import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { Mission } from "@/lib/mission-types";
import { broadcast } from "@/app/api/events/route";
import { reviewTask, executeNextTask } from "@/lib/mission-orchestrator";

// PATCH /api/missions/[id]/tasks/[taskId]
// Self-report endpoint for agents — fallback when the orchestrator's
// session-history polling doesn't pick up the TASK_COMPLETE marker
// (e.g. agent forgets the marker, or runs a long tool call after it).
//
// Body: { status: "done" | "failed", summary: string, sessionKey?: string }
//
// On "done": move the task to review and let Cap arbitrate.
// On "failed": mark task failed and try to advance the mission.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  try {
    const { id, taskId } = await params;
    const body = (await req.json()) as {
      status: "done" | "failed";
      summary: string;
      sessionKey?: string;
    };
    const now = new Date().toISOString();

    if (!body.status || !["done", "failed"].includes(body.status)) {
      return NextResponse.json(
        { ok: false, error: "status must be 'done' or 'failed'" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const doc = await db.collection("missions").findOne({ id });
    if (!doc) return NextResponse.json({ ok: false, error: "Mission not found" }, { status: 404 });

    const mission = doc as unknown as Mission;
    const taskIdx = mission.tasks.findIndex((t) => t.id === taskId);
    if (taskIdx === -1) {
      return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    }

    const task = mission.tasks[taskIdx];

    if (body.status === "done") {
      const updatedTasks = mission.tasks.map((t, i) =>
        i === taskIdx
          ? {
              ...t,
              status: "review" as const,
              output: body.summary,
              completedAt: now,
              updatedAt: now,
              sessionKey: body.sessionKey ?? t.sessionKey,
            }
          : t,
      );

      await db.collection("missions").updateOne(
        { id },
        { $set: { tasks: updatedTasks, updatedAt: now } },
      );

      broadcast({
        id: `evt-${Date.now()}`,
        type: "task_completed",
        workspaceId: mission.workspaceId,
        missionId: id,
        taskId: task.id,
        agentId: task.agentId,
        agentName: task.agentName,
        title: `${task.agentName} self-reported: "${task.title}" — sending to Cap`,
        detail: body.summary.slice(0, 300),
        timestamp: now,
      });

      void reviewTask(id, task.id).catch((err) =>
        console.error("[tasks/PATCH] reviewTask failed:", err),
      );
    } else {
      const updatedTasks = mission.tasks.map((t, i) =>
        i === taskIdx
          ? {
              ...t,
              status: "failed" as const,
              output: body.summary,
              errorMessage: body.summary,
              completedAt: now,
              updatedAt: now,
              sessionKey: body.sessionKey ?? t.sessionKey,
            }
          : t,
      );

      await db.collection("missions").updateOne(
        { id },
        { $set: { tasks: updatedTasks, updatedAt: now } },
      );

      broadcast({
        id: `evt-${Date.now()}`,
        type: "task_failed",
        workspaceId: mission.workspaceId,
        missionId: id,
        taskId: task.id,
        agentId: task.agentId,
        agentName: task.agentName,
        title: `${task.agentName} reported failure: "${task.title}"`,
        detail: body.summary.slice(0, 300),
        timestamp: now,
      });

      void executeNextTask(id).catch((err) =>
        console.error("[tasks/PATCH] executeNextTask failed:", err),
      );
    }

    const updated = await db.collection("missions").findOne({ id });
    const { _id, ...updatedMission } = updated!;
    void _id;

    return NextResponse.json({ ok: true, mission: updatedMission });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

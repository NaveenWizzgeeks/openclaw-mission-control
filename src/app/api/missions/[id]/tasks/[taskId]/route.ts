import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { Mission, TaskSummary } from "@/lib/mission-types";
import { broadcast } from "@/app/api/events/route";

// Called by agents when they finish a task.
// Body: { status: "done" | "failed", summary: string, sessionKey?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params;
    const body = await req.json() as { status: "done" | "failed"; summary: string; sessionKey?: string };
    const now = new Date().toISOString();

    if (!body.status || !["done", "failed"].includes(body.status)) {
      return NextResponse.json({ ok: false, error: "status must be 'done' or 'failed'" }, { status: 400 });
    }

    const db = await getDb();
    const doc = await db.collection("missions").findOne({ id });
    if (!doc) return NextResponse.json({ ok: false, error: "Mission not found" }, { status: 404 });

    const mission = doc as unknown as Mission;
    const taskIdx = mission.tasks.findIndex((t) => t.id === taskId);
    if (taskIdx === -1) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });

    const task = mission.tasks[taskIdx];

    // Update task in place
    const updatedTasks = mission.tasks.map((t, i) =>
      i === taskIdx
        ? {
            ...t,
            status: body.status,
            output: body.summary,
            completedAt: now,
            updatedAt: now,
            sessionKey: body.sessionKey ?? t.sessionKey,
          }
        : t
    );

    // Build task summary for mission memory
    const newSummary: TaskSummary = {
      taskId: task.id,
      taskTitle: task.title,
      agentId: task.agentId,
      agentName: task.agentName,
      summary: body.summary,
      completedAt: now,
      sessionKey: body.sessionKey ?? task.sessionKey,
    };
    const taskSummaries = [...(mission.taskSummaries ?? []), newSummary];

    // Determine next mission status
    const remaining = updatedTasks.filter((t) => t.status === "pending");
    const anyFailed = updatedTasks.some((t) => t.status === "failed");
    let nextMissionStatus: Mission["status"] = "executing";
    if (remaining.length === 0) {
      nextMissionStatus = anyFailed ? "paused" : "done";
    }

    await db.collection("missions").updateOne(
      { id },
      {
        $set: {
          tasks: updatedTasks,
          taskSummaries,
          status: nextMissionStatus,
          updatedAt: now,
        },
      }
    );

    const eventType = body.status === "done" ? "task_completed" : "task_failed";
    broadcast({
      id: `evt-${Date.now()}`,
      type: eventType,
      workspaceId: mission.workspaceId,
      missionId: id,
      taskId: task.id,
      agentId: task.agentId,
      agentName: task.agentName,
      title: body.status === "done"
        ? `${task.agentName} completed: "${task.title}"`
        : `${task.agentName} failed: "${task.title}"`,
      detail: body.summary,
      timestamp: now,
    });

    if (nextMissionStatus === "done") {
      broadcast({
        id: `evt-${Date.now()}-done`,
        type: "mission_done",
        workspaceId: mission.workspaceId,
        missionId: id,
        title: `Mission "${mission.title}" complete! All ${mission.tasks.length} tasks done.`,
        timestamp: now,
      });
    }

    const updated = await db.collection("missions").findOne({ id });
    const { _id, ...updatedMission } = updated!;
    void _id;

    return NextResponse.json({ ok: true, mission: updatedMission });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

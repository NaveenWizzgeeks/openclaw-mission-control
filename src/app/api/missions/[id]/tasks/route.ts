import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { Mission, MissionTask } from "@/lib/mission-types";
import { broadcast } from "@/app/api/events/route";
import { executeNextTask } from "@/lib/mission-orchestrator";
import { SQUAD } from "@/lib/team-store";

// POST /api/missions/[id]/tasks
// Add a new task to an existing mission. Useful for change requests
// after reviewing partial output.
//
// Body: {
//   title: string;
//   description: string;
//   agentId?: string;            // defaults to "vision"
//   insertAfterSequence?: number; // 1-based; defaults to "append at end"
// }
//
// Behavior:
// - Shifts sequenceNumbers of existing tasks at/after the insertion point
// - Inserts new task with status "pending", isUserAdded: true
// - If mission was "done", flips to "executing" and re-fires the orchestrator
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as {
      title: string;
      description: string;
      agentId?: string;
      insertAfterSequence?: number;
    };

    if (!body.title || !body.description) {
      return NextResponse.json(
        { ok: false, error: "title and description are required" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const now = new Date().toISOString();

    const doc = await db.collection("missions").findOne({ id });
    if (!doc) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    const mission = doc as unknown as Mission;

    const validAgentIds = new Set(SQUAD.map((a) => a.id));
    const agentId = body.agentId && validAgentIds.has(body.agentId) ? body.agentId : "vision";
    const agent = SQUAD.find((a) => a.id === agentId)!;

    const existing = [...(mission.tasks ?? [])].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    // Determine insertion point
    const insertAt =
      body.insertAfterSequence !== undefined
        ? body.insertAfterSequence + 1
        : existing.length === 0
        ? 1
        : existing[existing.length - 1].sequenceNumber + 1;

    // Shift sequence numbers for tasks at/after the insert point
    const shifted = existing.map((t) =>
      t.sequenceNumber >= insertAt
        ? { ...t, sequenceNumber: t.sequenceNumber + 1, updatedAt: now }
        : t,
    );

    const newTask: MissionTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      missionId: id,
      workspaceId: mission.workspaceId,
      title: body.title,
      description: body.description,
      agentId,
      agentName: agent.name,
      sequenceNumber: insertAt,
      status: "pending",
      isUserAdded: true,
      retryCount: 0,
      dependsOn: [],
      createdAt: now,
      updatedAt: now,
    };

    const updatedTasks = [...shifted, newTask].sort(
      (a, b) => a.sequenceNumber - b.sequenceNumber,
    );

    // If mission was done, flip to executing so the orchestrator picks it up
    const reactivate = mission.status === "done";
    const nextStatus: Mission["status"] = reactivate ? "executing" : mission.status;

    await db.collection("missions").updateOne(
      { id },
      {
        $set: {
          tasks: updatedTasks,
          status: nextStatus,
          updatedAt: now,
        },
      },
    );

    broadcast({
      id: `evt-${Date.now()}-add`,
      type: "task_added",
      workspaceId: mission.workspaceId,
      missionId: id,
      taskId: newTask.id,
      agentId,
      agentName: agent.name,
      title: `Task added at position ${insertAt}: "${newTask.title}"`,
      detail: `Assigned to ${agent.name}${reactivate ? " — mission reactivated" : ""}`,
      timestamp: now,
    });

    if (reactivate) {
      void executeNextTask(id).catch((err) => {
        console.error("[tasks/POST] orchestrator error on reactivation:", err);
      });
    }

    return NextResponse.json({ ok: true, task: newTask });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

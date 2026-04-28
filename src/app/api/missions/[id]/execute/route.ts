import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { Mission } from "@/lib/mission-types";
import { broadcast } from "@/app/api/events/route";
import { executeNextTask } from "@/lib/mission-orchestrator";

// POST /api/missions/[id]/execute
// Kicks off (or resumes) sequential execution of a planned mission.
// The orchestrator runs in the background and will:
//  - spawn an isolated session per task (label: agentId-task-taskId)
//  - poll session history for the TASK_COMPLETE marker
//  - run Cap review on each completed task
//  - retry rejected tasks up to 3 times
//  - chain into the next task automatically
//  - compile a final Jarvis report when all tasks are done
//
// This endpoint returns immediately after starting the orchestrator.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await getDb();
    const now = new Date().toISOString();

    const doc = await db.collection("missions").findOne({ id });
    if (!doc) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    const mission = doc as unknown as Mission;

    if (!["planned", "queued", "paused", "executing"].includes(mission.status)) {
      return NextResponse.json(
        { ok: false, error: `Cannot execute mission in status: ${mission.status}` },
        { status: 400 },
      );
    }

    if (!mission.tasks || mission.tasks.length === 0) {
      return NextResponse.json({ ok: false, error: "No tasks to execute" }, { status: 400 });
    }

    const remaining = mission.tasks.filter((t) => t.status !== "done" && t.status !== "failed");
    if (remaining.length === 0) {
      await db.collection("missions").updateOne(
        { id },
        { $set: { status: "done", updatedAt: now } },
      );
      broadcast({
        id: `evt-${Date.now()}`,
        type: "mission_done",
        workspaceId: mission.workspaceId,
        missionId: id,
        title: `Mission "${mission.title}" complete!`,
        timestamp: now,
      });
      return NextResponse.json({ ok: true, status: "done" });
    }

    if (mission.status !== "executing") {
      await db.collection("missions").updateOne(
        { id },
        { $set: { status: "executing", updatedAt: now } },
      );
    }

    // Fire the orchestrator in the background — do not await
    void executeNextTask(id).catch((err) => {
      console.error("[execute] orchestrator error:", err);
    });

    return NextResponse.json({ ok: true, status: "executing" });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

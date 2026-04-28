import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { Mission } from "@/lib/mission-types";
import { broadcast } from "@/app/api/events/route";
import { runPlanning } from "@/lib/mission-orchestrator";

// POST /api/missions/[id]/plan
// Triggers real AI-driven task planning by Fury.
// Reads the mission's clarification Q&A, asks Fury to break it into tasks,
// parses Fury's JSON, and saves the resulting tasks into mission.tasks.
//
// On success: mission.status = "planned", tasks populated, plan event broadcast.
// On failure: mission.status = "planning_failed", planError set, error event broadcast.
//
// Designed to be called fire-and-forget from the clarify route after the
// final clarification answer.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();

  const doc = await db.collection("missions").findOne({ id });
  if (!doc) {
    return NextResponse.json({ ok: false, error: "Mission not found" }, { status: 404 });
  }
  const { _id, ...rest } = doc;
  void _id;
  const mission = rest as unknown as Mission;
  if (!mission.taskSummaries) mission.taskSummaries = [];

  if (mission.status !== "analyzing" && mission.status !== "planning_failed") {
    return NextResponse.json(
      { ok: false, error: `Cannot plan from status: ${mission.status}` },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();

  broadcast({
    id: `evt-${Date.now()}-plan-start`,
    type: "planning_started",
    workspaceId: mission.workspaceId,
    missionId: id,
    agentId: "fury",
    agentName: "Fury",
    title: `Fury is breaking "${mission.title}" into tasks`,
    timestamp: now,
  });

  try {
    const result = await runPlanning(id);

    await db.collection("missions").updateOne(
      { id },
      {
        $set: {
          tasks: result.tasks,
          status: "planned",
          planningSessionKey: result.sessionKey,
          planError: undefined,
          updatedAt: new Date().toISOString(),
        },
      },
    );

    broadcast({
      id: `evt-${Date.now()}-plan-done`,
      type: "tasks_created",
      workspaceId: mission.workspaceId,
      missionId: id,
      agentId: "fury",
      agentName: "Fury",
      title: `${result.tasks.length} tasks planned for "${mission.title}"`,
      detail: result.tasks
        .map((t) => `• ${t.sequenceNumber}. ${t.title} → ${t.agentName}`)
        .join("\n"),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, tasksCreated: result.tasks.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[plan] Fury planning failed:", msg);

    await db.collection("missions").updateOne(
      { id },
      {
        $set: {
          status: "planning_failed",
          planError: msg,
          updatedAt: new Date().toISOString(),
        },
      },
    );

    broadcast({
      id: `evt-${Date.now()}-plan-fail`,
      type: "planning_failed",
      workspaceId: mission.workspaceId,
      missionId: id,
      agentId: "fury",
      agentName: "Fury",
      title: `Planning failed for "${mission.title}"`,
      detail: msg.slice(0, 400),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

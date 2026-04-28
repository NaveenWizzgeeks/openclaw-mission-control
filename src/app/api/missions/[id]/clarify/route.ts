import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { Mission, ClarificationMessage } from "@/lib/mission-types";
import { broadcast } from "@/app/api/events/route";
import { runPlanningInBackground } from "@/lib/mission-orchestrator";

// POST /api/missions/[id]/clarify
// Records the user's answer to the next outstanding clarification question.
// When all questions are answered, transitions mission to "analyzing" and
// fires AI planning (Fury) in the background.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { answer: string };
    const db = await getDb();
    const now = new Date().toISOString();

    const doc = await db.collection("missions").findOne({ id });
    if (!doc) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    const mission = doc as unknown as Mission;

    const userMsg: ClarificationMessage = {
      id: `cm-${Date.now()}`,
      role: "user",
      content: body.answer,
      createdAt: now,
    };

    const updatedClarification = [...mission.clarification, userMsg];
    const agentQuestions = updatedClarification.filter((m) => m.role === "agent").length;
    const userAnswers = updatedClarification.filter((m) => m.role === "user").length;
    const allAnswered = userAnswers >= agentQuestions;

    let newStatus: Mission["status"] = mission.status;
    if (allAnswered) {
      newStatus = "analyzing";
    }

    await db.collection("missions").updateOne(
      { id },
      {
        $set: {
          clarification: updatedClarification,
          status: newStatus,
          updatedAt: now,
        },
      },
    );

    if (allAnswered) {
      broadcast({
        id: `evt-${Date.now()}-analyzing`,
        type: "mission_analyzing",
        workspaceId: mission.workspaceId,
        missionId: id,
        agentId: mission.analystId ?? "fury",
        agentName: mission.analystName ?? "Fury",
        title: `All clarifications received — Fury is now analyzing`,
        timestamp: now,
      });

      // Fire AI planning in the background — do NOT await.
      // The background task updates mission status to "planned" or "planning_failed".
      void runPlanningInBackground(id, mission.workspaceId);
    } else {
      broadcast({
        id: `evt-${Date.now()}-answer`,
        type: "answer_given",
        workspaceId: mission.workspaceId,
        missionId: id,
        title: `You answered question ${userAnswers}/${agentQuestions}`,
        timestamp: now,
      });
    }

    const updated = await db.collection("missions").findOne({ id });
    const { _id, ...updatedMission } = updated!;
    void _id;

    return NextResponse.json({
      ok: true,
      mission: updatedMission,
      allAnswered,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}


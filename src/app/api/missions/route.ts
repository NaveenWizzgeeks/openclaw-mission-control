import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { Mission } from "@/lib/mission-types";
import { broadcast } from "@/app/api/events/route";
import { SQUAD } from "@/lib/team-store";
import { runShuriClarification } from "@/lib/mission-orchestrator";

// Pick the best analyst for a mission based on description keywords
function pickAnalyst(description: string) {
  const text = description.toLowerCase();
  if (/research|investigate|study|explore|market|competitor/.test(text)) {
    return SQUAD.find((a) => a.id === "banner") ?? SQUAD.find((a) => a.id === "shuri")!;
  }
  if (/security|vuln|audit|pentest/.test(text)) {
    return SQUAD.find((a) => a.id === "hawkeye")!;
  }
  if (/deploy|ci|docker|infra/.test(text)) {
    return SQUAD.find((a) => a.id === "rocket")!;
  }
  return SQUAD.find((a) => a.id === "shuri")!; // default: product analyst
}

function backfillMission(m: Record<string, unknown>): Mission {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { taskSummaries: [], ...(m as any) } as Mission;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");
    const db = await getDb();
    const filter = workspaceId ? { workspaceId } : {};
    const docs = await db.collection("missions").find(filter).sort({ createdAt: -1 }).toArray();
    const missions = docs.map(({ _id, ...m }) => { void _id; return backfillMission(m); });
    return NextResponse.json({ ok: true, missions });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { title: string; description: string; workspaceId: string };
    const now = new Date().toISOString();
    const db = await getDb();

    // Pick analyst agent (drives clarification phase only — Fury handles planning)
    const analyst = pickAnalyst(body.description);

    const mission: Mission = {
      id: `msn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      workspaceId: body.workspaceId,
      title: body.title,
      description: body.description,
      status: "clarification",
      analystId: analyst.id,
      analystName: analyst.name,
      // Empty for now — Shuri's session will populate this dynamically
      clarification: [],
      researchNotes: "",
      tasks: [],
      taskSummaries: [],
      currentTaskIndex: 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("missions").insertOne({ ...mission });

    // Add to workspace queue
    await db.collection("workspaces").updateOne(
      { id: body.workspaceId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { $push: { missionQueue: mission.id } as any, $set: { updatedAt: now } }
    );

    broadcast({
      id: `evt-${Date.now()}`,
      type: "mission_created",
      workspaceId: body.workspaceId,
      missionId: mission.id,
      agentId: analyst.id,
      agentName: analyst.name,
      title: `Mission received: "${body.title}"`,
      detail: `${analyst.name} is analyzing whether clarification is needed`,
      timestamp: now,
    });

    // Spawn Shuri session in background — she decides whether questions are
    // needed and what to ask. If none needed, she'll fast-track to Fury.
    void runShuriClarification(mission.id).catch((err) => {
      console.error("[missions/POST] runShuriClarification error:", err);
    });

    return NextResponse.json({ ok: true, mission });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

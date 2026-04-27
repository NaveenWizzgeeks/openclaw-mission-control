import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { Mission, ClarificationMessage } from "@/lib/mission-types";
import { broadcast } from "@/app/api/events/route";
import { SQUAD } from "@/lib/team-store";

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

// Generate initial clarifying questions from the analyst
function generateClarifyingQuestions(analyst: typeof SQUAD[0], missionTitle: string): ClarificationMessage[] {
  const now = new Date().toISOString();
  const questions: string[] = [];

  questions.push(
    `Hi! I'm ${analyst.name}, your ${analyst.title}. To make sure we build exactly what you need, I have a few questions about the mission:\n\n` +
    `**1.** What is the primary outcome you want from "${missionTitle}"? What does "done" look like?`
  );
  questions.push(
    `**2.** Are there any existing systems, codebases, or constraints I should be aware of?`
  );
  questions.push(
    `**3.** Who are the end users or stakeholders? Any specific requirements or preferences from them?`
  );
  questions.push(
    `**4.** What is the rough timeframe or deadline, and are there any hard technical constraints (language, framework, infra)?`
  );

  return questions.map((content, i) => ({
    id: `cq-${Date.now()}-${i}`,
    role: "agent" as const,
    agentId: analyst.id,
    agentName: analyst.name,
    content,
    createdAt: now,
  }));
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

    // Pick analyst agent
    const analyst = pickAnalyst(body.description);
    const initialQuestions = generateClarifyingQuestions(analyst, body.title);

    const mission: Mission = {
      id: `msn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      workspaceId: body.workspaceId,
      title: body.title,
      description: body.description,
      status: "clarification",
      analystId: analyst.id,
      analystName: analyst.name,
      clarification: initialQuestions,
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
      detail: `${analyst.name} will gather requirements`,
      timestamp: now,
    });

    broadcast({
      id: `evt-${Date.now()}-cla`,
      type: "clarification_started",
      workspaceId: body.workspaceId,
      missionId: mission.id,
      agentId: analyst.id,
      agentName: analyst.name,
      title: `${analyst.name} asking clarifying questions`,
      timestamp: now,
    });

    return NextResponse.json({ ok: true, mission });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { Mission, ClarificationMessage, MissionTask } from "@/lib/mission-types";
import { broadcast } from "@/app/api/events/route";
import { SQUAD } from "@/lib/team-store";
import { inferSpecialty } from "@/lib/team-store";

// After all questions answered, analyst creates task plan
function generateTaskPlan(mission: Mission): MissionTask[] {
  const now = new Date().toISOString();

  // Build tasks based on mission description + answers
  const text = `${mission.title} ${mission.description}`.toLowerCase();

  // Determine task breakdown strategy based on specialty
  const tasks: Array<{ title: string; description: string; agentId: string }> = [];

  // Always start with analysis/requirements
  tasks.push({
    title: `Analyze requirements for: ${mission.title}`,
    description: `Deep-dive analysis of all requirements gathered. Review all clarification answers and produce a technical specification.`,
    agentId: "shuri",
  });

  // Architecture/design if complex feature
  if (/build|create|implement|design|api|system|app/.test(text)) {
    tasks.push({
      title: `Design architecture for: ${mission.title}`,
      description: `Design the system architecture, data models, and API contracts based on requirements.`,
      agentId: "stark",
    });
  }

  // Security audit if needed
  if (/security|auth|user|login|payment|data/.test(text)) {
    tasks.push({
      title: `Security review: ${mission.title}`,
      description: `Review security requirements, identify attack surfaces, and define security controls.`,
      agentId: "hawkeye",
    });
  }

  // Main implementation
  tasks.push({
    title: `Implement: ${mission.title}`,
    description: `Core implementation based on the architecture design and requirements specification.`,
    agentId: "vision",
  });

  // QA
  tasks.push({
    title: `QA & validation: ${mission.title}`,
    description: `Test all functionality, validate against requirements, check edge cases and regression.`,
    agentId: "cap",
  });

  // DevOps if deployment related
  if (/deploy|ci|docker|prod|release/.test(text)) {
    tasks.push({
      title: `Deploy: ${mission.title}`,
      description: `Set up CI/CD, containerize, and deploy to production environment.`,
      agentId: "rocket",
    });
  }

  // Documentation
  tasks.push({
    title: `Document: ${mission.title}`,
    description: `Write technical documentation, API reference, and user guide.`,
    agentId: "loki",
  });

  return tasks.map((t, i) => {
    const agent = SQUAD.find((a) => a.id === t.agentId) ?? SQUAD[0];
    return {
      id: `task-${Date.now()}-${i}`,
      missionId: mission.id,
      workspaceId: mission.workspaceId,
      title: t.title,
      description: t.description,
      agentId: agent.id,
      agentName: agent.name,
      sequenceNumber: i + 1,
      status: "pending" as const,
      createdAt: now,
      updatedAt: now,
    };
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json() as { answer: string };
    const db = await getDb();
    const now = new Date().toISOString();

    const doc = await db.collection("missions").findOne({ id });
    if (!doc) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    const mission = doc as unknown as Mission;

    // Add user answer
    const userMsg: ClarificationMessage = {
      id: `cm-${Date.now()}`,
      role: "user",
      content: body.answer,
      createdAt: now,
    };

    const updatedClarification = [...mission.clarification, userMsg];

    // Count how many agent questions and user answers we have
    const agentQuestions = updatedClarification.filter((m) => m.role === "agent");
    const userAnswers = updatedClarification.filter((m) => m.role === "user");

    let newStatus = mission.status;
    let newTasks = mission.tasks;
    let researchNotes = mission.researchNotes;

    if (userAnswers.length >= agentQuestions.length) {
      // All questions answered — analyst moves to planning
      newStatus = "analyzing";

      broadcast({
        id: `evt-${Date.now()}`,
        type: "planning_started",
        workspaceId: mission.workspaceId,
        missionId: id,
        agentId: mission.analystId ?? "shuri",
        agentName: mission.analystName ?? "Shuri",
        title: `${mission.analystName ?? "Analyst"} analyzing mission and creating task plan`,
        timestamp: now,
      });

      // Generate task plan
      newTasks = generateTaskPlan({ ...mission, clarification: updatedClarification });
      researchNotes = `Analyzed "${mission.title}" based on ${userAnswers.length} clarification rounds. Created ${newTasks.length} sequential tasks spanning requirements analysis, implementation, QA, and documentation.`;
      newStatus = "planned";

      broadcast({
        id: `evt-${Date.now()}-tasks`,
        type: "tasks_created",
        workspaceId: mission.workspaceId,
        missionId: id,
        agentId: "jarvis",
        agentName: "Jarvis",
        title: `${newTasks.length} tasks planned by ${mission.analystName}`,
        detail: newTasks.map((t) => `• ${t.title} → ${t.agentName}`).join("\n"),
        timestamp: now,
      });
    } else {
      broadcast({
        id: `evt-${Date.now()}`,
        type: "answer_given",
        workspaceId: mission.workspaceId,
        missionId: id,
        title: `You answered question ${userAnswers.length}/${agentQuestions.length}`,
        timestamp: now,
      });
    }

    await db.collection("missions").updateOne(
      { id },
      {
        $set: {
          clarification: updatedClarification,
          status: newStatus,
          tasks: newTasks,
          researchNotes,
          updatedAt: now,
        },
      }
    );

    const updated = await db.collection("missions").findOne({ id });
    const { _id, ...updatedMission } = updated!;
    void _id;

    return NextResponse.json({ ok: true, mission: updatedMission, allAnswered: userAnswers.length >= agentQuestions.length });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// Suppress unused import warning
void inferSpecialty;

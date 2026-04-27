import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { Mission, Workspace } from "@/lib/mission-types";
import { broadcast } from "@/app/api/events/route";
import { callGateway } from "@/lib/openclaw-gateway";

function buildMissionContext(mission: Mission, workspace: Workspace | null): string {
  const wsPath = workspace?.path ?? "/home/wizzgeeks/.openclaw/workspace";
  const wsName = workspace?.name ?? "Main Workspace";
  const mcUrl = process.env.MISSION_CONTROL_URL ?? "http://localhost:3000";

  const task = mission.tasks.find((t) => t.status === "in_progress");
  if (!task) return "";

  const previousWork = mission.taskSummaries.length > 0
    ? `\n## COMPLETED TASKS (your memory of previous work)\n\n${mission.taskSummaries.map((s, i) =>
        `### Step ${i + 1}: ${s.taskTitle} — by ${s.agentName}\n${s.summary}`
      ).join("\n\n")}\n`
    : "\n## COMPLETED TASKS\nNone yet — you are the first agent on this mission.\n";

  return `# MISSION BRIEFING: ${mission.title}

## WORKSPACE
Name: ${wsName}
Path: ${wsPath}

## MISSION OBJECTIVE
${mission.description}

## ANALYST NOTES
${mission.researchNotes || "No analyst notes yet."}
${previousWork}
## YOUR TASK — Task ${task.sequenceNumber} of ${mission.tasks.length}
**Agent:** ${task.agentName}
**Title:** ${task.title}
**Description:** ${task.description}

## IMPORTANT RULES
1. You are working ONLY on the task assigned to you above.
2. Do NOT attempt other tasks in this mission — each task runs sequentially.
3. Do NOT reference or work on missions in other workspaces.
4. Keep your work within this workspace path: ${wsPath}
5. When you finish (success or failure), report back immediately:

   **On success** — POST ${mcUrl}/api/missions/${mission.id}/tasks/${task.id}
   Body: { "status": "done", "summary": "Concise description of what you built/did" }

   **On failure** — POST ${mcUrl}/api/missions/${mission.id}/tasks/${task.id}
   Body: { "status": "failed", "summary": "What went wrong and why" }

Begin your task now. Stay focused — do only what is described in YOUR TASK above.`;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await getDb();
    const now = new Date().toISOString();

    const doc = await db.collection("missions").findOne({ id });
    if (!doc) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    const mission = doc as unknown as Mission;

    if (!["planned", "queued", "paused"].includes(mission.status)) {
      return NextResponse.json({ ok: false, error: `Cannot execute mission in status: ${mission.status}` }, { status: 400 });
    }

    if (mission.tasks.length === 0) {
      return NextResponse.json({ ok: false, error: "No tasks to execute" }, { status: 400 });
    }

    // Find first pending task
    const nextTaskIdx = mission.tasks.findIndex((t) => t.status === "pending");
    if (nextTaskIdx === -1) {
      await db.collection("missions").updateOne(
        { id },
        { $set: { status: "done", updatedAt: now } }
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

    const task = mission.tasks[nextTaskIdx];
    const updatedTasks = mission.tasks.map((t, i) =>
      i === nextTaskIdx ? { ...t, status: "in_progress" as const, startedAt: now, updatedAt: now } : t
    );

    // Prepare mission with in_progress task so context builder sees it
    const missionWithTask: Mission = { ...mission, tasks: updatedTasks, taskSummaries: mission.taskSummaries ?? [] };

    // Fetch workspace for path/name context
    const wsDoc = await db.collection("workspaces").findOne({ id: mission.workspaceId });
    const workspace = wsDoc ? (wsDoc as unknown as Workspace) : null;

    // Spawn an OpenClaw session with full mission context
    let sessionKey: string | undefined;
    try {
      const contextPrompt = buildMissionContext(missionWithTask, workspace);
      const spawnResult = await callGateway<Record<string, unknown>>("sessions.create", {
        task: contextPrompt,
        label: `mission-${id}-task-${task.sequenceNumber}`,
        agentId: task.agentId !== "jarvis" ? task.agentId : undefined,
      });
      sessionKey = (spawnResult.sessionKey ?? spawnResult.key ?? spawnResult.sessionId ?? "") as string;
    } catch (spawnErr) {
      console.warn("Could not spawn OpenClaw session:", spawnErr);
    }

    const finalTasks = updatedTasks.map((t, i) =>
      i === nextTaskIdx ? { ...t, sessionKey: sessionKey ?? t.sessionKey } : t
    );

    await db.collection("missions").updateOne(
      { id },
      { $set: { status: "executing", tasks: finalTasks, currentTaskIndex: nextTaskIdx, updatedAt: now } }
    );

    broadcast({
      id: `evt-${Date.now()}`,
      type: "task_started",
      workspaceId: mission.workspaceId,
      missionId: id,
      taskId: task.id,
      agentId: task.agentId,
      agentName: task.agentName,
      title: `${task.agentName} started: "${task.title}"`,
      detail: `Task ${task.sequenceNumber} of ${mission.tasks.length}${sessionKey ? ` · session ${sessionKey}` : ""}`,
      timestamp: now,
    });

    const updated = await db.collection("missions").findOne({ id });
    const { _id, ...updatedMission } = updated!;
    void _id;

    return NextResponse.json({ ok: true, mission: updatedMission, currentTask: { ...task, sessionKey } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

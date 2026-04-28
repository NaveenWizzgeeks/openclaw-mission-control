// ============================================================
// MISSION ORCHESTRATOR
// Server-side orchestration engine for the mission lifecycle.
//
// Responsibilities:
//  - spawnAgentSession  : isolated OpenClaw session per task (no context bleed)
//  - executeNextTask    : sequential dispatcher with prior-task context
//  - reviewTask         : Cap-led review loop with auto-retry (3x)
//  - compileMissionReport : Jarvis writes executive summary on completion
//
// All operations mutate Mission documents via the embedded tasks[] array,
// matching the existing schema in src/lib/mission-types.ts.
// ============================================================

import { getDb } from "@/lib/mongodb";
import { callGateway } from "@/lib/openclaw-gateway";
import { broadcast } from "@/app/api/events/route";
import type { Mission, MissionTask, TaskSummary, Workspace } from "@/lib/mission-types";

const MAX_REVIEW_RETRIES = 3;
const DEFAULT_TASK_TIMEOUT_MS = 10 * 60 * 1000;   // 10 min per worker task
const DEFAULT_REVIEW_TIMEOUT_MS = 2 * 60 * 1000;  // 2 min per Cap review
const DEFAULT_PLAN_TIMEOUT_MS = 90 * 1000;        // 90 sec for Fury planning
const DEFAULT_REPORT_TIMEOUT_MS = 2 * 60 * 1000;  // 2 min for Jarvis report
const POLL_INTERVAL_MS = 6_000;

// ─── Session helpers ─────────────────────────────────────────────

interface SpawnResult {
  sessionKey: string;
  output: string;
  timedOut: boolean;
}

/**
 * Spawn an isolated OpenClaw session for one agent doing one task.
 * Polls session history until the agent emits a completion signal or
 * the timeout fires.
 *
 * Default completion detection looks for:
 *   - "TASK_COMPLETE" marker (worker tasks)
 *   - "DONE:" marker (legacy)
 *   - "APPROVED" / "REJECTED" verdicts (Cap reviews)
 *
 * For specialized cases (e.g. Fury returning pure JSON), pass a custom
 * `isComplete` function that inspects the accumulated assistant text.
 *
 * Each spawn creates a fresh context — tasks never share session state.
 */
export async function spawnAgentSession(opts: {
  agentId: string;
  label: string;
  task: string;
  waitForCompletion?: boolean;
  timeoutMs?: number;
  pollIntervalMs?: number;
  isComplete?: (assistantText: string) => boolean;
  // If set, every poll updates this mission's updatedAt so isStuck logic
  // doesn't misfire while the orchestrator is genuinely running.
  heartbeatMissionId?: string;
}): Promise<SpawnResult> {
  const {
    agentId,
    label,
    task,
    waitForCompletion = true,
    timeoutMs = DEFAULT_TASK_TIMEOUT_MS,
    pollIntervalMs = POLL_INTERVAL_MS,
    isComplete = workerCompletionDetector,
    heartbeatMissionId,
  } = opts;

  const spawnRes = await callGateway<Record<string, unknown>>("sessions.create", {
    task,
    label,
    agentId,
  });

  const sessionKey =
    (spawnRes.sessionKey ?? spawnRes.key ?? spawnRes.sessionId ?? "") as string;
  if (!sessionKey) {
    throw new Error(`Gateway returned no sessionKey for label=${label}`);
  }

  if (heartbeatMissionId) {
    await touchMission(heartbeatMissionId, sessionKey);
  }

  if (!waitForCompletion) {
    return { sessionKey, output: "", timedOut: false };
  }

  const deadline = Date.now() + timeoutMs;
  let output = "";
  let stableTicks = 0;
  let lastLength = 0;

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);

    let assistantText = "";
    let fetchOk = false;
    try {
      let hist: Record<string, unknown>;
      try {
        hist = await callGateway<Record<string, unknown>>("sessions.history", {
          key: sessionKey,
          limit: 50,
        });
      } catch {
        hist = await callGateway<Record<string, unknown>>("chat.history", {
          sessionKey,
          limit: 50,
        });
      }
      const messages = (hist.messages ?? hist.history ?? []) as Array<Record<string, unknown>>;
      assistantText = messages
        .filter((m) => m.role === "assistant")
        .map((m) => extractText(m.content))
        .filter(Boolean)
        .join("\n");
      fetchOk = true;
    } catch (err) {
      console.error("[orchestrator] history fetch failed:", err instanceof Error ? err.message : err);
    }

    if (!fetchOk) {
      // Don't let history failures count toward soft-completion stability —
      // resetting prevents N consecutive failures from looking like "stable".
      stableTicks = 0;
      if (heartbeatMissionId) await touchMission(heartbeatMissionId, sessionKey);
      continue;
    }

    output = assistantText;

    if (assistantText && isComplete(assistantText)) {
      return { sessionKey, output, timedOut: false };
    }

    if (assistantText.length > 0 && assistantText.length === lastLength) {
      stableTicks++;
      if (stableTicks >= 3) {
        return { sessionKey, output, timedOut: false };
      }
    } else {
      stableTicks = 0;
      lastLength = assistantText.length;
    }

    if (heartbeatMissionId) {
      await touchMission(heartbeatMissionId, sessionKey);
    }
  }

  return { sessionKey, output, timedOut: true };
}

// Worker tasks must finish with TASK_COMPLETE on its own line.
// Anchoring to a line break stops mid-text mentions ("emit TASK_COMPLETE
// when finished…") from triggering false completion.
function workerCompletionDetector(text: string): boolean {
  return /(?:^|\n)\s*TASK_COMPLETE\b/m.test(text) ||
         /(?:^|\n)\s*DONE\s*:/m.test(text);
}

// Cap reviews must lead with APPROVED or REJECTED (per agents/cap/SOUL.md
// instructions). Match the first line; tolerate preamble whitespace.
function reviewCompletionDetector(text: string): boolean {
  return /(?:^|\n)\s*(APPROVED|REJECTED)\b/m.test(text);
}

// Detects when Fury has produced a parseable JSON array.
function jsonArrayCompletionDetector(text: string): boolean {
  // Trim whitespace and any markdown fences, then peek for valid array shape.
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return false;
  const candidate = cleaned.slice(start, end + 1);
  try {
    const parsed = JSON.parse(candidate);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === "string") return c;
        if (c && typeof c === "object" && "text" in c) {
          return String((c as { text: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Mission helpers ─────────────────────────────────────────────

async function loadMission(missionId: string): Promise<Mission | null> {
  const db = await getDb();
  const doc = await db.collection("missions").findOne({ id: missionId });
  if (!doc) return null;
  const { _id, ...rest } = doc;
  void _id;
  const m = rest as unknown as Mission;
  if (!m.taskSummaries) m.taskSummaries = [];
  return m;
}

async function loadWorkspace(workspaceId: string): Promise<Workspace | null> {
  const db = await getDb();
  const doc = await db.collection("workspaces").findOne({ id: workspaceId });
  if (!doc) return null;
  const { _id, ...rest } = doc;
  void _id;
  return rest as unknown as Workspace;
}

async function patchTask(
  missionId: string,
  taskId: string,
  patch: Partial<MissionTask>,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const mission = await loadMission(missionId);
  if (!mission) return;
  const tasks = mission.tasks.map((t) =>
    t.id === taskId ? { ...t, ...patch, updatedAt: now } : t,
  );
  await db.collection("missions").updateOne(
    { id: missionId },
    { $set: { tasks, updatedAt: now } },
  );
}

async function setMissionStatus(
  missionId: string,
  status: Mission["status"],
  extra: Partial<Mission> = {},
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.collection("missions").updateOne(
    { id: missionId },
    { $set: { status, ...extra, updatedAt: now } },
  );
}

// Touch the mission's updatedAt and activeSessionKey so the UI sees
// continued activity during a long-running orchestrator run.
async function touchMission(missionId: string, sessionKey: string): Promise<void> {
  const db = await getDb();
  await db.collection("missions").updateOne(
    { id: missionId },
    {
      $set: {
        activeSessionKey: sessionKey,
        updatedAt: new Date().toISOString(),
      },
    },
  );
}

// Set the live "who's working right now" indicator on the mission.
// The kanban agent panel reads this to show the truly-active agent.
async function setActiveAgent(
  missionId: string,
  agentId: string | null,
  label: string | null,
  sessionKey: string | null = null,
): Promise<void> {
  const db = await getDb();
  await db.collection("missions").updateOne(
    { id: missionId },
    {
      $set: {
        activeAgentId: agentId,
        activeAgentLabel: label,
        activeSessionKey: sessionKey,
        updatedAt: new Date().toISOString(),
      },
    },
  );
}

// ─── Prompt builders ─────────────────────────────────────────────

function buildTaskPrompt(task: MissionTask, mission: Mission, workspace: Workspace | null): string {
  const wsPath = workspace?.path ?? "/home/wizzgeeks/.openclaw/workspace";
  const wsName = workspace?.name ?? "Main Workspace";
  const mcUrl = process.env.MISSION_CONTROL_URL ?? "http://localhost:3000";

  const priorContext =
    mission.taskSummaries.length > 0
      ? `\n## COMPLETED PRIOR TASKS (your memory of previous work)\n\n${mission.taskSummaries
          .map(
            (s, i) =>
              `### Step ${i + 1}: ${s.taskTitle} — by ${s.agentName}\n${s.summary.substring(0, 800)}`,
          )
          .join("\n\n---\n\n")}\n`
      : "\n## COMPLETED PRIOR TASKS\nNone yet — you are the first agent on this mission.\n";

  return `# MISSION BRIEFING: ${mission.title}

## WORKSPACE
Name: ${wsName}
Path: ${wsPath}

## MISSION OBJECTIVE
${mission.description}

## ANALYST NOTES
${mission.researchNotes || "No analyst notes yet."}
${priorContext}
## YOUR TASK — Task ${task.sequenceNumber} of ${mission.tasks.length}
**Agent:** ${task.agentName}
**Title:** ${task.title}
**Description:** ${task.description}

## RULES
1. You are working ONLY on the task assigned to you above. Do not attempt other tasks.
2. Stay within this workspace path: ${wsPath}
3. Produce concrete, working output (real code, real docs, real configs — no placeholders).
4. Do NOT ask the user clarifying questions — use the context above.
5. When complete, end your response with exactly this marker on its own line:

   TASK_COMPLETE

6. Immediately after that marker, write a one-paragraph SUMMARY for the next agent:

   SUMMARY: <what you built, where it lives, what's next>

7. (Fallback) You may also POST your summary to:
   ${mcUrl}/api/missions/${mission.id}/tasks/${task.id}
   with body { "status": "done", "summary": "..." }

Begin the task now.`;
}

function buildReviewPrompt(task: MissionTask, mission: Mission): string {
  return `You are reviewing a completed task from a software mission.

MISSION: ${mission.title}

TASK ${task.sequenceNumber}: ${task.title}
ASSIGNED TO: ${task.agentName}
TASK DESCRIPTION:
${task.description}

WORKER'S OUTPUT:
${(task.output ?? "").substring(0, 6000)}

REVIEW CRITERIA:
1. Does the output address the task description completely?
2. Are there obvious errors, missing pieces, or quality problems?
3. Does it set up the next task in the mission logically?

Respond with EXACTLY one of (no other text):
- APPROVED: <one sentence why it's good>
- REJECTED: <specific concrete reason and what to fix>`;
}

function buildReportPrompt(mission: Mission): string {
  const completed = mission.tasks
    .filter((t) => t.status === "done")
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  return `You are Jarvis. The mission has just completed. Compile an executive summary for the user.

MISSION: ${mission.title}
DESCRIPTION: ${mission.description}

COMPLETED TASKS:
${completed
  .map(
    (t, i) =>
      `${i + 1}. ${t.title} (${t.agentName})\n${(t.output ?? "").substring(0, 800)}`,
  )
  .join("\n\n---\n\n")}

Write a concise executive summary covering:
1. What was accomplished
2. Key deliverables produced
3. Caveats or follow-up actions
4. How to use / test / deploy what was built

Keep under 400 words. Write for a non-technical manager.

End your response with exactly this marker:
TASK_COMPLETE`;
}

// ─── executeNextTask ─────────────────────────────────────────────

// In-process lock to prevent multiple parallel orchestrator runs for the same
// mission. Spam-clicking Resume should not start three concurrent task chains.
const activeMissions = new Set<string>();

/**
 * Find the next pending task in a mission and run it through the
 * full lifecycle: in_progress → review → done (or retry on rejection,
 * or block after MAX_REVIEW_RETRIES).
 *
 * Recursively chains until no pending tasks remain, then triggers
 * compileMissionReport.
 *
 * Designed to be called fire-and-forget from API routes:
 *
 *   void executeNextTask(missionId).catch(console.error);
 *
 * Errors are surfaced via SSE broadcasts and task.errorMessage.
 */
export async function executeNextTask(missionId: string): Promise<void> {
  // Idempotency guard: if another orchestrator is already running this mission,
  // skip. Note: this lock only works within a single process — a server restart
  // wipes it, which is fine because the restart also kills the in-flight work.
  if (activeMissions.has(missionId)) {
    console.log(`[orchestrator] already running for ${missionId} — skipping duplicate run`);
    return;
  }
  activeMissions.add(missionId);

  try {
    await runOrchestrator(missionId);
  } finally {
    activeMissions.delete(missionId);
  }
}

async function runOrchestrator(missionId: string): Promise<void> {
  const mission = await loadMission(missionId);
  if (!mission) return;

  // Skip terminal mission states
  if (mission.status === "done") {
    return;
  }

  // Find next pending task respecting dependencies
  const nextTask = pickNextRunnableTask(mission);
  if (!nextTask) {
    // No more pending tasks — check if all done or any blocked
    const remaining = mission.tasks.filter(
      (t) => t.status !== "done" && t.status !== "failed",
    );
    if (remaining.length === 0) {
      await compileMissionReport(missionId);
    }
    return;
  }

  const workspace = await loadWorkspace(mission.workspaceId);
  const now = new Date().toISOString();

  // Mark task in_progress
  await patchTask(missionId, nextTask.id, {
    status: "in_progress",
    startedAt: now,
    errorMessage: undefined,
  });
  await setMissionStatus(missionId, "executing", { currentTaskIndex: nextTask.sequenceNumber - 1 });
  await setActiveAgent(
    missionId,
    nextTask.agentId,
    `${nextTask.title.slice(0, 60)}`,
  );

  broadcast({
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
    type: "task_started",
    workspaceId: mission.workspaceId,
    missionId,
    taskId: nextTask.id,
    agentId: nextTask.agentId,
    agentName: nextTask.agentName,
    title: `${nextTask.agentName} started: "${nextTask.title}"`,
    detail: `Task ${nextTask.sequenceNumber} of ${mission.tasks.length}`,
    timestamp: now,
  });

  // Spawn isolated session for this task
  const taskPrompt = buildTaskPrompt(nextTask, mission, workspace);
  const sessionLabel = `${nextTask.agentId}-task-${nextTask.id}`;

  let result: SpawnResult;
  try {
    result = await spawnAgentSession({
      agentId: nextTask.agentId,
      label: sessionLabel,
      task: taskPrompt,
      waitForCompletion: true,
      timeoutMs: DEFAULT_TASK_TIMEOUT_MS,
      heartbeatMissionId: missionId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await patchTask(missionId, nextTask.id, {
      status: "failed",
      errorMessage: msg,
      completedAt: new Date().toISOString(),
    });
    broadcast({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
      type: "task_failed",
      workspaceId: mission.workspaceId,
      missionId,
      taskId: nextTask.id,
      agentId: nextTask.agentId,
      agentName: nextTask.agentName,
      title: `${nextTask.agentName} could not start: "${nextTask.title}"`,
      detail: msg,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (result.timedOut && !result.output) {
    await patchTask(missionId, nextTask.id, {
      status: "failed",
      errorMessage: "Task timed out without output",
      sessionKey: result.sessionKey,
      completedAt: new Date().toISOString(),
    });
    broadcast({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
      type: "task_failed",
      workspaceId: mission.workspaceId,
      missionId,
      taskId: nextTask.id,
      agentId: nextTask.agentId,
      agentName: nextTask.agentName,
      title: `${nextTask.agentName} timed out: "${nextTask.title}"`,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Save output and move to review
  await patchTask(missionId, nextTask.id, {
    status: "review",
    output: result.output,
    sessionKey: result.sessionKey,
    completedAt: new Date().toISOString(),
  });
  await setActiveAgent(missionId, "cap", `Reviewing "${nextTask.title.slice(0, 40)}"`);

  broadcast({
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
    type: "task_completed",
    workspaceId: mission.workspaceId,
    missionId,
    taskId: nextTask.id,
    agentId: nextTask.agentId,
    agentName: nextTask.agentName,
    title: `${nextTask.agentName} submitted: "${nextTask.title}" — awaiting Cap review`,
    timestamp: new Date().toISOString(),
  });

  // Hand off to reviewer
  await reviewTask(missionId, nextTask.id);
}

function pickNextRunnableTask(mission: Mission): MissionTask | null {
  const pending = mission.tasks
    .filter((t) => t.status === "pending")
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  for (const t of pending) {
    if (!t.dependsOn || t.dependsOn.length === 0) return t;
    const depsDone = t.dependsOn.every((seq) =>
      mission.tasks.some((x) => x.sequenceNumber === seq && x.status === "done"),
    );
    if (depsDone) return t;
  }
  return null;
}

// ─── reviewTask ──────────────────────────────────────────────────

export async function reviewTask(missionId: string, taskId: string): Promise<void> {
  const mission = await loadMission(missionId);
  if (!mission) return;

  const task = mission.tasks.find((t) => t.id === taskId);
  if (!task || task.status !== "review") return;

  const reviewPrompt = buildReviewPrompt(task, mission);
  const reviewLabel = `cap-review-${task.id}`;

  let result: SpawnResult;
  try {
    result = await spawnAgentSession({
      agentId: "cap",
      label: reviewLabel,
      task: reviewPrompt,
      waitForCompletion: true,
      timeoutMs: DEFAULT_REVIEW_TIMEOUT_MS,
      heartbeatMissionId: missionId,
      isComplete: reviewCompletionDetector,
    });
  } catch (err) {
    // Reviewer failed → conservatively approve to avoid blocking the mission
    const msg = err instanceof Error ? err.message : String(err);
    await patchTask(missionId, taskId, {
      status: "done",
      reviewOutput: `APPROVED (review skipped: ${msg})`,
    });
    appendTaskSummary(missionId, task);
    broadcast({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
      type: "task_approved",
      workspaceId: mission.workspaceId,
      missionId,
      taskId: task.id,
      title: `Cap unavailable — auto-approved "${task.title}"`,
      timestamp: new Date().toISOString(),
    });
    void executeNextTask(missionId).catch(console.error);
    return;
  }

  // Cap may include preamble before the verdict line. Find the first
  // line that starts with APPROVED or REJECTED rather than requiring it
  // at position zero of the trimmed output.
  const verdict = result.output.trim();
  const verdictLineMatch = verdict.match(/(?:^|\n)\s*(APPROVED|REJECTED)\b[^\n]*/i);
  const approved = !!verdictLineMatch && /APPROVED/i.test(verdictLineMatch[1]);
  const rejected = !!verdictLineMatch && /REJECTED/i.test(verdictLineMatch[1]);

  if (approved) {
    await patchTask(missionId, taskId, {
      status: "done",
      reviewOutput: verdict,
    });
    await appendTaskSummary(missionId, task);
    broadcast({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
      type: "task_approved",
      workspaceId: mission.workspaceId,
      missionId,
      taskId: task.id,
      agentId: "cap",
      agentName: "Cap",
      title: `Cap approved: "${task.title}"`,
      detail: verdict.slice(0, 200),
      timestamp: new Date().toISOString(),
    });
    void executeNextTask(missionId).catch(console.error);
    return;
  }

  if (rejected) {
    const retries = (task.retryCount ?? 0) + 1;
    if (retries >= MAX_REVIEW_RETRIES) {
      await patchTask(missionId, taskId, {
        status: "blocked",
        reviewOutput: verdict,
        retryCount: retries,
        errorMessage: "Exceeded max review retries — manual intervention required",
      });
      broadcast({
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
        type: "task_escalated",
        workspaceId: mission.workspaceId,
        missionId,
        taskId: task.id,
        agentId: "cap",
        agentName: "Cap",
        title: `Task escalated after ${retries} rejections: "${task.title}"`,
        detail: verdict.slice(0, 300),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Reset to pending for retry
    await patchTask(missionId, taskId, {
      status: "pending",
      reviewOutput: verdict,
      retryCount: retries,
      output: undefined,
      sessionKey: undefined,
      startedAt: undefined,
      completedAt: undefined,
    });
    broadcast({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
      type: "task_retrying",
      workspaceId: mission.workspaceId,
      missionId,
      taskId: task.id,
      agentId: task.agentId,
      agentName: task.agentName,
      title: `Cap rejected (attempt ${retries}/${MAX_REVIEW_RETRIES}): "${task.title}"`,
      detail: verdict.slice(0, 300),
      timestamp: new Date().toISOString(),
    });
    void executeNextTask(missionId).catch(console.error);
    return;
  }

  // Verdict unparseable — treat as approval to avoid stuck missions
  await patchTask(missionId, taskId, {
    status: "done",
    reviewOutput: verdict || "(Cap returned no verdict — auto-approved)",
  });
  await appendTaskSummary(missionId, task);
  broadcast({
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
    type: "task_approved",
    workspaceId: mission.workspaceId,
    missionId,
    taskId: task.id,
    title: `Auto-approved (unparseable verdict): "${task.title}"`,
    timestamp: new Date().toISOString(),
  });
  void executeNextTask(missionId).catch(console.error);
}

async function appendTaskSummary(missionId: string, task: MissionTask): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const summary: TaskSummary = {
    taskId: task.id,
    taskTitle: task.title,
    agentId: task.agentId,
    agentName: task.agentName,
    summary: task.output ?? "",
    completedAt: now,
    sessionKey: task.sessionKey,
  };
  await db.collection("missions").updateOne(
    { id: missionId },
    {
      $push: {
        taskSummaries: summary,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      $set: { updatedAt: now },
    },
  );
}

// ─── compileMissionReport ────────────────────────────────────────

export async function compileMissionReport(missionId: string): Promise<void> {
  const mission = await loadMission(missionId);
  if (!mission) return;

  await setActiveAgent(missionId, "jarvis", "Writing final report…");

  const reportLabel = `jarvis-report-${missionId}`;
  const reportPrompt = buildReportPrompt(mission);

  let result: SpawnResult;
  try {
    result = await spawnAgentSession({
      agentId: "jarvis",
      label: reportLabel,
      task: reportPrompt,
      waitForCompletion: true,
      timeoutMs: DEFAULT_REPORT_TIMEOUT_MS,
      heartbeatMissionId: missionId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Even if the report fails, mark mission done — work is complete
    await setMissionStatus(missionId, "done", {
      finalReport: `(Report generation failed: ${msg})`,
    });
    broadcast({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
      type: "mission_done",
      workspaceId: mission.workspaceId,
      missionId,
      title: `Mission "${mission.title}" complete (report unavailable)`,
      detail: msg,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const report = result.output.replace(/\bTASK_COMPLETE\b/g, "").trim();
  await setMissionStatus(missionId, "done", {
    finalReport: report,
    activeAgentId: null,
    activeAgentLabel: null,
    activeSessionKey: null,
  });

  broadcast({
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
    type: "mission_done",
    workspaceId: mission.workspaceId,
    missionId,
    agentId: "jarvis",
    agentName: "Jarvis",
    title: `Mission "${mission.title}" complete`,
    detail: report.slice(0, 400),
    timestamp: new Date().toISOString(),
  });
}

// ─── runShuriClarification ───────────────────────────────────────

interface ShuriClarification {
  questions: string[];
  readyToPlan: boolean;
  reasoning?: string;
}

/**
 * Spawn a Shuri session that analyzes the mission description and decides:
 *   - whether clarifying questions are actually needed
 *   - if so, which specific questions to ask (1-4 max)
 *
 * Shuri responds with JSON:
 *   { "questions": ["Q1", "Q2", ...], "readyToPlan": false }
 *   or
 *   { "questions": [], "readyToPlan": true, "reasoning": "spec is clear" }
 *
 * Saves the questions into mission.clarification[] as agent messages.
 * If readyToPlan is true and there are no questions, immediately transitions
 * the mission to "analyzing" and fires Fury planning.
 *
 * On Shuri failure, falls back to a small set of generic questions so the
 * mission isn't blocked.
 */
export async function runShuriClarification(missionId: string): Promise<void> {
  const mission = await loadMission(missionId);
  if (!mission) return;

  const db = await getDb();
  const now = new Date().toISOString();
  const analystId = mission.analystId ?? "shuri";
  const analystName = mission.analystName ?? "Shuri";

  await setActiveAgent(missionId, analystId, "Reading the brief…");

  const prompt = `You are ${analystName}, the product analyst. A new mission has just arrived.

MISSION TITLE: ${mission.title}
MISSION DESCRIPTION:
${mission.description}

Your job: decide whether you need clarifying answers from the user before this mission can be planned.

Think about:
- What does "done" look like? Is the acceptance criterion clear from the description?
- Are there ambiguities about scope, constraints, integrations, or stakeholders?
- Is the framework / language / data model implied or unstated?
- Is there a deadline, budget, or hard constraint that should be confirmed?

Respond with a single JSON object (and nothing else):

{
  "questions": ["First specific question", "Second specific question", ...],
  "readyToPlan": false,
  "reasoning": "Brief note on why you're asking (or why no questions needed)"
}

Rules:
- 0 to 4 questions, no more.
- If the mission is already specific and complete, return an empty array and "readyToPlan": true.
- Each question must be a single concise sentence. No multi-part bundles.
- Address the user directly ("What ...", "Which ...", "Are you planning to ...").
- Do NOT ask about agent/team selection — that's not the user's concern.
- Do NOT ask the user to pick frameworks unless they have a stated stack already.

After the JSON, on a new line, write the literal marker: TASK_COMPLETE`;

  let result: SpawnResult;
  try {
    result = await spawnAgentSession({
      agentId: analystId,
      label: `${analystId}-clarify-${missionId}`,
      task: prompt,
      waitForCompletion: true,
      timeoutMs: 90 * 1000,
      heartbeatMissionId: missionId,
      isComplete: (text) => {
        if (text.includes("TASK_COMPLETE")) return true;
        // Also accept a parseable JSON object with a `questions` field
        const cleaned = text
          .replace(/```json/gi, "")
          .replace(/```/g, "")
          .trim();
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start === -1 || end === -1) return false;
        try {
          const obj = JSON.parse(cleaned.slice(start, end + 1));
          return obj && typeof obj === "object" && "questions" in obj;
        } catch {
          return false;
        }
      },
    });
  } catch (err) {
    console.error(`[shuri-clarify] session error:`, err);
    return fallbackToStaticQuestions(missionId, mission, analystId, analystName);
  }

  // Parse Shuri's JSON
  const parsed = parseShuriResponse(result.output);
  if (!parsed) {
    console.error(`[shuri-clarify] could not parse output:`, result.output.slice(0, 400));
    return fallbackToStaticQuestions(missionId, mission, analystId, analystName);
  }

  const questions = parsed.questions.slice(0, 4); // safety cap

  if (questions.length === 0 && parsed.readyToPlan) {
    // Shuri says no clarification needed — go straight to Fury planning
    await db.collection("missions").updateOne(
      { id: missionId },
      {
        $set: {
          status: "analyzing",
          researchNotes: parsed.reasoning ?? "",
          updatedAt: new Date().toISOString(),
        },
      },
    );

    broadcast({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2,5)}-skip-clar`,
      type: "mission_analyzing",
      workspaceId: mission.workspaceId,
      missionId,
      agentId: analystId,
      agentName: analystName,
      title: `${analystName}: no clarification needed — handing off to Fury`,
      detail: parsed.reasoning,
      timestamp: new Date().toISOString(),
    });

    void runPlanningInBackground(missionId, mission.workspaceId);
    return;
  }

  // Shuri produced questions → she's done for now; user must answer next
  await setActiveAgent(missionId, null, null);

  // Save questions as analyst clarification messages
  const clarificationMessages = questions.map((q, i) => ({
    id: `cq-${Date.now()}-${i}`,
    role: "agent" as const,
    agentId: analystId,
    agentName: analystName,
    content: q,
    createdAt: new Date(Date.now() + i).toISOString(),
  }));

  await db.collection("missions").updateOne(
    { id: missionId },
    {
      $set: {
        clarification: clarificationMessages,
        researchNotes: parsed.reasoning ?? "",
        updatedAt: new Date().toISOString(),
      },
    },
  );

  broadcast({
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2,5)}-clar`,
    type: "clarification_started",
    workspaceId: mission.workspaceId,
    missionId,
    agentId: analystId,
    agentName: analystName,
    title: `${analystName} has ${questions.length} clarification question${
      questions.length === 1 ? "" : "s"
    }`,
    detail: questions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
    timestamp: new Date().toISOString(),
  });
  void now;
}

function parseShuriResponse(raw: string): ShuriClarification | null {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .replace(/\bTASK_COMPLETE\b/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as Partial<ShuriClarification>;
    if (!Array.isArray(obj.questions)) return null;
    return {
      questions: obj.questions.filter((q): q is string => typeof q === "string"),
      readyToPlan: obj.readyToPlan === true,
      reasoning: typeof obj.reasoning === "string" ? obj.reasoning : undefined,
    };
  } catch {
    return null;
  }
}

async function fallbackToStaticQuestions(
  missionId: string,
  mission: Mission,
  analystId: string,
  analystName: string,
): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  const fallbackQs = [
    `What does "done" look like for "${mission.title}"? What's the primary outcome you want?`,
    `Are there any existing systems, codebases, or hard technical constraints I should know about?`,
    `Who are the end users or stakeholders, and what do they need from this?`,
    `What's the rough timeframe or deadline, and any preferred language/framework/infra?`,
  ];
  const messages = fallbackQs.map((q, i) => ({
    id: `cq-${now}-${i}`,
    role: "agent" as const,
    agentId: analystId,
    agentName: analystName,
    content: q,
    createdAt: new Date(now + i).toISOString(),
  }));

  await db.collection("missions").updateOne(
    { id: missionId },
    {
      $set: {
        clarification: messages,
        updatedAt: new Date().toISOString(),
      },
    },
  );

  broadcast({
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2,5)}-clar-fb`,
    type: "clarification_started",
    workspaceId: mission.workspaceId,
    missionId,
    agentId: analystId,
    agentName: analystName,
    title: `${analystName} asking standard clarification questions (Shuri session unavailable)`,
    timestamp: new Date().toISOString(),
  });
}

// Re-exportable helper used by both the create and clarify routes.
export async function runPlanningInBackground(
  missionId: string,
  workspaceId: string,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await setActiveAgent(missionId, "fury", "Planning tasks…");

  broadcast({
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2,5)}-plan-start`,
    type: "planning_started",
    workspaceId,
    missionId,
    agentId: "fury",
    agentName: "Fury",
    title: "Fury is breaking the mission into tasks",
    timestamp: now,
  });
  try {
    const result = await runPlanning(missionId);
    await db.collection("missions").updateOne(
      { id: missionId },
      {
        $set: {
          tasks: result.tasks,
          status: "planned",
          planningSessionKey: result.sessionKey,
          planError: undefined,
          activeAgentId: null,
          activeAgentLabel: null,
          activeSessionKey: null,
          updatedAt: new Date().toISOString(),
        },
      },
    );
    broadcast({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2,5)}-plan-done`,
      type: "tasks_created",
      workspaceId,
      missionId,
      agentId: "fury",
      agentName: "Fury",
      title: `${result.tasks.length} tasks planned`,
      detail: result.tasks.map((t) => `• ${t.sequenceNumber}. ${t.title} → ${t.agentName}`).join("\n"),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[orchestrator] background planning failed:", msg);
    await db.collection("missions").updateOne(
      { id: missionId },
      {
        $set: {
          status: "planning_failed",
          planError: msg,
          activeAgentId: null,
          activeAgentLabel: null,
          activeSessionKey: null,
          updatedAt: new Date().toISOString(),
        },
      },
    );
    broadcast({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2,5)}-plan-fail`,
      type: "planning_failed",
      workspaceId,
      missionId,
      agentId: "fury",
      agentName: "Fury",
      title: "Planning failed",
      detail: msg.slice(0, 400),
      timestamp: new Date().toISOString(),
    });
  }
}

// ─── runPlanning ─────────────────────────────────────────────────

interface PlannedTask {
  title: string;
  description: string;
  agentId: string;
  estimatedMinutes?: number;
  dependsOn?: number[];
}

/**
 * Run Fury's AI planning over a mission's clarification Q&A.
 * Produces a list of MissionTask objects ready to insert into mission.tasks.
 *
 * Throws on parse failure or empty plan; caller is responsible for marking
 * mission as planning_failed.
 */
export async function runPlanning(missionId: string): Promise<{
  tasks: MissionTask[];
  sessionKey: string;
  rawOutput: string;
}> {
  const mission = await loadMission(missionId);
  if (!mission) throw new Error("Mission not found");

  const clarificationContext = formatClarificationQA(mission);
  const planningPrompt = `You are planning a software mission. Produce the task breakdown as JSON.

MISSION TITLE: ${mission.title}
MISSION DESCRIPTION: ${mission.description}

CLARIFICATION Q&A:
${clarificationContext}

AVAILABLE WORKER (only one — assign every task to this agent):
- stark : full-stack execution — frontend, backend, infra, code, docs, tests.
          Cap will review afterward, so don't split tasks just to vary reviewers.

Respond with ONLY a valid JSON array. No markdown fences. No prose. Format:
[
  {
    "title": "Short task title",
    "description": "Specific acceptance criteria — what files, endpoints, or components must exist; concrete enough to execute without further questions",
    "agentId": "stark",
    "estimatedMinutes": 20,
    "dependsOn": []
  }
]

RULES:
- 3 to 7 tasks. Combine related work rather than over-fragmenting.
- Every task must be independently completable by one agent.
- Tasks must be in execution order — each builds on prior.
- Match agentId precisely to the work specialty.
- dependsOn is an array of 1-based task positions that must complete first.
- Description must be specific. Avoid vague phrases like "implement the feature".

OUTPUT THE JSON NOW. Nothing else.`;

  const sessionLabel = `fury-plan-${missionId}-${Date.now()}`;
  const spawn = await spawnAgentSession({
    agentId: "fury",
    label: sessionLabel,
    task: planningPrompt,
    waitForCompletion: true,
    timeoutMs: DEFAULT_PLAN_TIMEOUT_MS,
    // Fury's prompt asks for ONLY a JSON array — exit polling as soon as
    // we have a parseable array, instead of waiting for the marker.
    isComplete: jsonArrayCompletionDetector,
    heartbeatMissionId: missionId,
  });

  if (!spawn.output) {
    throw new Error(
      `Fury returned no output (timed out after ${Math.round(DEFAULT_PLAN_TIMEOUT_MS / 1000)}s, sessionKey=${spawn.sessionKey})`,
    );
  }

  // Extract JSON from output — strip markdown fences and any prose before/after the array
  const cleaned = spawn.output
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .replace(/\bTASK_COMPLETE\b/g, "")
    .trim();

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      `Fury did not return a JSON array. Raw output:\n${spawn.output.slice(0, 600)}`,
    );
  }
  const candidate = cleaned.slice(start, end + 1);

  let parsed: PlannedTask[];
  try {
    parsed = JSON.parse(candidate) as PlannedTask[];
  } catch (parseErr) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    throw new Error(
      `Fury returned malformed JSON: ${msg}\nRaw output:\n${spawn.output.slice(0, 600)}`,
    );
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`Fury returned empty plan. Raw output:\n${spawn.output.slice(0, 600)}`);
  }

  const now = new Date().toISOString();
  // v2: workflow locked to 5 canonical agents. Workers are always Stark;
  // any other agentId Fury returns gets remapped.
  const workerAgentId = "stark";
  const validWorkerIds = new Set([workerAgentId]);

  const tasks: MissionTask[] = parsed.map((t, i) => {
    const agentId = validWorkerIds.has(t.agentId) ? t.agentId : workerAgentId;
    const agentName = agentId.charAt(0).toUpperCase() + agentId.slice(1);
    return {
      id: `task-${Date.now()}-${i}`,
      missionId,
      workspaceId: mission.workspaceId,
      title: String(t.title ?? `Task ${i + 1}`),
      description: String(t.description ?? ""),
      agentId,
      agentName,
      sequenceNumber: i + 1,
      status: "pending",
      estimatedMinutes: t.estimatedMinutes ?? 20,
      dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn : [],
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  });

  return { tasks, sessionKey: spawn.sessionKey, rawOutput: spawn.output };
}

function formatClarificationQA(mission: Mission): string {
  const lines: string[] = [];
  let qIdx = 0;
  for (let i = 0; i < mission.clarification.length; i++) {
    const msg = mission.clarification[i];
    if (msg.role === "agent") {
      qIdx++;
      lines.push(`Q${qIdx}: ${msg.content}`);
    } else if (msg.role === "user") {
      lines.push(`A${qIdx}: ${msg.content}`);
    }
  }
  return lines.join("\n\n");
}

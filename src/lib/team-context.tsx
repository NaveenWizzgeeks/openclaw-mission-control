"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  SQUAD,
  INITIAL_TASKS,
  INITIAL_ACTIVITY,
  inferSpecialty,
  parseMentions,
  getAgent,
  type SquadAgent,
  type Task,
  type Comment,
  type TaskStatus,
  type TaskPriority,
  type ActivityEvent,
  type CommentType,
  type AgentSpecialty,
} from "./team-store";
import { useLocalStorage } from "./use-local-storage";
import { useOpenClaw } from "./openclaw-context";
import { sendToTelegram, pollTelegram, parseAgentMentions, stripMentions } from "./telegram-client";

// ============================================================
// Types
// ============================================================

export type ExecutionMode = "simulation" | "real";

interface TeamContextData {
  agents: SquadAgent[];
  tasks: Task[];
  activity: ActivityEvent[];
  selectedTaskId: string | null;
  selectTask: (taskId: string | null) => void;

  // Task lifecycle
  createTask: (opts: {
    title: string;
    description: string;
    priority: TaskPriority;
    tags: string[];
    specialty?: AgentSpecialty;
    creatorId?: string;
  }) => Task;
  claimTask: (taskId: string, agentId: string) => void;
  startTask: (taskId: string) => void;
  sendToReview: (taskId: string, reviewerId: string) => void;
  approveTask: (taskId: string, approverId: string) => void;
  rejectTask: (taskId: string, rejectorId: string, reason: string) => void;
  blockTask: (taskId: string, agentId: string, question: string) => void;
  unblockTask: (taskId: string, answer: string) => void;
  completeTask: (taskId: string, agentId: string) => void;
  postComment: (taskId: string, authorId: string, text: string, type?: CommentType) => void;

  // Autonomy + execution
  autonomyEnabled: boolean;
  setAutonomyEnabled: (v: boolean) => void;
  executionMode: ExecutionMode;
  setExecutionMode: (v: ExecutionMode) => void;
  gatewayConnected: boolean;

  // Reset
  clearAll: () => void;

  // Helpers
  getAgentTasks: (agentId: string) => Task[];
  getTasksByStatus: (status: TaskStatus) => Task[];
}

const TeamContext = createContext<TeamContextData>({
  agents: [],
  tasks: [],
  activity: [],
  selectedTaskId: null,
  selectTask: () => {},
  createTask: () => ({} as Task),
  claimTask: () => {},
  startTask: () => {},
  sendToReview: () => {},
  approveTask: () => {},
  rejectTask: () => {},
  blockTask: () => {},
  unblockTask: () => {},
  completeTask: () => {},
  postComment: () => {},
  autonomyEnabled: false,
  setAutonomyEnabled: () => {},
  executionMode: "simulation",
  setExecutionMode: () => {},
  gatewayConnected: false,
  clearAll: () => {},
  getAgentTasks: () => [],
  getTasksByStatus: () => [],
});

export function useTeam() {
  return useContext(TeamContext);
}

// ============================================================
// Prompt construction
// ============================================================

function buildAgentPrompt(agent: SquadAgent, task: Task): string {
  const priorWork = task.comments
    .filter((c) => c.type === "update" && c.authorId !== agent.id && c.authorId !== "user")
    .map((c) => {
      const author = getAgent(c.authorId);
      return `[${author?.name ?? c.authorId}]: ${c.text}`;
    })
    .join("\n\n");

  return [
    agent.systemPrompt,
    "",
    "You're part of a 10-agent autonomous squad led by Jarvis.",
    "Teammates: Jarvis, Fury, Shuri, Stark, Vision, Banner, Cap, Loki, Hawkeye, Rocket.",
    "",
    `MISSION: ${task.title}`,
    `PRIORITY: ${task.priority}`,
    task.description ? `DETAILS: ${task.description}` : "",
    task.tags.length ? `TAGS: ${task.tags.join(", ")}` : "",
    "",
    priorWork ? `PRIOR WORK FROM TEAMMATES:\n${priorWork}\n` : "",
    "",
    "Complete YOUR part of this mission (not the whole thing). Be concise. When done, summarise what you accomplished in 1-3 short paragraphs and explicitly signal completion with the word DONE on the last line. If you need clarification, ask one specific question and stop.",
  ]
    .filter(Boolean)
    .join("\n");
}

// Task templates agents can propose themselves (by specialty)
const AGENT_TASK_IDEAS: Record<AgentSpecialty, string[]> = {
  orchestration: [],
  strategy: [
    "Review active missions and rebalance priorities",
    "Plan next sprint goals based on completed work",
  ],
  engineering: [
    "Audit recent completed tasks for tech-debt hotspots",
    "Identify missing acceptance criteria in backlog items",
  ],
  architecture: [
    "Review system design docs for drift",
    "Propose API versioning strategy",
  ],
  development: [
    "Refactor duplicated logic spotted in recent PRs",
    "Add missing error boundaries",
  ],
  research: [
    "Research competitor feature gaps",
    "Investigate latest best practices for the current stack",
    "Summarise recent industry trends in our domain",
  ],
  qa: [
    "Audit recent merges for missing test coverage",
    "Run regression sweep on core flows",
  ],
  writing: [
    "Draft release notes for the last week of completed work",
    "Update README with recent architectural changes",
  ],
  security: [
    "Audit auth flow for OWASP top 10",
    "Review recent deployments for exposed secrets",
  ],
  devops: [
    "Review CI pipeline for slowdowns",
    "Audit infrastructure for cost optimization",
  ],
};

// ============================================================
// Provider
// ============================================================

export function TeamProvider({ children }: { children: ReactNode }) {
  const openclaw = useOpenClaw();

  const [agents, setAgents] = useLocalStorage<SquadAgent[]>("mc-squad", SQUAD);
  const [tasks, setTasks] = useLocalStorage<Task[]>("mc-tasks", INITIAL_TASKS);
  const [activity, setActivity] = useLocalStorage<ActivityEvent[]>("mc-activity", INITIAL_ACTIVITY);
  const [selectedTaskId, setSelectedTaskId] = useLocalStorage<string | null>("mc-selected-task", null);
  const [autonomyEnabled, setAutonomyEnabled] = useLocalStorage<boolean>("mc-autonomy", false);
  const [executionMode, setExecutionMode] = useLocalStorage<ExecutionMode>("mc-exec-mode", "simulation");

  // Refs so async loops always see current state
  const tasksRef = useRef(tasks);
  const agentsRef = useRef(agents);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { agentsRef.current = agents; }, [agents]);

  // --- Helpers ---

  const pushActivity = useCallback(
    (ev: Omit<ActivityEvent, "id" | "timestamp">) => {
      setActivity((prev) => [
        {
          ...ev,
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 500));
    },
    [setActivity]
  );

  const bumpStat = useCallback(
    (agentId: string, key: keyof SquadAgent["stats"], delta = 1) => {
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId
            ? { ...a, stats: { ...a.stats, [key]: a.stats[key] + delta } }
            : a
        )
      );
    },
    [setAgents]
  );

  const setAgentStatus = useCallback(
    (agentId: string, status: SquadAgent["status"], currentTaskId: string | null) => {
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, status, currentTaskId } : a))
      );
    },
    [setAgents]
  );

  // --- Task lifecycle ---

  const createTask: TeamContextData["createTask"] = useCallback(
    ({ title, description, priority, tags, specialty, creatorId }) => {
      const now = new Date().toISOString();
      const sp = specialty ?? inferSpecialty(title, description);
      const actor = creatorId ?? "user";

      const task: Task = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title, description,
        status: "backlog",
        priority,
        creatorId: actor,
        assigneeId: null,
        reviewerId: null,
        comments: [],
        tags,
        specialty: sp,
        createdAt: now, updatedAt: now,
        claimedAt: null, startedAt: null, completedAt: null,
      };

      setTasks((prev) => [task, ...prev]);

      if (actor !== "user") bumpStat(actor, "tasksCreated");

      const actorName = actor === "user" ? "You" : getAgent(actor)?.name ?? actor;
      pushActivity({
        type: "task_created",
        actorId: actor,
        taskId: task.id,
        message: `${actorName} created task "${title}"`,
      });
      // Only announce to Telegram if the creator is NOT from Telegram (avoid echo loops).
      // Tasks coming from Telegram inbound polling are marked with tag "from-telegram".
      if (!tags.includes("from-telegram")) {
        sendToTelegram(
          `🆕 New mission by *${actorName}*: _${title}_\n` +
            `Priority: ${priority}${sp ? ` · ${sp}` : ""}`
        );
      }

      return task;
    },
    [setTasks, pushActivity, bumpStat]
  );

  const postComment = useCallback(
    (taskId: string, authorId: string, text: string, type: CommentType = "comment") => {
      const mentions = parseMentions(text);
      const now = new Date().toISOString();
      const comment: Comment = {
        id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        taskId, authorId, text, mentions, type,
        createdAt: now,
      };
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, comments: [...t.comments, comment], updatedAt: now } : t
        )
      );
      if (authorId !== "user") bumpStat(authorId, "commentsPosted");

      const authorName = authorId === "user" ? "You" : getAgent(authorId)?.name ?? authorId;
      const task = tasksRef.current.find((t) => t.id === taskId);
      pushActivity({
        type: "comment",
        actorId: authorId,
        taskId,
        message: `${authorName} on "${task?.title ?? "task"}": ${text.slice(0, 80)}${text.length > 80 ? "…" : ""}`,
      });

      mentions.forEach((m) => {
        bumpStat(m, "mentionsReceived");
        pushActivity({
          type: "mention",
          actorId: authorId,
          targetAgentId: m,
          taskId,
          message: `${authorName} @mentioned ${getAgent(m)?.name} on "${task?.title ?? "task"}"`,
        });
      });

      // Mirror agent chatter to Telegram (skip auto-plumbing, user echoes, and empty updates)
      const isAuto = text.startsWith("Session spawned") || text.startsWith("Failed to spawn");
      if (authorId !== "user" && !isAuto && type !== "approval") {
        const preview = text.length > 240 ? text.slice(0, 240) + "…" : text;
        sendToTelegram(`💬 *${authorName}* on _${task?.title ?? "task"}_:\n${preview}`);
      }
    },
    [setTasks, bumpStat, pushActivity]
  );

  // Claim — supports both simulation and real execution modes
  const claimTask = useCallback(
    (taskId: string, agentId: string) => {
      const now = new Date().toISOString();
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId && t.status === "backlog"
            ? { ...t, status: "claimed" as const, assigneeId: agentId, claimedAt: now, updatedAt: now }
            : t
        )
      );
      setAgentStatus(agentId, "busy", taskId);
      const task = tasksRef.current.find((t) => t.id === taskId);
      const agentName = getAgent(agentId)?.name ?? agentId;
      pushActivity({
        type: "task_claimed",
        actorId: agentId,
        taskId,
        message: `${agentName} claimed "${task?.title ?? "task"}"`,
      });
      sendToTelegram(`🎯 *${agentName}* claimed mission: _${task?.title ?? "task"}_`);
    },
    [setTasks, setAgentStatus, pushActivity]
  );

  const startTask = useCallback(
    (taskId: string) => {
      const now = new Date().toISOString();
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (!task?.assigneeId) return;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: "in_progress" as const, startedAt: now, updatedAt: now } : t
        )
      );
      const agentName = getAgent(task.assigneeId)?.name ?? task.assigneeId;
      pushActivity({
        type: "task_started",
        actorId: task.assigneeId,
        taskId,
        message: `${agentName} started working on "${task.title}"`,
      });
      sendToTelegram(`⚡ *${agentName}* started: _${task.title}_`);
    },
    [setTasks, pushActivity]
  );

  const sendToReview = useCallback(
    (taskId: string, reviewerId: string) => {
      const now = new Date().toISOString();
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (!task) return;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: "review" as const, reviewerId, updatedAt: now }
            : t
        )
      );
      const doerName = getAgent(task.assigneeId ?? "")?.name ?? "Someone";
      const reviewerName = getAgent(reviewerId)?.name ?? reviewerId;
      pushActivity({
        type: "review_requested",
        actorId: task.assigneeId ?? "user",
        targetAgentId: reviewerId,
        taskId,
        message: `${doerName} requested review from ${reviewerName}`,
      });
      sendToTelegram(`👀 *${doerName}* → review by *${reviewerName}*: _${task.title}_`);
    },
    [setTasks, pushActivity]
  );

  const approveTask = useCallback(
    (taskId: string, approverId: string) => {
      const now = new Date().toISOString();
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (!task) return;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: "done" as const, completedAt: now, updatedAt: now } : t
        )
      );
      if (task.assigneeId) {
        setAgentStatus(task.assigneeId, "idle", null);
        bumpStat(task.assigneeId, "tasksCompleted");
      }
      bumpStat(approverId, "reviewsGiven");
      const approverName = getAgent(approverId)?.name ?? approverId;
      const doerName = task.assigneeId ? getAgent(task.assigneeId)?.name ?? task.assigneeId : "team";
      pushActivity({
        type: "review_approved",
        actorId: approverId,
        taskId,
        message: `${approverName} approved "${task.title}" — mission complete ✓`,
      });
      sendToTelegram(`✅ Mission complete: _${task.title}_\n${approverName} approved ${doerName}'s work.`);
    },
    [setTasks, setAgentStatus, bumpStat, pushActivity]
  );

  const rejectTask = useCallback(
    (taskId: string, rejectorId: string, reason: string) => {
      const now = new Date().toISOString();
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (!task) return;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: "in_progress" as const,
                updatedAt: now,
                comments: [
                  ...t.comments,
                  {
                    id: `c-${Date.now()}`,
                    taskId, authorId: rejectorId, text: reason,
                    mentions: t.assigneeId ? [t.assigneeId] : [],
                    type: "rejection", createdAt: now,
                  },
                ],
              }
            : t
        )
      );
      bumpStat(rejectorId, "reviewsGiven");
      pushActivity({
        type: "review_rejected",
        actorId: rejectorId,
        targetAgentId: task.assigneeId ?? undefined,
        taskId,
        message: `${getAgent(rejectorId)?.name} sent "${task.title}" back: ${reason.slice(0, 80)}`,
      });
    },
    [setTasks, bumpStat, pushActivity]
  );

  const blockTask = useCallback(
    (taskId: string, agentId: string, question: string) => {
      const now = new Date().toISOString();
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: "blocked" as const, updatedAt: now,
                comments: [
                  ...t.comments,
                  {
                    id: `c-${Date.now()}`,
                    taskId, authorId: agentId, text: question, mentions: [],
                    type: "question", createdAt: now,
                  },
                ],
              }
            : t
        )
      );
      const task = tasksRef.current.find((t) => t.id === taskId);
      const agentName = getAgent(agentId)?.name ?? agentId;
      pushActivity({
        type: "task_blocked",
        actorId: agentId, taskId,
        message: `${agentName} needs input on "${task?.title ?? "task"}"`,
      });
      sendToTelegram(`🙋 *${agentName}* needs input on _${task?.title ?? "task"}_:\n${question}`);
    },
    [setTasks, pushActivity]
  );

  const unblockTask = useCallback(
    (taskId: string, answer: string) => {
      const now = new Date().toISOString();
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: "in_progress" as const, updatedAt: now,
                comments: [
                  ...t.comments,
                  {
                    id: `c-${Date.now()}`,
                    taskId, authorId: "user", text: answer,
                    mentions: t.assigneeId ? [t.assigneeId] : [],
                    type: "comment", createdAt: now,
                  },
                ],
              }
            : t
        )
      );
      pushActivity({
        type: "comment", actorId: "user", taskId,
        message: `You answered the question — task resumed`,
      });
    },
    [setTasks, pushActivity]
  );

  const completeTask = useCallback(
    (taskId: string, agentId: string) => {
      const now = new Date().toISOString();
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: "done" as const, completedAt: now, updatedAt: now } : t
        )
      );
      setAgentStatus(agentId, "idle", null);
      bumpStat(agentId, "tasksCompleted");
      const task = tasksRef.current.find((t) => t.id === taskId);
      pushActivity({
        type: "task_completed", actorId: agentId, taskId,
        message: `${getAgent(agentId)?.name} completed "${task?.title ?? "task"}"`,
      });
    },
    [setTasks, setAgentStatus, bumpStat, pushActivity]
  );

  // ============================================================
  // REAL EXECUTION — spawn an OpenClaw session for a task
  // ============================================================

  const spawnRealSession = useCallback(
    async (task: Task, agent: SquadAgent) => {
      try {
        const prompt = buildAgentPrompt(agent, task);
        const result = (await openclaw.spawnTask({
          task: prompt,
          model: agent.model,
          mode: "run",
          label: `mc-${agent.id}-${task.id.slice(-6)}`,
        })) as Record<string, unknown> | undefined;

        // Extract sessionKey from varying response shapes
        const sessionKey =
          (result?.sessionKey as string) ??
          (result?.key as string) ??
          ((result?.session as Record<string, unknown>)?.key as string) ??
          null;

        if (!sessionKey) {
          postComment(task.id, agent.id, "Failed to start session (no key returned).", "update");
          return null;
        }

        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, sessionKey } : t))
        );
        postComment(
          task.id,
          agent.id,
          `Session spawned (${sessionKey.slice(0, 14)}…). Working on it now.`,
          "update"
        );
        return sessionKey;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        postComment(task.id, agent.id, `Failed to spawn session: ${msg}`, "update");
        return null;
      }
    },
    [openclaw, postComment, setTasks]
  );

  // ============================================================
  // Autonomous heartbeat (claim/propose/progress)
  // ============================================================

  const heartbeatTick = useCallback(() => {
    const currentTasks = tasksRef.current;
    const currentAgents = agentsRef.current;

    // (A) Agent-proposed tasks — occasionally an idle agent creates work
    if (Math.random() < 0.04 && currentTasks.filter((t) => t.status === "backlog").length < 3) {
      const idleProposers = currentAgents.filter(
        (a) => a.status === "online" && a.specialty !== "orchestration" && AGENT_TASK_IDEAS[a.specialty].length > 0
      );
      if (idleProposers.length > 0) {
        const proposer = idleProposers[Math.floor(Math.random() * idleProposers.length)];
        const ideas = AGENT_TASK_IDEAS[proposer.specialty];
        const idea = ideas[Math.floor(Math.random() * ideas.length)];
        createTask({
          title: idea,
          description: `Proposed by ${proposer.name} based on recent team activity.`,
          priority: "low",
          tags: ["agent-proposed", proposer.specialty],
          specialty: proposer.specialty,
          creatorId: proposer.id,
        });
        return; // do one action per tick
      }
    }

    // (B) Claim a backlog task
    const backlog = currentTasks.find((t) => t.status === "backlog");
    if (backlog) {
      const isAvailable = (a: SquadAgent) => a.status !== "busy" && a.status !== "offline";
      const match =
        currentAgents.find((a) => a.specialty === backlog.specialty && isAvailable(a)) ??
        currentAgents.find((a) => a.id === "jarvis" && isAvailable(a));
      if (match) {
        claimTask(backlog.id, match.id);

        if (executionMode === "real" && openclaw.connected) {
          // Real execution: start + spawn
          startTask(backlog.id);
          spawnRealSession({ ...backlog, assigneeId: match.id }, match);
        } else {
          // Simulation
          setTimeout(() => {
            startTask(backlog.id);
            postComment(
              backlog.id, match.id,
              `Picking this up. Starting on "${backlog.title}" now.`, "update"
            );
          }, 500);
        }
        return;
      }
    }

    // (C) Progress in-progress tasks (simulation only — real mode progresses via poller)
    if (executionMode === "simulation") {
      for (const task of currentTasks) {
        if (task.status !== "in_progress" || !task.assigneeId || !task.startedAt) continue;
        const ageMs = Date.now() - new Date(task.startedAt).getTime();

        if (ageMs > 20_000 && ageMs < 32_000) {
          const updates = task.comments.filter((c) => c.type === "update").length;
          if (updates < 2 && Math.random() < 0.5) {
            postComment(task.id, task.assigneeId, "Progress: core parts coming together. Will ping review shortly.", "update");
          }
        }
        if (ageMs > 30_000) {
          const reviewer =
            currentAgents.find((a) => a.id === "cap" && a.id !== task.assigneeId) ??
            currentAgents.find((a) => a.specialty === "qa" && a.id !== task.assigneeId) ??
            currentAgents.find((a) => a.id === "jarvis");
          if (reviewer && task.assigneeId !== reviewer.id) {
            postComment(task.id, task.assigneeId, `@${reviewer.name} ready for review when you have a minute.`, "update");
            sendToReview(task.id, reviewer.id);
            return;
          }
        }
      }
    }

    // (D) Review tasks (both modes — simpler auto-approve after delay)
    for (const task of currentTasks) {
      if (task.status !== "review" || !task.reviewerId) continue;
      const reviewAge = Date.now() - new Date(task.updatedAt).getTime();
      const needed = executionMode === "real" ? 6000 : 15_000;
      if (reviewAge < needed) continue;
      const shouldApprove = Math.random() < 0.85;
      if (shouldApprove) {
        postComment(
          task.id, task.reviewerId,
          `Looks solid. Approved. Nice work @${getAgent(task.assigneeId ?? "")?.name ?? ""}.`,
          "approval"
        );
        approveTask(task.id, task.reviewerId);
      } else {
        rejectTask(task.id, task.reviewerId, "Needs a tweak — please tighten up and re-submit.");
      }
      return;
    }
  }, [
    executionMode, openclaw.connected, createTask, claimTask, startTask,
    postComment, sendToReview, approveTask, rejectTask, spawnRealSession,
  ]);

  // Heartbeat effect
  useEffect(() => {
    if (!autonomyEnabled) return;
    const id = setInterval(heartbeatTick, 4000);
    return () => clearInterval(id);
  }, [autonomyEnabled, heartbeatTick]);

  // ============================================================
  // SESSION POLLER — streams real OpenClaw output into comments
  // ============================================================

  useEffect(() => {
    if (executionMode !== "real" || !openclaw.connected) return;

    const id = setInterval(async () => {
      const liveTasks = tasksRef.current.filter(
        (t) => t.sessionKey && (t.status === "in_progress" || t.status === "claimed")
      );

      for (const task of liveTasks) {
        if (!task.sessionKey || !task.assigneeId) continue;
        try {
          const history = await openclaw.getSessionHistory(task.sessionKey, 50);
          // Only consider assistant messages
          const assistantMsgs = history.filter((m) => m.role === "assistant");
          // Count existing "update" comments from this agent tied to the real run
          const existingUpdates = task.comments.filter(
            (c) => c.authorId === task.assigneeId && c.type === "update" && !c.text.startsWith("Session spawned")
          ).length;

          // Post any new messages we haven't yet
          const newMsgs = assistantMsgs.slice(existingUpdates);
          for (const m of newMsgs) {
            postComment(task.id, task.assigneeId, m.content, "update");
          }

          // Detect completion using multiple signals:
          // 1. Last assistant message ends with DONE
          // 2. Gateway session status is a terminal value
          // 3. Fallback: task has been in_progress > 4 minutes with at least one message
          const lastText = assistantMsgs[assistantMsgs.length - 1]?.content ?? "";
          const sessionInfo = openclaw.sessions.find((s) => s.key === task.sessionKey);
          const terminalStatuses = new Set([
            "completed", "done", "finished", "stopped", "ended", "idle", "paused",
          ]);
          const sessionEnded = sessionInfo
            ? terminalStatuses.has(sessionInfo.status?.toLowerCase() ?? "")
            : false;
          const ageMs = task.startedAt
            ? Date.now() - new Date(task.startedAt).getTime()
            : 0;
          const stale = ageMs > 4 * 60 * 1000 && assistantMsgs.length > 0;
          const completed =
            /(^|\n)\s*DONE\s*$/i.test(lastText) ||
            (sessionEnded && assistantMsgs.length > 0) ||
            stale;

          if (completed) {
            // Pick a reviewer (Cap for QA-style review, else Jarvis)
            const reviewer =
              agentsRef.current.find((a) => a.id === "cap" && a.id !== task.assigneeId) ??
              agentsRef.current.find((a) => a.id === "jarvis");
            if (reviewer) sendToReview(task.id, reviewer.id);
          }
        } catch {
          // transient error, try again next tick
        }
      }
    }, 6000);

    return () => clearInterval(id);
  }, [executionMode, openclaw, postComment, sendToReview]);

  // ============================================================
  // TELEGRAM INBOUND — user posts a task, optionally with @mentions
  // ============================================================

  const telegramOffsetRef = useRef(0);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const res = await pollTelegram(telegramOffsetRef.current);
      if (res.ok && res.nextOffset) telegramOffsetRef.current = res.nextOffset;
      if (res.ok && res.messages.length) {
        const knownIds = agentsRef.current.map((a) => a.id);
        for (const msg of res.messages) {
          const text = msg.text?.trim();
          if (!text) continue;
          // Ignore bot echo: only treat human messages from Telegram as task inputs.
          if (msg.from?.username?.endsWith("bot")) continue;
          const mentions = parseAgentMentions(text, knownIds);
          const title = stripMentions(text).slice(0, 120) || "Telegram mission";
          const description =
            `From Telegram (${msg.chat.title ?? msg.chat.type}) by ${msg.from?.name ?? "unknown"}` +
            (mentions.length ? `\n@-mentions: ${mentions.join(", ")}` : "");

          const newTask = createTask({
            title,
            description,
            priority: "medium",
            tags: ["from-telegram", ...mentions.map((m) => `@${m}`)],
            creatorId: "user",
          });

          // If a specific agent was @-mentioned and is available, claim immediately.
          const mentioned = mentions[0];
          if (mentioned) {
            const agent = agentsRef.current.find((a) => a.id === mentioned);
            if (agent && agent.status !== "offline") {
              claimTask(newTask.id, mentioned);
              sendToTelegram(
                `📥 Received. *${agent.name}* will handle: _${title}_`
              );
              continue;
            }
          }
          // Otherwise, let the heartbeat auto-claim.
          sendToTelegram(`📥 Received. Mission queued to backlog: _${title}_`);
        }
      }
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [createTask, claimTask]);

  // --- Misc ---

  const selectTask = useCallback(
    (id: string | null) => setSelectedTaskId(id),
    [setSelectedTaskId]
  );

  const getAgentTasks = useCallback(
    (agentId: string) =>
      tasks.filter((t) => t.assigneeId === agentId && t.status !== "done"),
    [tasks]
  );

  const getTasksByStatus = useCallback(
    (status: TaskStatus) => tasks.filter((t) => t.status === status),
    [tasks]
  );

  const clearAll = useCallback(() => {
    setTasks(INITIAL_TASKS);
    setActivity(INITIAL_ACTIVITY);
    setAgents(SQUAD);
    setSelectedTaskId(null);
  }, [setTasks, setActivity, setAgents, setSelectedTaskId]);

  return (
    <TeamContext.Provider
      value={{
        agents, tasks, activity, selectedTaskId, selectTask,
        createTask, claimTask, startTask, sendToReview,
        approveTask, rejectTask, blockTask, unblockTask,
        completeTask, postComment,
        autonomyEnabled, setAutonomyEnabled,
        executionMode, setExecutionMode,
        gatewayConnected: openclaw.connected,
        clearAll, getAgentTasks, getTasksByStatus,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

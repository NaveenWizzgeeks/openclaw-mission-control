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
import { useOpenClaw, extractMessageText } from "./openclaw-context";
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
  markComplete: (taskId: string) => void; // user manually marks task done
  postComment: (taskId: string, authorId: string, text: string, type?: CommentType) => void;
  updateAgentModel: (agentId: string, model: string) => void;

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
  markComplete: () => {},
  updateAgentModel: () => {},
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

interface AgentContext {
  workspace: string;
  missionControlUrl: string;
  telegram: { botUsername: string; chatId: string | null; groupChatId: string | null; sendEndpoint: string };
  tools: { files: string[]; runtime: string[]; web: string[]; memory: string[] };
}

function buildAgentPrompt(agent: SquadAgent, task: Task, ctx: AgentContext | null, allAgents: SquadAgent[]): string {
  const priorWork = task.comments
    .filter((c) => c.type === "update" && c.authorId !== agent.id && c.authorId !== "user")
    .map((c) => {
      const author = getAgent(c.authorId);
      return `[${author?.name ?? c.authorId}]: ${c.text}`;
    })
    .join("\n\n");

  const userQuestions = task.comments
    .filter((c) => c.authorId === "user")
    .map((c) => `[User]: ${c.text}`)
    .join("\n");

  const teammates = allAgents.map((a) => `${a.name} (${a.specialty})`).join(", ");

  const sections: string[] = [];

  // Identity & role
  sections.push(`# YOU ARE: ${agent.name}, ${agent.title}`);
  sections.push(agent.systemPrompt);
  sections.push("");

  // Team
  sections.push(`# TEAM`);
  sections.push(`You are part of an autonomous engineering squad. Teammates: ${teammates}.`);
  sections.push(`Coordinate by referencing teammates by name. Lead orchestrator: Jarvis.`);
  sections.push("");

  // Environment & tools
  if (ctx) {
    sections.push(`# YOUR ENVIRONMENT`);
    sections.push(`- Workspace: ${ctx.workspace}  (write all files here using the 'write' or 'edit' tool)`);
    sections.push(`- Mission Control UI: ${ctx.missionControlUrl}`);
    sections.push(`- Today's date: ${new Date().toISOString().slice(0, 10)}`);
    sections.push("");

    sections.push(`# TOOLS YOU CAN USE`);
    sections.push(`- File operations: ${ctx.tools.files.join(", ")} — for creating/editing project files`);
    sections.push(`- Runtime: ${ctx.tools.runtime.join(", ")} — for running shell commands, builds, tests`);
    sections.push(`- Web: ${ctx.tools.web.join(", ")} — for research, fetching docs`);
    sections.push(`- Memory: ${ctx.tools.memory.join(", ")} — for past context and notes`);
    sections.push("");

    // Telegram outbound
    if (ctx.telegram.chatId || ctx.telegram.groupChatId) {
      sections.push(`# COMMUNICATING WITH THE USER`);
      sections.push(`The user is reachable via Telegram bot ${ctx.telegram.botUsername}.`);
      sections.push(`To send a message: POST to ${ctx.missionControlUrl}${ctx.telegram.sendEndpoint}`);
      sections.push(`  Body: { "text": "your message" }`);
      sections.push(`  Default chat is auto-routed (user's group/DM). Markdown supported.`);
      sections.push(`Use this when: progress updates, sharing results, asking clarifying questions.`);
      sections.push(`DO NOT ask the user "what is your chat ID" — it is already configured.`);
      sections.push("");
    }
  }

  // Mission
  sections.push(`# YOUR MISSION`);
  sections.push(`Title: ${task.title}`);
  sections.push(`Priority: ${task.priority}`);
  if (task.description) sections.push(`Details: ${task.description}`);
  if (task.tags.length) sections.push(`Tags: ${task.tags.join(", ")}`);
  sections.push("");

  if (priorWork) {
    sections.push(`# PRIOR WORK FROM TEAMMATES`);
    sections.push(priorWork);
    sections.push("");
  }

  if (userQuestions) {
    sections.push(`# USER MESSAGES IN THIS THREAD`);
    sections.push(userQuestions);
    sections.push("");
  }

  // Completion protocol
  sections.push(`# HOW TO FINISH`);
  sections.push(`1. Do the work using the tools above. Write real files, run real commands.`);
  sections.push(`2. When done, summarize what you accomplished in 1-3 paragraphs.`);
  sections.push(`3. End your final message with the literal word DONE on the last line.`);
  sections.push(`4. If you need clarification, ask ONE specific question and stop. Do not invent context.`);

  return sections.filter(Boolean).join("\n");
}


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

  // ── MongoDB persistence ────────────────────────────────────────────────────

  // Load tasks + activity from DB on mount (DB wins over localStorage)
  useEffect(() => {
    (async () => {
      try {
        const [tasksRes, actRes] = await Promise.all([
          fetch("/api/db/tasks").then((r) => r.json()),
          fetch("/api/db/activity").then((r) => r.json()),
        ]);
        // DB is authoritative — even an empty result overrides localStorage
        if (tasksRes.ok) setTasks(tasksRes.tasks);
        if (actRes.ok) setActivity(actRes.events);
      } catch {
        // fall back to localStorage state already loaded
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Agent environment context (workspace, telegram, tools) — fetched once on mount
  const agentContextRef = useRef<AgentContext | null>(null);
  useEffect(() => {
    fetch("/api/agent/context")
      .then((r) => r.json())
      .then((ctx: AgentContext) => { agentContextRef.current = ctx; })
      .catch(() => {});
  }, []);

  // Debounced sync to DB whenever tasks or activity change
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      fetch("/api/db/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tasks, activity }),
      }).catch(() => {});
    }, 1500);
  }, [tasks, activity]);

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
    (taskId: string, knownAgentId?: string) => {
      const now = new Date().toISOString();
      const task = tasksRef.current.find((t) => t.id === taskId);
      // knownAgentId is passed when called right after claimTask (ref may be stale)
      const agentId = knownAgentId ?? task?.assigneeId;
      if (!agentId) return;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: "in_progress" as const, startedAt: now, updatedAt: now } : t
        )
      );
      const agentName = getAgent(agentId)?.name ?? agentId;
      const title = task?.title ?? "task";
      pushActivity({
        type: "task_started",
        actorId: agentId,
        taskId,
        message: `${agentName} started working on "${title}"`,
      });
      sendToTelegram(`⚡ *${agentName}* started: _${title}_`);
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
      const rejectorName = getAgent(rejectorId)?.name ?? rejectorId;
      const doerName = task.assigneeId ? getAgent(task.assigneeId)?.name ?? task.assigneeId : "assignee";
      pushActivity({
        type: "review_rejected",
        actorId: rejectorId,
        targetAgentId: task.assigneeId ?? undefined,
        taskId,
        message: `${rejectorName} sent "${task.title}" back: ${reason.slice(0, 80)}`,
      });
      sendToTelegram(`🔁 *${rejectorName}* sent _${task.title}_ back to *${doerName}*:\n${reason.slice(0, 120)}`);
    },
    [setTasks, bumpStat, pushActivity]
  );

  const blockTask = useCallback(
    async (taskId: string, agentId: string, question: string) => {
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
      // Store the Telegram message_id so inbound replies can route back here
      const tgMsgId = await sendToTelegram(`🙋 *${agentName}* needs input on _${task?.title ?? "task"}_:\n${question}`);
      if (tgMsgId) {
        setTasks((prev) =>
          prev.map((t) => t.id === taskId ? { ...t, telegramQuestionMsgId: tgMsgId } : t)
        );
      }
    },
    [setTasks, pushActivity]
  );

  const unblockTask = useCallback(
    (taskId: string, answer: string) => {
      const now = new Date().toISOString();
      const task = tasksRef.current.find((t) => t.id === taskId);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: "in_progress" as const, updatedAt: now,
                telegramQuestionMsgId: undefined,
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
      if (task?.assigneeId) {
        const agentName = getAgent(task.assigneeId)?.name ?? task.assigneeId;
        sendToTelegram(`✅ Got it! *${agentName}* is back on _${task.title}_`);
      }
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

  const updateAgentModel = useCallback(
    (agentId: string, model: string) => {
      setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, model } : a)));
    },
    [setAgents]
  );

  // User manually marks a task as complete — useful when an agent stalls or the user
  // is satisfied with partial output. Closes the OpenClaw session if one exists.
  const markComplete = useCallback(
    (taskId: string) => {
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (!task) return;
      const now = new Date().toISOString();
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: "done" as const, completedAt: now, updatedAt: now } : t
        )
      );
      if (task.assigneeId) {
        setAgentStatus(task.assigneeId, "idle", null);
        bumpStat(task.assigneeId, "tasksCompleted");
      }
      pushActivity({
        type: "task_completed", actorId: "user", taskId,
        message: `You marked "${task.title}" complete`,
      });
      sendToTelegram(`✅ You marked _${task.title}_ complete`);
    },
    [setTasks, setAgentStatus, bumpStat, pushActivity]
  );

  // ============================================================
  // REAL EXECUTION — spawn an OpenClaw session for a task
  // ============================================================

  const spawnRealSession = useCallback(
    async (task: Task, agent: SquadAgent) => {
      try {
        const prompt = buildAgentPrompt(agent, task, agentContextRef.current, agentsRef.current);
        // Models in OpenClaw require the "claude-cli/" provider prefix
        const fullModel = agent.model.startsWith("claude-cli/")
          ? agent.model
          : `claude-cli/${agent.model}`;
        const result = (await openclaw.spawnTask({
          task: prompt,
          model: fullModel,
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

    // (A) Cleanup — reset agents whose task no longer exists (stale busy state)
    const taskIds = new Set(currentTasks.map((t) => t.id));
    const staleAgents = currentAgents.filter(
      (a) => a.status === "busy" && a.currentTaskId && !taskIds.has(a.currentTaskId)
    );
    staleAgents.forEach((a) => setAgentStatus(a.id, "online", null));

    // Track agent availability across this tick (claims happen async, so manage locally)
    const claimedAgentsThisTick = new Set<string>();
    const isAvailable = (a: SquadAgent) =>
      a.status !== "busy" && a.status !== "offline" && !claimedAgentsThisTick.has(a.id);

    // (B) Claim ALL eligible backlog tasks in parallel — one per available agent
    const backlogTasks = currentTasks.filter((t) => t.status === "backlog");
    for (const backlog of backlogTasks) {
      const match =
        currentAgents.find((a) => a.specialty === backlog.specialty && isAvailable(a)) ??
        currentAgents.find((a) => a.id === "jarvis" && isAvailable(a));
      if (!match) continue;
      claimedAgentsThisTick.add(match.id);
      claimTask(backlog.id, match.id);

      if (executionMode === "real" && openclaw.connected) {
        startTask(backlog.id, match.id);
        spawnRealSession({ ...backlog, assigneeId: match.id }, match);
      } else {
        setTimeout(() => {
          startTask(backlog.id, match.id);
          postComment(backlog.id, match.id, `Picking this up. Starting on "${backlog.title}" now.`, "update");
        }, 500);
      }
    }

    // (B2) Kick "claimed" tasks that never got started — process all in parallel
    const stuckClaimed = currentTasks.filter((t) => t.status === "claimed" && !t.startedAt);
    for (const t of stuckClaimed) {
      if (!t.assigneeId) continue;
      const agent = currentAgents.find((a) => a.id === t.assigneeId);
      if (!agent) continue;
      if (executionMode === "real" && openclaw.connected) {
        startTask(t.id, t.assigneeId);
        if (!t.sessionKey) spawnRealSession(t, agent);
      } else {
        startTask(t.id, t.assigneeId);
        postComment(t.id, agent.id, `Picking this up. Starting on "${t.title}" now.`, "update");
        sendToTelegram(`⚡ *${agent.name}* started _${t.title}_`);
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
    postComment, sendToReview, approveTask, rejectTask, spawnRealSession, setAgentStatus,
  ]);

  // Heartbeat effect — periodic background tick
  useEffect(() => {
    if (!autonomyEnabled) return;
    const id = setInterval(heartbeatTick, 15000);
    return () => clearInterval(id);
  }, [autonomyEnabled, heartbeatTick]);

  // Reactive heartbeat — fires shortly after tasks change so new tasks get claimed
  // without waiting up to 15s for the next interval tick
  useEffect(() => {
    if (!autonomyEnabled) return;
    const id = setTimeout(heartbeatTick, 250);
    return () => clearTimeout(id);
  }, [tasks, autonomyEnabled, heartbeatTick]);

  // ============================================================
  // SESSION LIFECYCLE — clear sessionKey from tasks done >24h ago
  // (frees up the OpenClaw session label so it can be reused)
  // ============================================================
  useEffect(() => {
    const sweep = () => {
      const now = Date.now();
      const cutoff = 24 * 60 * 60 * 1000;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.status !== "done" || !t.sessionKey || !t.completedAt) return t;
          const age = now - new Date(t.completedAt).getTime();
          if (age < cutoff) return t;
          return { ...t, sessionKey: undefined };
        })
      );
    };
    sweep(); // run once on mount
    const id = setInterval(sweep, 60 * 60 * 1000); // every hour
    return () => clearInterval(id);
  }, [setTasks]);

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
          const assistantMsgs = history.filter((m) => m.role === "assistant");
          const existingUpdates = task.comments.filter(
            (c) => c.authorId === task.assigneeId && c.type === "update" && !c.text.startsWith("Session spawned")
          ).length;

          // Post any new messages (extract plain text from content blocks)
          const newMsgs = assistantMsgs.slice(existingUpdates);
          for (const m of newMsgs) {
            const text = extractMessageText(m);
            if (text) postComment(task.id, task.assigneeId, text, "update");
          }

          const lastText = assistantMsgs.length > 0
            ? extractMessageText(assistantMsgs[assistantMsgs.length - 1])
            : "";
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
          // Stale: session done OR >4 min old with any messages OR >10 min old regardless
          const stale =
            (ageMs > 4 * 60 * 1000 && assistantMsgs.length > 0) ||
            ageMs > 10 * 60 * 1000;
          const completed =
            /(^|\n)\s*DONE\s*$/i.test(lastText) ||
            sessionEnded ||
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
          // Ignore bot echo
          if (msg.from?.username?.endsWith("bot")) continue;

          // ── Check if this is a reply to a blocked-task question ──────────
          if (msg.replyToMessageId) {
            const blockedTask = tasksRef.current.find(
              (t) => t.status === "blocked" && t.telegramQuestionMsgId === msg.replyToMessageId
            );
            if (blockedTask) {
              unblockTask(blockedTask.id, text);
              const agentName = getAgent(blockedTask.assigneeId ?? "")?.name ?? "Agent";
              sendToTelegram(`✅ Got it! *${agentName}* is back on _${blockedTask.title}_`);
              continue;
            }
          }

          // ── Otherwise treat as a new task ────────────────────────────────
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

          const mentioned = mentions[0];
          if (mentioned) {
            const agent = agentsRef.current.find((a) => a.id === mentioned);
            if (agent && agent.status !== "offline") {
              claimTask(newTask.id, mentioned);
              sendToTelegram(`📥 Received. *${agent.name}* will handle: _${title}_`);
              continue;
            }
          }
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
  }, [createTask, claimTask, unblockTask]);

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
        completeTask, markComplete, postComment, updateAgentModel,
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

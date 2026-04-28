// ============================================================
// MISSION CONTROL — New Mission/Workspace Architecture
// Flow: User → Jarvis → Analyst (clarification) → Tasks → Sequential execution
// ============================================================

// ─── Workspace ───────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;              // emoji
  color: string;             // tailwind bg color class
  path: string;              // filesystem path for this workspace's files
  isDefault: boolean;        // only one workspace is default
  currentMissionId: string | null;
  missionQueue: string[];    // ordered list of mission IDs waiting to execute
  settings: {
    autoExecute: boolean;    // auto-start next task when current completes
    heartbeatEnabled: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

// ─── Mission ─────────────────────────────────────────────────

export type MissionStatus =
  | "received"          // just created, Jarvis will route to analyst
  | "clarification"     // analyst is asking clarifying questions
  | "analyzing"         // analyst is researching and planning tasks
  | "planning_failed"   // Fury planning failed; user can retry
  | "planned"           // tasks created, Jarvis reviewing assignments
  | "queued"            // waiting in workspace queue
  | "executing"         // tasks executing sequentially
  | "paused"            // user paused execution
  | "done";             // all tasks complete

export interface ClarificationMessage {
  id: string;
  role: "agent" | "user";
  agentId?: string;
  agentName?: string;
  content: string;
  createdAt: string;
}

export interface TaskSummary {
  taskId: string;
  taskTitle: string;
  agentId: string;
  agentName: string;
  summary: string;
  completedAt: string;
  sessionKey?: string;
}

export type MissionTaskStatus =
  | "pending"      // waiting for executor
  | "in_progress"  // active worker session
  | "review"       // worker done, awaiting Cap's review
  | "done"         // approved by Cap
  | "failed"       // worker session error
  | "blocked";     // exceeded max review retries — needs user intervention

export interface MissionTask {
  id: string;
  missionId: string;
  workspaceId: string;
  title: string;
  description: string;
  agentId: string;
  agentName: string;
  sequenceNumber: number;    // 1-based order of execution
  status: MissionTaskStatus;
  sessionKey?: string;       // OpenClaw session key (real execution)
  output?: string;           // agent's output/summary
  reviewOutput?: string;     // Cap's review verdict
  retryCount?: number;       // how many times Cap rejected
  errorMessage?: string;     // execution error if any
  isUserAdded?: boolean;     // task added after planning
  dependsOn?: number[];      // sequenceNumber array of prereqs (1-based)
  estimatedMinutes?: number; // Fury's estimate
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Mission {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  // NO priority level — removed by design
  status: MissionStatus;
  analystId: string | null;             // which agent is doing analysis
  analystName: string | null;
  clarification: ClarificationMessage[]; // Q&A thread
  researchNotes: string;                // analyst's research summary
  tasks: MissionTask[];                 // ordered task list
  taskSummaries: TaskSummary[];         // completed task memory (injected into next agent)
  currentTaskIndex: number;             // 0-based, which task is running
  heartbeatAt?: string;                 // last heartbeat touch
  finalReport?: string;                 // Jarvis's executive summary on completion
  planError?: string;                   // Fury's error if planning failed
  planningSessionKey?: string;          // session key used for AI planning
  // Live activity tracking — set by the orchestrator as work transitions.
  // The UI reads this to show the truly-active agent rather than guessing
  // from mission.status alone.
  activeAgentId?: string | null;        // who's currently doing work (or null when idle)
  activeAgentLabel?: string | null;     // short human-readable activity (e.g. "Planning tasks")
  activeSessionKey?: string | null;     // session key of the active agent's session
  createdAt: string;
  updatedAt: string;
}

// ─── Live Feed Events ─────────────────────────────────────────

export type LiveEventType =
  | "mission_created"
  | "mission_queued"
  | "mission_analyzing"
  | "planning_failed"
  | "clarification_started"
  | "question_asked"
  | "answer_given"
  | "planning_started"
  | "tasks_created"
  | "task_added"
  | "task_started"
  | "task_completed"
  | "task_failed"
  | "task_approved"
  | "task_rejected"
  | "task_retrying"
  | "task_escalated"
  | "mission_done"
  | "heartbeat_tick"
  | "workspace_created"
  | "agent_status_changed";

export interface LiveEvent {
  id: string;
  type: LiveEventType;
  workspaceId?: string;
  missionId?: string;
  taskId?: string;
  agentId?: string;
  agentName?: string;
  title: string;            // short human-readable headline
  detail?: string;          // optional longer detail
  timestamp: string;
}

// ─── Heartbeat ───────────────────────────────────────────────

export interface HeartbeatEntry {
  id: string;
  workspaceId?: string;
  missionId?: string;
  taskId?: string;
  action: "tick" | "task_triggered" | "mission_queued" | "mission_received" | "no_work";
  message: string;
  timestamp: string;
}

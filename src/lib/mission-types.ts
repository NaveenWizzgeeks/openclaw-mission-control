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
  | "received"      // just created, Jarvis will route to analyst
  | "clarification" // analyst is asking clarifying questions
  | "analyzing"     // analyst is researching and planning tasks
  | "planned"       // tasks created, Jarvis reviewing assignments
  | "queued"        // waiting in workspace queue
  | "executing"     // tasks executing sequentially
  | "paused"        // user paused execution
  | "done";         // all tasks complete

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

export interface MissionTask {
  id: string;
  missionId: string;
  workspaceId: string;
  title: string;
  description: string;
  agentId: string;
  agentName: string;
  sequenceNumber: number;    // 1-based order of execution
  status: "pending" | "in_progress" | "done" | "failed";
  sessionKey?: string;       // OpenClaw session key (real execution)
  output?: string;           // agent's output/summary
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
  createdAt: string;
  updatedAt: string;
}

// ─── Live Feed Events ─────────────────────────────────────────

export type LiveEventType =
  | "mission_created"
  | "mission_queued"
  | "clarification_started"
  | "question_asked"
  | "answer_given"
  | "planning_started"
  | "tasks_created"
  | "task_started"
  | "task_completed"
  | "task_failed"
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

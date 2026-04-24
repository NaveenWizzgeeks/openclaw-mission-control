export type AgentStatus = "active" | "idle" | "error" | "offline";
export type TaskStatus = "backlog" | "todo" | "in-progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface Agent {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: AgentStatus;
  model: string;
  tasksCompleted: number;
  tasksActive: number;
  costToday: number;
  lastActive: string;
  capabilities: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  createdAt: string;
  dueDate: string | null;
  tags: string[];
}

export interface ActivityEvent {
  id: string;
  agentId: string;
  type: "task_started" | "task_completed" | "task_failed" | "agent_spawned" | "agent_stopped" | "message" | "cost_alert";
  message: string;
  timestamp: string;
}

export const AGENTS: Agent[] = [
  {
    id: "agent-1",
    name: "Codex",
    role: "Software Engineer",
    avatar: "🤖",
    status: "idle",
    model: "claude-sonnet-4-6",
    tasksCompleted: 0,
    tasksActive: 0,
    costToday: 0,
    lastActive: "—",
    capabilities: ["coding", "debugging", "code-review", "refactoring"],
  },
  {
    id: "agent-2",
    name: "Scout",
    role: "Research Analyst",
    avatar: "🔍",
    status: "idle",
    model: "claude-haiku-4-5",
    tasksCompleted: 0,
    tasksActive: 0,
    costToday: 0,
    lastActive: "—",
    capabilities: ["web-search", "summarization", "analysis"],
  },
  {
    id: "agent-3",
    name: "Sentinel",
    role: "Security Auditor",
    avatar: "🛡️",
    status: "idle",
    model: "claude-sonnet-4-6",
    tasksCompleted: 0,
    tasksActive: 0,
    costToday: 0,
    lastActive: "—",
    capabilities: ["security-review", "vulnerability-scan", "compliance"],
  },
  {
    id: "agent-4",
    name: "Scribe",
    role: "Technical Writer",
    avatar: "✍️",
    status: "idle",
    model: "claude-haiku-4-5",
    tasksCompleted: 0,
    tasksActive: 0,
    costToday: 0,
    lastActive: "—",
    capabilities: ["documentation", "blog-posts", "release-notes"],
  },
  {
    id: "agent-5",
    name: "Ops",
    role: "DevOps Engineer",
    avatar: "⚙️",
    status: "idle",
    model: "claude-sonnet-4-6",
    tasksCompleted: 0,
    tasksActive: 0,
    costToday: 0,
    lastActive: "—",
    capabilities: ["deployment", "monitoring", "infrastructure"],
  },
  {
    id: "agent-6",
    name: "Pixel",
    role: "UI/UX Designer",
    avatar: "🎨",
    status: "idle",
    model: "claude-sonnet-4-6",
    tasksCompleted: 0,
    tasksActive: 0,
    costToday: 0,
    lastActive: "—",
    capabilities: ["design", "prototyping", "accessibility"],
  },
];

export const TASKS: Task[] = [];
export const ACTIVITY: ActivityEvent[] = [];

// --- Projects ---

export type ProjectStatus = "active" | "on-hold" | "completed" | "archived";

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  color: string;
  agentIds: string[];
  taskIds: string[];
  createdAt: string;
  deadline: string | null;
  budget: number;
  spent: number;
}

export const PROJECTS: Project[] = [];

// --- Workflows ---

export type WorkflowStatus = "running" | "paused" | "completed" | "failed";

export interface WorkflowStep {
  id: string;
  agentId: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  projectId: string | null;
  steps: WorkflowStep[];
  createdAt: string;
  trigger: "manual" | "scheduled" | "event";
  schedule?: string;
}

export const WORKFLOWS: Workflow[] = [];

// --- Cost Tracking ---

export interface DailyCost {
  date: string;
  agentId: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export const DAILY_COSTS: DailyCost[] = [];

// --- Notifications ---

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  read: boolean;
  timestamp: string;
  agentId?: string;
  actionUrl?: string;
}

export const NOTIFICATIONS: Notification[] = [];

// --- Helpers ---

export function getAgent(id: string): Agent | undefined {
  return AGENTS.find((a) => a.id === id);
}

export function getTasksByStatus(status: TaskStatus): Task[] {
  return TASKS.filter((t) => t.status === status);
}

export function getTasksByAgent(agentId: string): Task[] {
  return TASKS.filter((t) => t.assigneeId === agentId);
}

export function getProject(id: string): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}

export function getCostsByDate(date: string): DailyCost[] {
  return DAILY_COSTS.filter((c) => c.date === date);
}

export function getCostsByAgent(agentId: string): DailyCost[] {
  return DAILY_COSTS.filter((c) => c.agentId === agentId);
}

export function getTotalCostForDateRange(start: string, end: string): number {
  return DAILY_COSTS
    .filter((c) => c.date >= start && c.date <= end)
    .reduce((sum, c) => sum + c.cost, 0);
}

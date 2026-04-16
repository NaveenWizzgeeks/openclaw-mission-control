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
    status: "active",
    model: "claude-opus-4-6",
    tasksCompleted: 47,
    tasksActive: 2,
    costToday: 3.24,
    lastActive: "2 min ago",
    capabilities: ["coding", "debugging", "code-review", "refactoring"],
  },
  {
    id: "agent-2",
    name: "Scout",
    role: "Research Analyst",
    avatar: "🔍",
    status: "active",
    model: "claude-sonnet-4-6",
    tasksCompleted: 89,
    tasksActive: 1,
    costToday: 1.12,
    lastActive: "5 min ago",
    capabilities: ["web-search", "summarization", "analysis"],
  },
  {
    id: "agent-3",
    name: "Sentinel",
    role: "Security Auditor",
    avatar: "🛡️",
    status: "idle",
    model: "claude-opus-4-6",
    tasksCompleted: 23,
    tasksActive: 0,
    costToday: 0.0,
    lastActive: "1 hr ago",
    capabilities: ["security-review", "vulnerability-scan", "compliance"],
  },
  {
    id: "agent-4",
    name: "Scribe",
    role: "Technical Writer",
    avatar: "✍️",
    status: "active",
    model: "claude-haiku-4-5",
    tasksCompleted: 156,
    tasksActive: 3,
    costToday: 0.45,
    lastActive: "1 min ago",
    capabilities: ["documentation", "blog-posts", "release-notes"],
  },
  {
    id: "agent-5",
    name: "Ops",
    role: "DevOps Engineer",
    avatar: "⚙️",
    status: "offline",
    model: "claude-sonnet-4-6",
    tasksCompleted: 34,
    tasksActive: 0,
    costToday: 0.0,
    lastActive: "3 hrs ago",
    capabilities: ["deployment", "monitoring", "infrastructure"],
  },
  {
    id: "agent-6",
    name: "Pixel",
    role: "UI/UX Designer",
    avatar: "🎨",
    status: "idle",
    model: "claude-sonnet-4-6",
    tasksCompleted: 67,
    tasksActive: 0,
    costToday: 0.87,
    lastActive: "30 min ago",
    capabilities: ["design", "prototyping", "accessibility"],
  },
];

export const TASKS: Task[] = [
  {
    id: "task-1",
    title: "Implement authentication flow",
    description: "Add OAuth2 login with Google and GitHub providers",
    status: "in-progress",
    priority: "high",
    assigneeId: "agent-1",
    createdAt: "2026-04-14T10:00:00Z",
    dueDate: "2026-04-16T18:00:00Z",
    tags: ["feature", "auth"],
  },
  {
    id: "task-2",
    title: "Research competitor pricing models",
    description: "Analyze top 5 competitors and summarize pricing strategies",
    status: "in-progress",
    priority: "medium",
    assigneeId: "agent-2",
    createdAt: "2026-04-14T11:00:00Z",
    dueDate: "2026-04-15T17:00:00Z",
    tags: ["research", "business"],
  },
  {
    id: "task-3",
    title: "Write API documentation",
    description: "Document all REST endpoints with examples",
    status: "in-progress",
    priority: "medium",
    assigneeId: "agent-4",
    createdAt: "2026-04-13T09:00:00Z",
    dueDate: "2026-04-17T12:00:00Z",
    tags: ["docs", "api"],
  },
  {
    id: "task-4",
    title: "Security audit on user endpoints",
    description: "Review all user-facing endpoints for OWASP top 10 vulnerabilities",
    status: "todo",
    priority: "critical",
    assigneeId: "agent-3",
    createdAt: "2026-04-15T08:00:00Z",
    dueDate: "2026-04-18T18:00:00Z",
    tags: ["security", "audit"],
  },
  {
    id: "task-5",
    title: "Set up CI/CD pipeline",
    description: "Configure GitHub Actions for automated testing and deployment",
    status: "backlog",
    priority: "high",
    assigneeId: null,
    createdAt: "2026-04-12T14:00:00Z",
    dueDate: null,
    tags: ["devops", "infrastructure"],
  },
  {
    id: "task-6",
    title: "Redesign landing page",
    description: "Create a modern, conversion-focused landing page design",
    status: "todo",
    priority: "medium",
    assigneeId: "agent-6",
    createdAt: "2026-04-14T16:00:00Z",
    dueDate: "2026-04-20T12:00:00Z",
    tags: ["design", "marketing"],
  },
  {
    id: "task-7",
    title: "Fix memory leak in WebSocket handler",
    description: "Investigate and fix the memory leak reported in production",
    status: "in-progress",
    priority: "critical",
    assigneeId: "agent-1",
    createdAt: "2026-04-15T06:00:00Z",
    dueDate: "2026-04-15T18:00:00Z",
    tags: ["bug", "urgent"],
  },
  {
    id: "task-8",
    title: "Generate release notes for v2.1",
    description: "Compile changelog and write user-friendly release notes",
    status: "todo",
    priority: "low",
    assigneeId: "agent-4",
    createdAt: "2026-04-15T09:00:00Z",
    dueDate: "2026-04-19T12:00:00Z",
    tags: ["docs", "release"],
  },
  {
    id: "task-9",
    title: "Update blog post on AI agents",
    description: "Write and publish a blog post about our multi-agent setup",
    status: "review",
    priority: "low",
    assigneeId: "agent-4",
    createdAt: "2026-04-13T10:00:00Z",
    dueDate: "2026-04-16T12:00:00Z",
    tags: ["content", "marketing"],
  },
  {
    id: "task-10",
    title: "Optimize database queries",
    description: "Profile and optimize slow MongoDB aggregation pipelines",
    status: "backlog",
    priority: "medium",
    assigneeId: null,
    createdAt: "2026-04-11T08:00:00Z",
    dueDate: null,
    tags: ["performance", "backend"],
  },
  {
    id: "task-11",
    title: "Design system component library",
    description: "Create reusable UI components with Storybook documentation",
    status: "done",
    priority: "high",
    assigneeId: "agent-6",
    createdAt: "2026-04-08T10:00:00Z",
    dueDate: "2026-04-14T18:00:00Z",
    tags: ["design", "frontend"],
  },
  {
    id: "task-12",
    title: "Implement rate limiting",
    description: "Add rate limiting middleware to prevent API abuse",
    status: "done",
    priority: "high",
    assigneeId: "agent-1",
    createdAt: "2026-04-10T09:00:00Z",
    dueDate: "2026-04-13T18:00:00Z",
    tags: ["security", "backend"],
  },
];

export const ACTIVITY: ActivityEvent[] = [
  { id: "evt-1", agentId: "agent-1", type: "task_started", message: "Started working on 'Fix memory leak in WebSocket handler'", timestamp: "2026-04-15T10:30:00Z" },
  { id: "evt-2", agentId: "agent-4", type: "task_completed", message: "Completed 'Update blog post on AI agents' — submitted for review", timestamp: "2026-04-15T10:25:00Z" },
  { id: "evt-3", agentId: "agent-2", type: "message", message: "Found 3 competitor pricing pages, analyzing now...", timestamp: "2026-04-15T10:20:00Z" },
  { id: "evt-4", agentId: "agent-1", type: "task_started", message: "Started working on 'Implement authentication flow'", timestamp: "2026-04-15T10:15:00Z" },
  { id: "evt-5", agentId: "agent-6", type: "task_completed", message: "Completed 'Design system component library'", timestamp: "2026-04-15T10:10:00Z" },
  { id: "evt-6", agentId: "agent-3", type: "agent_spawned", message: "Agent Sentinel came online, ready for security tasks", timestamp: "2026-04-15T10:05:00Z" },
  { id: "evt-7", agentId: "agent-4", type: "task_started", message: "Started 'Write API documentation' — scanning codebase", timestamp: "2026-04-15T10:00:00Z" },
  { id: "evt-8", agentId: "agent-1", type: "task_completed", message: "Completed 'Implement rate limiting' — all tests passing", timestamp: "2026-04-15T09:45:00Z" },
  { id: "evt-9", agentId: "agent-5", type: "agent_stopped", message: "Agent Ops went offline — no pending tasks", timestamp: "2026-04-15T09:30:00Z" },
  { id: "evt-10", agentId: "agent-2", type: "task_started", message: "Started 'Research competitor pricing models'", timestamp: "2026-04-15T09:15:00Z" },
  { id: "evt-11", agentId: "agent-6", type: "message", message: "Design tokens exported, ready for handoff", timestamp: "2026-04-15T09:00:00Z" },
  { id: "evt-12", agentId: "agent-1", type: "cost_alert", message: "Daily cost threshold 80% reached ($3.24 / $4.00)", timestamp: "2026-04-15T08:45:00Z" },
];

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

export const PROJECTS: Project[] = [
  {
    id: "proj-1",
    name: "Medsy Platform v2",
    description: "Full rebuild of the healthcare education platform with Next.js 15 and new design system",
    status: "active",
    color: "bg-blue-500",
    agentIds: ["agent-1", "agent-4", "agent-6"],
    taskIds: ["task-1", "task-3", "task-7", "task-11", "task-12"],
    createdAt: "2026-03-01T00:00:00Z",
    deadline: "2026-05-15T00:00:00Z",
    budget: 150.0,
    spent: 87.50,
  },
  {
    id: "proj-2",
    name: "Security Hardening Q2",
    description: "Comprehensive security audit and remediation across all services",
    status: "active",
    color: "bg-red-500",
    agentIds: ["agent-3", "agent-1"],
    taskIds: ["task-4", "task-12"],
    createdAt: "2026-04-01T00:00:00Z",
    deadline: "2026-04-30T00:00:00Z",
    budget: 60.0,
    spent: 23.40,
  },
  {
    id: "proj-3",
    name: "Market Research Sprint",
    description: "Competitive analysis and pricing strategy for Q2 launch",
    status: "active",
    color: "bg-violet-500",
    agentIds: ["agent-2", "agent-4"],
    taskIds: ["task-2", "task-9"],
    createdAt: "2026-04-10T00:00:00Z",
    deadline: "2026-04-20T00:00:00Z",
    budget: 25.0,
    spent: 12.80,
  },
  {
    id: "proj-4",
    name: "Infrastructure Overhaul",
    description: "Migrate to containerized microservices with automated CI/CD",
    status: "on-hold",
    color: "bg-amber-500",
    agentIds: ["agent-5", "agent-1"],
    taskIds: ["task-5", "task-10"],
    createdAt: "2026-03-15T00:00:00Z",
    deadline: "2026-06-01T00:00:00Z",
    budget: 80.0,
    spent: 14.20,
  },
  {
    id: "proj-5",
    name: "Brand Refresh",
    description: "New landing page, marketing materials, and design tokens",
    status: "active",
    color: "bg-emerald-500",
    agentIds: ["agent-6", "agent-4"],
    taskIds: ["task-6", "task-8", "task-11"],
    createdAt: "2026-04-05T00:00:00Z",
    deadline: "2026-04-25T00:00:00Z",
    budget: 35.0,
    spent: 18.90,
  },
  {
    id: "proj-6",
    name: "API Gateway v1",
    description: "Build centralized API gateway with rate limiting and auth",
    status: "completed",
    color: "bg-zinc-500",
    agentIds: ["agent-1", "agent-3"],
    taskIds: ["task-12"],
    createdAt: "2026-02-15T00:00:00Z",
    deadline: "2026-03-31T00:00:00Z",
    budget: 45.0,
    spent: 41.20,
  },
];

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

export const WORKFLOWS: Workflow[] = [
  {
    id: "wf-1",
    name: "Code Review Pipeline",
    description: "Automated PR review: lint → security scan → code review → approve",
    status: "running",
    projectId: "proj-1",
    trigger: "event",
    steps: [
      { id: "s1", agentId: "agent-1", label: "Run linter & type checks", status: "completed" },
      { id: "s2", agentId: "agent-3", label: "Security vulnerability scan", status: "running" },
      { id: "s3", agentId: "agent-1", label: "Deep code review", status: "pending" },
      { id: "s4", agentId: "agent-4", label: "Update changelog", status: "pending" },
    ],
    createdAt: "2026-04-15T09:00:00Z",
  },
  {
    id: "wf-2",
    name: "Content Publishing",
    description: "Research → write draft → design assets → review → publish",
    status: "running",
    projectId: "proj-3",
    trigger: "manual",
    steps: [
      { id: "s1", agentId: "agent-2", label: "Research topic & gather data", status: "completed" },
      { id: "s2", agentId: "agent-4", label: "Write blog draft", status: "completed" },
      { id: "s3", agentId: "agent-6", label: "Create cover art & diagrams", status: "running" },
      { id: "s4", agentId: "agent-4", label: "Final review & SEO", status: "pending" },
    ],
    createdAt: "2026-04-14T14:00:00Z",
  },
  {
    id: "wf-3",
    name: "Nightly Security Scan",
    description: "Automated nightly scan of all endpoints and dependencies",
    status: "completed",
    projectId: "proj-2",
    trigger: "scheduled",
    schedule: "0 2 * * *",
    steps: [
      { id: "s1", agentId: "agent-3", label: "Scan OWASP top 10", status: "completed" },
      { id: "s2", agentId: "agent-3", label: "Check dependency CVEs", status: "completed" },
      { id: "s3", agentId: "agent-4", label: "Generate security report", status: "completed" },
    ],
    createdAt: "2026-04-15T02:00:00Z",
  },
  {
    id: "wf-4",
    name: "Release Pipeline",
    description: "Build → test → deploy staging → smoke test → deploy prod",
    status: "paused",
    projectId: "proj-4",
    trigger: "manual",
    steps: [
      { id: "s1", agentId: "agent-1", label: "Build & run tests", status: "completed" },
      { id: "s2", agentId: "agent-5", label: "Deploy to staging", status: "completed" },
      { id: "s3", agentId: "agent-3", label: "Run smoke tests", status: "failed" },
      { id: "s4", agentId: "agent-5", label: "Deploy to production", status: "pending" },
    ],
    createdAt: "2026-04-14T16:00:00Z",
  },
  {
    id: "wf-5",
    name: "Design Handoff",
    description: "Design → review → export tokens → implement components",
    status: "completed",
    projectId: "proj-5",
    trigger: "manual",
    steps: [
      { id: "s1", agentId: "agent-6", label: "Create design mockups", status: "completed" },
      { id: "s2", agentId: "agent-6", label: "Export design tokens", status: "completed" },
      { id: "s3", agentId: "agent-1", label: "Implement UI components", status: "completed" },
      { id: "s4", agentId: "agent-4", label: "Document component API", status: "completed" },
    ],
    createdAt: "2026-04-10T10:00:00Z",
  },
];

// --- Cost Tracking ---

export interface DailyCost {
  date: string;
  agentId: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export const DAILY_COSTS: DailyCost[] = [
  { date: "2026-04-09", agentId: "agent-1", inputTokens: 145000, outputTokens: 38000, cost: 4.12 },
  { date: "2026-04-09", agentId: "agent-2", inputTokens: 89000, outputTokens: 22000, cost: 1.45 },
  { date: "2026-04-09", agentId: "agent-3", inputTokens: 34000, outputTokens: 8000, cost: 0.92 },
  { date: "2026-04-09", agentId: "agent-4", inputTokens: 67000, outputTokens: 45000, cost: 0.78 },
  { date: "2026-04-09", agentId: "agent-5", inputTokens: 112000, outputTokens: 28000, cost: 2.10 },
  { date: "2026-04-09", agentId: "agent-6", inputTokens: 56000, outputTokens: 15000, cost: 0.95 },
  { date: "2026-04-10", agentId: "agent-1", inputTokens: 198000, outputTokens: 52000, cost: 5.67 },
  { date: "2026-04-10", agentId: "agent-2", inputTokens: 45000, outputTokens: 12000, cost: 0.72 },
  { date: "2026-04-10", agentId: "agent-4", inputTokens: 123000, outputTokens: 67000, cost: 1.23 },
  { date: "2026-04-10", agentId: "agent-6", inputTokens: 78000, outputTokens: 21000, cost: 1.32 },
  { date: "2026-04-11", agentId: "agent-1", inputTokens: 167000, outputTokens: 43000, cost: 4.78 },
  { date: "2026-04-11", agentId: "agent-2", inputTokens: 134000, outputTokens: 35000, cost: 2.15 },
  { date: "2026-04-11", agentId: "agent-3", inputTokens: 89000, outputTokens: 24000, cost: 2.45 },
  { date: "2026-04-11", agentId: "agent-4", inputTokens: 56000, outputTokens: 34000, cost: 0.56 },
  { date: "2026-04-12", agentId: "agent-1", inputTokens: 210000, outputTokens: 56000, cost: 6.02 },
  { date: "2026-04-12", agentId: "agent-2", inputTokens: 67000, outputTokens: 18000, cost: 1.08 },
  { date: "2026-04-12", agentId: "agent-5", inputTokens: 145000, outputTokens: 38000, cost: 2.45 },
  { date: "2026-04-12", agentId: "agent-6", inputTokens: 92000, outputTokens: 25000, cost: 1.56 },
  { date: "2026-04-13", agentId: "agent-1", inputTokens: 178000, outputTokens: 47000, cost: 5.12 },
  { date: "2026-04-13", agentId: "agent-2", inputTokens: 112000, outputTokens: 30000, cost: 1.82 },
  { date: "2026-04-13", agentId: "agent-3", inputTokens: 45000, outputTokens: 12000, cost: 1.23 },
  { date: "2026-04-13", agentId: "agent-4", inputTokens: 89000, outputTokens: 56000, cost: 0.89 },
  { date: "2026-04-13", agentId: "agent-6", inputTokens: 134000, outputTokens: 36000, cost: 2.28 },
  { date: "2026-04-14", agentId: "agent-1", inputTokens: 156000, outputTokens: 41000, cost: 4.48 },
  { date: "2026-04-14", agentId: "agent-2", inputTokens: 98000, outputTokens: 26000, cost: 1.58 },
  { date: "2026-04-14", agentId: "agent-4", inputTokens: 78000, outputTokens: 48000, cost: 0.82 },
  { date: "2026-04-14", agentId: "agent-5", inputTokens: 34000, outputTokens: 9000, cost: 0.58 },
  { date: "2026-04-14", agentId: "agent-6", inputTokens: 67000, outputTokens: 18000, cost: 1.12 },
  { date: "2026-04-15", agentId: "agent-1", inputTokens: 134000, outputTokens: 35000, cost: 3.24 },
  { date: "2026-04-15", agentId: "agent-2", inputTokens: 78000, outputTokens: 21000, cost: 1.12 },
  { date: "2026-04-15", agentId: "agent-4", inputTokens: 45000, outputTokens: 28000, cost: 0.45 },
  { date: "2026-04-15", agentId: "agent-6", inputTokens: 56000, outputTokens: 15000, cost: 0.87 },
];

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

export const NOTIFICATIONS: Notification[] = [
  { id: "notif-1", title: "Cost Alert", message: "Agent Codex has reached 80% of daily budget ($3.24/$4.00)", type: "warning", read: false, timestamp: "2026-04-15T10:45:00Z", agentId: "agent-1" },
  { id: "notif-2", title: "Task Completed", message: "Design system component library has been completed by Pixel", type: "success", read: false, timestamp: "2026-04-15T10:10:00Z", agentId: "agent-6" },
  { id: "notif-3", title: "Workflow Failed", message: "Release Pipeline smoke tests failed — deployment paused", type: "error", read: false, timestamp: "2026-04-14T17:30:00Z", actionUrl: "/workflows" },
  { id: "notif-4", title: "Agent Offline", message: "Agent Ops went offline due to no pending tasks", type: "info", read: true, timestamp: "2026-04-15T09:30:00Z", agentId: "agent-5" },
  { id: "notif-5", title: "Security Scan Complete", message: "Nightly security scan completed — 0 critical issues found", type: "success", read: true, timestamp: "2026-04-15T03:15:00Z", agentId: "agent-3" },
  { id: "notif-6", title: "Budget Warning", message: "Project 'Medsy Platform v2' has used 58% of budget", type: "warning", read: true, timestamp: "2026-04-14T16:00:00Z" },
  { id: "notif-7", title: "New Agent Available", message: "Agent Sentinel is idle and available for assignment", type: "info", read: true, timestamp: "2026-04-15T10:05:00Z", agentId: "agent-3" },
];

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

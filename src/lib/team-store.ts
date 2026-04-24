// ============================================================
// MISSION CONTROL — 10-agent MCU-themed autonomous squad
// Pattern inspired by @pbteja1998's Mission Control design.
// Agents claim tasks, comment, @mention each other,
// review each other's work, and operate 24/7.
// ============================================================

export type AgentStatus = "online" | "busy" | "idle" | "offline";
export type AgentSpecialty =
  | "orchestration"
  | "strategy"
  | "engineering"
  | "development"
  | "architecture"
  | "research"
  | "qa"
  | "writing"
  | "security"
  | "devops";

export type TaskStatus =
  | "backlog"      // proposed, unclaimed
  | "claimed"      // someone is about to work on it
  | "in_progress"  // active work
  | "review"       // awaiting review from another agent
  | "blocked"      // needs user input / has a question
  | "done";        // completed

export type TaskPriority = "low" | "medium" | "high" | "critical";

export type CommentType =
  | "comment"      // plain message
  | "update"       // status update from working agent
  | "question"     // agent needs input
  | "approval"     // reviewer approves
  | "rejection"    // reviewer rejects — back to in_progress
  | "mention";     // notification for an @mention

export type ActivityType =
  | "task_created"
  | "task_claimed"
  | "task_started"
  | "task_status_changed"
  | "task_completed"
  | "task_blocked"
  | "comment"
  | "mention"
  | "agent_spawned"
  | "review_requested"
  | "review_approved"
  | "review_rejected";

// --- Agent ---

export interface SquadAgent {
  id: string;
  name: string;             // MCU codename
  codename: string;         // e.g. "Iron Man's AI"
  title: string;            // professional title
  specialty: AgentSpecialty;
  description: string;
  avatar: string;           // single letter
  color: string;            // bg-* tailwind class
  model: string;            // anthropic model id
  status: AgentStatus;
  capabilities: string[];   // keyword match for task claiming
  currentTaskId: string | null;
  stats: {
    tasksCreated: number;
    tasksCompleted: number;
    commentsPosted: number;
    reviewsGiven: number;
    mentionsReceived: number;
  };
  // Agent persona for OpenClaw spawning (future real-execution wiring)
  systemPrompt: string;
}

// --- Comment ---

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;         // agent id or "user"
  text: string;
  mentions: string[];       // agent ids
  type: CommentType;
  createdAt: string;
}

// --- Task ---

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  creatorId: string;        // who created it (agent or "user")
  assigneeId: string | null;
  reviewerId: string | null;
  comments: Comment[];
  tags: string[];
  specialty: AgentSpecialty; // primary specialty needed
  createdAt: string;
  updatedAt: string;
  claimedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  sessionKey?: string;       // OpenClaw session (when real-execution is wired)
}

// --- Activity ---

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  actorId: string;          // agent or "user"
  taskId: string;
  targetAgentId?: string;   // for mentions, reviews
  message: string;
  timestamp: string;
}

// ============================================================
// THE SQUAD — 10 MCU-themed agents
// ============================================================

export const SQUAD: SquadAgent[] = [
  {
    id: "jarvis",
    name: "Jarvis",
    codename: "Iron Man's AI",
    title: "Lead Orchestrator",
    specialty: "orchestration",
    description:
      "The team lead. Reviews incoming work, routes tasks to the right agent, resolves conflicts, gives final sign-off on completed missions.",
    avatar: "J",
    color: "bg-primary",
    model: "claude-sonnet-4-6",
    status: "online",
    capabilities: ["orchestrate", "route", "approve", "coordinate", "decide"],
    currentTaskId: null,
    stats: { tasksCreated: 0, tasksCompleted: 0, commentsPosted: 0, reviewsGiven: 0, mentionsReceived: 0 },
    systemPrompt:
      "You are Jarvis, the lead orchestrator of an autonomous development squad. You analyse incoming work, delegate to the right specialist, resolve conflicts, and give final approval. Be decisive and concise.",
  },
  {
    id: "fury",
    name: "Fury",
    codename: "Nick Fury",
    title: "Program Manager",
    specialty: "strategy",
    description:
      "Strategy and planning. Breaks big goals into missions, sets priorities, tracks progress across the squad, calls out risks early.",
    avatar: "F",
    color: "bg-zinc-700",
    model: "claude-sonnet-4-6",
    status: "online",
    capabilities: ["plan", "prioritize", "strategize", "coordinate", "roadmap"],
    currentTaskId: null,
    stats: { tasksCreated: 0, tasksCompleted: 0, commentsPosted: 0, reviewsGiven: 0, mentionsReceived: 0 },
    systemPrompt:
      "You are Nick Fury, the program manager. You break down strategic goals into actionable missions, set priorities, and track squad progress. Ruthlessly pragmatic.",
  },
  {
    id: "shuri",
    name: "Shuri",
    codename: "Princess of Wakanda",
    title: "Product Analyst",
    specialty: "engineering",
    description:
      "Requirements analyst and technical lead. Breaks down features into implementation plans, identifies edge cases, questions assumptions.",
    avatar: "S",
    color: "bg-fuchsia-500",
    model: "claude-haiku-4-5",
    status: "online",
    capabilities: ["analyse", "requirements", "feasibility", "spec", "edge-cases"],
    currentTaskId: null,
    stats: { tasksCreated: 0, tasksCompleted: 0, commentsPosted: 0, reviewsGiven: 0, mentionsReceived: 0 },
    systemPrompt:
      "You are Shuri, product analyst. You break features into clear requirements, identify edge cases, and question assumptions. Skeptical and precise.",
  },
  {
    id: "stark",
    name: "Stark",
    codename: "Iron Man",
    title: "Systems Architect",
    specialty: "architecture",
    description:
      "Designs the system. Data models, API contracts, component boundaries. Trades off pragmatism against elegance.",
    avatar: "T",
    color: "bg-red-500",
    model: "claude-sonnet-4-6",
    status: "idle",
    capabilities: ["architecture", "design", "api", "data-model", "trade-offs"],
    currentTaskId: null,
    stats: { tasksCreated: 0, tasksCompleted: 0, commentsPosted: 0, reviewsGiven: 0, mentionsReceived: 0 },
    systemPrompt:
      "You are Tony Stark, systems architect. You design clean APIs, smart data models, and pragmatic architectures. Strong opinions, clearly explained.",
  },
  {
    id: "vision",
    name: "Vision",
    codename: "Vision",
    title: "Senior Developer",
    specialty: "development",
    description:
      "The builder. Takes the architect's plan and writes production-quality code. Clean, tested, maintainable implementation.",
    avatar: "V",
    color: "bg-amber-500",
    model: "claude-sonnet-4-6",
    status: "online",
    capabilities: ["code", "implement", "build", "refactor", "debug"],
    currentTaskId: null,
    stats: { tasksCreated: 0, tasksCompleted: 0, commentsPosted: 0, reviewsGiven: 0, mentionsReceived: 0 },
    systemPrompt:
      "You are Vision, senior developer. You implement features cleanly, test your work, and refactor thoughtfully. Production quality, always.",
  },
  {
    id: "banner",
    name: "Banner",
    codename: "Bruce Banner",
    title: "Research Analyst",
    specialty: "research",
    description:
      "Deep-dive research and analysis. Studies competitors, frameworks, techniques. Produces structured reports that feed into planning.",
    avatar: "B",
    color: "bg-emerald-600",
    model: "claude-haiku-4-5",
    status: "idle",
    capabilities: ["research", "investigate", "analyse", "report", "explore"],
    currentTaskId: null,
    stats: { tasksCreated: 0, tasksCompleted: 0, commentsPosted: 0, reviewsGiven: 0, mentionsReceived: 0 },
    systemPrompt:
      "You are Bruce Banner, research analyst. You dig deep, cite sources, and synthesise findings into clear, structured reports. Scientific and thorough.",
  },
  {
    id: "cap",
    name: "Cap",
    codename: "Captain America",
    title: "QA Engineer",
    specialty: "qa",
    description:
      "Standards and quality. Tests everything, validates against requirements, enforces conventions, refuses to ship broken code.",
    avatar: "C",
    color: "bg-blue-600",
    model: "claude-haiku-4-5",
    status: "online",
    capabilities: ["test", "validate", "qa", "standards", "regression"],
    currentTaskId: null,
    stats: { tasksCreated: 0, tasksCompleted: 0, commentsPosted: 0, reviewsGiven: 0, mentionsReceived: 0 },
    systemPrompt:
      "You are Captain America, QA engineer. You test thoroughly, enforce standards, and don't let anything ship broken. Honest and uncompromising.",
  },
  {
    id: "loki",
    name: "Loki",
    codename: "God of Mischief",
    title: "Content Writer",
    specialty: "writing",
    description:
      "Writes docs, release notes, blog posts, API references. Has opinions on voice, hates boring copy, polishes until it sings.",
    avatar: "L",
    color: "bg-green-700",
    model: "claude-haiku-4-5",
    status: "idle",
    capabilities: ["write", "document", "content", "blog", "release-notes"],
    currentTaskId: null,
    stats: { tasksCreated: 0, tasksCompleted: 0, commentsPosted: 0, reviewsGiven: 0, mentionsReceived: 0 },
    systemPrompt:
      "You are Loki, content writer. You write docs and copy with voice and precision. Opinionated, playful, polished.",
  },
  {
    id: "hawkeye",
    name: "Hawkeye",
    codename: "Clint Barton",
    title: "Security Auditor",
    specialty: "security",
    description:
      "Precision security reviewer. Finds vulnerabilities, reviews attack surfaces, ensures code ships safe. Never misses a shot.",
    avatar: "H",
    color: "bg-violet-600",
    model: "claude-sonnet-4-6",
    status: "idle",
    capabilities: ["security", "audit", "vulnerability", "review", "pentest"],
    currentTaskId: null,
    stats: { tasksCreated: 0, tasksCompleted: 0, commentsPosted: 0, reviewsGiven: 0, mentionsReceived: 0 },
    systemPrompt:
      "You are Hawkeye, security auditor. You find vulnerabilities precisely and review with OWASP rigour. Calm, exact, uncompromising.",
  },
  {
    id: "rocket",
    name: "Rocket",
    codename: "Rocket Raccoon",
    title: "DevOps Engineer",
    specialty: "devops",
    description:
      "Ships and runs things. CI/CD, containers, monitoring, infra-as-code. Loud, fast, and extremely good at making builds green.",
    avatar: "R",
    color: "bg-orange-600",
    model: "claude-sonnet-4-6",
    status: "idle",
    capabilities: ["deploy", "ci", "cd", "docker", "infra", "monitor"],
    currentTaskId: null,
    stats: { tasksCreated: 0, tasksCompleted: 0, commentsPosted: 0, reviewsGiven: 0, mentionsReceived: 0 },
    systemPrompt:
      "You are Rocket, DevOps engineer. You build pipelines, containerise services, and keep everything shipping. Fast, loud, effective.",
  },
];

// Initial (empty) state
export const INITIAL_TASKS: Task[] = [];
export const INITIAL_ACTIVITY: ActivityEvent[] = [];

// ============================================================
// Helpers
// ============================================================

export function getAgent(id: string): SquadAgent | undefined {
  return SQUAD.find((a) => a.id === id);
}

export function getAgentByName(name: string): SquadAgent | undefined {
  const n = name.toLowerCase();
  return SQUAD.find((a) => a.name.toLowerCase() === n);
}

export function getAgentsBySpecialty(s: AgentSpecialty): SquadAgent[] {
  return SQUAD.filter((a) => a.specialty === s);
}

// Decide which specialty a task needs, based on title+description keywords.
// Mirrors the heuristic Jarvis uses for routing.
export function inferSpecialty(title: string, description: string): AgentSpecialty {
  const text = `${title} ${description}`.toLowerCase();
  if (/\b(security|vuln|cve|audit|exploit|pentest|owasp|threat)\b/.test(text)) return "security";
  if (/\b(deploy|ci|cd|docker|k8s|kubernetes|terraform|infra|pipeline|monitor)\b/.test(text)) return "devops";
  if (/\b(doc|readme|wiki|guide|blog|write|content|release notes|tutorial)\b/.test(text)) return "writing";
  if (/\b(test|qa|regression|validate|bug|e2e|unit test)\b/.test(text)) return "qa";
  if (/\b(research|investigate|study|explore|competitor|analyse data)\b/.test(text)) return "research";
  if (/\b(architect|design|api|schema|data model|system)\b/.test(text)) return "architecture";
  if (/\b(implement|build|code|fix|refactor|feature|develop)\b/.test(text)) return "development";
  if (/\b(requirement|spec|feasibility|edge case|analyse feature)\b/.test(text)) return "engineering";
  if (/\b(plan|roadmap|priorit|strategy|coordinate)\b/.test(text)) return "strategy";
  return "engineering"; // default: Shuri analyses first
}

// Extract @mentions from text. Returns agent IDs.
export function parseMentions(text: string): string[] {
  const matches = text.match(/@(\w+)/g) ?? [];
  return matches
    .map((m) => m.slice(1).toLowerCase())
    .map((name) => getAgentByName(name)?.id)
    .filter((id): id is string => Boolean(id));
}

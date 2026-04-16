// ============================================================
// Team Jarvis — Autonomous Agent Development Squad
// ============================================================
// Pipeline: Task → Jarvis (Lead) → Nova (Analysis) → Architect (Planning)
//         → Forge (Development) → Pulse (Testing) → [bug loop → Forge]
//         → Apex (Review) → Jarvis (Final Approval) → Done
// ============================================================

export type TeamRole =
  | "lead"
  | "analyst"
  | "planner"
  | "developer"
  | "tester"
  | "reviewer";

export type AgentStatus = "online" | "busy" | "idle" | "offline";

export type PipelineStage =
  | "intake"
  | "analysis"
  | "planning"
  | "development"
  | "testing"
  | "review"
  | "approval"
  | "completed"
  | "failed";

export type MissionPriority = "low" | "medium" | "high" | "critical";
export type MissionStatus = "queued" | "active" | "paused" | "completed" | "failed";

// --- Team Agent Definition ---

export interface TeamAgent {
  id: string;
  name: string;
  role: TeamRole;
  title: string;
  description: string;
  avatar: string;
  color: string;
  status: AgentStatus;
  model: string;
  capabilities: string[];
  currentMissionId: string | null;
  currentStage: PipelineStage | null;
  tasksHandled: number;
  bugsFound?: number;
  bugsFixed?: number;
  approvals?: number;
}

// --- Pipeline Stage Config ---

export interface PipelineStageConfig {
  id: PipelineStage;
  label: string;
  agentId: string;
  description: string;
  order: number;
}

// --- Mission (a task flowing through the pipeline) ---

export interface MissionLog {
  id: string;
  timestamp: string;
  agentId: string;
  stage: PipelineStage;
  type: "info" | "handoff" | "bug" | "fix" | "approval" | "rejection" | "completion";
  message: string;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  priority: MissionPriority;
  status: MissionStatus;
  currentStage: PipelineStage;
  currentAgentId: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  stageHistory: { stage: PipelineStage; agentId: string; enteredAt: string; exitedAt: string | null }[];
  logs: MissionLog[];
  bugLoopCount: number;
  tags: string[];
}

// --- Team Agent Definitions ---

export const TEAM_AGENTS: TeamAgent[] = [
  {
    id: "jarvis",
    name: "Jarvis",
    role: "lead",
    title: "Team Lead & Orchestrator",
    description:
      "The brain of the operation. Receives tasks, delegates to the right agent, monitors progress, and gives final approval before marking anything done.",
    avatar: "J",
    color: "bg-primary",
    status: "online",
    model: "ollama/mixtral",
    capabilities: [
      "task-delegation",
      "orchestration",
      "final-review",
      "conflict-resolution",
      "priority-management",
    ],
    currentMissionId: null,
    currentStage: null,
    tasksHandled: 34,
  },
  {
    id: "nova",
    name: "Nova",
    role: "analyst",
    title: "Requirements Analyst",
    description:
      "Breaks down incoming tasks into clear requirements. Researches feasibility, identifies risks, gathers context, and produces a structured analysis document for the planner.",
    avatar: "N",
    color: "bg-cyan-500",
    status: "online",
    model: "ollama/llama3",
    capabilities: [
      "requirement-analysis",
      "research",
      "feasibility-study",
      "risk-assessment",
      "context-gathering",
    ],
    currentMissionId: null,
    currentStage: null,
    tasksHandled: 28,
  },
  {
    id: "architect",
    name: "Architect",
    role: "planner",
    title: "System Architect & Planner",
    description:
      "Takes the analysis and designs the implementation plan. Creates architecture diagrams, defines data models, breaks work into subtasks, and produces a development blueprint.",
    avatar: "A",
    color: "bg-violet-500",
    status: "idle",
    model: "ollama/mixtral",
    capabilities: [
      "system-design",
      "architecture",
      "task-breakdown",
      "data-modeling",
      "api-design",
    ],
    currentMissionId: null,
    currentStage: null,
    tasksHandled: 22,
  },
  {
    id: "forge",
    name: "Forge",
    role: "developer",
    title: "Senior Developer",
    description:
      "The builder. Takes the plan and writes production-quality code. Implements features, fixes bugs reported by Pulse, writes clean and maintainable code following best practices.",
    avatar: "F",
    color: "bg-amber-500",
    status: "online",
    model: "ollama/codellama",
    capabilities: [
      "full-stack-development",
      "code-implementation",
      "bug-fixing",
      "refactoring",
      "performance-optimization",
    ],
    currentMissionId: null,
    currentStage: null,
    tasksHandled: 45,
    bugsFixed: 67,
  },
  {
    id: "pulse",
    name: "Pulse",
    role: "tester",
    title: "QA Engineer",
    description:
      "Tests everything Forge builds. Runs test suites, validates against the plan, finds edge cases, and reports bugs back to Forge. Only passes code that meets the spec.",
    avatar: "P",
    color: "bg-emerald-500",
    status: "idle",
    model: "ollama/llama3",
    capabilities: [
      "testing",
      "bug-detection",
      "edge-case-analysis",
      "regression-testing",
      "spec-validation",
    ],
    currentMissionId: null,
    currentStage: null,
    tasksHandled: 38,
    bugsFound: 89,
  },
  {
    id: "apex",
    name: "Apex",
    role: "reviewer",
    title: "Code Reviewer & Gatekeeper",
    description:
      "The final checkpoint before Jarvis. Reviews code quality, security, performance, and adherence to standards. Can reject and send back to Forge or approve for final sign-off.",
    avatar: "X",
    color: "bg-rose-500",
    status: "idle",
    model: "ollama/mixtral",
    capabilities: [
      "code-review",
      "security-audit",
      "performance-review",
      "standards-compliance",
      "approval-authority",
    ],
    currentMissionId: null,
    currentStage: null,
    tasksHandled: 30,
    approvals: 26,
  },
];

// --- Pipeline Configuration ---

export const PIPELINE_STAGES: PipelineStageConfig[] = [
  {
    id: "intake",
    label: "Intake",
    agentId: "jarvis",
    description: "Jarvis receives and triages the task",
    order: 0,
  },
  {
    id: "analysis",
    label: "Analysis",
    agentId: "nova",
    description: "Nova analyzes requirements and feasibility",
    order: 1,
  },
  {
    id: "planning",
    label: "Planning",
    agentId: "architect",
    description: "Architect designs the implementation plan",
    order: 2,
  },
  {
    id: "development",
    label: "Development",
    agentId: "forge",
    description: "Forge implements the solution",
    order: 3,
  },
  {
    id: "testing",
    label: "Testing",
    agentId: "pulse",
    description: "Pulse tests and validates the work",
    order: 4,
  },
  {
    id: "review",
    label: "Review",
    agentId: "apex",
    description: "Apex reviews code quality and security",
    order: 5,
  },
  {
    id: "approval",
    label: "Approval",
    agentId: "jarvis",
    description: "Jarvis gives final approval",
    order: 6,
  },
  {
    id: "completed",
    label: "Done",
    agentId: "jarvis",
    description: "Mission completed successfully",
    order: 7,
  },
];

export const MISSIONS: Mission[] = [];

// --- Helpers ---

export function getTeamAgent(id: string): TeamAgent | undefined {
  return TEAM_AGENTS.find((a) => a.id === id);
}

export function getAgentByRole(role: TeamRole): TeamAgent | undefined {
  return TEAM_AGENTS.find((a) => a.role === role);
}

export function getActiveMissions(): Mission[] {
  return MISSIONS.filter((m) => m.status === "active");
}

export function getQueuedMissions(): Mission[] {
  return MISSIONS.filter((m) => m.status === "queued");
}

export function getCompletedMissions(): Mission[] {
  return MISSIONS.filter((m) => m.status === "completed");
}

export function getMissionsByAgent(agentId: string): Mission[] {
  return MISSIONS.filter((m) => m.currentAgentId === agentId && m.status === "active");
}

export function getStageConfig(stage: PipelineStage): PipelineStageConfig | undefined {
  return PIPELINE_STAGES.find((s) => s.id === stage);
}

export function getNextStage(current: PipelineStage): PipelineStage | null {
  const currentConfig = PIPELINE_STAGES.find((s) => s.id === current);
  if (!currentConfig) return null;
  const next = PIPELINE_STAGES.find((s) => s.order === currentConfig.order + 1);
  return next?.id ?? null;
}

export function getTeamStats() {
  const totalMissions = MISSIONS.length;
  const active = MISSIONS.filter((m) => m.status === "active").length;
  const completed = MISSIONS.filter((m) => m.status === "completed").length;
  const queued = MISSIONS.filter((m) => m.status === "queued").length;
  const totalBugLoops = MISSIONS.reduce((s, m) => s + m.bugLoopCount, 0);
  const onlineAgents = TEAM_AGENTS.filter((a) => a.status !== "offline").length;
  const busyAgents = TEAM_AGENTS.filter(
    (a) => a.status === "busy" || a.status === "online"
  ).length;

  return {
    totalMissions,
    active,
    completed,
    queued,
    totalBugLoops,
    onlineAgents,
    busyAgents,
    totalAgents: TEAM_AGENTS.length,
  };
}

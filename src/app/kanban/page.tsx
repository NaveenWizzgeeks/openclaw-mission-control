"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft, ChevronRight, KanbanSquare, Loader2,
  CheckCheck, Play, Clock, AlertCircle, Pause, Radio,
  Target, Circle, User, HelpCircle, Flame, MessageSquare,
  AlertTriangle, Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveFeed } from "@/components/live-feed";
import { AgentAvatar } from "@/components/agent-avatar";
import { AssignMissionDialog } from "@/components/assign-mission-dialog";
import { TaskDetailSheet } from "@/components/task-detail-sheet";
import { useTeam } from "@/lib/team-context";
import {
  SQUAD, getAgent,
  type Task, type TaskStatus,
} from "@/lib/team-store";
import { cn, elapsedShort } from "@/lib/utils";
import type { Mission, MissionTask, MissionStatus } from "@/lib/mission-types";

// ─── View mode ──────────────────────────────────────────────────

type ViewMode = "missions" | "tasks";

// ─── Mission columns ─────────────────────────────────────────────

const MISSION_COLS: {
  id: string;
  label: string;
  statuses: MissionStatus[];
  color: string;
  icon: React.ElementType;
}[] = [
  { id: "planning",  label: "Planning",    statuses: ["received", "clarification", "analyzing"], color: "text-violet-400", icon: Radio },
  { id: "queued",    label: "Queued",      statuses: ["planned", "queued"],                       color: "text-blue-400",   icon: Clock },
  { id: "executing", label: "In Progress", statuses: ["executing"],                               color: "text-amber-400",  icon: Play },
  { id: "paused",    label: "Paused",      statuses: ["paused"],                                  color: "text-yellow-400", icon: Pause },
  { id: "done",      label: "Done",        statuses: ["done"],                                    color: "text-emerald-400",icon: CheckCheck },
];

// ─── Task columns (team-store / Squad HQ system) ─────────────────

const TASK_COLS: {
  id: TaskStatus;
  label: string;
  color: string;
  icon: React.ElementType;
}[] = [
  { id: "backlog",     label: "Backlog",     color: "text-zinc-400",   icon: Clock },
  { id: "claimed",     label: "Claimed",     color: "text-blue-400",   icon: User },
  { id: "in_progress", label: "In Progress", color: "text-amber-400",  icon: Play },
  { id: "review",      label: "Review",      color: "text-violet-400", icon: CheckCheck },
  { id: "blocked",     label: "Blocked",     color: "text-yellow-400", icon: HelpCircle },
  { id: "done",        label: "Done",        color: "text-emerald-400",icon: CheckCheck },
];

// ─── Mission task columns ─────────────────────────────────────────

const MISSION_TASK_COLS: {
  id: MissionTask["status"];
  label: string;
  color: string;
  icon: React.ElementType;
}[] = [
  { id: "pending",     label: "Pending",     color: "text-zinc-400",   icon: Clock },
  { id: "in_progress", label: "In Progress", color: "text-amber-400",  icon: Play },
  { id: "done",        label: "Done",        color: "text-emerald-400",icon: CheckCheck },
  { id: "failed",      label: "Failed",      color: "text-red-400",    icon: AlertCircle },
];

const STATUS_LABEL: Record<MissionStatus, string> = {
  received:      "Received",
  clarification: "Clarifying",
  analyzing:     "Analyzing",
  planned:       "Planned",
  queued:        "Queued",
  executing:     "Executing",
  paused:        "Paused",
  done:          "Done",
};

const STATUS_COLOR: Record<MissionStatus, string> = {
  received:      "text-[#8b949e]",
  clarification: "text-[#d2a8ff]",
  analyzing:     "text-[#d2a8ff]",
  planned:       "text-[#58a6ff]",
  queued:        "text-[#58a6ff]",
  executing:     "text-[#ffa657]",
  paused:        "text-[#e3b341]",
  done:          "text-[#3fb950]",
};

// ─── Page ───────────────────────────────────────────────────────

export default function MissionBoardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("missions");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [loadingMissions, setLoadingMissions] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  // Team-store tasks (same data as Squad HQ)
  const { tasks, selectTask, selectedTaskId } = useTeam();

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  // Fetch missions
  useEffect(() => {
    async function fetchMissions() {
      try {
        const res = await fetch("/api/missions");
        const data = (await res.json()) as { ok: boolean; missions: Mission[] };
        if (data.ok) {
          setMissions(data.missions);
          setSelectedMission((prev) => {
            if (!prev) return null;
            return data.missions.find((m) => m.id === prev.id) ?? prev;
          });
          setLoadingMissions(false);
        }
      } catch {
        setLoadingMissions(false);
      }
    }
    fetchMissions();
    const id = setInterval(fetchMissions, 8_000);
    return () => clearInterval(id);
  }, []);

  // Derive agent working status (from both systems)
  const workingAgentIds = new Set<string>();
  const agentCurrentWork = new Map<string, string>();

  // From missions
  for (const m of missions) {
    if (m.status === "executing") {
      for (const t of m.tasks) {
        if (t.status === "in_progress") {
          workingAgentIds.add(t.agentId);
          agentCurrentWork.set(t.agentId, t.title);
        }
      }
    }
    if ((m.status === "clarification" || m.status === "analyzing") && m.analystId) {
      workingAgentIds.add(m.analystId);
      agentCurrentWork.set(m.analystId, m.status === "clarification" ? "Clarifying…" : "Analyzing…");
    }
  }
  // From team-store tasks
  for (const t of tasks) {
    if (t.status === "in_progress" && t.assigneeId) {
      workingAgentIds.add(t.assigneeId);
      if (!agentCurrentWork.has(t.assigneeId)) {
        agentCurrentWork.set(t.assigneeId, t.title);
      }
    }
  }

  const totalMissionsActive = missions.filter((m) => m.status !== "done").length;
  const totalExecuting = missions.filter((m) => m.status === "executing").length;
  const totalTasksActive = tasks.filter((t) => t.status !== "done").length;

  function openTask(t: Task) {
    selectTask(t.id);
    setDetailOpen(true);
  }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden bg-[#0d1117]">

      {/* ── Left: Agent Panel ── */}
      <div className="w-52 shrink-0 border-r border-[#30363d] flex flex-col bg-[#0d1117]">
        <div className="px-4 py-3 border-b border-[#30363d] shrink-0 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#484f58]">Agents</p>
          <span className="text-[10px] text-[#484f58]">
            {workingAgentIds.size} working
          </span>
        </div>
        <div className="flex-1 overflow-y-auto py-2 space-y-px px-2">
          {SQUAD.map((agent) => {
            const isWorking = workingAgentIds.has(agent.id);
            const currentWork = agentCurrentWork.get(agent.id);
            return (
              <div
                key={agent.id}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors",
                  isWorking ? "bg-[#1c2128]" : "hover:bg-[#161b22]"
                )}
              >
                <div className="relative shrink-0">
                  <AgentAvatar agentId={agent.id} />
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-[1.5px] border-[#0d1117]",
                      isWorking ? "bg-[#3fb950] animate-pulse" : "bg-[#30363d]"
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#e6edf3] truncate leading-tight">
                    {agent.name}
                  </p>
                  <p className={cn(
                    "text-[10px] truncate leading-tight mt-0.5",
                    isWorking ? "text-[#3fb950]" : "text-[#484f58]"
                  )}>
                    {isWorking ? (currentWork ?? "Working") : "Idle"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Center: Board ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <div className="px-5 py-3 border-b border-[#30363d] shrink-0 flex items-center gap-3 bg-[#0d1117]">

          {/* Breadcrumb / title */}
          {selectedMission && viewMode === "missions" ? (
            <>
              <button
                onClick={() => setSelectedMission(null)}
                className="flex items-center gap-1.5 text-[#8b949e] hover:text-[#e6edf3] transition-colors shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-xs font-medium">Missions</span>
              </button>
              <ChevronRight className="h-3.5 w-3.5 text-[#484f58] shrink-0" />
              <p className="text-sm font-semibold text-[#e6edf3] truncate">
                {selectedMission.title}
              </p>
              <span className={cn(
                "shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                selectedMission.status === "executing"
                  ? "text-[#ffa657] border-[#ffa657]/30 bg-[#ffa657]/10"
                  : selectedMission.status === "done"
                  ? "text-[#3fb950] border-[#3fb950]/30 bg-[#3fb950]/10"
                  : "text-[#8b949e] border-[#30363d] bg-[#161b22]"
              )}>
                {STATUS_LABEL[selectedMission.status]}
              </span>
              <span className="text-[11px] text-[#484f58] ml-auto shrink-0">
                {selectedMission.tasks.filter(t => t.status === "done").length}/
                {selectedMission.tasks.length} tasks done
              </span>
            </>
          ) : (
            <>
              <KanbanSquare className="h-4 w-4 text-[#58a6ff] shrink-0" />
              <h1 className="text-sm font-semibold text-[#e6edf3]">Mission Board</h1>

              {/* Mode toggle */}
              <div className="flex items-center gap-0.5 ml-2 bg-[#161b22] border border-[#30363d] rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("missions")}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-all",
                    viewMode === "missions"
                      ? "bg-[#58a6ff]/15 text-[#58a6ff]"
                      : "text-[#8b949e] hover:text-[#e6edf3]"
                  )}
                >
                  Missions
                  {totalMissionsActive > 0 && (
                    <span className="ml-1.5 text-[10px] font-mono opacity-70">{totalMissionsActive}</span>
                  )}
                </button>
                <button
                  onClick={() => setViewMode("tasks")}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-all",
                    viewMode === "tasks"
                      ? "bg-[#58a6ff]/15 text-[#58a6ff]"
                      : "text-[#8b949e] hover:text-[#e6edf3]"
                  )}
                >
                  Tasks
                  {totalTasksActive > 0 && (
                    <span className="ml-1.5 text-[10px] font-mono opacity-70">{totalTasksActive}</span>
                  )}
                </button>
              </div>

              {/* Stats */}
              {viewMode === "missions" ? (
                <div className="flex items-center gap-3 ml-1">
                  {totalExecuting > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-[#ffa657]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#ffa657] animate-pulse" />
                      {totalExecuting} executing
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 ml-1">
                  <span className="text-[11px] text-[#8b949e]">
                    {tasks.filter(t => t.status === "in_progress").length} in progress
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="ml-auto">
                {viewMode === "tasks" && (
                  <Button size="sm" onClick={() => setAssignOpen(true)}
                    className="h-7 text-xs bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/20 hover:bg-[#58a6ff]/20">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    New Task
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Board body */}
        <div className="flex-1 overflow-auto">
          {viewMode === "missions" ? (
            loadingMissions ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-5 w-5 text-[#58a6ff] animate-spin" />
              </div>
            ) : selectedMission ? (
              <MissionTaskBoard mission={selectedMission} />
            ) : (
              <MissionBoard missions={missions} onSelect={setSelectedMission} />
            )
          ) : (
            <SquadTaskBoard tasks={tasks} onOpenTask={openTask} />
          )}
        </div>
      </div>

      {/* ── Right: Live Feed ── */}
      <div className="w-72 border-l border-[#30363d] shrink-0 hidden lg:flex flex-col bg-[#0d1117]">
        <LiveFeed
          className="h-full"
          missionId={viewMode === "missions" ? selectedMission?.id : undefined}
        />
      </div>

      <AssignMissionDialog open={assignOpen} onOpenChange={setAssignOpen} />
      <TaskDetailSheet task={selectedTask} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}

// ─── Mission Board (mission-level kanban) ────────────────────────

function MissionBoard({
  missions,
  onSelect,
}: {
  missions: Mission[];
  onSelect: (m: Mission) => void;
}) {
  if (missions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <Target className="h-10 w-10 text-[#30363d] mb-3" />
        <p className="text-sm font-medium text-[#e6edf3] mb-1">No missions yet</p>
        <p className="text-xs text-[#8b949e]">
          Create a mission from a workspace to get started
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-3 p-4 h-full min-w-max items-start">
      {MISSION_COLS.map((col) => {
        const colMissions = missions.filter((m) => col.statuses.includes(m.status));
        const Icon = col.icon;
        return (
          <div key={col.id} className="w-64 flex flex-col shrink-0">
            <div className="flex items-center justify-between px-1 pb-2.5 mb-2 border-b border-[#30363d]">
              <div className={cn("flex items-center gap-1.5 text-xs font-semibold", col.color)}>
                <Icon className="h-3.5 w-3.5" />
                {col.label}
              </div>
              <span className="text-[10px] text-[#484f58] font-mono bg-[#161b22] px-1.5 py-0.5 rounded">
                {colMissions.length}
              </span>
            </div>
            <div className="space-y-2">
              {colMissions.length === 0 ? (
                <p className="text-[11px] text-[#30363d] text-center py-8">—</p>
              ) : (
                colMissions.map((m) => (
                  <MissionCard key={m.id} mission={m} onClick={() => onSelect(m)} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MissionCard({ mission, onClick }: { mission: Mission; onClick: () => void }) {
  const totalTasks = mission.tasks.length;
  const doneTasks = mission.tasks.filter((t) => t.status === "done").length;
  const inProgressTask = mission.tasks.find((t) => t.status === "in_progress");
  const progress = totalTasks > 0 ? doneTasks / totalTasks : 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg bg-[#161b22] hover:bg-[#1c2128] border border-[#30363d] hover:border-[#58a6ff]/40 transition-all"
    >
      <p className="text-xs font-semibold text-[#e6edf3] leading-snug line-clamp-2 mb-2">
        {mission.title}
      </p>
      <div className="flex items-center gap-1.5 mb-2">
        <span className={cn("text-[10px] font-medium", STATUS_COLOR[mission.status])}>
          {STATUS_LABEL[mission.status]}
        </span>
        {mission.status === "executing" && inProgressTask && (
          <span className="text-[10px] text-[#8b949e]">· {inProgressTask.agentName}</span>
        )}
        {(mission.status === "clarification" || mission.status === "analyzing") && mission.analystName && (
          <span className="text-[10px] text-[#8b949e]">· {mission.analystName}</span>
        )}
      </div>
      {totalTasks > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[10px] text-[#484f58] mb-1">
            <span>Tasks</span>
            <span className="font-mono">{doneTasks}/{totalTasks}</span>
          </div>
          <div className="h-1 bg-[#21262d] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#3fb950] rounded-full transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between text-[10px] text-[#484f58] mt-1">
        <span>{totalTasks > 0 ? `${totalTasks} task${totalTasks !== 1 ? "s" : ""}` : "No tasks yet"}</span>
        <span>{elapsedShort(mission.updatedAt)}</span>
      </div>
    </button>
  );
}

// ─── Mission Task Board (task drill-down inside a mission) ────────

function MissionTaskBoard({ mission }: { mission: Mission }) {
  const tasks = mission.tasks;

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <Circle className="h-10 w-10 text-[#30363d] mb-3" />
        <p className="text-sm font-medium text-[#e6edf3] mb-1">No tasks yet</p>
        <p className="text-xs text-[#8b949e]">
          {mission.status === "clarification" || mission.status === "analyzing"
            ? "The analyst is currently planning tasks…"
            : "Tasks will appear once the mission is planned"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-3 p-4 h-full min-w-max items-start">
      {MISSION_TASK_COLS.map((col) => {
        const colTasks = tasks
          .filter((t) => t.status === col.id)
          .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
        const Icon = col.icon;
        return (
          <div key={col.id} className="w-64 flex flex-col shrink-0">
            <div className="flex items-center justify-between px-1 pb-2.5 mb-2 border-b border-[#30363d]">
              <div className={cn("flex items-center gap-1.5 text-xs font-semibold", col.color)}>
                <Icon className="h-3.5 w-3.5" />
                {col.label}
              </div>
              <span className="text-[10px] text-[#484f58] font-mono bg-[#161b22] px-1.5 py-0.5 rounded">
                {colTasks.length}
              </span>
            </div>
            <div className="space-y-2">
              {colTasks.length === 0 ? (
                <p className="text-[11px] text-[#30363d] text-center py-8">—</p>
              ) : (
                colTasks.map((t) => <MissionTaskCard key={t.id} task={t} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MissionTaskCard({ task }: { task: MissionTask }) {
  const statusColor: Record<MissionTask["status"], string> = {
    pending:     "text-[#8b949e]",
    in_progress: "text-[#ffa657]",
    done:        "text-[#3fb950]",
    failed:      "text-[#f85149]",
  };
  const statusLabel: Record<MissionTask["status"], string> = {
    pending: "Pending", in_progress: "In Progress", done: "Done", failed: "Failed",
  };

  return (
    <div className={cn(
      "p-3 rounded-lg border transition-colors space-y-2",
      task.status === "in_progress" ? "bg-[#1c2128] border-[#ffa657]/20"
        : task.status === "failed" ? "bg-[#1c2128] border-[#f85149]/20"
        : "bg-[#161b22] border-[#30363d]"
    )}>
      <div className="flex items-start gap-2">
        <span className="text-[10px] font-mono text-[#484f58] shrink-0 mt-0.5">
          #{task.sequenceNumber}
        </span>
        <p className="text-xs font-medium text-[#e6edf3] leading-snug">{task.title}</p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#8b949e]">{task.agentName}</span>
        <span className={cn("text-[10px] font-medium", statusColor[task.status])}>
          {statusLabel[task.status]}
        </span>
      </div>
      {task.output && task.status === "done" && (
        <p className="text-[10px] text-[#8b949e] line-clamp-2 leading-snug border-t border-[#21262d] pt-1.5">
          {task.output}
        </p>
      )}
      <p className="text-[10px] text-[#30363d]">{elapsedShort(task.updatedAt)}</p>
    </div>
  );
}

// ─── Squad Task Board (team-store tasks — same data as Squad HQ) ──

function SquadTaskBoard({
  tasks,
  onOpenTask,
}: {
  tasks: Task[];
  onOpenTask: (t: Task) => void;
}) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <Target className="h-10 w-10 text-[#30363d] mb-3" />
        <p className="text-sm font-medium text-[#e6edf3] mb-1">No tasks yet</p>
        <p className="text-xs text-[#8b949e]">Tasks created by agents will appear here</p>
      </div>
    );
  }

  return (
    <div className="flex gap-3 p-4 h-full min-w-max items-start">
      {TASK_COLS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);
        const Icon = col.icon;
        return (
          <div key={col.id} className="w-64 flex flex-col shrink-0">
            <div className="flex items-center justify-between px-1 pb-2.5 mb-2 border-b border-[#30363d]">
              <div className={cn("flex items-center gap-1.5 text-xs font-semibold", col.color)}>
                <Icon className="h-3.5 w-3.5" />
                {col.label}
              </div>
              <span className="text-[10px] text-[#484f58] font-mono bg-[#161b22] px-1.5 py-0.5 rounded">
                {colTasks.length}
              </span>
            </div>
            <div className="space-y-2 min-h-[80px]">
              {colTasks.length === 0 ? (
                <p className="text-[11px] text-[#30363d] text-center py-8">—</p>
              ) : (
                colTasks.map((t) => (
                  <SquadTaskCard key={t.id} task={t} onClick={() => onOpenTask(t)} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SquadTaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const priorityBar: Record<string, string> = {
    critical: "bg-red-500",
    high:     "bg-amber-500",
    medium:   "bg-blue-500",
    low:      "bg-zinc-500",
  };

  const unresolvedQuestions =
    task.comments.filter((c) => c.type === "question").length -
    task.comments.filter((c) => c.authorId === "user" && c.type === "comment").length;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-2.5 rounded-lg bg-[#161b22] hover:bg-[#1c2128] border border-[#30363d] transition-all relative overflow-hidden"
    >
      {/* Priority bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", priorityBar[task.priority])} />

      <div className="pl-2 space-y-1.5">
        <div className="flex items-start gap-1.5">
          {task.priority === "critical" && (
            <Flame className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
          )}
          {task.priority === "high" && (
            <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
          )}
          <p className="text-xs font-medium leading-tight flex-1 text-[#e6edf3]">{task.title}</p>
        </div>

        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] text-[#484f58]">#{tag}</span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-0.5">
          {task.assigneeId ? (
            <div className="flex items-center gap-1.5">
              <AgentAvatar agentId={task.assigneeId} />
              <span className="text-[11px] text-[#8b949e]">
                {getAgent(task.assigneeId)?.name}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-[#484f58]">Unclaimed</span>
          )}

          <div className="ml-auto flex items-center gap-2 text-[11px] text-[#484f58]">
            {task.comments.length > 0 && (
              <span className="flex items-center gap-0.5">
                <MessageSquare className="h-3 w-3" />
                {task.comments.length}
              </span>
            )}
            {task.status === "blocked" && unresolvedQuestions > 0 && (
              <HelpCircle className="h-3 w-3 text-yellow-400" />
            )}
            <span>{elapsedShort(task.updatedAt)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

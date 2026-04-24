"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTeam } from "@/lib/team-context";
import { getAgent, type Task, type SquadAgent, type ActivityEvent } from "@/lib/team-store";
import { AssignMissionDialog } from "@/components/assign-mission-dialog";
import { TaskDetailSheet } from "@/components/task-detail-sheet";
import {
  Users,
  Plus,
  Radio,
  Activity,
  Play,
  Pause,
  Trash2,
  AtSign,
  MessageSquare,
  CheckCheck,
  XCircle,
  ArrowRight,
  AlertTriangle,
  HelpCircle,
  Rocket,
  Circle,
  Crown,
  Flame,
  Zap,
  AlertCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn, elapsed } from "@/lib/utils";
import { AgentAvatar } from "@/components/agent-avatar";

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "task_created":    return <Plus className="h-3.5 w-3.5 text-blue-400" />;
    case "task_claimed":    return <Circle className="h-3.5 w-3.5 text-violet-400" />;
    case "task_started":    return <Play className="h-3.5 w-3.5 text-amber-400" />;
    case "task_completed":  return <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />;
    case "task_blocked":    return <HelpCircle className="h-3.5 w-3.5 text-yellow-400" />;
    case "comment":         return <MessageSquare className="h-3.5 w-3.5 text-zinc-400" />;
    case "mention":         return <AtSign className="h-3.5 w-3.5 text-primary" />;
    case "review_requested":return <ArrowRight className="h-3.5 w-3.5 text-blue-400" />;
    case "review_approved": return <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />;
    case "review_rejected": return <XCircle className="h-3.5 w-3.5 text-red-400" />;
    default:                return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

// ============================================================
// MAIN PAGE — Mission Control HQ
// ============================================================

export default function MissionControlHQ() {
  const {
    agents, tasks, activity, selectedTaskId, selectTask,
    autonomyEnabled, setAutonomyEnabled,
    executionMode, setExecutionMode, gatewayConnected,
    clearAll,
  } = useTeam();

  const [assignOpen, setAssignOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const openTask = (task: Task) => {
    selectTask(task.id);
    setDetailOpen(true);
  };

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  const backlog     = tasks.filter((t) => t.status === "backlog");
  const inProgress  = tasks.filter((t) => t.status === "in_progress" || t.status === "claimed");
  const inReview    = tasks.filter((t) => t.status === "review");
  const blocked     = tasks.filter((t) => t.status === "blocked");
  const done        = tasks.filter((t) => t.status === "done");

  const busyAgents = agents.filter((a) => a.status === "busy");

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

      {/* ── HEADER ──────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Radio className="h-5 w-5 text-primary" />
            </div>
            Mission Control HQ
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            10-agent autonomous squad · {busyAgents.length} working ·{" "}
            {inProgress.length} in progress · {blocked.length > 0 && (
              <span className="text-amber-400 font-medium">{blocked.length} blocked · </span>
            )}{done.length} done
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Execution mode toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-card/40 p-1">
            <button
              onClick={() => setExecutionMode("simulation")}
              className={cn(
                "h-7 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors",
                executionMode === "simulation"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Simulation
            </button>
            <button
              onClick={() => setExecutionMode("real")}
              disabled={!gatewayConnected}
              className={cn(
                "h-7 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors",
                executionMode === "real"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "text-muted-foreground hover:text-foreground",
                !gatewayConnected && "opacity-40 cursor-not-allowed"
              )}
              title={!gatewayConnected ? "Gateway disconnected" : "Use real Claude sessions (costs tokens)"}
            >
              <Zap className="h-3 w-3" />
              Real
            </button>
          </div>

          <Button
            size="sm"
            variant={autonomyEnabled ? "default" : "outline"}
            onClick={() => setAutonomyEnabled(!autonomyEnabled)}
            className={autonomyEnabled ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            {autonomyEnabled ? (
              <><Pause className="h-4 w-4 mr-2" />Autonomy ON</>
            ) : (
              <><Play className="h-4 w-4 mr-2" />Start Autonomy</>
            )}
          </Button>
          {tasks.length > 0 && (
            <Button size="sm" variant="outline" onClick={clearAll} className="text-muted-foreground">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear
            </Button>
          )}
          <Button size="sm" onClick={() => setAssignOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Mission
          </Button>
        </div>
      </div>

      {/* Status banners */}
      {autonomyEnabled && executionMode === "real" && gatewayConnected && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 flex items-center gap-3">
          <Zap className="h-4 w-4 text-emerald-400" />
          <p className="text-sm flex-1">
            <span className="font-semibold text-emerald-400">Real execution active.</span>{" "}
            <span className="text-muted-foreground">Agents spawn live OpenClaw sessions when they claim tasks. Token costs apply — monitor usage.</span>
          </p>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <Wifi className="h-3.5 w-3.5" />
            <span>gateway connected</span>
          </div>
        </div>
      )}
      {autonomyEnabled && executionMode === "simulation" && (
        <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 px-4 py-3 flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
          <p className="text-sm">
            <span className="font-semibold text-blue-400">Simulation running.</span>{" "}
            <span className="text-muted-foreground">Agents move tasks through stages with templated comments — no real Claude calls. Switch to Real mode for live execution.</span>
          </p>
        </div>
      )}
      {executionMode === "real" && !gatewayConnected && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 flex items-center gap-3">
          <WifiOff className="h-4 w-4 text-red-400" />
          <p className="text-sm">
            <span className="font-semibold text-red-400">Gateway disconnected.</span>{" "}
            <span className="text-muted-foreground">Real execution needs the OpenClaw gateway at ws://127.0.0.1:18789. Check your OpenClaw service and reload.</span>
          </p>
        </div>
      )}

      {/* ── STATS ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "Squad",        value: `${agents.filter(a => a.status !== "offline").length}/${agents.length}`, icon: Users,      color: "text-primary bg-primary/10" },
          { label: "Backlog",      value: backlog.length,    icon: Rocket,     color: "text-zinc-400 bg-zinc-500/10" },
          { label: "In Progress",  value: inProgress.length, icon: Play,       color: "text-amber-400 bg-amber-500/10" },
          { label: "In Review",    value: inReview.length,   icon: CheckCheck, color: "text-violet-400 bg-violet-500/10" },
          { label: "Blocked",      value: blocked.length,    icon: HelpCircle, color: "text-yellow-400 bg-yellow-500/10" },
          { label: "Done",         value: done.length,       icon: CheckCheck, color: "text-emerald-400 bg-emerald-500/10" },
        ].map((s) => (
          <Card key={s.label} className="border-border/50 bg-card/60">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-0.5">{s.value}</p>
                </div>
                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", s.color)}>
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── MAIN GRID: squad + activity feed ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Squad grid */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            The Squad
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                currentTask={tasks.find((t) => t.id === agent.currentTaskId) ?? null}
                onClick={(task) => task && openTask(task)}
              />
            ))}
          </div>

          {/* Mini mission board preview */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Rocket className="h-3.5 w-3.5" />
                Mission Board
              </h2>
              <a href="/kanban" className="text-xs text-primary hover:text-primary/80">Open full board →</a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MiniColumn title="Backlog" count={backlog.length} tasks={backlog.slice(0, 3)} onTaskClick={openTask} />
              <MiniColumn title="Active" count={inProgress.length} tasks={inProgress.slice(0, 3)} onTaskClick={openTask} />
              <MiniColumn title="Review" count={inReview.length} tasks={inReview.slice(0, 3)} onTaskClick={openTask} />
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div>
          <div className="sticky top-20">
            <ActivityFeed activity={activity} onTaskClick={(id) => {
              const t = tasks.find((x) => x.id === id);
              if (t) openTask(t);
            }} />
          </div>
        </div>
      </div>

      <AssignMissionDialog open={assignOpen} onOpenChange={setAssignOpen} />
      <TaskDetailSheet task={selectedTask} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}

// ============================================================
// AGENT CARD
// ============================================================

function AgentCard({
  agent, currentTask, onClick,
}: {
  agent: SquadAgent;
  currentTask: Task | null;
  onClick: (task: Task | null) => void;
}) {
  const statusDot: Record<string, string> = {
    online:  "bg-emerald-500",
    busy:    "bg-amber-500 animate-pulse",
    idle:    "bg-blue-400",
    offline: "bg-zinc-500",
  };

  return (
    <Card className={cn(
      "border-border/50 bg-card/60 hover:shadow-lg transition-all",
      agent.status === "busy" && "border-amber-500/20 bg-amber-500/5",
      currentTask && "cursor-pointer"
    )}
    onClick={() => currentTask && onClick(currentTask)}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center text-base font-bold text-white", agent.color)}>
              {agent.avatar}
            </div>
            <span className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background", statusDot[agent.status])} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{agent.name}</span>
              {agent.specialty === "orchestration" && <Crown className="h-3 w-3 text-amber-400" />}
            </div>
            <p className="text-xs text-muted-foreground truncate">{agent.title}</p>
            <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">{agent.codename}</p>

            {currentTask ? (
              <div className="mt-2 p-2 rounded-md bg-background/60 border border-border/30">
                <p className="text-xs font-medium truncate">{currentTask.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                  {currentTask.status.replace("_", " ")}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1.5">{agent.description.slice(0, 80)}…</p>
            )}

            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
              <span>{agent.stats.tasksCompleted} done</span>
              <span>·</span>
              <span>{agent.stats.commentsPosted} comments</span>
              {agent.stats.reviewsGiven > 0 && (<><span>·</span><span>{agent.stats.reviewsGiven} reviews</span></>)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// MINI COLUMN (mission board preview)
// ============================================================

function MiniColumn({
  title, count, tasks, onTaskClick,
}: {
  title: string;
  count: number;
  tasks: Task[];
  onTaskClick: (t: Task) => void;
}) {
  return (
    <Card className="border-border/50 bg-card/60">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
          {title}
          <Badge variant="secondary" className="text-xs">{count}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 py-2 text-center">empty</p>
        ) : (
          tasks.map((t) => (
            <button
              key={t.id}
              onClick={() => onTaskClick(t)}
              className="w-full text-left p-2 rounded-md bg-muted/30 hover:bg-muted/60 transition-colors border border-border/20"
            >
              <div className="flex items-start gap-1.5">
                {t.priority === "critical" && <Flame className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />}
                {t.priority === "high" && <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />}
                <p className="text-xs line-clamp-2 flex-1">{t.title}</p>
              </div>
              {t.assigneeId && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <AgentAvatar agentId={t.assigneeId} size="sm" />
                  <span className="text-[11px] text-muted-foreground truncate">{getAgent(t.assigneeId)?.name}</span>
                </div>
              )}
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// ACTIVITY FEED
// ============================================================

function ActivityFeed({
  activity, onTaskClick,
}: {
  activity: ActivityEvent[];
  onTaskClick: (taskId: string) => void;
}) {
  return (
    <Card className="border-border/50 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Live Activity
          <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          {activity.length === 0 ? (
            <div className="py-12 text-center">
              <Activity className="h-10 w-10 mx-auto text-muted-foreground/15 mb-3" />
              <p className="text-sm text-muted-foreground">No activity yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Create a mission to start the squad</p>
            </div>
          ) : (
            <div className="space-y-2.5 pr-3">
              {activity.slice(0, 100).map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => onTaskClick(ev.taskId)}
                  className="w-full flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-muted/40 transition-colors text-left"
                >
                  <AgentAvatar agentId={ev.actorId} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <ActivityIcon type={ev.type} />
                      <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{elapsed(ev.timestamp)}</span>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed">{ev.message}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

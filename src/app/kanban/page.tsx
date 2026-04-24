"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTeam } from "@/lib/team-context";
import {
  SQUAD,
  getAgent,
  type Task,
  type TaskStatus,
} from "@/lib/team-store";
import { AssignMissionDialog } from "@/components/assign-mission-dialog";
import { TaskDetailSheet } from "@/components/task-detail-sheet";
import {
  Plus,
  Kanban,
  Flame,
  AlertTriangle,
  MessageSquare,
  Clock,
  HelpCircle,
  CheckCheck,
  Play,
  User,
  Check,
  Zap,
} from "lucide-react";
import { cn, elapsedShort } from "@/lib/utils";
import { AgentAvatar } from "@/components/agent-avatar";

const COLUMNS: { id: TaskStatus; label: string; color: string; icon: typeof Clock }[] = [
  { id: "backlog",     label: "Backlog",     color: "text-zinc-400",   icon: Clock },
  { id: "claimed",     label: "Claimed",     color: "text-blue-400",   icon: User },
  { id: "in_progress", label: "In Progress", color: "text-amber-400",  icon: Play },
  { id: "review",      label: "Review",      color: "text-violet-400", icon: CheckCheck },
  { id: "blocked",     label: "Blocked",     color: "text-yellow-400", icon: HelpCircle },
  { id: "done",        label: "Done",        color: "text-emerald-400", icon: Check },
];

export default function MissionBoardPage() {
  const { tasks, selectTask, selectedTaskId } = useTeam();
  const [assignOpen, setAssignOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [specialtyFilter, setSpecialtyFilter] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);

  const openTask = (t: Task) => {
    selectTask(t.id);
    setDetailOpen(true);
  };

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  const filteredTasks = tasks.filter((t) => {
    if (specialtyFilter && t.specialty !== specialtyFilter) return false;
    if (assigneeFilter && t.assigneeId !== assigneeFilter) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-5 max-w-[1800px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Kanban className="h-5 w-5 text-primary" />
            </div>
            Mission Board
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredTasks.length} mission{filteredTasks.length !== 1 ? "s" : ""} · click any card to open
          </p>
        </div>
        <Button size="sm" onClick={() => setAssignOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Mission
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Filters:</span>

        {/* Specialty filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm" variant={!specialtyFilter ? "secondary" : "ghost"}
            className="h-7 text-xs px-2.5"
            onClick={() => setSpecialtyFilter(null)}
          >All</Button>
          {["development", "research", "qa", "security", "devops", "architecture", "writing"].map((s) => (
            <Button
              key={s} size="sm"
              variant={specialtyFilter === s ? "secondary" : "ghost"}
              className="h-7 text-xs px-2.5 capitalize"
              onClick={() => setSpecialtyFilter(specialtyFilter === s ? null : s)}
            >{s}</Button>
          ))}
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Assignee filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm" variant={!assigneeFilter ? "secondary" : "ghost"}
            className="h-7 text-xs px-2.5"
            onClick={() => setAssigneeFilter(null)}
          >Everyone</Button>
          {SQUAD.map((a) => (
            <button
              key={a.id}
              onClick={() => setAssigneeFilter(assigneeFilter === a.id ? null : a.id)}
              className={cn(
                "h-7 w-7 rounded-md flex items-center justify-center text-xs font-bold text-white transition-all",
                a.color,
                assigneeFilter === a.id ? "ring-2 ring-primary/50 scale-110" : "opacity-70 hover:opacity-100"
              )}
              title={a.name}
            >
              {a.avatar}
            </button>
          ))}
        </div>
      </div>

      {/* Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);
          const Icon = col.icon;
          return (
            <Card key={col.id} className="border-border/40 bg-card/40">
              <CardContent className="pt-3 pb-3 space-y-2">
                <div className="flex items-center justify-between px-1 pb-2 border-b border-border/40">
                  <div className={cn("flex items-center gap-2 text-sm font-semibold", col.color)}>
                    <Icon className="h-3.5 w-3.5" />
                    {col.label}
                  </div>
                  <Badge variant="secondary" className="text-xs">{colTasks.length}</Badge>
                </div>

                <div className="space-y-2 min-h-[100px]">
                  {colTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 text-center py-4">—</p>
                  ) : (
                    colTasks.map((t) => <TaskCard key={t.id} task={t} onClick={() => openTask(t)} />)
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AssignMissionDialog open={assignOpen} onOpenChange={setAssignOpen} />
      <TaskDetailSheet task={selectedTask} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const priorityBar: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-amber-500",
    medium: "bg-blue-500",
    low: "bg-zinc-500",
  };

  const unresolvedQuestions = task.comments.filter((c) => c.type === "question").length -
                              task.comments.filter((c) => c.authorId === "user" && c.type === "comment").length;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-2.5 rounded-lg bg-background/60 hover:bg-muted/60 border border-border/30 transition-all relative overflow-hidden group"
    >
      {/* Priority bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", priorityBar[task.priority])} />

      <div className="pl-2 space-y-1.5">
        {/* Title */}
        <div className="flex items-start gap-1.5">
          {task.priority === "critical" && <Flame className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />}
          {task.priority === "high" && <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />}
          <p className="text-sm font-medium leading-tight flex-1">{task.title}</p>
          {task.sessionKey && (task.status === "in_progress" || task.status === "claimed") && (
            <span
              title={`Live OpenClaw session: ${task.sessionKey}`}
              className="shrink-0 flex items-center gap-0.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded"
            >
              <Zap className="h-2.5 w-2.5" />
              LIVE
            </span>
          )}
        </div>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] text-muted-foreground">#{tag}</span>
            ))}
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 pt-1">
          {task.assigneeId ? (
            <div className="flex items-center gap-1.5">
              <AgentAvatar agentId={task.assigneeId} />
              <span className="text-[11px] text-muted-foreground">{getAgent(task.assigneeId)?.name}</span>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">Unclaimed</span>
          )}

          <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
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

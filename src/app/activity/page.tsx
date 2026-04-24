"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTeam } from "@/lib/team-context";
import { SQUAD, getAgent, type ActivityEvent, type Task } from "@/lib/team-store";
import { TaskDetailSheet } from "@/components/task-detail-sheet";
import {
  Activity,
  Plus,
  Circle,
  Play,
  CheckCheck,
  XCircle,
  MessageSquare,
  AtSign,
  ArrowRight,
  HelpCircle,
  Search,
  Filter,
} from "lucide-react";
import { cn, elapsed } from "@/lib/utils";
import { AgentAvatar } from "@/components/agent-avatar";

const FILTER_GROUPS: { label: string; types: string[]; color: string }[] = [
  { label: "Tasks",     types: ["task_created", "task_claimed", "task_started", "task_completed", "task_blocked"], color: "text-primary" },
  { label: "Reviews",   types: ["review_requested", "review_approved", "review_rejected"], color: "text-violet-400" },
  { label: "Comms",     types: ["comment", "mention"], color: "text-emerald-400" },
];

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "task_created":     return <Plus className="h-4 w-4 text-blue-400" />;
    case "task_claimed":     return <Circle className="h-4 w-4 text-violet-400" />;
    case "task_started":     return <Play className="h-4 w-4 text-amber-400" />;
    case "task_completed":   return <CheckCheck className="h-4 w-4 text-emerald-400" />;
    case "task_blocked":     return <HelpCircle className="h-4 w-4 text-yellow-400" />;
    case "comment":          return <MessageSquare className="h-4 w-4 text-zinc-400" />;
    case "mention":          return <AtSign className="h-4 w-4 text-primary" />;
    case "review_requested": return <ArrowRight className="h-4 w-4 text-blue-400" />;
    case "review_approved":  return <CheckCheck className="h-4 w-4 text-emerald-400" />;
    case "review_rejected":  return <XCircle className="h-4 w-4 text-red-400" />;
    default:                 return <Activity className="h-4 w-4 text-muted-foreground" />;
  }
}

// Group activity by day
function groupByDay(events: ActivityEvent[]) {
  const groups: Record<string, ActivityEvent[]> = {};
  for (const ev of events) {
    const d = new Date(ev.timestamp);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yday = new Date(today.getTime() - 86400000);
    let key: string;
    if (d >= today) key = "Today";
    else if (d >= yday) key = "Yesterday";
    else key = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    if (!groups[key]) groups[key] = [];
    groups[key].push(ev);
  }
  return groups;
}

export default function ActivityPage() {
  const { activity, tasks, selectTask, selectedTaskId } = useTeam();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string[] | null>(null);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filtered = useMemo(() => {
    return activity.filter((ev) => {
      if (typeFilter && !typeFilter.includes(ev.type)) return false;
      if (agentFilter && ev.actorId !== agentFilter && ev.targetAgentId !== agentFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!ev.message.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [activity, typeFilter, agentFilter, search]);

  const grouped = groupByDay(filtered);

  const openTask = (taskId: string) => {
    selectTask(taskId);
    setDetailOpen(true);
  };
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  // Counts by agent
  const agentCounts = activity.reduce<Record<string, number>>((acc, ev) => {
    acc[ev.actorId] = (acc[ev.actorId] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          Activity Feed
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {activity.length} event{activity.length !== 1 ? "s" : ""} · showing {filtered.length}
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activity..."
              className="pl-9 h-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              size="sm" variant={!typeFilter ? "secondary" : "ghost"} className="h-8 text-xs"
              onClick={() => setTypeFilter(null)}
            >
              <Filter className="h-3 w-3 mr-1.5" />All
            </Button>
            {FILTER_GROUPS.map((g) => (
              <Button
                key={g.label} size="sm"
                variant={typeFilter === g.types ? "secondary" : "ghost"}
                className={cn("h-8 text-xs", g.color)}
                onClick={() => setTypeFilter(typeFilter === g.types ? null : g.types)}
              >
                {g.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Agent filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mr-1">Agent:</span>
          <Button size="sm" variant={!agentFilter ? "secondary" : "ghost"}
            className="h-7 text-xs px-2.5" onClick={() => setAgentFilter(null)}>
            All
          </Button>
          {SQUAD.map((a) => {
            const count = agentCounts[a.id] ?? 0;
            return (
              <button
                key={a.id}
                onClick={() => setAgentFilter(agentFilter === a.id ? null : a.id)}
                className={cn(
                  "h-7 px-2 rounded-md flex items-center gap-1.5 text-xs transition-all",
                  agentFilter === a.id ? "ring-1 ring-primary/40 bg-primary/10" : "hover:bg-muted/60 opacity-70 hover:opacity-100"
                )}
                title={a.name}
              >
                <div className={cn("h-4 w-4 rounded text-[9px] font-bold flex items-center justify-center text-white", a.color)}>
                  {a.avatar}
                </div>
                <span>{a.name}</span>
                <span className="text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feed */}
      <Card className="border-border/50 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Squad Activity
            {activity.length > 0 && <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground/15 mb-3" />
                <p className="text-base text-muted-foreground">
                  {activity.length === 0 ? "No activity yet" : "No events match your filters"}
                </p>
                <p className="text-sm text-muted-foreground/60 mt-1">
                  {activity.length === 0 && "Create a mission on the board to get the squad moving"}
                </p>
              </div>
            ) : (
              <div className="space-y-5 pr-3">
                {Object.entries(grouped).map(([day, events]) => (
                  <div key={day}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 sticky top-0 bg-card/95 backdrop-blur py-1 z-10">
                      {day} <span className="text-muted-foreground/60">· {events.length}</span>
                    </p>
                    <div className="space-y-2">
                      {events.map((ev) => (
                        <button
                          key={ev.id}
                          onClick={() => openTask(ev.taskId)}
                          className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-muted/40 transition-colors text-left"
                        >
                          <AgentAvatar agentId={ev.actorId} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <ActivityIcon type={ev.type} />
                              {ev.targetAgentId && (
                                <>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
                                  <AgentAvatar agentId={ev.targetAgentId} size="sm" />
                                </>
                              )}
                              <Badge variant="outline" className="text-[10px] capitalize ml-auto text-muted-foreground border-border/40">
                                {ev.type.replace(/_/g, " ")}
                              </Badge>
                              <span className="text-xs text-muted-foreground shrink-0">{elapsed(ev.timestamp)}</span>
                            </div>
                            <p className="text-sm text-foreground/90 leading-relaxed">{ev.message}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <TaskDetailSheet task={selectedTask} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}

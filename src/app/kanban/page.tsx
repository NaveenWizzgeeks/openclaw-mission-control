"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOpenClaw } from "@/lib/openclaw-context";
import { ConnectionStatus } from "@/components/connection-status";
import { Loader2, Server } from "lucide-react";

export default function KanbanPage() {
  const { loading, sessions, cronJobs } = useOpenClaw();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const columns = [
    {
      id: "idle",
      label: "Idle",
      color: "text-zinc-400",
      dotColor: "bg-zinc-400",
      items: sessions.filter((s) => s.status !== "running"),
    },
    {
      id: "running",
      label: "Running",
      color: "text-emerald-400",
      dotColor: "bg-emerald-400",
      items: sessions.filter((s) => s.status === "running"),
    },
    {
      id: "scheduled",
      label: "Scheduled Jobs",
      color: "text-amber-400",
      dotColor: "bg-amber-400",
      items: cronJobs.filter((j) => j.enabled),
    },
    {
      id: "disabled",
      label: "Disabled Jobs",
      color: "text-zinc-500",
      dotColor: "bg-zinc-500",
      items: cronJobs.filter((j) => !j.enabled),
    },
  ];

  return (
    <div className="p-6 space-y-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kanban Board</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sessions and jobs organized by status
          </p>
        </div>
        <ConnectionStatus />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div key={col.id} className="min-w-[280px] w-[280px] flex-shrink-0">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className={`h-2.5 w-2.5 rounded-full ${col.dotColor}`} />
              <h3 className={`text-sm font-semibold ${col.color}`}>{col.label}</h3>
              <span className="text-xs text-muted-foreground ml-auto bg-muted px-1.5 py-0.5 rounded-full">
                {col.items.length}
              </span>
            </div>

            <div className="space-y-2.5 min-h-[200px] p-2 rounded-xl border border-dashed border-border/50 bg-muted/20">
              {col.items.length === 0 ? (
                <div className="flex items-center justify-center h-[100px] text-xs text-muted-foreground/50">
                  Empty
                </div>
              ) : (
                col.items.map((item: unknown) => {
                  const isSession = "sessionId" in (item as Record<string, unknown>);
                  if (isSession) {
                    const s = item as typeof sessions[0];
                    return (
                      <Card
                        key={s.key}
                        className="border-border/50 bg-card hover:bg-muted/50 transition-all"
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-mono truncate">{s.key}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="secondary" className="text-[10px]">
                              {s.model}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">
                              {s.channel}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>{((s.totalTokens || 0) / 1000).toFixed(1)}K tokens</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                s.status === "running"
                                  ? "text-emerald-400 border-emerald-500/30"
                                  : "text-zinc-400"
                              }`}
                            >
                              {s.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  } else {
                    const j = item as typeof cronJobs[0];
                    return (
                      <Card
                        key={j.id}
                        className="border-border/50 bg-card hover:bg-muted/50 transition-all"
                      >
                        <CardContent className="p-3 space-y-2">
                          <span className="text-sm font-medium">{j.name || j.id}</span>
                          {j.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {j.description}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px]">
                              {j.schedule?.kind || "unknown"}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">
                              {j.payload?.kind || ""}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

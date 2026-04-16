"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOpenClaw } from "@/lib/openclaw-context";
import { ConnectionStatus } from "@/components/connection-status";
import { Loader2, Server, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ActivityPage() {
  const { loading, sessions, cronJobs, refresh } = useOpenClaw();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allItems = [
    ...sessions.map((s) => ({
      key: s.key,
      type: "session" as const,
      label: s.key,
      status: s.status,
      model: s.model,
      channel: s.channel,
      tokens: s.totalTokens || 0,
      updatedAt: s.updatedAt,
    })),
    ...cronJobs.map((j) => ({
      key: j.id,
      type: "cron" as const,
      label: j.name || j.id,
      status: j.enabled ? "enabled" : "disabled",
      model: "",
      channel: j.payload?.kind || "",
      tokens: 0,
      updatedAt: j.lastRunAt ? new Date(j.lastRunAt).getTime() : 0,
    })),
  ].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live session and job activity from OpenClaw
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => refresh()}
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
          <ConnectionStatus />
        </div>
      </div>

      {allItems.length === 0 ? (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="py-12 text-center">
            <Server className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No activity yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border/50" />
          <div className="space-y-2">
            {allItems.map((item) => (
              <div key={item.key} className="flex items-start gap-4 pl-2">
                <div className="flex items-center justify-center h-[38px] w-[38px] shrink-0 z-10">
                  <div
                    className={`text-base ${
                      item.type === "session" ? "" : ""
                    }`}
                  >
                    {item.type === "session"
                      ? item.status === "running"
                        ? "🟢"
                        : "🔵"
                      : item.status === "enabled"
                      ? "⏰"
                      : "⏸️"}
                  </div>
                </div>

                <Card className="flex-1 border-border/50 bg-card/50 hover:bg-muted/30 transition-colors">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px]">
                            {item.type}
                          </Badge>
                          <span className="text-sm font-medium font-mono truncate">
                            {item.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {item.model && <span>{item.model}</span>}
                          {item.channel && (
                            <>
                              <span>·</span>
                              <span>{item.channel}</span>
                            </>
                          )}
                          {item.tokens > 0 && (
                            <>
                              <span>·</span>
                              <span className="font-mono">
                                {(item.tokens / 1000).toFixed(1)}K tokens
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            item.status === "running" || item.status === "enabled"
                              ? "text-emerald-400 border-emerald-500/30"
                              : "text-zinc-400"
                          }`}
                        >
                          {item.status}
                        </Badge>
                        {item.updatedAt > 0 && (
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {new Date(item.updatedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

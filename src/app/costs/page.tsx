"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOpenClaw } from "@/lib/openclaw-context";
import { ConnectionStatus } from "@/components/connection-status";
import { Cpu, Loader2, Server } from "lucide-react";

export default function CostsPage() {
  const { loading, sessions, models, status } = useOpenClaw();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalTokens = sessions.reduce((s, sess) => s + (sess.totalTokens || 0), 0);
  const totalContext = sessions.reduce((s, sess) => s + (sess.contextTokens || 0), 0);

  const sessionsByModel = new Map<string, { count: number; tokens: number }>();
  for (const s of sessions) {
    const model = s.model || "unknown";
    const existing = sessionsByModel.get(model) || { count: 0, tokens: 0 };
    existing.count++;
    existing.tokens += s.totalTokens || 0;
    sessionsByModel.set(model, existing);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usage & Costs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Token usage and model utilization
          </p>
        </div>
        <ConnectionStatus />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Tokens Used</p>
            <p className="text-3xl font-bold mt-1 font-mono">
              {(totalTokens / 1000).toFixed(1)}K
            </p>
            <p className="text-xs text-muted-foreground mt-1">across all sessions</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Context Capacity</p>
            <p className="text-3xl font-bold mt-1 font-mono">
              {(totalContext / 1000).toFixed(0)}K
            </p>
            <p className="text-xs text-muted-foreground mt-1">total context window</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Active Models</p>
            <p className="text-3xl font-bold mt-1">{sessionsByModel.size}</p>
            <p className="text-xs text-muted-foreground mt-1">in use</p>
          </CardContent>
        </Card>
      </div>

      {/* Usage by Model */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Usage by Model</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionsByModel.size === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No usage data</p>
          ) : (
            Array.from(sessionsByModel.entries())
              .sort((a, b) => b[1].tokens - a[1].tokens)
              .map(([model, data]) => {
                const pct = totalTokens > 0 ? (data.tokens / totalTokens) * 100 : 0;
                return (
                  <div key={model} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-mono">{model}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {data.count} session{data.count !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <span className="text-sm font-mono">
                        {(data.tokens / 1000).toFixed(1)}K tokens
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-10 text-right">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })
          )}
        </CardContent>
      </Card>

      {/* Session Token Details */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Session Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sessions.map((session) => {
            const utilization =
              session.contextTokens > 0
                ? ((session.totalTokens / session.contextTokens) * 100).toFixed(0)
                : "0";
            return (
              <div
                key={session.key}
                className="flex items-center justify-between p-3 rounded-lg border border-border/50"
              >
                <div className="flex items-center gap-3">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-mono">{session.key}</p>
                    <p className="text-xs text-muted-foreground">{session.model}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-mono">
                      {((session.totalTokens || 0) / 1000).toFixed(1)}K
                    </p>
                    <p className="text-[10px] text-muted-foreground">used</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono">
                      {((session.contextTokens || 0) / 1000).toFixed(0)}K
                    </p>
                    <p className="text-[10px] text-muted-foreground">context</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono">{utilization}%</p>
                    <p className="text-[10px] text-muted-foreground">used</p>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

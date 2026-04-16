"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOpenClaw } from "@/lib/openclaw-context";
import { useChatContext } from "@/lib/chat-context";
import { ConnectionStatus } from "@/components/connection-status";
import {
  Bot,
  Zap,
  Server,
  Cpu,
  Clock,
  Loader2,
  MessageSquare,
} from "lucide-react";

export default function Dashboard() {
  const { loading, sessions, agents, cronJobs, models, tools, status } =
    useOpenClaw();
  const { openChat } = useChatContext();

  const activeSessions = sessions.filter((s) => s.status === "running");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Connecting to OpenClaw gateway...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live overview of your OpenClaw instance
          </p>
        </div>
        <ConnectionStatus />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Sessions</p>
                <p className="text-3xl font-bold mt-1">{activeSessions.length}</p>
                <p className="text-xs text-muted-foreground mt-1">of {sessions.length} total</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Zap className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Agents</p>
                <p className="text-3xl font-bold mt-1">{agents.length}</p>
                <p className="text-xs text-muted-foreground mt-1">registered agents</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Bot className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cron Jobs</p>
                <p className="text-3xl font-bold mt-1">{cronJobs.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {cronJobs.filter((j) => j.enabled).length} enabled
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Models</p>
                <p className="text-3xl font-bold mt-1">{models.length}</p>
                <p className="text-xs text-muted-foreground mt-1">available models</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Cpu className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions */}
        <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Sessions</CardTitle>
              <span className="text-xs text-muted-foreground">{sessions.length} total</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No active sessions</p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.key}
                  className="flex items-center gap-4 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => openChat(session)}
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Server className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{session.key}</span>
                      <div
                        className={`h-2 w-2 rounded-full ${
                          session.status === "running"
                            ? "bg-emerald-500"
                            : session.status === "idle"
                            ? "bg-amber-500"
                            : "bg-zinc-500"
                        }`}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {session.channel} · {session.model}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono">
                      {((session.totalTokens || 0) / 1000).toFixed(1)}K
                    </p>
                    <p className="text-xs text-muted-foreground">tokens</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        session.status === "running"
                          ? "text-emerald-400 border-emerald-500/30"
                          : "text-zinc-400"
                      }`}
                    >
                      {session.status}
                    </Badge>
                    <MessageSquare className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* System Info */}
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {status && typeof status === "object" && "raw" in status && status.raw ? (
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {String(status.raw)}
              </pre>
            ) : status ? (
              <div className="space-y-3">
                {Object.entries(status).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground capitalize">{key}</span>
                    <span className="font-mono truncate max-w-[200px]">
                      {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">No status data</p>
            )}

            <div className="pt-3 border-t border-border/50 space-y-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Available Tools
              </p>
              <p className="text-xs text-muted-foreground">
                {tools.length} tools registered
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Models & Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Available Models</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {models.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No models found</p>
            ) : (
              models.map((model, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg border border-border/50"
                >
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-mono">
                      {typeof model === "string" ? model : model.id || model.name || JSON.stringify(model)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Scheduled Jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cronJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No scheduled jobs yet
              </p>
            ) : (
              cronJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-2 rounded-lg border border-border/50"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-sm font-medium">{job.name || job.id}</span>
                      {job.description && (
                        <p className="text-xs text-muted-foreground">{job.description}</p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      job.enabled ? "text-emerald-400 border-emerald-500/30" : "text-zinc-400"
                    }`}
                  >
                    {job.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

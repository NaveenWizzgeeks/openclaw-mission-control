"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOpenClaw } from "@/lib/openclaw-context";
import { useChatContext } from "@/lib/chat-context";
import { ConnectionStatus } from "@/components/connection-status";
import { SpawnTaskDialog } from "@/components/spawn-task-dialog";
import { Bot, Cpu, MessageSquare, Rocket, Send } from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";

export default function AgentsPage() {
  const { loading, agents, sessions } = useOpenClaw();
  const { openChat } = useChatContext();
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [spawnAgent, setSpawnAgent] = useState<string | undefined>();

  if (loading) return <LoadingSpinner />;

  function getAgentSessions(agentId: string) {
    return sessions.filter(
      (s) => s.key.includes(agentId) || s.agentId === agentId
    );
  }

  function openSpawnForAgent(agentId?: string) {
    setSpawnAgent(agentId);
    setSpawnOpen(true);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registered agents in your OpenClaw instance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => openSpawnForAgent()}>
            <Rocket className="h-4 w-4 mr-2" />
            Spawn Task
          </Button>
          <ConnectionStatus />
        </div>
      </div>

      {agents.length === 0 ? (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="py-12 text-center">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No agents registered yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Configure agents in your openclaw.json to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const agentSessions = getAgentSessions(agent.id);
            const activeSessions = agentSessions.filter((s) => s.status === "running");
            const totalTokens = agentSessions.reduce(
              (s, sess) => s + (sess.totalTokens || 0),
              0
            );

            return (
              <Card
                key={agent.id}
                className="border-border/50 bg-card/50 hover:shadow-lg transition-all"
              >
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Bot className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{agent.name || agent.id}</h3>
                        <p className="text-xs text-muted-foreground">
                          {agent.role || "Agent"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          activeSessions.length > 0
                            ? "text-emerald-400 border-emerald-500/20"
                            : "text-zinc-400 border-zinc-500/20"
                        }`}
                      >
                        {activeSessions.length > 0 ? "Active" : "Idle"}
                      </Badge>
                    </div>
                  </div>

                  {agent.model && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Cpu className="h-3 w-3" />
                      {typeof agent.model === "string" ? agent.model : agent.model.primary}
                    </Badge>
                  )}

                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/50">
                    <div className="text-center">
                      <p className="text-lg font-bold">{activeSessions.length}</p>
                      <p className="text-[10px] text-muted-foreground">Active</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold">{agentSessions.length}</p>
                      <p className="text-[10px] text-muted-foreground">Sessions</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold font-mono">
                        {(totalTokens / 1000).toFixed(0)}K
                      </p>
                      <p className="text-[10px] text-muted-foreground">Tokens</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        agent.configured
                          ? "text-emerald-400 border-emerald-500/30"
                          : "text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {agent.configured ? "Configured" : "Default config"}
                    </Badge>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => openSpawnForAgent(agent.id)}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Assign Task
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sessions linked to agents */}
      {sessions.length > 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-sm mb-3">All Sessions</h3>
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.key}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => openChat(session)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        session.status === "running" ? "bg-emerald-500" : "bg-zinc-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium font-mono">{session.key}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.channel} · {session.model}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground">
                      {((session.totalTokens || 0) / 1000).toFixed(1)}K tokens
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {session.status}
                    </Badge>
                    <MessageSquare className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <SpawnTaskDialog
        open={spawnOpen}
        onOpenChange={setSpawnOpen}
        preselectedAgent={spawnAgent}
      />
    </div>
  );
}

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOpenClaw } from "@/lib/openclaw-context";
import { ConnectionStatus } from "@/components/connection-status";
import { FolderOpen, Bot, Cpu, Server } from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";

export default function ProjectsPage() {
  const { loading, agents, sessions, models, tools, config } = useOpenClaw();

  if (loading) return <LoadingSpinner />;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = (config || {}) as any;
  const workspace: string | null = cfg?.agents?.defaults?.workspace ?? null;
  const pluginEntries = cfg?.plugins?.entries ?? {};
  const enabledPlugins: [string, Record<string, unknown>][] = Object.entries(pluginEntries).filter(
    ([, v]) => (v as Record<string, unknown>)?.enabled
  ) as [string, Record<string, unknown>][];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects & Config</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your OpenClaw instance configuration and resources
          </p>
        </div>
        <ConnectionStatus />
      </div>

      {/* Instance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Agents</p>
                <p className="text-3xl font-bold mt-1">{agents.length}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Bot className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Models</p>
                <p className="text-3xl font-bold mt-1">{models.length}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Cpu className="h-6 w-6 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tools</p>
                <p className="text-3xl font-bold mt-1">{tools.length}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Server className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Plugins</p>
                <p className="text-3xl font-bold mt-1">{enabledPlugins.length}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <FolderOpen className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plugins */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-sm mb-3">Enabled Plugins</h3>
          {enabledPlugins.length === 0 ? (
            <p className="text-sm text-muted-foreground">No plugins enabled</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {enabledPlugins.map(([name]) => (
                <div
                  key={name}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/50"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-lg">
                    {name === "telegram"
                      ? "📨"
                      : name === "ollama"
                      ? "🦙"
                      : name === "anthropic"
                      ? "🤖"
                      : "🔌"}
                  </div>
                  <div>
                    <p className="text-sm font-medium capitalize">{name}</p>
                    <Badge
                      variant="outline"
                      className="text-[10px] text-emerald-400 border-emerald-500/30"
                    >
                      Active
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Models List */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-sm mb-3">Available Models</h3>
          <div className="space-y-2">
            {models.map((model, idx) => {
              const modelId = typeof model === "string" ? model : model.id || model.name || "";
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border/50"
                >
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-mono">{String(modelId)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Workspace Info */}
      {workspace && (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-sm mb-2">Workspace</h3>
            <p className="text-sm font-mono text-muted-foreground">{String(workspace)}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

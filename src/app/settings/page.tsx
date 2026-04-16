"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useOpenClaw } from "@/lib/openclaw-context";
import { ConnectionStatus } from "@/components/connection-status";
import { Loader2, Server, Key, Cpu, Plug, Shield } from "lucide-react";

export default function SettingsPage() {
  const { loading, config, health, status, models } = useOpenClaw();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cfg = (config || {}) as Record<string, unknown>;
  const gateway = cfg.gateway as Record<string, unknown> | undefined;
  const auth = cfg.auth as Record<string, unknown> | undefined;
  const agentDefaults = (cfg.agents as Record<string, Record<string, unknown>>)?.defaults;
  const plugins = (cfg.plugins as Record<string, Record<string, Record<string, unknown>>>)
    ?.entries;
  const toolsConfig = cfg.tools as Record<string, unknown> | undefined;
  const channels = cfg.channels as Record<string, unknown> | undefined;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live OpenClaw gateway configuration
          </p>
        </div>
        <ConnectionStatus />
      </div>

      {/* Gateway */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Gateway</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {gateway ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Mode</span>
                <span className="font-mono">{String(gateway.mode || "unknown")}</span>
              </div>
              <Separator className="bg-border/50" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Port</span>
                <span className="font-mono">{String(gateway.port || "")}</span>
              </div>
              <Separator className="bg-border/50" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bind</span>
                <span className="font-mono">{String(gateway.bind || "")}</span>
              </div>
              <Separator className="bg-border/50" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Auth</span>
                <span className="font-mono">
                  {String((gateway.auth as Record<string, unknown>)?.mode || "none")}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No gateway config</p>
          )}
        </CardContent>
      </Card>

      {/* Auth Profiles */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Auth Profiles</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {auth?.profiles ? (
            Object.entries(auth.profiles as Record<string, Record<string, unknown>>).map(
              ([name, profile]) => (
                <div key={name} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-mono">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {String(profile.provider || "")} · {String(profile.mode || "")}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                    Active
                  </Badge>
                </div>
              )
            )
          ) : (
            <p className="text-sm text-muted-foreground">No auth profiles</p>
          )}
        </CardContent>
      </Card>

      {/* Agent Defaults */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Agent Defaults</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {agentDefaults ? (
            <>
              {agentDefaults.workspace && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Workspace</span>
                    <span className="font-mono text-xs">{String(agentDefaults.workspace)}</span>
                  </div>
                  <Separator className="bg-border/50" />
                </>
              )}
              {agentDefaults.model && (
                <>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Primary Model</span>
                    <p className="font-mono text-xs mt-1">
                      {String(
                        (agentDefaults.model as Record<string, unknown>)?.primary || ""
                      )}
                    </p>
                  </div>
                  <Separator className="bg-border/50" />
                  <div className="text-sm">
                    <span className="text-muted-foreground">Fallbacks</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(
                        (agentDefaults.model as Record<string, unknown>)?.fallbacks as string[] ||
                        []
                      ).map((fb: string) => (
                        <Badge key={fb} variant="secondary" className="text-[10px] font-mono">
                          {fb}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No agent defaults</p>
          )}
        </CardContent>
      </Card>

      {/* Plugins */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Plugins</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {plugins ? (
            Object.entries(plugins).map(([name, conf]) => (
              <div key={name} className="flex items-center justify-between">
                <p className="text-sm font-medium capitalize">{name}</p>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    conf?.enabled
                      ? "text-emerald-400 border-emerald-500/30"
                      : "text-zinc-400 border-zinc-500/30"
                  }`}
                >
                  {conf?.enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No plugins</p>
          )}
        </CardContent>
      </Card>

      {/* Tools Config */}
      {toolsConfig && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Tools Configuration</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap bg-muted/30 p-3 rounded-lg">
              {JSON.stringify(toolsConfig, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Raw Status */}
      {status && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Raw Status</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap bg-muted/30 p-3 rounded-lg">
              {typeof status === "object" && "raw" in status
                ? String(status.raw)
                : JSON.stringify(status, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

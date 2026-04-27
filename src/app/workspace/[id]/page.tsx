"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket, Plus, Play, CheckCheck, Clock, AlertCircle,
  Loader2, Radio, ChevronRight, Trash2, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LiveFeed } from "@/components/live-feed";
import { MissionCreator } from "@/components/mission-creator";
import { cn } from "@/lib/utils";
import type { Mission, Workspace } from "@/lib/mission-types";

const STATUS_CONFIG: Record<Mission["status"], { label: string; color: string; bg: string; icon: React.ElementType }> = {
  received:      { label: "Received",    color: "text-[#8b949e]",  bg: "bg-[#8b949e]/10",  icon: Clock },
  clarification: { label: "Clarifying",  color: "text-[#ffa657]",  bg: "bg-[#ffa657]/10",  icon: AlertCircle },
  analyzing:     { label: "Analyzing",   color: "text-[#d2a8ff]",  bg: "bg-[#d2a8ff]/10",  icon: Loader2 },
  planned:       { label: "Planned",     color: "text-[#58a6ff]",  bg: "bg-[#58a6ff]/10",  icon: CheckCheck },
  queued:        { label: "Queued",      color: "text-[#8b949e]",  bg: "bg-[#8b949e]/10",  icon: Clock },
  executing:     { label: "Executing",   color: "text-[#ffa657]",  bg: "bg-[#ffa657]/10",  icon: Loader2 },
  paused:        { label: "Paused",      color: "text-[#8b949e]",  bg: "bg-[#8b949e]/10",  icon: Clock },
  done:          { label: "Done",        color: "text-[#3fb950]",  bg: "bg-[#3fb950]/10",  icon: CheckCheck },
};

function MissionCard({ mission, onClick, onDelete }: {
  mission: Mission;
  onClick: () => void;
  onDelete: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[mission.status];
  const Icon = cfg.icon;
  const doneCount = mission.tasks.filter((t) => t.status === "done").length;
  const progress = mission.tasks.length > 0 ? Math.round((doneCount / mission.tasks.length) * 100) : 0;
  const isAnimated = mission.status === "executing" || mission.status === "analyzing";

  return (
    <div
      className={cn(
        "group relative p-4 rounded-xl border border-[#30363d] bg-[#161b22]",
        "hover:border-[#58a6ff]/40 hover:bg-[#161b22] transition-all cursor-pointer"
      )}
      onClick={onClick}
    >
      {/* Status indicator line */}
      <div className={cn("absolute left-0 top-4 bottom-4 w-0.5 rounded-r-full", cfg.bg.replace("/10", ""))} />

      <div className="ml-2">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-[#e6edf3] leading-snug flex-1">{mission.title}</h3>
          <div className="flex items-center gap-2 shrink-0">
            <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", cfg.bg, cfg.color)}>
              <Icon className={cn("h-2.5 w-2.5", isAnimated && "animate-spin")} />
              {cfg.label}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(mission.id); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-[#8b949e] hover:text-[#f85149]"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {mission.description && (
          <p className="text-xs text-[#8b949e] line-clamp-2 mb-3">{mission.description}</p>
        )}

        {/* Progress bar (if has tasks) */}
        {mission.tasks.length > 0 && (
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center justify-between text-[10px] text-[#8b949e]">
              <span>{doneCount}/{mission.tasks.length} tasks</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1 bg-[#21262d] rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", mission.status === "done" ? "bg-[#3fb950]" : "bg-[#58a6ff]")}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-[#8b949e]">
            {mission.analystName && (
              <span>via {mission.analystName}</span>
            )}
            {mission.tasks.length > 0 && (
              <>
                <span>·</span>
                <span>{mission.tasks.length} tasks</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[#8b949e]">
            {new Date(mission.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [wsRes, msRes] = await Promise.all([
        fetch(`/api/workspaces/${id}`),
        fetch(`/api/missions?workspaceId=${id}`),
      ]);
      const wsData = await wsRes.json() as { ok: boolean; workspace: Workspace };
      const msData = await msRes.json() as { ok: boolean; missions: Mission[] };
      if (wsData.ok) setWorkspace(wsData.workspace);
      if (msData.ok) setMissions(msData.missions);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Poll for mission updates every 8s
  useEffect(() => {
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function handleDelete(missionId: string) {
    await fetch(`/api/missions/${missionId}`, { method: "DELETE" });
    setMissions((prev) => prev.filter((m) => m.id !== missionId));
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  const activeMissions = missions.filter((m) => !["done"].includes(m.status));
  const doneMissions = missions.filter((m) => m.status === "done");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 text-[#58a6ff] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6 max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{workspace?.icon ?? "🚀"}</span>
              <div>
                <h1 className="text-xl font-bold text-[#e6edf3]">{workspace?.name ?? "Workspace"}</h1>
                {workspace?.description && (
                  <p className="text-xs text-[#8b949e] mt-0.5">{workspace.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                className="text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]"
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              </Button>
              <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
                className="bg-[#58a6ff] hover:bg-[#58a6ff]/90 text-[#0d1117] font-semibold"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                New Mission
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total",     value: missions.length,                  color: "text-[#e6edf3]" },
              { label: "Active",    value: activeMissions.length,            color: "text-[#ffa657]" },
              { label: "Executing", value: missions.filter(m => m.status === "executing").length, color: "text-[#58a6ff]" },
              { label: "Done",      value: doneMissions.length,              color: "text-[#3fb950]" },
            ].map((s) => (
              <div key={s.label} className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
                <p className="text-[10px] text-[#8b949e] uppercase tracking-wider mb-1">{s.label}</p>
                <p className={cn("text-2xl font-bold font-mono", s.color)}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Active missions */}
          {activeMissions.length === 0 && doneMissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-[#21262d] flex items-center justify-center mb-4">
                <Radio className="h-8 w-8 text-[#30363d]" />
              </div>
              <h3 className="text-base font-semibold text-[#e6edf3] mb-2">No missions yet</h3>
              <p className="text-sm text-[#8b949e] max-w-sm mb-6">
                Give Jarvis a mission and the squad will handle everything — from requirements to execution.
              </p>
              <Button
                onClick={() => setCreateOpen(true)}
                className="bg-[#58a6ff] hover:bg-[#58a6ff]/90 text-[#0d1117] font-semibold"
              >
                <Rocket className="h-4 w-4 mr-2" />
                Launch First Mission
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {activeMissions.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Play className="h-3.5 w-3.5" />
                    Active ({activeMissions.length})
                  </h2>
                  <div className="space-y-3">
                    {activeMissions.map((m) => (
                      <MissionCard
                        key={m.id}
                        mission={m}
                        onClick={() => router.push(`/mission/${m.id}`)}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </div>
              )}

              {doneMissions.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CheckCheck className="h-3.5 w-3.5" />
                    Completed ({doneMissions.length})
                  </h2>
                  <div className="space-y-3">
                    {doneMissions.slice(0, 5).map((m) => (
                      <MissionCard
                        key={m.id}
                        mission={m}
                        onClick={() => router.push(`/mission/${m.id}`)}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Live Feed sidebar */}
      <div className="w-80 border-l border-[#30363d] shrink-0 hidden lg:flex flex-col">
        <LiveFeed className="h-full" />
      </div>

      <MissionCreator
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={id}
        onCreated={(m) => {
          setMissions((prev) => [{ ...m } as Mission, ...prev]);
          router.push(`/mission/${m.id}`);
        }}
      />
    </div>
  );
}

// Suppress unused import
void Badge;

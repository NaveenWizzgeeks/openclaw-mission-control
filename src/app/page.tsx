"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Rocket, CheckCheck, Play, Loader2, Globe,
  Users, Zap, Brain, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LiveFeed } from "@/components/live-feed";
import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";
import type { Mission } from "@/lib/mission-types";

function WorkspaceCard({
  workspace,
  missions,
  onClick,
  onDelete,
}: {
  workspace: { id: string; name: string; icon: string; color: string; description: string };
  missions: Mission[];
  onClick: () => void;
  onDelete: (id: string) => void;
}) {
  const active = missions.filter((m) => !["done"].includes(m.status));
  const done = missions.filter((m) => m.status === "done");
  const executing = missions.filter((m) => m.status === "executing");

  return (
    <div
      className="group relative p-5 rounded-xl border border-[#30363d] bg-[#161b22] hover:border-[#58a6ff]/50 hover:shadow-[0_0_20px_rgba(88,166,255,0.05)] transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#21262d] flex items-center justify-center text-xl">
            {workspace.icon}
          </div>
          <div>
            <h3 className="font-semibold text-[#e6edf3]">{workspace.name}</h3>
            {workspace.description && (
              <p className="text-xs text-[#8b949e] mt-0.5 line-clamp-1">{workspace.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(workspace.id); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-[#8b949e] hover:text-[#f85149]"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2.5 rounded-lg bg-[#0d1117]">
          <p className="text-lg font-bold text-[#e6edf3] font-mono">{active.length}</p>
          <p className="text-[10px] text-[#8b949e] mt-0.5">Active</p>
        </div>
        <div className="text-center p-2.5 rounded-lg bg-[#0d1117]">
          <p className="text-lg font-bold text-[#ffa657] font-mono">{executing.length}</p>
          <p className="text-[10px] text-[#8b949e] mt-0.5">Executing</p>
        </div>
        <div className="text-center p-2.5 rounded-lg bg-[#0d1117]">
          <p className="text-lg font-bold text-[#3fb950] font-mono">{done.length}</p>
          <p className="text-[10px] text-[#8b949e] mt-0.5">Done</p>
        </div>
      </div>

      {executing.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-[#ffa657]">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="truncate">{executing[0]?.title}</span>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { workspaces, createWorkspace, deleteWorkspace, loading } = useWorkspace();
  const [allMissions, setAllMissions] = useState<Mission[]>([]);
  const [creating, setCreating] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [newWsIcon, setNewWsIcon] = useState("🚀");
  const [showNewWs, setShowNewWs] = useState(false);

  useEffect(() => {
    async function fetchMissions() {
      const res = await fetch("/api/missions");
      const data = await res.json() as { ok: boolean; missions: Mission[] };
      if (data.ok) setAllMissions(data.missions);
    }
    fetchMissions();
    const id = setInterval(fetchMissions, 10_000);
    return () => clearInterval(id);
  }, []);

  async function handleCreateWorkspace() {
    if (!newWsName.trim()) return;
    setCreating(true);
    try {
      const ws = await createWorkspace({ name: newWsName.trim(), icon: newWsIcon });
      setNewWsName("");
      setShowNewWs(false);
      router.push(`/workspace/${ws.id}`);
    } finally {
      setCreating(false);
    }
  }

  const totalExecuting = allMissions.filter((m) => m.status === "executing").length;
  const totalActive = allMissions.filter((m) => !["done"].includes(m.status)).length;
  const totalDone = allMissions.filter((m) => m.status === "done").length;

  const EMOJIS = ["🚀", "⚡", "🔥", "🎯", "🌐", "🤖", "💡", "🔬", "🛡️", "📡"];

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Main */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-8 max-w-5xl">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#58a6ff]/15 flex items-center justify-center">
              <Zap className="h-5 w-5 text-[#58a6ff]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#e6edf3]">Mission Control</h1>
              <p className="text-xs text-[#8b949e]">Sequential multi-agent orchestration</p>
            </div>
          </div>

          {/* Global stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Workspaces", value: workspaces.length,  icon: Globe,     color: "text-[#58a6ff]",  bg: "bg-[#58a6ff]/10",  spin: false },
              { label: "Active",     value: totalActive,         icon: Play,      color: "text-[#ffa657]",  bg: "bg-[#ffa657]/10",  spin: false },
              { label: "Executing",  value: totalExecuting,      icon: Loader2,   color: "text-[#d2a8ff]",  bg: "bg-[#d2a8ff]/10",  spin: totalExecuting > 0 },
              { label: "Completed",  value: totalDone,           icon: CheckCheck,color: "text-[#3fb950]",  bg: "bg-[#3fb950]/10",  spin: false },
            ].map((s) => (
              <div key={s.label} className="p-4 rounded-xl bg-[#161b22] border border-[#30363d]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-[#8b949e] uppercase tracking-wider">{s.label}</p>
                  <div className={cn("h-6 w-6 rounded-md flex items-center justify-center", s.bg)}>
                    <s.icon className={cn("h-3.5 w-3.5", s.color, s.spin && "animate-spin")} />
                  </div>
                </div>
                <p className={cn("text-2xl font-bold font-mono", s.color)}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* How it works — show only when no workspaces */}
          {workspaces.length === 0 && !loading && (
            <div className="p-5 rounded-xl bg-[#58a6ff]/5 border border-[#58a6ff]/20">
              <h3 className="font-semibold text-[#e6edf3] mb-3 flex items-center gap-2">
                <Brain className="h-4 w-4 text-[#58a6ff]" />
                How it works
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#8b949e]">
                {[
                  { n: "1", title: "Give Jarvis a mission", desc: "No priority levels. Just describe what you want to build or accomplish." },
                  { n: "2", title: "Analyst gathers requirements", desc: "An analyst agent asks clarifying questions, researches, and breaks it into tasks." },
                  { n: "3", title: "Sequential execution", desc: "Tasks run one at a time in order. Heartbeat checks progress every 5 minutes." },
                ].map((step) => (
                  <div key={step.n} className="flex gap-3">
                    <div className="h-6 w-6 rounded-full bg-[#58a6ff]/15 flex items-center justify-center text-[#58a6ff] text-xs font-bold shrink-0 mt-0.5">{step.n}</div>
                    <div>
                      <p className="font-medium text-[#e6edf3] mb-0.5">{step.title}</p>
                      <p>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workspaces section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider flex items-center gap-2">
                <Globe className="h-3.5 w-3.5" />
                Workspaces
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setShowNewWs(true)}
                className="text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] text-xs h-7">
                <Plus className="h-3.5 w-3.5 mr-1" /> New
              </Button>
            </div>

            {showNewWs && (
              <div className="mb-4 p-4 rounded-xl border border-[#58a6ff]/30 bg-[#58a6ff]/5 space-y-3">
                <p className="text-xs font-semibold text-[#58a6ff]">Create workspace</p>
                <div className="flex gap-2 flex-wrap">
                  {EMOJIS.map((e) => (
                    <button key={e} onClick={() => setNewWsIcon(e)}
                      className={cn("h-8 w-8 rounded-lg text-base flex items-center justify-center transition-all",
                        newWsIcon === e ? "bg-[#58a6ff]/20 ring-1 ring-[#58a6ff]" : "bg-[#21262d] hover:bg-[#30363d]")}>
                      {e}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={newWsName} onChange={(e) => setNewWsName(e.target.value)}
                    placeholder="Workspace name" onKeyDown={(e) => e.key === "Enter" && handleCreateWorkspace()}
                    className="bg-[#0d1117] border-[#30363d] text-[#e6edf3] placeholder:text-[#484f58]" autoFocus />
                  <Button onClick={handleCreateWorkspace} disabled={!newWsName.trim() || creating}
                    className="bg-[#58a6ff] hover:bg-[#58a6ff]/90 text-[#0d1117] font-semibold shrink-0">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                  </Button>
                  <Button variant="ghost" onClick={() => setShowNewWs(false)}
                    className="text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] shrink-0">Cancel</Button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 text-[#58a6ff] animate-spin" />
              </div>
            ) : workspaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[#30363d] rounded-xl">
                <Globe className="h-10 w-10 text-[#30363d] mb-3" />
                <p className="text-sm font-medium text-[#e6edf3] mb-1">No workspaces yet</p>
                <p className="text-xs text-[#8b949e] mb-4">Create a workspace to organize your missions</p>
                <Button onClick={() => setShowNewWs(true)} size="sm"
                  className="bg-[#58a6ff] hover:bg-[#58a6ff]/90 text-[#0d1117] font-semibold">
                  <Plus className="h-4 w-4 mr-1.5" /> Create Workspace
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workspaces.map((ws) => (
                  <WorkspaceCard key={ws.id} workspace={ws}
                    missions={allMissions.filter((m) => m.workspaceId === ws.id)}
                    onClick={() => router.push(`/workspace/${ws.id}`)}
                    onDelete={deleteWorkspace} />
                ))}
              </div>
            )}
          </div>

          {/* Squad */}
          <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d]">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-[#8b949e]" />
              <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">The Squad</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "jarvis", name: "Jarvis", role: "Orchestrator", color: "#58a6ff", you: true },
                { id: "shuri",  name: "Shuri",  role: "Analyst",      color: "#d2a8ff" },
                { id: "banner", name: "Banner", role: "Research",      color: "#3fb950" },
                { id: "stark",  name: "Stark",  role: "Architect",     color: "#f85149" },
                { id: "vision", name: "Vision", role: "Dev",           color: "#ffa657" },
                { id: "cap",    name: "Cap",    role: "QA",            color: "#58a6ff" },
                { id: "hawkeye",name: "Hawkeye",role: "Security",      color: "#a371f7" },
                { id: "rocket", name: "Rocket", role: "DevOps",        color: "#fb923c" },
                { id: "loki",   name: "Loki",   role: "Writer",        color: "#4ade80" },
                { id: "fury",   name: "Fury",   role: "Strategy",      color: "#71717a" },
              ].map((a) => (
                <div key={a.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#21262d] border border-[#30363d]">
                  <div className="h-4 w-4 rounded text-[10px] font-bold flex items-center justify-center"
                    style={{ backgroundColor: a.color + "33", color: a.color }}>
                    {a.name[0]}
                  </div>
                  <span className="text-xs text-[#e6edf3]">{a.name}</span>
                  {a.you && <span className="text-[9px] text-[#58a6ff] font-semibold">you</span>}
                  <span className="text-[10px] text-[#484f58]">{a.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live Feed */}
      <div className="w-80 border-l border-[#30363d] shrink-0 hidden lg:flex flex-col">
        <LiveFeed className="h-full" />
      </div>
    </div>
  );
}

// suppress unused
void Rocket;

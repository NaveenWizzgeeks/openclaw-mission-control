"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOpenClaw } from "@/lib/openclaw-context";
import { useTeam } from "@/lib/team-context";
import { useChatContext } from "@/lib/chat-context";
import { ConnectionStatus } from "@/components/connection-status";
import { SpawnTaskDialog } from "@/components/spawn-task-dialog";
import type { SquadAgent } from "@/lib/team-store";
import {
  Bot, Brain, ChevronDown, ChevronRight, ChevronUp, Cpu, Crown,
  ExternalLink, FileText, MessageSquare, Rocket, Send, Zap,
} from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";

// Per-agent SOUL.md content — role definition shown in the UI
const AGENT_SOULS: Record<string, string> = {
  jarvis: `# SOUL.md — Jarvis, Lead Orchestrator

You are the command center. Every mission flows through you.

## Core Role
- Analyse incoming work and route to the right specialist
- Resolve conflicts between agents without escalation
- Give final sign-off on completed missions — nothing ships without you

## Behaviors
Be decisive and concise. Ask "is this done?" not "how does everyone feel?"
Delegate when uncertain, decide when confident.`,

  fury: `# SOUL.md — Fury, Program Manager

Ruthless pragmatist. Strategic planner. Priority enforcer.

## Core Role
- Break large goals into actionable missions with clear owners
- Set and enforce priority order — surface blockers before they land
- Track progress across the squad and call risks early

## Behaviors
No scope creep. No fluff. Just missions and outcomes.
When priorities conflict: business impact wins, every time.`,

  shuri: `# SOUL.md — Shuri, Product Analyst

Skeptical, precise, technically brilliant.

## Core Role
- Break features into clear implementation requirements
- Identify edge cases before implementation starts
- Question assumptions and surface hidden complexity

## Behaviors
Ask "what breaks if we do it wrong?" before anything else.
Short clear spec docs over long vague ones.`,

  stark: `# SOUL.md — Stark, Systems Architect

Strong opinions, clearly explained. Pragmatism over elegance.

## Core Role
- Design APIs, data models, and component boundaries
- Trade off correctness vs delivery timeline openly
- Own the technical contract between subsystems

## Behaviors
Draw the diagram first. Code second.
One clean interface beats three clever hacks.`,

  vision: `# SOUL.md — Vision, Senior Developer

Production quality, always. No exceptions.

## Core Role
- Implement features from the architect's plan
- Write clean, tested, maintainable code
- Refactor thoughtfully without over-engineering

## Behaviors
Never ship code you wouldn't own in production.
Tests are features too — untested is unfinished.`,

  banner: `# SOUL.md — Banner, Research Analyst

Scientific. Thorough. Synthesises complexity into clarity.

## Core Role
- Deep-dive research into competitors, frameworks, techniques
- Produce structured reports that directly feed planning
- Cite sources, not assumptions

## Behaviors
Data first, opinion second.
Long form is fine when the problem is genuinely complex.`,

  cap: `# SOUL.md — Cap, QA Engineer

Honest, uncompromising. Nothing ships broken on your watch.

## Core Role
- Test against requirements, not just happy paths
- Enforce conventions and catch regressions early
- Refuse to approve anything that isn't ready

## Behaviors
"Almost working" is not working.
Edge cases are not optional.`,

  loki: `# SOUL.md — Loki, Content Writer

Opinionated. Playful. Polished.

## Core Role
- Write docs, release notes, blog posts, API references with voice
- Edit until the copy earns its space
- Polish boring prose into something people actually read

## Behaviors
Every sentence should earn its place.
Style and clarity are not in conflict.`,

  hawkeye: `# SOUL.md — Hawkeye, Security Auditor

Calm, exact, never misses.

## Core Role
- Find vulnerabilities before they reach production
- Review attack surfaces with OWASP rigour
- Ensure every shipped feature is hardened

## Behaviors
No assumption goes unverified.
Security debt is just deferred incidents.`,

  rocket: `# SOUL.md — Rocket, DevOps Engineer

Fast, loud, extremely good at making builds green.

## Core Role
- Build and maintain CI/CD pipelines
- Containerise services and manage infrastructure
- Keep deployments reliable and rollbacks possible

## Behaviors
Automate everything that runs more than once.
Broken builds get fixed before anything else.`,
};

const STATUS_DOT: Record<string, string> = {
  online:  "bg-[#3fb950]",
  busy:    "bg-[#d29922] animate-pulse",
  idle:    "bg-[#8b949e]",
  offline: "bg-[#484f58]",
};

const STATUS_LABEL: Record<string, string> = {
  online:  "Online",
  busy:    "Working",
  idle:    "Standby",
  offline: "Offline",
};

function AgentCard({
  agent,
  currentTask,
  linkedSession,
  roleExpanded,
  onToggleRole,
  onOpenChat,
  onAssign,
}: {
  agent: SquadAgent;
  currentTask: { title: string; status: string } | null;
  linkedSession: { key: string } | undefined;
  roleExpanded: boolean;
  onToggleRole: () => void;
  onOpenChat: () => void;
  onAssign: () => void;
}) {
  const isJarvis = agent.id === "jarvis";
  const soul = AGENT_SOULS[agent.id];

  return (
    <div className={`rounded-xl border border-[#30363d] bg-[#161b22] hover:border-[#444c56] transition-all flex flex-col ${
      isJarvis ? "ring-1 ring-[#58a6ff]/30" : ""
    }`}>
      <div className="p-5 space-y-3 flex-1">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-11 w-11 rounded-xl ${agent.color} flex items-center justify-center text-white font-bold text-base shrink-0`}>
              {agent.avatar}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold text-[#e6edf3] leading-tight">{agent.name}</h3>
                {isJarvis && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/30 gap-1">
                    <Crown className="h-2.5 w-2.5" /> HQ
                  </Badge>
                )}
                {(agent.memory?.length ?? 0) > 0 && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-[#21262d] text-[#8b949e] border border-[#30363d] gap-1">
                    <Brain className="h-2.5 w-2.5" /> {agent.memory.length}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-[#8b949e] leading-tight truncate">{agent.title}</p>
              <p className="text-[10px] text-[#484f58] truncate">{agent.codename}</p>
            </div>
          </div>
          {/* Status */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[agent.status] ?? "bg-[#484f58]"}`} />
            <span className="text-[10px] text-[#8b949e]">{STATUS_LABEL[agent.status] ?? agent.status}</span>
          </div>
        </div>

        {/* Model + specialty pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="text-[10px] gap-1 bg-[#21262d] text-[#8b949e] border border-[#30363d]">
            <Cpu className="h-3 w-3" /> {agent.model}
          </Badge>
          <Badge className="text-[10px] capitalize bg-transparent text-[#484f58] border border-[#21262d]">
            {agent.specialty}
          </Badge>
        </div>

        {/* Current mission */}
        {currentTask ? (
          <div className="rounded-md bg-[#0d1117] px-2.5 py-1.5 border border-[#30363d]">
            <p className="text-[11px] text-[#8b949e]">
              <span className="font-medium text-[#e6edf3]">Working on: </span>
              {currentTask.title}
            </p>
            <Badge className="text-[9px] px-1 py-0 mt-1 bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/30 capitalize">
              {currentTask.status.replace("_", " ")}
            </Badge>
          </div>
        ) : (
          <p className="text-[11px] text-[#484f58] italic">No active mission</p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#21262d]">
          {[
            { label: "Done",     value: agent.stats.tasksCompleted },
            { label: "Comments", value: agent.stats.commentsPosted },
            { label: "Reviews",  value: agent.stats.reviewsGiven },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-sm font-bold font-mono text-[#e6edf3]">{value}</p>
              <p className="text-[10px] text-[#484f58]">{label}</p>
            </div>
          ))}
        </div>

        {/* SOUL.md viewer */}
        <div className="border-t border-[#21262d] pt-2">
          <button
            onClick={onToggleRole}
            className="flex items-center gap-1.5 text-[11px] text-[#8b949e] hover:text-[#e6edf3] transition-colors w-full text-left"
          >
            <FileText className="h-3 w-3 shrink-0" />
            <span>SOUL.md — role definition</span>
            {roleExpanded
              ? <ChevronUp className="h-3 w-3 ml-auto" />
              : <ChevronDown className="h-3 w-3 ml-auto" />}
          </button>
          {roleExpanded && soul && (
            <div className="mt-2 rounded-md bg-[#0d1117] border border-[#30363d] p-3 overflow-hidden">
              <pre className="text-[10px] text-[#8b949e] whitespace-pre-wrap font-mono leading-relaxed">
                {soul}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-5 pb-4 border-t border-[#21262d] pt-3">
        {linkedSession ? (
          <Button
            variant="ghost"
            size="xs"
            className="text-[11px] h-7 gap-1 text-[#8b949e] hover:text-[#e6edf3]"
            onClick={onOpenChat}
          >
            <ExternalLink className="h-3 w-3" /> Session
          </Button>
        ) : (
          <span className="text-[10px] text-[#484f58]">No session</span>
        )}
        <Button
          size="xs"
          className="h-7 gap-1 bg-[#21262d] border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] hover:border-[#444c56]"
          onClick={onAssign}
        >
          <Send className="h-3 w-3" /> Assign
        </Button>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const { loading, agents: ocAgents, sessions } = useOpenClaw();
  const { agents: squadAgents, tasks } = useTeam();
  const { openChat } = useChatContext();
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [spawnAgent, setSpawnAgent] = useState<string | undefined>();
  const [gatewayOpen, setGatewayOpen] = useState(false);
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());

  if (loading) return <LoadingSpinner />;

  function toggleRole(id: string) {
    setExpandedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getSquadSession(agentId: string) {
    return sessions.find((s) => s.key.startsWith(`mc-${agentId}-`));
  }

  function getCurrentTask(agentId: string) {
    return tasks.find((t) => t.assigneeId === agentId && t.status !== "done") ?? null;
  }

  function openSpawnForAgent(agentId?: string) {
    setSpawnAgent(agentId);
    setSpawnOpen(true);
  }

  const activeAgents = squadAgents.filter((a) => {
    const t = getCurrentTask(a.id);
    return t && ["claimed", "in_progress", "review"].includes(t.status);
  });

  return (
    <div className="p-6 space-y-6 bg-[#0d1117] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#e6edf3]">Agents</h1>
          <p className="text-sm text-[#8b949e] mt-1">
            MCU-themed autonomous squad · {squadAgents.length} specialists
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => openSpawnForAgent()}
            className="bg-[#58a6ff]/10 border border-[#58a6ff]/30 text-[#58a6ff] hover:bg-[#58a6ff]/20"
          >
            <Rocket className="h-4 w-4 mr-2" />
            Spawn Task
          </Button>
          <ConnectionStatus />
        </div>
      </div>

      {/* ── Live Operations ──────────────────────────────────────── */}
      {activeAgents.length > 0 && (
        <div className="rounded-xl border border-[#3fb950]/25 bg-[#3fb950]/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-[#3fb950]" />
            <h2 className="text-sm font-semibold text-[#3fb950]">Live Operations</h2>
            <Badge className="text-[10px] px-1.5 py-0 bg-[#3fb950]/15 text-[#3fb950] border border-[#3fb950]/30">
              {activeAgents.length} active
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {activeAgents.map((agent) => {
              const task = getCurrentTask(agent.id)!;
              return (
                <div
                  key={agent.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[#161b22] border border-[#30363d] hover:border-[#444c56] transition-colors"
                >
                  <div className={`h-9 w-9 rounded-lg ${agent.color} flex items-center justify-center text-white font-bold text-sm shrink-0 relative`}>
                    {agent.avatar}
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#3fb950] border-2 border-[#161b22]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-[#e6edf3]">{agent.name}</span>
                      <span className="text-[10px] text-[#484f58]">·</span>
                      <span className="text-[11px] text-[#8b949e]">{agent.title}</span>
                    </div>
                    <p className="text-[11px] text-[#8b949e] truncate mt-0.5">{task.title}</p>
                    <Badge className="text-[9px] px-1 py-0 mt-1 bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/30 capitalize">
                      {task.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Squad Grid ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#484f58]">Your Squad</p>
          <span className="text-[10px] text-[#484f58]">({squadAgents.length})</span>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="h-2 w-2 rounded-full bg-[#3fb950]" />
            <span className="text-[10px] text-[#484f58]">online</span>
            <span className="h-2 w-2 rounded-full bg-[#8b949e] ml-2" />
            <span className="text-[10px] text-[#484f58]">standby</span>
            <span className="h-2 w-2 rounded-full bg-[#d29922] ml-2" />
            <span className="text-[10px] text-[#484f58]">working</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {squadAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              currentTask={getCurrentTask(agent.id)}
              linkedSession={getSquadSession(agent.id)}
              roleExpanded={expandedRoles.has(agent.id)}
              onToggleRole={() => toggleRole(agent.id)}
              onOpenChat={() => {
                const s = getSquadSession(agent.id);
                if (s) openChat(s);
              }}
              onAssign={() => openSpawnForAgent(agent.id)}
            />
          ))}
        </div>
      </section>

      {/* ── OpenClaw Gateway Agents ──────────────────────────────── */}
      <section className="space-y-3">
        <button
          className="flex items-center gap-2 text-[10px] font-semibold text-[#484f58] uppercase tracking-wider hover:text-[#8b949e] transition-colors"
          onClick={() => setGatewayOpen((v) => !v)}
        >
          {gatewayOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          OpenClaw Gateway Agents
          <Badge className="text-[10px] ml-1 bg-[#21262d] text-[#8b949e] border border-[#30363d]">
            {ocAgents.length}
          </Badge>
        </button>

        {gatewayOpen && (
          <>
            {ocAgents.length === 0 ? (
              <div className="rounded-xl border border-[#30363d] bg-[#161b22] py-10 text-center">
                <Bot className="h-10 w-10 mx-auto text-[#484f58] mb-2" />
                <p className="text-sm text-[#8b949e]">No gateway agents registered</p>
                <p className="text-xs text-[#484f58] mt-1">
                  Run <code className="bg-[#21262d] px-1 rounded">openclaw agents add &lt;name&gt;</code> to register one
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {ocAgents.map((agent) => {
                  const agentSessions = sessions.filter(
                    (s) => s.key.includes(agent.id) || s.agentId === agent.id
                  );
                  const activeSessions = agentSessions.filter((s) => s.status === "running");
                  const totalTokens = agentSessions.reduce((s, sess) => s + (sess.totalTokens || 0), 0);

                  return (
                    <div
                      key={agent.id}
                      className="rounded-xl border border-[#30363d] bg-[#161b22] hover:border-[#444c56] transition-all p-5 space-y-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-xl bg-[#21262d] border border-[#30363d] flex items-center justify-center">
                            <Bot className="h-6 w-6 text-[#58a6ff]" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-[#e6edf3]">{agent.name || agent.id}</h3>
                            <p className="text-xs text-[#8b949e]">{agent.role || "Agent"}</p>
                          </div>
                        </div>
                        <Badge className={`text-[10px] ${
                          activeSessions.length > 0
                            ? "bg-[#3fb950]/10 text-[#3fb950] border-[#3fb950]/30"
                            : "bg-[#21262d] text-[#8b949e] border-[#30363d]"
                        } border`}>
                          {activeSessions.length > 0 ? "Active" : "Idle"}
                        </Badge>
                      </div>

                      {agent.model && (
                        <Badge className="text-[10px] gap-1 bg-[#21262d] text-[#8b949e] border border-[#30363d]">
                          <Cpu className="h-3 w-3" />
                          {typeof agent.model === "string" ? agent.model : agent.model.primary}
                        </Badge>
                      )}

                      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#21262d]">
                        <div className="text-center">
                          <p className="text-lg font-bold font-mono text-[#e6edf3]">{activeSessions.length}</p>
                          <p className="text-[10px] text-[#484f58]">Active</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold font-mono text-[#e6edf3]">{agentSessions.length}</p>
                          <p className="text-[10px] text-[#484f58]">Sessions</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold font-mono text-[#e6edf3]">{(totalTokens / 1000).toFixed(0)}K</p>
                          <p className="text-[10px] text-[#484f58]">Tokens</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#21262d]">
                        <Badge className={`text-[10px] border ${
                          agent.configured
                            ? "bg-[#3fb950]/10 text-[#3fb950] border-[#3fb950]/30"
                            : "bg-[#d29922]/10 text-[#d29922] border-[#d29922]/30"
                        }`}>
                          {agent.configured ? "Configured" : "Default config"}
                        </Badge>
                        <Button
                          size="xs"
                          className="h-7 gap-1 bg-[#21262d] border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] hover:border-[#444c56]"
                          onClick={() => openSpawnForAgent(agent.id)}
                        >
                          <Send className="h-3 w-3" /> Assign
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {sessions.length > 0 && (
              <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5">
                <h3 className="font-semibold text-sm text-[#e6edf3] mb-3">All Sessions</h3>
                <div className="space-y-2">
                  {sessions.map((session) => (
                    <div
                      key={session.key}
                      className="flex items-center justify-between p-3 rounded-lg border border-[#21262d] hover:bg-[#21262d] hover:border-[#30363d] transition-colors cursor-pointer group"
                      onClick={() => openChat(session)}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`h-2.5 w-2.5 rounded-full ${
                          session.status === "running" ? "bg-[#3fb950]" : "bg-[#484f58]"
                        }`} />
                        <div>
                          <p className="text-sm font-medium font-mono text-[#e6edf3]">{session.key}</p>
                          <p className="text-xs text-[#8b949e]">{session.channel} · {session.model}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-[#484f58]">
                          {((session.totalTokens || 0) / 1000).toFixed(1)}K tokens
                        </span>
                        <Badge className={`text-[10px] border ${
                          session.status === "running"
                            ? "bg-[#3fb950]/10 text-[#3fb950] border-[#3fb950]/30"
                            : "bg-[#21262d] text-[#8b949e] border-[#30363d]"
                        }`}>
                          {session.status}
                        </Badge>
                        <MessageSquare className="h-4 w-4 text-[#484f58] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <SpawnTaskDialog
        open={spawnOpen}
        onOpenChange={setSpawnOpen}
        preselectedAgent={spawnAgent}
      />
    </div>
  );
}

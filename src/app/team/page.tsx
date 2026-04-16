"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useTeam } from "@/lib/team-context";
import { PIPELINE_STAGES, getTeamStats, type Mission, type TeamAgent, type PipelineStage } from "@/lib/team-store";
import { AssignMissionDialog } from "@/components/assign-mission-dialog";
import {
  Users,
  Rocket,
  CheckCircle2,
  Clock,
  Bug,
  ArrowRight,
  ChevronRight,
  Plus,
  Shield,
  Code,
  Search,
  PenTool,
  FlaskConical,
  Crown,
  Zap,
  AlertTriangle,
  CircleDot,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Role icon mapping ---
function RoleIcon({ role, className }: { role: string; className?: string }) {
  switch (role) {
    case "lead": return <Crown className={className} />;
    case "analyst": return <Search className={className} />;
    case "planner": return <PenTool className={className} />;
    case "developer": return <Code className={className} />;
    case "tester": return <FlaskConical className={className} />;
    case "reviewer": return <Shield className={className} />;
    default: return <Zap className={className} />;
  }
}

// --- Stage status icon ---
function StageStatusIcon({ stage, currentStage }: { stage: PipelineStage; currentStage: PipelineStage }) {
  const stageOrder = PIPELINE_STAGES.find((s) => s.id === stage)?.order ?? 0;
  const currentOrder = PIPELINE_STAGES.find((s) => s.id === currentStage)?.order ?? 0;

  if (stageOrder < currentOrder) {
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  }
  if (stageOrder === currentOrder) {
    return <CircleDot className="h-4 w-4 text-amber-400 animate-pulse" />;
  }
  return <Clock className="h-3.5 w-3.5 text-muted-foreground/40" />;
}

// --- Priority badge ---
function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    critical: "text-red-400 border-red-500/30 bg-red-500/10",
    high: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    medium: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    low: "text-zinc-400 border-zinc-500/30 bg-zinc-500/10",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px]", styles[priority])}>
      {priority === "critical" && <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
      {priority}
    </Badge>
  );
}

// --- Log type icon ---
function LogIcon({ type }: { type: string }) {
  switch (type) {
    case "handoff": return <ArrowRight className="h-3 w-3 text-blue-400" />;
    case "bug": return <Bug className="h-3 w-3 text-red-400" />;
    case "fix": return <Code className="h-3 w-3 text-amber-400" />;
    case "approval": return <CheckCircle2 className="h-3 w-3 text-emerald-400" />;
    case "rejection": return <AlertTriangle className="h-3 w-3 text-red-400" />;
    case "completion": return <Rocket className="h-3 w-3 text-emerald-400" />;
    default: return <MessageSquare className="h-3 w-3 text-muted-foreground" />;
  }
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function TeamPage() {
  const { agents, missions, selectedMission, selectMission, getMissionProgress } = useTeam();
  const [assignOpen, setAssignOpen] = useState(false);
  const [missionTab, setMissionTab] = useState("active");

  const stats = getTeamStats();
  const activeMissions = missions.filter((m) => m.status === "active");
  const queuedMissions = missions.filter((m) => m.status === "queued");
  const completedMissions = missions.filter((m) => m.status === "completed");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Team Jarvis
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Autonomous development squad — 24/7 coordinated agent team
          </p>
        </div>
        <Button size="sm" onClick={() => setAssignOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Mission
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Team Online</p>
                <p className="text-2xl font-bold mt-1">
                  {stats.onlineAgents}
                  <span className="text-sm font-normal text-muted-foreground">/{stats.totalAgents}</span>
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active Missions</p>
                <p className="text-2xl font-bold mt-1">{stats.active}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Rocket className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold mt-1">{stats.completed}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Bug Loops</p>
                <p className="text-2xl font-bold mt-1">{stats.totalBugLoops}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Bug className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Team Grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          The Squad
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} missions={missions} />
          ))}
        </div>
      </div>

      {/* Pipeline Visualization */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Pipeline Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {PIPELINE_STAGES.filter((s) => s.id !== "completed" && s.id !== "failed").map((stage, idx) => {
              const stageAgent = agents.find((a) => a.id === stage.agentId);
              const missionsAtStage = activeMissions.filter((m) => m.currentStage === stage.id);
              return (
                <div key={stage.id} className="flex items-center">
                  <div
                    className={cn(
                      "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border min-w-[110px] transition-all",
                      missionsAtStage.length > 0
                        ? "border-primary/30 bg-primary/5 shadow-sm shadow-primary/10"
                        : "border-border/30 bg-muted/20"
                    )}
                  >
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold",
                      stageAgent?.color || "bg-muted",
                      "text-white"
                    )}>
                      {stageAgent?.avatar || "?"}
                    </div>
                    <span className="text-[11px] font-medium text-center">{stage.label}</span>
                    <span className="text-[10px] text-muted-foreground">{stageAgent?.name}</span>
                    {missionsAtStage.length > 0 && (
                      <Badge className="text-[9px] bg-primary/20 text-primary border-0 px-1.5">
                        {missionsAtStage.length} active
                      </Badge>
                    )}
                  </div>
                  {idx < PIPELINE_STAGES.filter((s) => s.id !== "completed" && s.id !== "failed").length - 1 && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0 mx-0.5" />
                  )}
                </div>
              );
            })}
          </div>
          {/* Bug loop indicator */}
          <div className="flex items-center gap-2 mt-3 px-2">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Bug className="h-3 w-3 text-red-400" />
              <span>Bug loop: Testing → Development (auto-reroute on failure)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Missions Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mission List */}
        <div className="lg:col-span-2">
          <Tabs value={missionTab} onValueChange={setMissionTab}>
            <div className="flex items-center justify-between mb-3">
              <TabsList>
                <TabsTrigger value="active" className="text-xs">
                  Active ({activeMissions.length})
                </TabsTrigger>
                <TabsTrigger value="queued" className="text-xs">
                  Queued ({queuedMissions.length})
                </TabsTrigger>
                <TabsTrigger value="completed" className="text-xs">
                  Done ({completedMissions.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="active" className="space-y-3 mt-0">
              {activeMissions.length === 0 ? (
                <EmptyState message="No active missions" />
              ) : (
                activeMissions.map((m) => (
                  <MissionCard
                    key={m.id}
                    mission={m}
                    agents={agents}
                    progress={getMissionProgress(m)}
                    selected={selectedMission?.id === m.id}
                    onSelect={() => selectMission(selectedMission?.id === m.id ? null : m)}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="queued" className="space-y-3 mt-0">
              {queuedMissions.length === 0 ? (
                <EmptyState message="No queued missions" />
              ) : (
                queuedMissions.map((m) => (
                  <MissionCard
                    key={m.id}
                    mission={m}
                    agents={agents}
                    progress={getMissionProgress(m)}
                    selected={selectedMission?.id === m.id}
                    onSelect={() => selectMission(selectedMission?.id === m.id ? null : m)}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-3 mt-0">
              {completedMissions.length === 0 ? (
                <EmptyState message="No completed missions yet" />
              ) : (
                completedMissions.map((m) => (
                  <MissionCard
                    key={m.id}
                    mission={m}
                    agents={agents}
                    progress={getMissionProgress(m)}
                    selected={selectedMission?.id === m.id}
                    onSelect={() => selectMission(selectedMission?.id === m.id ? null : m)}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Mission Detail / Comms Log */}
        <div>
          <Card className="border-border/50 bg-card/50 sticky top-20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                {selectedMission ? "Mission Detail" : "Agent Comms"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedMission ? (
                <MissionDetail mission={selectedMission} agents={agents} />
              ) : (
                <RecentComms missions={missions} agents={agents} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AssignMissionDialog open={assignOpen} onOpenChange={setAssignOpen} />
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function AgentCard({ agent, missions }: { agent: TeamAgent; missions: Mission[] }) {
  const agentMissions = missions.filter(
    (m) => m.currentAgentId === agent.id && m.status === "active"
  );
  const statusColors: Record<string, string> = {
    online: "bg-emerald-500",
    busy: "bg-amber-500",
    idle: "bg-blue-400",
    offline: "bg-zinc-500",
  };

  return (
    <Card className="border-border/50 bg-card/50 hover:shadow-lg transition-all">
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold text-white",
              agent.color
            )}>
              {agent.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">{agent.name}</h3>
                {agent.role === "lead" && (
                  <Crown className="h-3 w-3 text-amber-400" />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">{agent.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={cn("h-2 w-2 rounded-full", statusColors[agent.status])} />
            <span className="text-[10px] text-muted-foreground capitalize">{agent.status}</span>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground/80 leading-relaxed line-clamp-2">
          {agent.description}
        </p>

        <div className="flex flex-wrap gap-1">
          {agent.capabilities.slice(0, 3).map((cap) => (
            <Badge key={cap} variant="secondary" className="text-[9px] px-1.5 py-0">
              {cap}
            </Badge>
          ))}
          {agent.capabilities.length > 3 && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
              +{agent.capabilities.length - 3}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-sm font-bold">{agent.tasksHandled}</p>
              <p className="text-[9px] text-muted-foreground">Handled</p>
            </div>
            {agent.bugsFound !== undefined && (
              <div className="text-center">
                <p className="text-sm font-bold">{agent.bugsFound}</p>
                <p className="text-[9px] text-muted-foreground">Bugs found</p>
              </div>
            )}
            {agent.bugsFixed !== undefined && (
              <div className="text-center">
                <p className="text-sm font-bold">{agent.bugsFixed}</p>
                <p className="text-[9px] text-muted-foreground">Fixes</p>
              </div>
            )}
            {agent.approvals !== undefined && (
              <div className="text-center">
                <p className="text-sm font-bold">{agent.approvals}</p>
                <p className="text-[9px] text-muted-foreground">Approved</p>
              </div>
            )}
          </div>
          {agentMissions.length > 0 && (
            <Badge className="text-[9px] bg-primary/20 text-primary border-0">
              {agentMissions.length} mission{agentMissions.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        <Badge variant="secondary" className="text-[9px] gap-1">
          <RoleIcon role={agent.role} className="h-2.5 w-2.5" />
          {agent.model}
        </Badge>
      </CardContent>
    </Card>
  );
}

function MissionCard({
  mission,
  agents,
  progress,
  selected,
  onSelect,
}: {
  mission: Mission;
  agents: TeamAgent[];
  progress: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const currentAgent = agents.find((a) => a.id === mission.currentAgentId);
  const stageConfig = PIPELINE_STAGES.find((s) => s.id === mission.currentStage);

  return (
    <Card
      className={cn(
        "border-border/50 bg-card/50 hover:shadow-lg transition-all cursor-pointer",
        selected && "border-primary/40 ring-1 ring-primary/20"
      )}
      onClick={onSelect}
    >
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm truncate">{mission.title}</h3>
              <PriorityBadge priority={mission.priority} />
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{mission.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {currentAgent && (
              <div className={cn(
                "h-5 w-5 rounded text-[9px] font-bold flex items-center justify-center text-white",
                currentAgent.color
              )}>
                {currentAgent.avatar}
              </div>
            )}
            <span className="text-[11px] text-muted-foreground">
              {currentAgent?.name} — {stageConfig?.label}
            </span>
          </div>
          {mission.bugLoopCount > 0 && (
            <div className="flex items-center gap-1">
              <Bug className="h-3 w-3 text-red-400" />
              <span className="text-[10px] text-red-400">{mission.bugLoopCount}x</span>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Pipeline progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Mini pipeline dots */}
        <div className="flex items-center gap-1 pt-1">
          {PIPELINE_STAGES.filter((s) => s.id !== "failed").map((stage) => (
            <StageStatusIcon key={stage.id} stage={stage.id} currentStage={mission.currentStage} />
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-1">
          {mission.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground border-border/50">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MissionDetail({ mission, agents }: { mission: Mission; agents: TeamAgent[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold text-sm">{mission.title}</h4>
        <p className="text-[11px] text-muted-foreground mt-1">{mission.description}</p>
      </div>

      {/* Stage timeline */}
      <div className="space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Stage History
        </p>
        <div className="space-y-2">
          {mission.stageHistory.map((entry, idx) => {
            const agent = agents.find((a) => a.id === entry.agentId);
            const stageConfig = PIPELINE_STAGES.find((s) => s.id === entry.stage);
            return (
              <div key={idx} className="flex items-start gap-2">
                <div className={cn(
                  "h-5 w-5 rounded text-[8px] font-bold flex items-center justify-center text-white shrink-0 mt-0.5",
                  agent?.color || "bg-muted"
                )}>
                  {agent?.avatar || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium">{stageConfig?.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(entry.enteredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {entry.exitedAt && (
                      <> → {new Date(entry.exitedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>
                    )}
                    {!entry.exitedAt && (
                      <span className="text-amber-400 ml-1">in progress</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comms log */}
      <div className="space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Communications
        </p>
        <ScrollArea className="h-[280px]">
          <div className="space-y-2 pr-3">
            {mission.logs.map((log) => {
              const agent = agents.find((a) => a.id === log.agentId);
              return (
                <div key={log.id} className="flex items-start gap-2">
                  <LogIcon type={log.type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold">{agent?.name}</span>
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/90 leading-relaxed">
                      {log.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function RecentComms({ missions, agents }: { missions: Mission[]; agents: TeamAgent[] }) {
  const allLogs = missions
    .flatMap((m) =>
      m.logs.map((log) => ({ ...log, missionTitle: m.title, missionId: m.id }))
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
        Latest Inter-Agent Communications
      </p>
      <ScrollArea className="h-[400px]">
        <div className="space-y-3 pr-3">
          {allLogs.map((log) => {
            const agent = agents.find((a) => a.id === log.agentId);
            return (
              <div key={`${log.missionId}-${log.id}`} className="flex items-start gap-2">
                <div className={cn(
                  "h-5 w-5 rounded text-[8px] font-bold flex items-center justify-center text-white shrink-0 mt-0.5",
                  agent?.color || "bg-muted"
                )}>
                  {agent?.avatar || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold">{agent?.name}</span>
                    <LogIcon type={log.type} />
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 truncate">{log.missionTitle}</p>
                  <p className="text-[11px] text-muted-foreground/90 leading-relaxed">
                    {log.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="py-8 text-center">
        <Rocket className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

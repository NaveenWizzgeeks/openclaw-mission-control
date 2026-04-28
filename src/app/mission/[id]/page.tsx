"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Play, Loader2, CheckCheck,
  ListOrdered, MessageSquare, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClarificationPanel } from "@/components/clarification-panel";
import { TaskSequence } from "@/components/task-sequence";
import { cn } from "@/lib/utils";
import type { Mission } from "@/lib/mission-types";

const STATUS_STEPS: Mission["status"][] = [
  "received", "clarification", "analyzing", "planned", "queued", "executing", "done"
];

function StatusStepper({ status }: { status: Mission["status"] }) {
  const currentIdx = STATUS_STEPS.indexOf(status);
  const labels: Record<Mission["status"], string> = {
    received: "Received", clarification: "Clarifying", analyzing: "Analyzing",
    planning_failed: "Plan Failed",
    planned: "Planned", queued: "Queued", executing: "Executing", paused: "Paused", done: "Done",
  };
  const steps = STATUS_STEPS.filter((s) => s !== "paused");

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const idx = STATUS_STEPS.indexOf(step);
        const isDone = idx < currentIdx;
        const isActive = step === status || (status === "paused" && step === "executing");
        const isFuture = idx > currentIdx && status !== "paused";

        return (
          <div key={step} className="flex items-center gap-1">
            <div className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all",
              isDone   && "bg-[#3fb950]/10 text-[#3fb950]",
              isActive && "bg-[#58a6ff]/15 text-[#58a6ff] ring-1 ring-[#58a6ff]/30",
              isFuture && "bg-[#21262d] text-[#484f58]"
            )}>
              {isDone && <CheckCheck className="h-2.5 w-2.5" />}
              {isActive && <div className="h-1.5 w-1.5 rounded-full bg-[#58a6ff] animate-pulse" />}
              {labels[step]}
            </div>
            {i < steps.length - 1 && (
              <div className={cn("h-px w-3", isDone ? "bg-[#3fb950]/30" : "bg-[#30363d]")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [mission, setMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState<"clarification" | "tasks">("clarification");

  const fetchMission = useCallback(async () => {
    const res = await fetch(`/api/missions/${id}`);
    const data = await res.json() as { ok: boolean; mission: Mission };
    if (data.ok) {
      setMission(data.mission);
      // Auto-switch to tasks tab when planned
      if (["planned", "queued", "executing", "done"].includes(data.mission.status)) {
        setActiveTab("tasks");
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchMission(); }, [fetchMission]);

  // Poll every 6s when executing
  useEffect(() => {
    if (!mission || !["executing", "analyzing", "clarification"].includes(mission.status)) return;
    const interval = setInterval(fetchMission, 6000);
    return () => clearInterval(interval);
  }, [mission, fetchMission]);

  async function handleAnswer(answer: string) {
    const res = await fetch(`/api/missions/${id}/clarify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answer }),
    });
    const data = await res.json() as { ok: boolean; mission: Mission };
    if (data.ok) {
      setMission(data.mission);
      if (["planned", "queued", "executing", "done"].includes(data.mission.status)) {
        setActiveTab("tasks");
      }
    }
  }

  async function handleExecute() {
    if (!mission) return;
    setExecuting(true);
    try {
      const res = await fetch(`/api/missions/${id}/execute`, { method: "POST" });
      const data = await res.json() as { ok: boolean; mission: Mission };
      if (data.ok) setMission(data.mission);
    } finally {
      setExecuting(false);
    }
  }

  if (loading || !mission) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 text-[#58a6ff] animate-spin" />
      </div>
    );
  }

  const hasTasks = mission.tasks.length > 0;
  const canExecute = mission.status === "planned" || mission.status === "queued";

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {/* Header */}
      <div className="border-b border-[#30363d] px-6 py-4 shrink-0">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] -ml-2 mt-0.5"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-[#e6edf3] leading-tight">{mission.title}</h1>
            {mission.description && (
              <p className="text-sm text-[#8b949e] mt-1 line-clamp-2">{mission.description}</p>
            )}
            <div className="mt-3 overflow-x-auto">
              <StatusStepper status={mission.status} />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchMission}
              className="text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            {canExecute && (
              <Button
                onClick={handleExecute}
                disabled={executing}
                size="sm"
                className="bg-[#3fb950] hover:bg-[#3fb950]/90 text-[#0d1117] font-semibold"
              >
                {executing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Execute
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4 -mb-4">
          {[
            { key: "clarification", label: "Requirements", icon: MessageSquare },
            { key: "tasks", label: `Tasks${hasTasks ? ` (${mission.tasks.length})` : ""}`, icon: ListOrdered, disabled: !hasTasks },
          ].map(({ key, label, icon: Icon, disabled }) => (
            <button
              key={key}
              onClick={() => !disabled && setActiveTab(key as typeof activeTab)}
              disabled={disabled}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors",
                activeTab === key
                  ? "border-[#58a6ff] text-[#58a6ff]"
                  : "border-transparent text-[#8b949e] hover:text-[#e6edf3]",
                disabled && "opacity-40 cursor-not-allowed"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "clarification" && (
          <ClarificationPanel
            mission={mission}
            onAnswer={handleAnswer}
          />
        )}
        {activeTab === "tasks" && hasTasks && (
          <div className="h-full overflow-y-auto p-6">
            <div className="max-w-2xl space-y-4">
              {/* Research notes */}
              {mission.researchNotes && (
                <div className="p-4 rounded-xl bg-[#d2a8ff]/5 border border-[#d2a8ff]/20">
                  <p className="text-xs font-semibold text-[#d2a8ff] uppercase tracking-wider mb-2">Analyst Notes</p>
                  <p className="text-sm text-[#e6edf3] leading-relaxed">{mission.researchNotes}</p>
                </div>
              )}
              <TaskSequence
                tasks={mission.tasks}
                currentTaskIndex={mission.currentTaskIndex}
                missionId={mission.id}
                onTaskUpdated={fetchMission}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

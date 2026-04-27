"use client";

import { useState } from "react";
import { CheckCheck, Clock, Loader2, AlertCircle, ChevronRight, Terminal, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MissionTask } from "@/lib/mission-types";
import { SQUAD } from "@/lib/team-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const AGENT_COLORS: Record<string, string> = {
  jarvis: "bg-[#58a6ff]",
  fury: "bg-zinc-600",
  shuri: "bg-fuchsia-600",
  stark: "bg-red-600",
  vision: "bg-amber-600",
  banner: "bg-emerald-700",
  cap: "bg-blue-700",
  loki: "bg-green-800",
  hawkeye: "bg-violet-700",
  rocket: "bg-orange-700",
};

interface TaskSequenceProps {
  tasks: MissionTask[];
  currentTaskIndex: number;
  missionId: string;
  onTaskUpdated?: () => void;
}

function TaskCompleteForm({
  missionId,
  taskId,
  onDone,
}: {
  missionId: string;
  taskId: string;
  onDone: () => void;
}) {
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"done" | "failed">("done");

  async function handleSubmit() {
    if (!summary.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`/api/missions/${missionId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, summary: summary.trim() }),
      });
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
      <p className="text-[10px] text-[#8b949e] font-semibold uppercase tracking-wider">Mark task as complete</p>
      <Textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Describe what was done or what went wrong..."
        className="min-h-[60px] resize-none bg-[#161b22] border-[#30363d] text-[#e6edf3] text-xs placeholder:text-[#484f58]"
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setStatus("done")}
          className={cn(
            "text-xs h-7 gap-1.5",
            status === "done" ? "bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/30" : "text-[#8b949e]"
          )}
        >
          <CheckCircle className="h-3 w-3" /> Done
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setStatus("failed")}
          className={cn(
            "text-xs h-7 gap-1.5",
            status === "failed" ? "bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/30" : "text-[#8b949e]"
          )}
        >
          <XCircle className="h-3 w-3" /> Failed
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={submitting || !summary.trim()}
          className="ml-auto text-xs h-7 bg-[#58a6ff] hover:bg-[#58a6ff]/90 text-[#0d1117] font-semibold"
        >
          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Submit"}
        </Button>
      </div>
    </div>
  );
}

export function TaskSequence({ tasks, currentTaskIndex, missionId, onTaskUpdated }: TaskSequenceProps) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  if (tasks.length === 0) return null;

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const progress = Math.round((doneCount / tasks.length) * 100);

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[#8b949e]">
          <span>{doneCount} of {tasks.length} complete</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#58a6ff] rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {tasks.map((task, idx) => {
          const isActive = task.status === "in_progress";
          const isDone = task.status === "done";
          const isFailed = task.status === "failed";
          const isPending = task.status === "pending";
          const agentColor = AGENT_COLORS[task.agentId] ?? "bg-[#21262d]";
          const agentAvatar = SQUAD.find((a) => a.id === task.agentId)?.avatar ?? "?";
          const isExpanded = expandedTaskId === task.id;

          return (
            <div
              key={task.id}
              className={cn(
                "p-3 rounded-lg border transition-all",
                isActive  && "border-[#58a6ff]/40 bg-[#58a6ff]/5",
                isDone    && "border-[#30363d] bg-[#161b22] opacity-70",
                isFailed  && "border-[#f85149]/30 bg-[#f85149]/5",
                isPending && idx === currentTaskIndex + 1 && "border-[#30363d] bg-[#161b22]",
                isPending && idx > currentTaskIndex + 1 && "border-[#30363d]/50 bg-transparent opacity-50",
              )}
            >
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div className="shrink-0 mt-0.5">
                  {isDone && (
                    <div className="h-6 w-6 rounded-full bg-[#3fb950]/15 flex items-center justify-center">
                      <CheckCheck className="h-3.5 w-3.5 text-[#3fb950]" />
                    </div>
                  )}
                  {isActive && (
                    <div className="h-6 w-6 rounded-full bg-[#58a6ff]/15 flex items-center justify-center">
                      <Loader2 className="h-3.5 w-3.5 text-[#58a6ff] animate-spin" />
                    </div>
                  )}
                  {isFailed && (
                    <div className="h-6 w-6 rounded-full bg-[#f85149]/15 flex items-center justify-center">
                      <AlertCircle className="h-3.5 w-3.5 text-[#f85149]" />
                    </div>
                  )}
                  {isPending && (
                    <div className="h-6 w-6 rounded-full border border-[#30363d] flex items-center justify-center">
                      <span className="text-[10px] text-[#8b949e] font-mono">{task.sequenceNumber}</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium leading-snug",
                    isDone ? "text-[#8b949e] line-through" : "text-[#e6edf3]"
                  )}>
                    {task.title}
                  </p>
                  {task.description && !isDone && (
                    <p className="text-xs text-[#8b949e] mt-0.5 leading-snug line-clamp-2">{task.description}</p>
                  )}
                  {task.output && (
                    <p className={cn(
                      "text-xs mt-1 leading-snug",
                      isFailed ? "text-[#f85149]" : "text-[#3fb950]"
                    )}>
                      {task.output}
                    </p>
                  )}
                  {isActive && task.startedAt && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-[#8b949e]" />
                        <span className="text-[10px] text-[#8b949e]">
                          Started {new Date(task.startedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {task.sessionKey && (
                        <div className="flex items-center gap-1">
                          <Terminal className="h-3 w-3 text-[#8b949e]" />
                          <span className="text-[10px] text-[#8b949e] font-mono truncate max-w-[120px]">
                            {task.sessionKey}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mark done button for in-progress tasks */}
                  {isActive && (
                    <div className="mt-2">
                      <button
                        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                        className="text-[11px] text-[#58a6ff] hover:text-[#79c0ff] transition-colors"
                      >
                        {isExpanded ? "Cancel" : "Mark as done / failed"}
                      </button>
                      {isExpanded && (
                        <TaskCompleteForm
                          missionId={missionId}
                          taskId={task.id}
                          onDone={() => {
                            setExpandedTaskId(null);
                            onTaskUpdated?.();
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Agent */}
                <div className="shrink-0 flex items-center gap-1.5">
                  <div className={cn("h-6 w-6 rounded-md flex items-center justify-center text-[11px] font-bold text-white", agentColor)}>
                    {agentAvatar}
                  </div>
                  {isActive && <ChevronRight className="h-3.5 w-3.5 text-[#58a6ff]" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

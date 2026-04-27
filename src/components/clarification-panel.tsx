"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, User, Send, Loader2, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Mission } from "@/lib/mission-types";
import { SQUAD } from "@/lib/team-store";

interface ClarificationPanelProps {
  mission: Mission;
  onAnswer: (answer: string) => Promise<void>;
  loading?: boolean;
}

export function ClarificationPanel({ mission, onAnswer, loading }: ClarificationPanelProps) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const agentQuestions = mission.clarification.filter((m) => m.role === "agent");
  const userAnswers = mission.clarification.filter((m) => m.role === "user");
  const allAnswered = userAnswers.length >= agentQuestions.length;
  const analyst = SQUAD.find((a) => a.id === mission.analystId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mission.clarification.length]);

  async function handleSubmit() {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onAnswer(answer.trim());
      setAnswer("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Analyst info */}
      <div className="flex items-center gap-3 p-4 border-b border-[#30363d] shrink-0">
        <div className={cn(
          "h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold",
          analyst ? `bg-${analyst.color.replace("bg-", "")}` : "bg-fuchsia-600"
        )} style={{ backgroundColor: analyst?.id === "shuri" ? "#a21caf" : undefined }}>
          {analyst?.avatar ?? "A"}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#e6edf3]">{analyst?.name ?? "Analyst"}</p>
          <p className="text-xs text-[#8b949e]">{analyst?.title ?? "Product Analyst"} · Gathering requirements</p>
        </div>
        <div className="ml-auto text-xs text-[#8b949e]">
          {userAnswers.length}/{agentQuestions.length} answered
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {mission.clarification.map((msg) => {
          const isAgent = msg.role === "agent";
          return (
            <div key={msg.id} className={cn("flex gap-3", !isAgent && "flex-row-reverse")}>
              {/* Avatar */}
              <div className="shrink-0">
                {isAgent ? (
                  <div className={cn(
                    "h-7 w-7 rounded-lg flex items-center justify-center text-white text-xs font-bold",
                    "bg-fuchsia-600"
                  )}>
                    {analyst?.avatar ?? "A"}
                  </div>
                ) : (
                  <div className="h-7 w-7 rounded-lg bg-[#58a6ff]/20 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-[#58a6ff]" />
                  </div>
                )}
              </div>

              {/* Bubble */}
              <div className={cn(
                "max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                isAgent
                  ? "bg-[#21262d] text-[#e6edf3] rounded-tl-sm"
                  : "bg-[#58a6ff]/15 text-[#e6edf3] rounded-tr-sm border border-[#58a6ff]/20"
              )}>
                {msg.content}
                <div className={cn(
                  "text-[10px] mt-2",
                  isAgent ? "text-[#484f58]" : "text-[#58a6ff]/60 text-right"
                )}>
                  {new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Planning started indicator */}
        {allAnswered && mission.status === "analyzing" && (
          <div className="flex items-center gap-2 py-2">
            <div className="flex-1 h-px bg-[#30363d]" />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#d2a8ff]/10 border border-[#d2a8ff]/20">
              <Loader2 className="h-3 w-3 text-[#d2a8ff] animate-spin" />
              <span className="text-xs text-[#d2a8ff]">{analyst?.name} analyzing and creating task plan…</span>
            </div>
            <div className="flex-1 h-px bg-[#30363d]" />
          </div>
        )}

        {allAnswered && mission.status === "planned" && (
          <div className="flex items-center gap-2 py-2">
            <div className="flex-1 h-px bg-[#30363d]" />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#3fb950]/10 border border-[#3fb950]/20">
              <CheckCheck className="h-3 w-3 text-[#3fb950]" />
              <span className="text-xs text-[#3fb950]">Requirements gathered · Task plan ready</span>
            </div>
            <div className="flex-1 h-px bg-[#30363d]" />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!allAnswered && (
        <div className="p-4 border-t border-[#30363d] shrink-0">
          <div className="flex gap-2">
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer…"
              rows={2}
              disabled={submitting || loading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
              }}
              className={cn(
                "bg-[#0d1117] border-[#30363d] text-[#e6edf3] placeholder:text-[#484f58] resize-none text-sm",
                "focus-visible:ring-[#58a6ff]/40 focus-visible:border-[#58a6ff]"
              )}
            />
            <Button
              onClick={handleSubmit}
              disabled={!answer.trim() || submitting}
              size="icon"
              className="shrink-0 self-end bg-[#58a6ff] hover:bg-[#58a6ff]/90 text-[#0d1117] h-10 w-10"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-[#484f58] mt-1.5">⌘+Enter to send</p>
        </div>
      )}

      {allAnswered && mission.status === "planned" && (
        <div className="p-4 border-t border-[#30363d] shrink-0">
          <div className="flex items-center gap-2 text-xs text-[#8b949e]">
            <Bot className="h-3.5 w-3.5 text-[#3fb950]" />
            <span>Jarvis has reviewed the task plan. Use the <strong className="text-[#e6edf3]">Execute</strong> button to begin sequential execution.</span>
          </div>
        </div>
      )}
    </div>
  );
}

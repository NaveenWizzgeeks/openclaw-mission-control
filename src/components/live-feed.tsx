"use client";

import { useEffect, useRef, useState } from "react";
import {
  Rocket, MessageSquare, CheckCheck, Zap, AlertCircle,
  Radio, Bot, Globe, HelpCircle, Cpu, Wifi, WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveEvent, LiveEventType } from "@/lib/mission-types";

const EVENT_CONFIG: Record<LiveEventType, { icon: React.ElementType; color: string; dotColor: string }> = {
  mission_created:       { icon: Rocket,       color: "text-[#58a6ff]",   dotColor: "bg-[#58a6ff]" },
  mission_queued:        { icon: Rocket,       color: "text-[#d2a8ff]",   dotColor: "bg-[#d2a8ff]" },
  mission_analyzing:     { icon: Cpu,          color: "text-[#d2a8ff]",   dotColor: "bg-[#d2a8ff]" },
  planning_failed:       { icon: AlertCircle,  color: "text-[#f85149]",   dotColor: "bg-[#f85149]" },
  clarification_started: { icon: HelpCircle,   color: "text-[#ffa657]",   dotColor: "bg-[#ffa657]" },
  question_asked:        { icon: HelpCircle,   color: "text-[#ffa657]",   dotColor: "bg-[#ffa657]" },
  answer_given:          { icon: MessageSquare,color: "text-[#8b949e]",   dotColor: "bg-[#8b949e]" },
  planning_started:      { icon: Cpu,          color: "text-[#d2a8ff]",   dotColor: "bg-[#d2a8ff]" },
  tasks_created:         { icon: CheckCheck,   color: "text-[#3fb950]",   dotColor: "bg-[#3fb950]" },
  task_added:            { icon: Zap,          color: "text-[#58a6ff]",   dotColor: "bg-[#58a6ff]" },
  task_started:          { icon: Zap,          color: "text-[#ffa657]",   dotColor: "bg-[#ffa657]" },
  task_completed:        { icon: CheckCheck,   color: "text-[#3fb950]",   dotColor: "bg-[#3fb950]" },
  task_failed:           { icon: AlertCircle,  color: "text-[#f85149]",   dotColor: "bg-[#f85149]" },
  task_approved:         { icon: CheckCheck,   color: "text-[#39d353]",   dotColor: "bg-[#39d353]" },
  task_rejected:         { icon: AlertCircle,  color: "text-[#e3b341]",   dotColor: "bg-[#e3b341]" },
  task_retrying:         { icon: Cpu,          color: "text-[#e3b341]",   dotColor: "bg-[#e3b341]" },
  task_escalated:        { icon: AlertCircle,  color: "text-[#f85149]",   dotColor: "bg-[#f85149]" },
  mission_done:          { icon: CheckCheck,   color: "text-[#39d353]",   dotColor: "bg-[#39d353]" },
  heartbeat_tick:        { icon: Radio,        color: "text-[#8b949e]",   dotColor: "bg-[#484f58]" },
  workspace_created:     { icon: Globe,        color: "text-[#58a6ff]",   dotColor: "bg-[#58a6ff]" },
  agent_status_changed:  { icon: Bot,          color: "text-[#8b949e]",   dotColor: "bg-[#8b949e]" },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 5_000)   return "just now";
  if (diff < 60_000)  return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60000)}m ago`;
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

interface LiveFeedProps {
  className?: string;
  maxEvents?: number;
  missionId?: string;
}

export function LiveFeed({ className, maxEvents = 80, missionId }: LiveFeedProps) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [, setTick] = useState(0);
  const esRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isConnecting = useRef(false);

  // Tick every 30s to refresh relative timestamps
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (isConnecting.current) return;
    isConnecting.current = true;

    function connect() {
      const es = new EventSource("/api/events");
      esRef.current = es;

      es.onopen = () => { setConnected(true); isConnecting.current = false; };
      es.onerror = () => {
        setConnected(false);
        es.close();
        setTimeout(connect, 5_000);
      };
      es.onmessage = (e) => {
        const raw = e.data as string;
        if (!raw || raw.startsWith(":")) return;
        try {
          const event = JSON.parse(raw) as LiveEvent;
          // Dedupe by id — protects against duplicate event ids from any
          // upstream collision (heartbeat, parallel orchestrators, etc.)
          setEvents((prev) => {
            if (prev.some((e) => e.id === event.id)) return prev;
            return [event, ...prev].slice(0, maxEvents);
          });
          setTimeout(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = 0;
          }, 50);
        } catch { /* skip malformed */ }
      };
    }

    connect();
    return () => {
      esRef.current?.close();
    };
  }, [maxEvents]);

  const displayEvents = missionId
    ? events.filter((e) => e.missionId === missionId)
    : events;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d] shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-[#58a6ff]" />
          <span className="text-xs font-semibold text-[#e6edf3] tracking-wide uppercase">
            {missionId ? "Mission Feed" : "Live Feed"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {connected ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-[#3fb950] animate-pulse" />
              <Wifi className="h-3 w-3 text-[#3fb950]" />
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-[#f85149]" />
              <WifiOff className="h-3 w-3 text-[#f85149]" />
            </>
          )}
          <span className="text-[10px] text-[#8b949e]">{displayEvents.length}</span>
        </div>
      </div>

      {/* Events */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {displayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <Radio className="h-8 w-8 text-[#30363d] mb-2" />
            <p className="text-xs text-[#8b949e]">
              {missionId ? "No events for this mission yet…" : "Waiting for events…"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#21262d]">
            {displayEvents.map((event) => {
              const cfg = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.heartbeat_tick;
              const Icon = cfg.icon;
              const isHeartbeat = event.type === "heartbeat_tick";

              return (
                <div
                  key={event.id}
                  className={cn(
                    "flex gap-3 px-4 py-2.5 hover:bg-[#161b22] transition-colors",
                    isHeartbeat && "opacity-50"
                  )}
                >
                  <div className="shrink-0 mt-0.5">
                    <div className={cn("h-6 w-6 rounded-md flex items-center justify-center", isHeartbeat ? "bg-[#21262d]" : "bg-[#161b22]")}>
                      <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#e6edf3] leading-snug">{event.title}</p>
                    {event.detail && (
                      <p className="text-[11px] text-[#8b949e] mt-0.5 leading-snug whitespace-pre-line">{event.detail}</p>
                    )}
                    {event.agentName && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-[#8b949e]">
                        <Bot className="h-2.5 w-2.5" />
                        {event.agentName}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0">
                    <span className="text-[10px] text-[#484f58]">{relativeTime(event.timestamp)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

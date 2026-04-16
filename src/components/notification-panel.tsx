"use client";

import { useState } from "react";
import { useOpenClaw } from "@/lib/openclaw-context";
import { Bell, X, Info, Server, Clock, Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const { sessions, cronJobs, agents, connected } = useOpenClaw();

  const notifications = [
    ...sessions.map((s) => ({
      id: `session-${s.key}`,
      title: `Session ${s.status}`,
      message: `${s.key} — ${s.model} (${((s.totalTokens || 0) / 1000).toFixed(1)}K tokens)`,
      icon: <Server className="h-4 w-4 text-blue-400" />,
      time: s.updatedAt ? new Date(s.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
    })),
    ...cronJobs.map((j) => ({
      id: `cron-${j.id}`,
      title: j.enabled ? "Scheduled Job" : "Disabled Job",
      message: `${j.name || j.id} — ${j.schedule?.kind || "unknown"}`,
      icon: <Clock className="h-4 w-4 text-amber-400" />,
      time: j.lastRunAt ? new Date(j.lastRunAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
    })),
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center h-9 w-9 rounded-lg hover:bg-muted transition-colors"
      >
        <Bell className="h-[18px] w-[18px] text-muted-foreground" />
        {sessions.filter((s) => s.status === "running").length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-500 text-[10px] font-bold text-white flex items-center justify-center">
            {sessions.filter((s) => s.status === "running").length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-[380px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Live Status</h3>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    connected ? "text-emerald-400 border-emerald-500/30" : "text-red-400"
                  }`}
                >
                  {connected ? "Connected" : "Offline"}
                </Badge>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Info className="h-6 w-6 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">No active sessions or jobs</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="flex gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <div className="mt-0.5">{notif.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{notif.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {notif.message}
                      </p>
                    </div>
                    {notif.time && (
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">
                        {notif.time}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

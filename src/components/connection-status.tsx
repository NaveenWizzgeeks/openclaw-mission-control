"use client";

import { useOpenClaw } from "@/lib/openclaw-context";
import { Loader2, WifiOff, Wifi } from "lucide-react";

export function ConnectionStatus() {
  const { connected, loading } = useOpenClaw();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Connecting...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {connected ? (
        <>
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Connected to OpenClaw
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3 text-red-400" />
          <span className="text-red-400">Disconnected</span>
        </>
      )}
    </div>
  );
}

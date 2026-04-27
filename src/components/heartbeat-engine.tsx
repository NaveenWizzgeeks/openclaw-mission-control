"use client";

import { useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Headless component — mounts once in layout, fires the heartbeat API
 * every 5 minutes to advance sequential task queues and write HEARTBEAT.md.
 */
export function HeartbeatEngine() {
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    async function tick() {
      try {
        await fetch("/api/heartbeat", { method: "POST" });
        lastTickRef.current = Date.now();
      } catch {
        // silent — heartbeat is best-effort
      }
    }

    // Fire immediately on mount
    tick();

    const interval = setInterval(tick, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return null;
}

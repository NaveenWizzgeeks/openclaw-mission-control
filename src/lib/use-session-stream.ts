"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOpenClaw, type OCMessage } from "@/lib/openclaw-context";
import type { DaemonEvent } from "@/lib/daemon-events";

const FALLBACK_POLL_MS = 1000;

export interface UseSessionStreamOptions {
  enabled?: boolean;
  initialLimit?: number;
}

export interface UseSessionStreamResult {
  messages: OCMessage[];
  loading: boolean;
  lastUpdate: number | null;
  refresh: () => Promise<void>;
}

export function useSessionStream(
  sessionKey: string | null,
  opts: UseSessionStreamOptions = {},
): UseSessionStreamResult {
  const { enabled = true, initialLimit = 50 } = opts;
  const { getSessionHistory } = useOpenClaw();
  const [messages, setMessages] = useState<OCMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (!sessionKey || inflight.current) return;
    inflight.current = true;
    setLoading(true);
    try {
      const history = await getSessionHistory(sessionKey, initialLimit);
      setMessages((prev) => {
        if (prev.length === history.length) {
          const lastPrev = prev[prev.length - 1];
          const lastNew = history[history.length - 1];
          if (lastPrev && lastNew && lastPrev.timestamp === lastNew.timestamp) {
            return prev;
          }
        }
        return history;
      });
      setLastUpdate(Date.now());
    } finally {
      setLoading(false);
      inflight.current = false;
    }
  }, [sessionKey, initialLimit, getSessionHistory]);

  useEffect(() => {
    if (!enabled || !sessionKey) {
      setMessages([]);
      setLastUpdate(null);
      return;
    }
    void refresh();
  }, [enabled, sessionKey, refresh]);

  useEffect(() => {
    if (!enabled || !sessionKey || typeof window === "undefined") return;
    const es = new EventSource("/api/daemon/events");

    const onSse = (raw: MessageEvent) => {
      try {
        const data: DaemonEvent = JSON.parse(raw.data);
        if (data.kind !== "gateway.event") return;
        const sk =
          (data.payload as { sessionKey?: string }).sessionKey ??
          (data.payload as { key?: string }).key;
        if (sk !== sessionKey) return;
        void refresh();
      } catch {}
    };
    es.addEventListener("gateway.event", onSse as EventListener);

    const id = setInterval(() => {
      void refresh();
    }, FALLBACK_POLL_MS);

    return () => {
      es.removeEventListener("gateway.event", onSse as EventListener);
      es.close();
      clearInterval(id);
    };
  }, [enabled, sessionKey, refresh]);

  return { messages, loading, lastUpdate, refresh };
}

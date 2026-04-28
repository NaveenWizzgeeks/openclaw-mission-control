"use client";

import { useEffect, useRef, useState } from "react";

export type DaemonEvent =
  | { kind: "daemon.state"; state: "starting" | "ready" | "stopping"; ts: number }
  | { kind: "daemon.heartbeat"; ts: number }
  | { kind: "daemon.snapshot"; daemonState: string; gatewayState: string; ts: number }
  | { kind: "gateway.state"; state: string; ts: number }
  | { kind: "gateway.event"; name: string; payload: Record<string, unknown>; ts: number };

type Status = "idle" | "connecting" | "open" | "closed" | "error";

export interface UseDaemonEventsResult {
  status: Status;
  lastEvent: DaemonEvent | null;
  lastEventId: number | null;
}

export function useDaemonEvents(
  onEvent?: (evt: DaemonEvent) => void,
): UseDaemonEventsResult {
  const [status, setStatus] = useState<Status>("idle");
  const [lastEvent, setLastEvent] = useState<DaemonEvent | null>(null);
  const [lastEventId, setLastEventId] = useState<number | null>(null);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setStatus("connecting");
    const es = new EventSource("/api/daemon/events");

    es.onopen = () => setStatus("open");
    es.onerror = () => setStatus("error");

    const dispatch = (raw: MessageEvent) => {
      try {
        const data: DaemonEvent = JSON.parse(raw.data);
        setLastEvent(data);
        if (raw.lastEventId) setLastEventId(Number(raw.lastEventId));
        handlerRef.current?.(data);
      } catch {}
    };
    for (const kind of [
      "daemon.state",
      "daemon.heartbeat",
      "daemon.snapshot",
      "gateway.state",
      "gateway.event",
    ]) {
      es.addEventListener(kind, dispatch as EventListener);
    }

    return () => {
      es.close();
      setStatus("closed");
    };
  }, []);

  return { status, lastEvent, lastEventId };
}

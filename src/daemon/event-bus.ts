import { EventEmitter } from "node:events";

export type DaemonEvent =
  | { kind: "daemon.state"; state: "starting" | "ready" | "stopping"; ts: number }
  | { kind: "daemon.heartbeat"; ts: number }
  | { kind: "daemon.snapshot"; daemonState: string; gatewayState: string; ts: number }
  | { kind: "gateway.state"; state: string; ts: number }
  | { kind: "gateway.event"; name: string; payload: Record<string, unknown>; ts: number };

export class EventBus {
  private emitter = new EventEmitter();
  private nextId = 1;

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  publish(evt: DaemonEvent): { id: number; evt: DaemonEvent } {
    const id = this.nextId++;
    this.emitter.emit("event", { id, evt });
    return { id, evt };
  }

  subscribe(
    handler: (msg: { id: number; evt: DaemonEvent }) => void,
  ): () => void {
    this.emitter.on("event", handler);
    return () => this.emitter.off("event", handler);
  }

  subscriberCount(): number {
    return this.emitter.listenerCount("event");
  }
}

export const bus = new EventBus();

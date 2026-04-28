import { EventEmitter } from "node:events";
import WebSocket, { type RawData } from "ws";
import { config } from "./config";
import { logger } from "./logger";
import {
  GatewayError,
  type GatewayEnvelope,
  type GatewayEvent,
  type GatewayLinkState,
  type PendingRequest,
} from "./types";

const log = logger("gateway-link");

export interface GatewayLinkEvents {
  state: (state: GatewayLinkState) => void;
  event: (evt: GatewayEvent) => void;
  ready: () => void;
  closed: (code: number, reason: string) => void;
}

export class GatewayLink extends EventEmitter {
  private ws: WebSocket | null = null;
  private state: GatewayLinkState = "idle";
  private connectId: string | null = null;
  private pending = new Map<string, PendingRequest>();
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((err: Error) => void) | null = null;

  constructor() {
    super();
  }

  start(): void {
    if (this.stopped) {
      throw new Error("GatewayLink: already stopped");
    }
    this.openSocket();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.failPending(new GatewayError("daemon stopping", "gateway/stopped"));
    this.setState("stopped");
    if (this.ws) {
      try {
        this.ws.close(1000, "daemon stop");
      } catch {}
      this.ws = null;
    }
  }

  whenReady(): Promise<void> {
    if (this.state === "ready") return Promise.resolve();
    if (!this.readyPromise) {
      this.readyPromise = new Promise<void>((resolve, reject) => {
        this.readyResolve = resolve;
        this.readyReject = reject;
      });
    }
    return this.readyPromise;
  }

  getState(): GatewayLinkState {
    return this.state;
  }

  request<T extends Record<string, unknown> = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs: number = config.request.defaultTimeoutMs,
  ): Promise<T> {
    if (this.state !== "ready" || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(
        new GatewayError(
          `gateway not ready (state=${this.state})`,
          "gateway/not-ready",
        ),
      );
    }
    const id = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new GatewayError(
            `request timeout: ${method} (${timeoutMs}ms)`,
            "gateway/timeout",
          ),
        );
      }, timeoutMs);
      this.pending.set(id, {
        method,
        startedAt: Date.now(),
        timer,
        resolve: (payload) => resolve(payload as T),
        reject,
      });
      const envelope: GatewayEnvelope = { type: "req", id, method, params };
      this.ws!.send(JSON.stringify(envelope), (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(new GatewayError(`send failed: ${err.message}`, "gateway/send"));
        }
      });
    });
  }

  private openSocket() {
    if (this.stopped) return;
    this.setState("connecting");
    log.info(`opening WS to ${config.gateway.url}`);
    const ws = new WebSocket(config.gateway.url, {
      headers: { Origin: config.gateway.origin },
    });
    this.ws = ws;
    ws.on("open", () => {
      log.debug("WS open");
    });
    ws.on("message", (data: RawData) => this.onMessage(data));
    ws.on("error", (err) => {
      log.warn(`WS error: ${err.message}`);
    });
    ws.on("close", (code, reasonBuf) => {
      const reason = reasonBuf.toString();
      log.warn(`WS closed code=${code} reason=${reason || "<none>"}`);
      this.ws = null;
      this.failPending(
        new GatewayError("connection closed", "gateway/closed"),
      );
      this.emit("closed", code, reason);
      this.scheduleReconnect();
    });
  }

  private onMessage(data: RawData) {
    let msg: GatewayEnvelope;
    try {
      msg = JSON.parse(data.toString());
    } catch (err) {
      log.warn(`bad JSON from gateway: ${(err as Error).message}`);
      return;
    }

    if (msg.type === "event") {
      if (msg.event === "connect.challenge") {
        this.sendHandshake();
        return;
      }
      const evt: GatewayEvent = {
        name: msg.event ?? "unknown",
        payload: msg.payload ?? {},
        receivedAt: Date.now(),
      };
      log.debug(`event ${evt.name}`, evt.payload);
      this.emit("event", evt);
      return;
    }

    if (msg.type === "res" && msg.id === this.connectId) {
      if (msg.ok) {
        log.info("handshake complete");
        this.connectId = null;
        this.reconnectAttempt = 0;
        this.setState("ready");
        this.emit("ready");
        if (this.readyResolve) {
          this.readyResolve();
          this.readyResolve = null;
          this.readyReject = null;
          this.readyPromise = null;
        }
      } else {
        const err = new GatewayError(
          msg.error?.message ?? "handshake failed",
          msg.error?.code ?? "gateway/handshake",
        );
        log.error(`handshake failed: ${err.message}`);
        this.failPending(err);
        if (this.readyReject) {
          this.readyReject(err);
          this.readyResolve = null;
          this.readyReject = null;
          this.readyPromise = null;
        }
        try {
          this.ws?.close(1008, "handshake failed");
        } catch {}
      }
      return;
    }

    if (msg.type === "res" && msg.id) {
      const pending = this.pending.get(msg.id);
      if (!pending) {
        log.debug(`unmatched res id=${msg.id}`);
        return;
      }
      this.pending.delete(msg.id);
      clearTimeout(pending.timer);
      if (msg.ok) {
        pending.resolve(msg.payload ?? {});
      } else {
        pending.reject(
          new GatewayError(
            msg.error?.message ?? "request failed",
            msg.error?.code ?? "gateway/error",
          ),
        );
      }
      return;
    }
  }

  private sendHandshake() {
    if (!this.ws) return;
    if (!config.gateway.token) {
      log.debug("OPENCLAW_TOKEN not set; gateway accepts empty on localhost");
    }
    this.setState("handshaking");
    const id = `conn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.connectId = id;
    const envelope: GatewayEnvelope = {
      type: "req",
      id,
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: config.gateway.clientId,
          displayName: config.gateway.clientName,
          version: config.gateway.clientVersion,
          platform: process.platform,
          mode: config.gateway.clientMode,
        },
        caps: [],
        auth: { token: config.gateway.token },
        role: "operator",
        scopes: ["operator.admin", "operator.read", "operator.write"],
      },
    };
    log.debug(`sending handshake id=${id}`);
    this.ws.send(JSON.stringify(envelope));
  }

  private scheduleReconnect() {
    if (this.stopped) return;
    if (this.reconnectTimer) return;
    const { minDelayMs, maxDelayMs, factor } = config.reconnect;
    const delay = Math.min(
      maxDelayMs,
      Math.round(minDelayMs * Math.pow(factor, this.reconnectAttempt)),
    );
    this.reconnectAttempt += 1;
    this.setState("reconnecting");
    log.info(
      `reconnect in ${delay}ms (attempt ${this.reconnectAttempt})`,
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  private failPending(err: GatewayError) {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
  }

  private setState(next: GatewayLinkState) {
    if (this.state === next) return;
    this.state = next;
    log.debug(`state -> ${next}`);
    this.emit("state", next);
  }
}

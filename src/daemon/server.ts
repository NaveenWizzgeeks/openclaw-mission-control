import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { config } from "./config";
import { logger } from "./logger";
import { bus, type DaemonEvent } from "./event-bus";
import type { GatewayLink } from "./gateway-link";

const log = logger("server");

const HEARTBEAT_INTERVAL_MS = 15_000;

let linkRef: GatewayLink | null = null;
let daemonStateRef: "starting" | "ready" | "stopping" = "starting";

export function attachGatewayLink(link: GatewayLink) {
  linkRef = link;
}

export function setDaemonState(state: "starting" | "ready" | "stopping") {
  daemonStateRef = state;
}

interface SseClient {
  id: number;
  res: ServerResponse;
  unsubscribe: () => void;
  heartbeat: NodeJS.Timeout;
}

let nextClientId = 1;
const clients = new Set<SseClient>();
let heartbeatTimer: NodeJS.Timeout | null = null;

function writeSse(
  res: ServerResponse,
  payload: { id: number; evt: DaemonEvent },
) {
  try {
    res.write(`id: ${payload.id}\n`);
    res.write(`event: ${payload.evt.kind}\n`);
    res.write(`data: ${JSON.stringify(payload.evt)}\n\n`);
  } catch (err) {
    log.warn(`SSE write failed: ${(err as Error).message}`);
  }
}

function attachSseClient(req: IncomingMessage, res: ServerResponse) {
  const client: SseClient = {
    id: nextClientId++,
    res,
    unsubscribe: () => {},
    heartbeat: setInterval(() => {
      try {
        res.write(": heartbeat\n\n");
      } catch {}
    }, HEARTBEAT_INTERVAL_MS),
  };

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`retry: 2000\n\n`);
  res.write(`: connected client=${client.id}\n\n`);

  const snapshot: { id: number; evt: DaemonEvent } = bus.publish({
    kind: "daemon.snapshot",
    daemonState: daemonStateRef,
    gatewayState: linkRef?.getState() ?? "idle",
    ts: Date.now(),
  });
  writeSse(res, snapshot);

  client.unsubscribe = bus.subscribe((msg) => writeSse(res, msg));
  clients.add(client);
  log.info(`SSE client ${client.id} connected (total=${clients.size})`);

  const onClose = () => {
    if (!clients.has(client)) return;
    clearInterval(client.heartbeat);
    client.unsubscribe();
    clients.delete(client);
    log.info(`SSE client ${client.id} disconnected (total=${clients.size})`);
  };
  req.on("close", onClose);
  req.on("error", onClose);
}

function handleHealth(res: ServerResponse) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      ok: true,
      ts: Date.now(),
      daemonState: daemonStateRef,
      gatewayState: linkRef?.getState() ?? "idle",
      sseClients: clients.size,
      busListeners: bus.subscriberCount(),
    }),
  );
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handleGatewayRequest(req: IncomingMessage, res: ServerResponse) {
  if (!linkRef) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "gateway link not attached" }));
    return;
  }
  let body: { method?: string; params?: Record<string, unknown>; timeoutMs?: number };
  try {
    body = JSON.parse((await readBody(req)) || "{}");
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "bad JSON body" }));
    return;
  }
  const { method, params, timeoutMs } = body;
  if (!method || typeof method !== "string") {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "method required" }));
    return;
  }
  try {
    const startedAt = Date.now();
    const payload = await linkRef.request(method, params ?? {}, timeoutMs);
    const tookMs = Date.now() - startedAt;
    log.debug(`gateway.${method} ok in ${tookMs}ms`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, data: payload, tookMs }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    log.warn(`gateway.${method} failed: ${message}`);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}

async function handleSessionsSpawn(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (!linkRef) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "gateway link not attached" }));
    return;
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse((await readBody(req)) || "{}");
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "bad JSON body" }));
    return;
  }
  const task = typeof body.task === "string" ? body.task : "";
  if (!task) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "task required" }));
    return;
  }
  try {
    const created = await linkRef.request<{ sessionKey?: string; key?: string }>(
      "sessions.create",
      {
        task,
        agentId: body.agentId,
        model: body.model,
        label: body.label,
      },
    );
    const sessionKey = created.sessionKey ?? created.key;
    if (sessionKey) {
      try {
        await linkRef.request("sessions.subscribe", { sessionKey });
        log.info(`spawned + subscribed: ${sessionKey}`);
      } catch (err) {
        log.warn(
          `subscribed-after-spawn failed for ${sessionKey}: ${(err as Error).message}`,
        );
      }
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, data: { sessionKey, ...created } }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    log.warn(`sessions.spawn failed: ${message}`);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}

function notFound(res: ServerResponse) {
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "not_found" }));
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  res.setHeader("Vary", "Origin");

  const url = new URL(req.url ?? "/", `http://${config.server.host}`);
  if (req.method === "GET" && url.pathname === "/health") {
    handleHealth(res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/events") {
    attachSseClient(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/gateway/request") {
    void handleGatewayRequest(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/sessions/spawn") {
    void handleSessionsSpawn(req, res);
    return;
  }
  notFound(res);
});

export function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.server.port, config.server.host, () => {
      server.off("error", reject);
      log.info(
        `daemon HTTP listening on http://${config.server.host}:${config.server.port}`,
      );
      heartbeatTimer = setInterval(() => {
        bus.publish({ kind: "daemon.heartbeat", ts: Date.now() });
      }, 30_000);
      resolve();
    });
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    for (const c of clients) {
      clearInterval(c.heartbeat);
      c.unsubscribe();
      try {
        c.res.end();
      } catch {}
    }
    clients.clear();
    server.close(() => resolve());
  });
}

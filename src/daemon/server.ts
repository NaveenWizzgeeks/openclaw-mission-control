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
      sseClients: clients.size,
      busListeners: bus.subscriberCount(),
    }),
  );
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

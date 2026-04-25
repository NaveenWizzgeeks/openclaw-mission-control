// Server-side helper to call the OpenClaw gateway from API routes.
// Mirrors the protocol of src/app/api/openclaw/route.ts but lets server
// routes invoke gateway methods directly.

import WebSocket from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const GATEWAY_TOKEN = process.env.NEXT_PUBLIC_OPENCLAW_TOKEN || "";

interface GatewayMessage {
  type: string;
  id?: string;
  ok?: boolean;
  event?: string;
  payload?: Record<string, unknown>;
  error?: { code?: string; message?: string };
}

export function callGateway<T = unknown>(
  method: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(GATEWAY_URL, {
      headers: { Origin: "http://localhost:3000" },
    });
    const reqId = `srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    let connected = false;
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("gateway timeout"));
    }, 15000);

    ws.on("message", (data: WebSocket.Data) => {
      try {
        const msg: GatewayMessage = JSON.parse(data.toString());
        if (msg.type === "event" && msg.event === "connect.challenge") {
          ws.send(JSON.stringify({
            type: "req",
            id: `conn-${Date.now()}`,
            method: "connect",
            params: {
              minProtocol: 3, maxProtocol: 3,
              client: {
                id: "openclaw-control-ui",
                displayName: "Mission Control",
                version: "1.0.0",
                platform: "linux",
                mode: "ui",
              },
              caps: [],
              auth: { token: GATEWAY_TOKEN },
              role: "operator",
              scopes: ["operator.admin", "operator.read", "operator.write"],
            },
          }));
          return;
        }
        if (msg.type === "res" && msg.ok === true && !connected) {
          connected = true;
          ws.send(JSON.stringify({ type: "req", id: reqId, method, params }));
          return;
        }
        if (msg.type === "res" && !msg.ok && !connected) {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(msg.error?.message || "connect failed"));
          return;
        }
        if (msg.id === reqId) {
          clearTimeout(timeout);
          ws.close();
          if (msg.ok) resolve(msg.payload as T);
          else reject(new Error(msg.error?.message || "request failed"));
        }
      } catch {}
    });

    ws.on("error", () => {
      clearTimeout(timeout);
      reject(new Error("gateway connection error"));
    });
    ws.on("close", () => clearTimeout(timeout));
  });
}

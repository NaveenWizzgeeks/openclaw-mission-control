import { NextRequest, NextResponse } from "next/server";
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

function gatewayRequest(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(GATEWAY_URL, {
      headers: { Origin: "http://localhost:3000" },
    });
    const reqId = `proxy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    let connected = false;
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("gateway timeout"));
    }, 10000);

    ws.on("message", (data: WebSocket.Data) => {
      try {
        const msg: GatewayMessage = JSON.parse(data.toString());

        // Handle challenge
        if (msg.type === "event" && msg.event === "connect.challenge") {
          ws.send(
            JSON.stringify({
              type: "req",
              id: `conn-${Date.now()}`,
              method: "connect",
              params: {
                minProtocol: 3,
                maxProtocol: 3,
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
                scopes: [
                  "operator.admin",
                  "operator.read",
                  "operator.write",
                ],
              },
            })
          );
          return;
        }

        // Handle connect response
        if (msg.type === "res" && msg.ok === true && !connected) {
          connected = true;
          // Now send the actual request
          ws.send(
            JSON.stringify({ type: "req", id: reqId, method, params })
          );
          return;
        }

        if (msg.type === "res" && !msg.ok && !connected) {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(msg.error?.message || "connect failed"));
          return;
        }

        // Handle our request response
        if (msg.id === reqId) {
          clearTimeout(timeout);
          ws.close();
          if (msg.ok) {
            resolve(msg.payload);
          } else {
            reject(new Error(msg.error?.message || "request failed"));
          }
        }
      } catch {}
    });

    ws.on("error", () => {
      clearTimeout(timeout);
      reject(new Error("gateway connection error"));
    });

    ws.on("close", () => {
      clearTimeout(timeout);
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { method, params } = body;

    if (!method || typeof method !== "string") {
      return NextResponse.json(
        { error: "method required" },
        { status: 400 }
      );
    }

    const result = await gatewayRequest(method, params || {});
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

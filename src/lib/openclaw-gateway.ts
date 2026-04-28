// Server-side helper to call the OpenClaw gateway.
// v2: forwards to the daemon's persistent connection instead of
// opening a fresh WS per request.

import { daemonUrl } from "./daemon-url";

export class GatewayCallError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "GatewayCallError";
  }
}

export async function callGateway<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const res = await fetch(daemonUrl("/gateway/request"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params, timeoutMs: options.timeoutMs }),
    signal: options.signal,
    cache: "no-store",
  }).catch((err) => {
    throw new GatewayCallError(`daemon unreachable: ${err.message}`);
  });

  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: unknown;
    error?: string;
  };

  if (!res.ok || !json.ok) {
    throw new GatewayCallError(
      json.error ?? `daemon returned ${res.status}`,
      res.status,
    );
  }
  return json.data as T;
}

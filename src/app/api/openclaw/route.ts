// v2: thin proxy to the daemon. The daemon owns the persistent
// gateway connection; this route just forwards browser-side calls.

import { NextRequest, NextResponse } from "next/server";
import { callGateway, GatewayCallError } from "@/lib/openclaw-gateway";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { method?: string; params?: Record<string, unknown>; timeoutMs?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad JSON body" }, { status: 400 });
  }
  const { method, params, timeoutMs } = body;
  if (!method || typeof method !== "string") {
    return NextResponse.json({ ok: false, error: "method required" }, { status: 400 });
  }
  try {
    const data = await callGateway(method, params ?? {}, { timeoutMs });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    if (err instanceof GatewayCallError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.status ?? 502 },
      );
    }
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

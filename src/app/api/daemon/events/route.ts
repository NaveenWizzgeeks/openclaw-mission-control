// v2 daemon SSE proxy — separate from /api/events which carries
// mission-orchestrator LiveEvents. This route streams gateway link
// state and gateway events from the daemon's persistent connection.

import type { NextRequest } from "next/server";
import { daemonUrl } from "@/lib/daemon-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const upstream = await fetch(daemonUrl("/events"), {
    headers: { Accept: "text/event-stream" },
    signal: req.signal,
    cache: "no-store",
  }).catch((err) => {
    return new Response(
      JSON.stringify({ ok: false, error: `daemon unreachable: ${err.message}` }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  });

  if (!(upstream instanceof Response)) {
    return upstream;
  }
  if (!upstream.ok || !upstream.body) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `daemon returned ${upstream.status}`,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

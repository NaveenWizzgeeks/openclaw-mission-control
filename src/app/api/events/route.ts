import type { LiveEvent } from "@/lib/mission-types";

// In-memory SSE client registry (single process)
const clients = new Set<ReadableStreamDefaultController<string>>();

/** Broadcast a live event to all connected SSE clients */
export function broadcast(event: LiveEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const ctrl of clients) {
    try {
      ctrl.enqueue(data);
    } catch {
      clients.delete(ctrl);
    }
  }
}

export const dynamic = "force-dynamic";

export async function GET() {
  let ctrl: ReadableStreamDefaultController<string>;

  const stream = new ReadableStream<string>({
    start(controller) {
      ctrl = controller;
      clients.add(ctrl);
      // Initial ping
      controller.enqueue(": connected\n\n");

      // Keep-alive ping every 25s
      const ping = setInterval(() => {
        try {
          controller.enqueue(": ping\n\n");
        } catch {
          clearInterval(ping);
          clients.delete(ctrl);
        }
      }, 25_000);

      // Attach cleanup to controller so it fires on cancel
      (ctrl as unknown as Record<string, unknown>)._ping = ping;
    },
    cancel() {
      const ping = (ctrl as unknown as Record<string, unknown>)._ping;
      if (ping) clearInterval(ping as ReturnType<typeof setInterval>);
      clients.delete(ctrl);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

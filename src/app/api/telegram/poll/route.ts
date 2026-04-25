import { NextRequest, NextResponse } from "next/server";

// ============================================================
// Telegram inbound polling. Returns new messages since `offset`.
// Client calls this periodically and updates its local offset.
// ============================================================

let cachedOffset = 0;

export async function GET(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token.includes("YOUR_BOT_TOKEN")) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_BOT_TOKEN not configured", messages: [] },
      { status: 200 }
    );
  }

  const url = new URL(req.url);
  const clientOffset = Number(url.searchParams.get("offset") ?? "0");
  const offset = Math.max(clientOffset, cachedOffset);

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=0&allowed_updates=["message"]`,
      { method: "GET" }
    );
    const data = await res.json();
    if (!data.ok) {
      return NextResponse.json({ ok: false, error: data.description, messages: [] });
    }

    const messages = (data.result ?? [])
      .filter((u: { message?: unknown }) => u.message)
      .map((u: {
        update_id: number;
        message: {
          message_id: number;
          reply_to_message?: { message_id: number };
          from?: { id: number; first_name?: string; username?: string };
          chat: { id: number; type: string; title?: string };
          date: number;
          text?: string;
          entities?: Array<{ type: string; offset: number; length: number }>;
        };
      }) => ({
        updateId: u.update_id,
        messageId: u.message.message_id,
        replyToMessageId: u.message.reply_to_message?.message_id,
        from: u.message.from
          ? {
              id: u.message.from.id,
              name: u.message.from.first_name ?? u.message.from.username ?? "unknown",
              username: u.message.from.username,
            }
          : null,
        chat: {
          id: u.message.chat.id,
          type: u.message.chat.type,
          title: u.message.chat.title,
        },
        date: u.message.date,
        text: u.message.text ?? "",
      }));

    // Advance offset past the last update so we don't reprocess
    if (messages.length > 0) {
      const maxUpdate = Math.max(...messages.map((m: { updateId: number }) => m.updateId));
      cachedOffset = maxUpdate + 1;
    }

    return NextResponse.json({ ok: true, messages, nextOffset: cachedOffset });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg, messages: [] }, { status: 500 });
  }
}

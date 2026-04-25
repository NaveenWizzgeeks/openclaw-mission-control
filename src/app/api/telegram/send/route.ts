import { NextRequest, NextResponse } from "next/server";

// ============================================================
// Telegram outbound: sends messages to the configured chat/group.
// Environment variables:
//   TELEGRAM_BOT_TOKEN    — from @BotFather
//   TELEGRAM_GROUP_CHAT_ID — group chat id (negative number, e.g. -1001234567890)
//   TELEGRAM_CHAT_ID       — fallback DM chat id (positive number)
// ============================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token.includes("YOUR_BOT_TOKEN")) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_BOT_TOKEN not configured in .env.local" },
      { status: 500, headers: CORS }
    );
  }

  let body: { text?: string; chatId?: string; parseMode?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400, headers: CORS });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "text is required" }, { status: 400, headers: CORS });
  }

  const chatId =
    body.chatId ||
    process.env.TELEGRAM_GROUP_CHAT_ID ||
    process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    return NextResponse.json(
      { ok: false, error: "No chatId: set TELEGRAM_GROUP_CHAT_ID or TELEGRAM_CHAT_ID" },
      { status: 500, headers: CORS }
    );
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: body.parseMode ?? "Markdown",
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      return NextResponse.json(
        { ok: false, error: data.description ?? "Telegram API error", raw: data },
        { status: 502, headers: CORS }
      );
    }
    return NextResponse.json({ ok: true, messageId: data.result?.message_id }, { headers: CORS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: CORS });
  }
}

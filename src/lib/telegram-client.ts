// Client-side helpers for Telegram integration.
// Outbound messages go through /api/telegram/send; inbound via /api/telegram/poll.

export interface TelegramMessage {
  updateId: number;
  messageId: number;
  replyToMessageId?: number;
  from: { id: number; name: string; username?: string } | null;
  chat: { id: number; type: string; title?: string };
  date: number;
  text: string;
}

export interface TelegramPollResponse {
  ok: boolean;
  messages: TelegramMessage[];
  nextOffset?: number;
  error?: string;
}

let sendEnabled = true;

// Returns the Telegram message_id on success, null on failure.
export async function sendToTelegram(text: string): Promise<number | null> {
  if (!sendEnabled || !text.trim()) return null;
  try {
    const res = await fetch("/api/telegram/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!data.ok) {
      if (data.error?.includes("not configured")) {
        sendEnabled = false;
        console.warn("[telegram] disabled:", data.error);
      }
      return null;
    }
    return data.messageId ?? null;
  } catch (err) {
    console.warn("[telegram] send failed:", err);
    return null;
  }
}

export async function pollTelegram(offset: number): Promise<TelegramPollResponse> {
  try {
    const res = await fetch(`/api/telegram/poll?offset=${offset}`);
    return (await res.json()) as TelegramPollResponse;
  } catch (err) {
    return {
      ok: false,
      messages: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Parses "@agentname" from text. Returns lowercased agent IDs.
export function parseAgentMentions(text: string, knownAgentIds: string[]): string[] {
  const matches = text.match(/@(\w+)/g) ?? [];
  const ids = matches
    .map((m) => m.slice(1).toLowerCase())
    .filter((id) => knownAgentIds.includes(id));
  return Array.from(new Set(ids));
}

// Strips mention tokens, leaving the task title/description.
export function stripMentions(text: string): string {
  return text.replace(/@\w+/g, "").trim().replace(/\s+/g, " ");
}

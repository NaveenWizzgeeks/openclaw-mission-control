import { NextResponse } from "next/server";

// Returns environment-derived context that gets injected into agent prompts.
// Lets agents know their workspace, Telegram config, and how to coordinate.
export async function GET() {
  return NextResponse.json({
    workspace: "/home/wizzgeeks/.openclaw/workspace",
    missionControlUrl: process.env.MISSION_CONTROL_URL ?? "http://localhost:3000",
    telegram: {
      botUsername: "@Openclaw_agent",
      chatId: process.env.TELEGRAM_CHAT_ID ?? null,
      groupChatId: process.env.TELEGRAM_GROUP_CHAT_ID ?? null,
      sendEndpoint: "/api/telegram/send",
    },
    tools: {
      files: ["read", "write", "edit", "apply_patch"],
      runtime: ["exec", "process", "code_execution"],
      web: ["web_search", "web_fetch", "x_search"],
      memory: ["memory_search"],
    },
    models: [
      "claude-cli/claude-sonnet-4-6",
      "claude-cli/claude-haiku-4-5",
      "claude-cli/claude-opus-4-6",
    ],
  });
}

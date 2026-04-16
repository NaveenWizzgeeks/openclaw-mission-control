"use client";

import { useChatContext } from "@/lib/chat-context";
import { SessionChatSheet } from "./session-chat-sheet";
import { NewChatDialog } from "./new-chat-dialog";

export function GlobalChat() {
  const {
    chatOpen,
    chatSession,
    closeChat,
    newChatOpen,
    closeNewChat,
    openChat,
  } = useChatContext();

  return (
    <>
      <SessionChatSheet
        open={chatOpen}
        onOpenChange={(open) => {
          if (!open) closeChat();
        }}
        session={chatSession}
      />
      <NewChatDialog
        open={newChatOpen}
        onOpenChange={(open) => {
          if (!open) closeNewChat();
        }}
        onSessionCreated={(session) => {
          openChat(session);
        }}
      />
    </>
  );
}

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { OCSession } from "./openclaw-context";

interface ChatContextData {
  chatOpen: boolean;
  chatSession: OCSession | null;
  newChatOpen: boolean;
  openChat: (session: OCSession) => void;
  closeChat: () => void;
  openNewChat: () => void;
  closeNewChat: () => void;
}

const ChatContext = createContext<ChatContextData>({
  chatOpen: false,
  chatSession: null,
  newChatOpen: false,
  openChat: () => {},
  closeChat: () => {},
  openNewChat: () => {},
  closeNewChat: () => {},
});

export function useChatContext() {
  return useContext(ChatContext);
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSession, setChatSession] = useState<OCSession | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);

  const openChat = useCallback((session: OCSession) => {
    setChatSession(session);
    setChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setChatOpen(false);
  }, []);

  const openNewChat = useCallback(() => {
    setNewChatOpen(true);
  }, []);

  const closeNewChat = useCallback(() => {
    setNewChatOpen(false);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        chatOpen,
        chatSession,
        newChatOpen,
        openChat,
        closeChat,
        openNewChat,
        closeNewChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

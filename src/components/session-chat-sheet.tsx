"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useOpenClaw, extractMessageText, type OCSession, type OCMessage } from "@/lib/openclaw-context";
import { useSessionStream } from "@/lib/use-session-stream";
import {
  Loader2,
  Send,
  RefreshCw,
  Bot,
  User,
  Terminal,
  MessageSquare,
} from "lucide-react";

interface SessionChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: OCSession | null;
}

export function SessionChatSheet({
  open,
  onOpenChange,
  session,
}: SessionChatSheetProps) {
  const { sendChat } = useOpenClaw();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<OCMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const stream = useSessionStream(session?.key ?? null, {
    enabled: open && !!session,
    initialLimit: 50,
  });
  const baseMessages = stream.messages;
  const messages: OCMessage[] = errorMsg
    ? [...baseMessages, errorMsg]
    : baseMessages;
  const loadingHistory = stream.loading && baseMessages.length === 0;

  useEffect(() => {
    if (!open) {
      setInput("");
      setErrorMsg(null);
      return;
    }
    setTimeout(scrollToBottom, 100);
  }, [open, baseMessages.length, scrollToBottom]);

  const handleSend = async () => {
    if (!input.trim() || !session || sending) return;

    const text = input.trim();
    setInput("");
    setErrorMsg(null);
    setSending(true);
    setTimeout(scrollToBottom, 50);

    try {
      await sendChat(session.key, text);
      void stream.refresh();
      setTimeout(() => {
        void stream.refresh();
        setSending(false);
      }, 1500);
    } catch {
      setErrorMsg({ role: "system", content: "Failed to send message" });
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  function renderContent(content: string | Array<{ type: string; text?: string }>) {
    // Handle content that might be an array (multi-part messages)
    if (typeof content !== "string") {
      try {
        const parts = content as unknown;
        if (Array.isArray(parts)) {
          return parts
            .map((p: { type?: string; text?: string }) =>
              p.type === "text" ? p.text : ""
            )
            .filter(Boolean)
            .join("\n");
        }
      } catch {}
      return String(content);
    }
    return content;
  }

  const RoleIcon = ({ role }: { role: string }) => {
    switch (role) {
      case "user":
        return <User className="h-4 w-4" />;
      case "assistant":
        return <Bot className="h-4 w-4" />;
      default:
        return <Terminal className="h-4 w-4" />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <SheetTitle className="truncate text-sm">
              {session?.key || "Session Chat"}
            </SheetTitle>
          </div>
          <SheetDescription className="flex items-center gap-2">
            {session && (
              <>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    session.status === "running"
                      ? "text-emerald-400 border-emerald-500/20"
                      : "text-zinc-400 border-zinc-500/20"
                  }`}
                >
                  {session.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {session.channel} · {session.model}
                </span>
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Send a message to start the conversation
              </p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const text = renderContent(msg.content);
              if (!text) return null;

              return (
                <div
                  key={i}
                  className={`flex gap-2.5 ${
                    msg.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  <div
                    className={`flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center ${
                      msg.role === "user"
                        ? "bg-primary/10 text-primary"
                        : msg.role === "assistant"
                        ? "bg-violet-500/10 text-violet-500"
                        : "bg-zinc-500/10 text-zinc-500"
                    }`}
                  >
                    <RoleIcon role={msg.role} />
                  </div>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : msg.role === "assistant"
                        ? "bg-muted/70 border border-border/50"
                        : "bg-zinc-500/10 border border-zinc-500/20 text-zinc-400 text-xs"
                    }`}
                  >
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
                      {text}
                    </pre>
                  </div>
                </div>
              );
            })
          )}
          {sending && (
            <div className="flex gap-2.5">
              <div className="flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center bg-violet-500/10 text-violet-500">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-muted/70 border border-border/50 rounded-xl px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border/50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void stream.refresh()}
              disabled={stream.loading}
              title="Refresh messages"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${stream.loading ? "animate-spin" : ""}`}
              />
            </Button>
            <span className="text-[10px] text-muted-foreground">
              {messages.length} message{messages.length !== 1 ? "s" : ""}
            </span>
          </div>
          {(() => {
            const hardClosed = new Set(["stopped", "ended"]);
            const sessionClosed = session ? hardClosed.has(session.status?.toLowerCase() ?? "") : false;
            const notLive = session ? session.status?.toLowerCase() !== "running" : false;
            return (
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    sessionClosed
                      ? "Session stopped — start a new task to continue"
                      : notLive
                      ? `Session is ${session?.status} — send a message to re-engage`
                      : "Type a message... (Enter to send, Shift+Enter for newline)"
                  }
                  className="min-h-[44px] max-h-[120px] resize-none bg-background text-sm"
                  disabled={sending || sessionClosed}
                />
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={sending || sessionClosed || !input.trim()}
                  className="self-end h-[44px] px-3"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            );
          })()}
        </div>
      </SheetContent>
    </Sheet>
  );
}

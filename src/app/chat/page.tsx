"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot, User, Terminal, Send, RefreshCw, Loader2,
  MessageSquare, ChevronDown, Zap,
} from "lucide-react";
import { useOpenClaw, extractMessageText, type OCSession, type OCMessage } from "@/lib/openclaw-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function MessageBubble({ msg }: { msg: OCMessage }) {
  function renderContent(content: OCMessage["content"]): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.filter((p) => p.type === "text").map((p) => p.text ?? "").join("\n");
    }
    return String(content);
  }
  const text = renderContent(msg.content);
  if (!text.trim()) return null;

  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="text-[10px] text-[#484f58] px-2 py-0.5 rounded-full bg-[#21262d]">{text}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className={cn(
        "shrink-0 h-7 w-7 rounded-lg flex items-center justify-center",
        isUser ? "bg-[#58a6ff]/15 text-[#58a6ff]" : "bg-[#d2a8ff]/10 text-[#d2a8ff]"
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn(
        "max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
        isUser
          ? "bg-[#58a6ff] text-[#0d1117] font-medium"
          : "bg-[#161b22] border border-[#30363d] text-[#e6edf3]"
      )}>
        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">{text}</pre>
      </div>
    </div>
  );
}

function SessionPicker({
  sessions,
  selected,
  onSelect,
}: {
  sessions: OCSession[];
  selected: OCSession | null;
  onSelect: (s: OCSession) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#30363d] bg-[#161b22] text-xs text-[#e6edf3] hover:border-[#58a6ff]/40 transition-colors"
      >
        <Terminal className="h-3.5 w-3.5 text-[#8b949e]" />
        <span className="max-w-[160px] truncate">{selected?.key ?? "Select session"}</span>
        {selected && (
          <span className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            selected.status === "running" ? "bg-[#3fb950]" : "bg-[#8b949e]"
          )} />
        )}
        <ChevronDown className="h-3 w-3 text-[#8b949e] shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 rounded-xl border border-[#30363d] bg-[#161b22] shadow-xl z-50 overflow-hidden">
          <div className="p-2 space-y-0.5 max-h-60 overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="text-xs text-[#484f58] px-2 py-2">No active sessions</p>
            ) : sessions.map((s) => (
              <button
                key={s.key}
                onClick={() => { onSelect(s); setOpen(false); }}
                className={cn(
                  "flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-left text-xs transition-colors",
                  selected?.key === s.key
                    ? "bg-[#58a6ff]/10 text-[#58a6ff]"
                    : "text-[#8b949e] hover:bg-[#21262d] hover:text-[#e6edf3]"
                )}
              >
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  s.status === "running" ? "bg-[#3fb950]" : "bg-[#484f58]"
                )} />
                <span className="truncate flex-1">{s.key}</span>
                <span className="text-[10px] opacity-60">{s.channel}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const { sessions, sendChat, getSessionHistory, connected, refresh } = useOpenClaw();
  const [selectedSession, setSelectedSession] = useState<OCSession | null>(null);
  const [messages, setMessages] = useState<OCMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-select main session when sessions load
  useEffect(() => {
    if (sessions.length > 0 && !selectedSession) {
      const main =
        sessions.find((s) => s.key === "main" || s.channel === "webchat" || s.channel === "main") ??
        sessions.find((s) => s.status === "running") ??
        sessions[0];
      setSelectedSession(main ?? null);
    }
  }, [sessions, selectedSession]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadHistory = useCallback(async () => {
    if (!selectedSession) return;
    setLoadingHistory(true);
    try {
      const history = await getSessionHistory(selectedSession.key, 100);
      setMessages(history);
      setTimeout(scrollToBottom, 100);
    } catch {
      setMessages([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedSession, getSessionHistory, scrollToBottom]);

  // Load history when session changes
  useEffect(() => {
    if (selectedSession) loadHistory();
    else setMessages([]);
  }, [selectedSession, loadHistory]);

  // Auto-poll every 4s when session is running
  useEffect(() => {
    if (!selectedSession || selectedSession.status !== "running") return;
    const id = setInterval(loadHistory, 4000);
    return () => clearInterval(id);
  }, [selectedSession, loadHistory]);

  async function handleSend() {
    if (!input.trim() || !selectedSession || sending) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);
    setTimeout(scrollToBottom, 50);

    try {
      await sendChat(selectedSession.key, text);
      setTimeout(() => {
        loadHistory().finally(() => setSending(false));
      }, 1500);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [...prev, { role: "system", content: `Send failed: ${detail}` }]);
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Only hard-stopped sessions can't receive messages; idle/completed/paused can still be re-engaged
  const sessionClosed = selectedSession
    ? ["stopped", "ended"].includes(selectedSession.status?.toLowerCase() ?? "")
    : false;
  const sessionNotLive = selectedSession
    ? selectedSession.status?.toLowerCase() !== "running"
    : false;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-[#0d1117]">
      {/* Header */}
      <div className="shrink-0 border-b border-[#30363d] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#d2a8ff]/10 border border-[#d2a8ff]/20 flex items-center justify-center">
            <Zap className="h-4 w-4 text-[#d2a8ff]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#e6edf3]">Chat with Jarvis</h1>
            <p className="text-[10px] text-[#8b949e]">
              {connected ? "Connected" : "Disconnected"} ·{" "}
              {selectedSession
                ? `${selectedSession.channel} · ${selectedSession.model}`
                : "No session selected"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SessionPicker
            sessions={sessions}
            selected={selectedSession}
            onSelect={setSelectedSession}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => { refresh(); loadHistory(); }}
            disabled={loadingHistory}
            className="text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loadingHistory && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
        {!connected ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="h-12 w-12 rounded-full bg-[#f85149]/10 flex items-center justify-center mb-3">
              <Bot className="h-6 w-6 text-[#f85149]" />
            </div>
            <p className="text-sm text-[#e6edf3]">Not connected to OpenClaw</p>
            <p className="text-xs text-[#8b949e] mt-1">Make sure the OpenClaw gateway is running</p>
          </div>
        ) : !selectedSession ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="h-12 w-12 rounded-full bg-[#58a6ff]/10 flex items-center justify-center mb-3">
              <MessageSquare className="h-6 w-6 text-[#58a6ff]" />
            </div>
            <p className="text-sm text-[#e6edf3]">No session selected</p>
            <p className="text-xs text-[#8b949e] mt-1">Pick a session from the dropdown above to start chatting</p>
          </div>
        ) : loadingHistory && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 text-[#58a6ff] animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="h-12 w-12 rounded-full bg-[#d2a8ff]/10 flex items-center justify-center mb-3">
              <Bot className="h-6 w-6 text-[#d2a8ff]" />
            </div>
            <p className="text-sm text-[#e6edf3]">No messages yet</p>
            <p className="text-xs text-[#8b949e] mt-1">Say something to Jarvis to get started</p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
            {sending && (
              <div className="flex gap-3">
                <div className="shrink-0 h-7 w-7 rounded-lg bg-[#d2a8ff]/10 text-[#d2a8ff] flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-[#161b22] border border-[#30363d] rounded-xl px-3.5 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#8b949e] animate-bounce [animation-delay:0ms]" />
                    <div className="h-1.5 w-1.5 rounded-full bg-[#8b949e] animate-bounce [animation-delay:150ms]" />
                    <div className="h-1.5 w-1.5 rounded-full bg-[#8b949e] animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[#30363d] px-6 py-4">
        <div className="flex gap-3 items-end max-w-4xl mx-auto">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !connected
                ? "Not connected to OpenClaw..."
                : !selectedSession
                ? "Select a session above to start chatting..."
                : sessionClosed
                ? "Session stopped — select a different session"
                : sessionNotLive
                ? `Session is ${selectedSession?.status} — send a message to re-engage...`
                : "Message Jarvis... (Enter to send, Shift+Enter for newline)"
            }
            className="flex-1 min-h-[52px] max-h-[160px] resize-none bg-[#161b22] border-[#30363d] text-[#e6edf3] placeholder:text-[#484f58] focus:border-[#58a6ff]/50 text-sm"
            disabled={sending || sessionClosed || !connected || !selectedSession}
          />
          <Button
            onClick={handleSend}
            disabled={sending || sessionClosed || !input.trim() || !connected || !selectedSession}
            className="h-[52px] px-4 bg-[#58a6ff] hover:bg-[#58a6ff]/90 text-[#0d1117] font-semibold shrink-0"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        {sessionNotLive && !sessionClosed && selectedSession && (
          <p className="text-[10px] text-[#d29922] text-center mt-1">
            Session is <span className="font-mono">{selectedSession.status}</span> — your message will re-engage it
          </p>
        )}
        <p className="text-[10px] text-[#484f58] text-center mt-1">
          {messages.length} messages · {selectedSession?.status ?? "no session"} ·{" "}
          {selectedSession?.model ?? "—"}
        </p>
      </div>
    </div>
  );
}

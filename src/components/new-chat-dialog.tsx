"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOpenClaw, type OCAgent, type OCSession } from "@/lib/openclaw-context";
import { Loader2, MessageSquarePlus } from "lucide-react";

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionCreated: (session: OCSession) => void;
}

export function NewChatDialog({
  open,
  onOpenChange,
  onSessionCreated,
}: NewChatDialogProps) {
  const { agents, models, spawnTask, refresh, sessions } = useOpenClaw();
  const [agentId, setAgentId] = useState("");
  const [model, setModel] = useState("");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const result = await spawnTask({
        task: "You are now in an interactive chat session. Greet the user and await instructions.",
        agentId: agentId || undefined,
        model: model || undefined,
        label: label.trim() || `chat-${Date.now()}`,
        mode: "session",
      });

      // Wait a moment for the session to register, then refresh
      await new Promise((r) => setTimeout(r, 1500));
      await refresh();

      // Try to find the newly created session from the result or by label
      const res = result as Record<string, unknown>;
      const sessionKey = (res.sessionKey || res.key || res.sessionId || "") as string;

      // Get updated sessions after refresh
      const findSession = (): OCSession | undefined => {
        if (sessionKey) {
          return sessions.find((s) => s.key === sessionKey || s.sessionId === sessionKey);
        }
        // Fallback: find by label
        const searchLabel = label.trim() || `chat-${Date.now()}`;
        return sessions.find((s) => s.key.includes(searchLabel));
      };

      // Construct a minimal session object if we can't find it in the list yet
      const foundSession = findSession();
      const newSession: OCSession = foundSession || {
        key: sessionKey || label.trim() || `chat-${Date.now()}`,
        kind: "session",
        channel: "mission-control",
        updatedAt: Date.now(),
        sessionId: sessionKey,
        model: model || "default",
        contextTokens: 0,
        totalTokens: 0,
        status: "running",
        startedAt: Date.now(),
        lastChannel: "mission-control",
        agentId: agentId || undefined,
      };

      setAgentId("");
      setModel("");
      setLabel("");
      onOpenChange(false);
      onSessionCreated(newSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Chat Session</DialogTitle>
          <DialogDescription>
            Start a new interactive agent session
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chat-agent">Agent</Label>
            <select
              id="chat-agent"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="flex h-8 w-full rounded-lg border border-input bg-zinc-900 text-foreground px-2.5 py-1.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            >
              <option value="" className="bg-zinc-900 text-foreground">Default</option>
              {agents.map((a: OCAgent) => (
                <option key={a.id} value={a.id} className="bg-zinc-900 text-foreground">
                  {a.name || a.id}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chat-model">Model</Label>
            <select
              id="chat-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="flex h-8 w-full rounded-lg border border-input bg-zinc-900 text-foreground px-2.5 py-1.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            >
              <option value="" className="bg-zinc-900 text-foreground">Default</option>
              {models.map((m) => (
                <option key={m.id} value={m.id} className="bg-zinc-900 text-foreground">
                  {m.name || m.id}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chat-label">Session Label (optional)</Label>
            <Input
              id="chat-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. research-assistant"
              className="bg-background"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <MessageSquarePlus className="h-4 w-4 mr-2" />
              )}
              {submitting ? "Starting..." : "Start Chat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

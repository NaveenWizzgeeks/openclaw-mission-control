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
import { Textarea } from "@/components/ui/textarea";
import { useOpenClaw, type OCAgent } from "@/lib/openclaw-context";
import { Loader2, Rocket } from "lucide-react";

interface SpawnTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedAgent?: string;
}

export function SpawnTaskDialog({
  open,
  onOpenChange,
  preselectedAgent,
}: SpawnTaskDialogProps) {
  const { agents, models, spawnTask } = useOpenClaw();
  const [task, setTask] = useState("");
  const [agentId, setAgentId] = useState(preselectedAgent || "");
  const [model, setModel] = useState("");
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<"run" | "session">("run");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      await spawnTask({
        task: task.trim(),
        agentId: agentId || undefined,
        model: model || undefined,
        label: label.trim() || undefined,
        mode,
      });
      setTask("");
      setAgentId("");
      setModel("");
      setLabel("");
      setMode("run");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to spawn task");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Spawn Task</DialogTitle>
          <DialogDescription>
            Create a new agent session to run a task
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task">Task Prompt</Label>
            <Textarea
              id="task"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe what the agent should do..."
              className="min-h-[100px] bg-background"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="agent">Agent</Label>
              <select
                id="agent"
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
              <Label htmlFor="model">Model</Label>
              <select
                id="model"
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="label">Label (optional)</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. deploy-check"
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mode">Mode</Label>
              <select
                id="mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as "run" | "session")}
                className="flex h-8 w-full rounded-lg border border-input bg-zinc-900 text-foreground px-2.5 py-1.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                <option value="run" className="bg-zinc-900 text-foreground">Run (one-shot)</option>
                <option value="session" className="bg-zinc-900 text-foreground">Session (persistent)</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={submitting || !task.trim()}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Rocket className="h-4 w-4 mr-2" />
              )}
              {submitting ? "Spawning..." : "Spawn Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

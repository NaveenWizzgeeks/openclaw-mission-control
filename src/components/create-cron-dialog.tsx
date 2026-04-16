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
import { useOpenClaw, type OCAgent, type CreateCronParams } from "@/lib/openclaw-context";
import { Loader2, Plus } from "lucide-react";

interface CreateCronDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCronDialog({ open, onOpenChange }: CreateCronDialogProps) {
  const { agents, createCron } = useOpenClaw();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scheduleKind, setScheduleKind] = useState<"cron" | "every" | "at">("every");
  const [cronExpr, setCronExpr] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState("30");
  const [atTime, setAtTime] = useState("");
  const [payloadKind, setPayloadKind] = useState<"agentTurn" | "systemEvent">("agentTurn");
  const [message, setMessage] = useState("");
  const [agentId, setAgentId] = useState("");
  const [sessionTarget, setSessionTarget] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setName("");
    setDescription("");
    setScheduleKind("every");
    setCronExpr("");
    setIntervalMinutes("30");
    setAtTime("");
    setPayloadKind("agentTurn");
    setMessage("");
    setAgentId("");
    setSessionTarget("");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const schedule: Record<string, unknown> = { kind: scheduleKind };
      if (scheduleKind === "cron") {
        if (!cronExpr.trim()) {
          setError("Cron expression is required");
          setSubmitting(false);
          return;
        }
        schedule.expr = cronExpr.trim();
      } else if (scheduleKind === "every") {
        const mins = parseInt(intervalMinutes);
        if (isNaN(mins) || mins < 1) {
          setError("Interval must be at least 1 minute");
          setSubmitting(false);
          return;
        }
        schedule.everyMs = mins * 60000;
      } else if (scheduleKind === "at") {
        if (!atTime) {
          setError("Timestamp is required for one-shot jobs");
          setSubmitting(false);
          return;
        }
        schedule.at = new Date(atTime).toISOString();
      }

      const payload: Record<string, unknown> = { kind: payloadKind };
      if (payloadKind === "agentTurn") {
        payload.message = message.trim();
      } else {
        payload.text = message.trim();
      }

      await createCron({
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        schedule: schedule as CreateCronParams["schedule"],
        payload: payload as CreateCronParams["payload"],
        agentId: agentId || undefined,
        sessionTarget: sessionTarget || undefined,
        enabled: true,
      });

      resetForm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create cron job");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Cron Job</DialogTitle>
          <DialogDescription>
            Schedule a recurring or one-shot agent task
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cron-name">Name</Label>
              <Input
                id="cron-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. daily-report"
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-kind">Schedule Type</Label>
              <select
                id="schedule-kind"
                value={scheduleKind}
                onChange={(e) => setScheduleKind(e.target.value as "cron" | "every" | "at")}
                className="flex h-8 w-full rounded-lg border border-input bg-zinc-900 text-foreground px-2.5 py-1.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                <option value="every" className="bg-zinc-900 text-foreground">Interval</option>
                <option value="cron" className="bg-zinc-900 text-foreground">Cron Expression</option>
                <option value="at" className="bg-zinc-900 text-foreground">One-shot (at time)</option>
              </select>
            </div>
          </div>

          {scheduleKind === "every" && (
            <div className="space-y-2">
              <Label htmlFor="interval">Interval (minutes)</Label>
              <Input
                id="interval"
                type="number"
                min="1"
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(e.target.value)}
                className="bg-background"
              />
            </div>
          )}

          {scheduleKind === "cron" && (
            <div className="space-y-2">
              <Label htmlFor="cron-expr">Cron Expression</Label>
              <Input
                id="cron-expr"
                value={cronExpr}
                onChange={(e) => setCronExpr(e.target.value)}
                placeholder="e.g. 0 9 * * 1-5"
                className="bg-background font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                min hour day month weekday (0=Sun)
              </p>
            </div>
          )}

          {scheduleKind === "at" && (
            <div className="space-y-2">
              <Label htmlFor="at-time">Run At</Label>
              <Input
                id="at-time"
                type="datetime-local"
                value={atTime}
                onChange={(e) => setAtTime(e.target.value)}
                className="bg-background"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cron-message">
              {payloadKind === "agentTurn" ? "Agent Prompt" : "System Event Text"}
            </Label>
            <Textarea
              id="cron-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                payloadKind === "agentTurn"
                  ? "Describe the task for the agent..."
                  : "System event message..."
              }
              className="min-h-[80px] bg-background"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="payload-kind">Payload</Label>
              <select
                id="payload-kind"
                value={payloadKind}
                onChange={(e) => setPayloadKind(e.target.value as "agentTurn" | "systemEvent")}
                className="flex h-8 w-full rounded-lg border border-input bg-zinc-900 text-foreground px-2.5 py-1.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                <option value="agentTurn" className="bg-zinc-900 text-foreground">Agent Turn</option>
                <option value="systemEvent" className="bg-zinc-900 text-foreground">System Event</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cron-agent">Agent</Label>
              <select
                id="cron-agent"
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
              <Label htmlFor="session-target">Target</Label>
              <select
                id="session-target"
                value={sessionTarget}
                onChange={(e) => setSessionTarget(e.target.value)}
                className="flex h-8 w-full rounded-lg border border-input bg-zinc-900 text-foreground px-2.5 py-1.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                <option value="" className="bg-zinc-900 text-foreground">Default</option>
                <option value="main" className="bg-zinc-900 text-foreground">Main Session</option>
                <option value="isolated" className="bg-zinc-900 text-foreground">Isolated</option>
                <option value="current" className="bg-zinc-900 text-foreground">Current Session</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cron-desc">Description (optional)</Label>
            <Input
              id="cron-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this job do?"
              className="bg-background"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={submitting || !message.trim()}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {submitting ? "Creating..." : "Create Job"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


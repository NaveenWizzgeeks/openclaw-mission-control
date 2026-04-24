"use client";

import { useState, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { useTeam } from "@/lib/team-context";
import { SQUAD, inferSpecialty, getAgentsBySpecialty } from "@/lib/team-store";
import type { TaskPriority } from "@/lib/team-store";
import { Rocket, X, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssignMissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: "low",      label: "Low",      color: "text-zinc-400 border-zinc-500/30 hover:bg-zinc-500/10" },
  { value: "medium",   label: "Medium",   color: "text-blue-400 border-blue-500/30 hover:bg-blue-500/10" },
  { value: "high",     label: "High",     color: "text-amber-400 border-amber-500/30 hover:bg-amber-500/10" },
  { value: "critical", label: "Critical", color: "text-red-400 border-red-500/30 hover:bg-red-500/10" },
];

export function AssignMissionDialog({ open, onOpenChange }: AssignMissionDialogProps) {
  const { createTask } = useTeam();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // Predict which agent will pick this up
  const inferred = useMemo(() => {
    if (!title.trim()) return null;
    const specialty = inferSpecialty(title.trim(), description.trim());
    const candidates = getAgentsBySpecialty(specialty);
    return { specialty, candidates };
  }, [title, description]);

  function addTag() {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createTask({
      title: title.trim(),
      description: description.trim(),
      priority,
      tags,
    });
    setTitle(""); setDescription(""); setPriority("medium"); setTags([]); setTagInput("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            New Mission
          </DialogTitle>
          <DialogDescription>
            Describe the task. An agent matching the specialty will claim it from the backlog.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="t">Mission Title</Label>
            <Input
              id="t"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Build a simple todo app"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="d">Description</Label>
            <Textarea
              id="d"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the goal, constraints, and expected outcome..."
              className="min-h-[90px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all",
                    opt.color,
                    priority === opt.value ? "ring-1 ring-primary/30 bg-primary/5" : "opacity-60"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addTag(); }
                }}
                placeholder="Add tags, press Enter"
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs gap-1 pr-1">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-400">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Specialty prediction */}
          {inferred && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-2">
              <div className="flex items-center gap-1.5">
                <BrainCircuit className="h-3.5 w-3.5 text-primary" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Likely claim
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Specialty: <span className="font-semibold capitalize text-foreground">{inferred.specialty}</span>
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {inferred.candidates.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Jarvis will route manually</span>
                ) : (
                  inferred.candidates.map((a) => (
                    <div key={a.id} className="flex items-center gap-1.5">
                      <div className={cn("h-5 w-5 rounded text-[10px] font-bold flex items-center justify-center text-white", a.color)}>
                        {a.avatar}
                      </div>
                      <span className="text-xs">{a.name}</span>
                      <span className="text-[10px] text-muted-foreground">({a.title})</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={!title.trim()}>
              <Rocket className="h-4 w-4 mr-2" />
              Add to Backlog
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

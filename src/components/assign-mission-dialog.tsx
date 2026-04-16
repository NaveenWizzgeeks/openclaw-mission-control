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
import { Badge } from "@/components/ui/badge";
import { useTeam } from "@/lib/team-context";
import type { MissionPriority } from "@/lib/team-store";
import { Rocket, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssignMissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRIORITY_OPTIONS: { value: MissionPriority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "text-zinc-400 border-zinc-500/30 hover:bg-zinc-500/10" },
  { value: "medium", label: "Medium", color: "text-blue-400 border-blue-500/30 hover:bg-blue-500/10" },
  { value: "high", label: "High", color: "text-amber-400 border-amber-500/30 hover:bg-amber-500/10" },
  { value: "critical", label: "Critical", color: "text-red-400 border-red-500/30 hover:bg-red-500/10" },
];

export function AssignMissionDialog({ open, onOpenChange }: AssignMissionDialogProps) {
  const { createMission } = useTeam();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<MissionPriority>("medium");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

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

    createMission(title.trim(), description.trim(), priority, tags);

    // Reset form
    setTitle("");
    setDescription("");
    setPriority("medium");
    setTags([]);
    setTagInput("");
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
            Assign a task to Team Jarvis. It will flow through the full pipeline:
            Analysis → Planning → Development → Testing → Review → Approval.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mission-title">Mission Title</Label>
            <Input
              id="mission-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Build real-time notification system"
              className="bg-background"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mission-desc">Description</Label>
            <Textarea
              id="mission-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what needs to be built, any constraints, and expected outcome..."
              className="min-h-[100px] bg-background"
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
                    priority === opt.value
                      ? "ring-1 ring-primary/30 bg-primary/5"
                      : "opacity-60"
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
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add tags, press Enter"
                className="bg-background"
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] gap-1 pr-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-red-400 transition-colors"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Pipeline preview */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Pipeline Route
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
              <span className="font-medium text-foreground">Jarvis</span>
              <span>→</span>
              <span>Nova (Analysis)</span>
              <span>→</span>
              <span>Architect (Plan)</span>
              <span>→</span>
              <span>Forge (Build)</span>
              <span>→</span>
              <span>Pulse (Test)</span>
              <span>→</span>
              <span>Apex (Review)</span>
              <span>→</span>
              <span className="font-medium text-foreground">Jarvis (Approve)</span>
            </div>
          </div>

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={!title.trim()}>
              <Rocket className="h-4 w-4 mr-2" />
              Launch Mission
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

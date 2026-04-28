"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Rocket, Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface MissionCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onCreated: (mission: { id: string; title: string }) => void;
}

export function MissionCreator({ open, onOpenChange, workspaceId, onCreated }: MissionCreatorProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), workspaceId }),
      });
      const data = await res.json() as { ok: boolean; mission: { id: string; title: string } };
      if (!data.ok) throw new Error("Failed to create mission");
      onCreated(data.mission);
      onOpenChange(false);
      setTitle("");
      setDescription("");
    } catch {
      setError("Failed to create mission. Try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#161b22] border-[#30363d] max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#e6edf3]">
            <div className="h-8 w-8 rounded-lg bg-[#58a6ff]/15 flex items-center justify-center">
              <Rocket className="h-4 w-4 text-[#58a6ff]" />
            </div>
            New Mission
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Info banner */}
          <div className="flex gap-2.5 p-3 rounded-lg bg-[#21262d] border border-[#30363d] text-xs text-[#8b949e]">
            <Zap className="h-4 w-4 text-[#ffa657] shrink-0 mt-0.5" />
            <span>Jarvis will route your mission to the best analyst agent who will ask clarifying questions, research, and break it into sequential tasks.</span>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-[#8b949e] uppercase tracking-wider">Mission</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you want to build or accomplish?"
              className={cn(
                "bg-[#0d1117] border-[#30363d] text-[#e6edf3] placeholder:text-[#484f58]",
                "focus-visible:ring-[#58a6ff]/40 focus-visible:border-[#58a6ff]"
              )}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-[#8b949e] uppercase tracking-wider">
              Context <span className="text-[#484f58] normal-case">(optional)</span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any additional context, constraints, or background information…"
              rows={4}
              className={cn(
                "bg-[#0d1117] border-[#30363d] text-[#e6edf3] placeholder:text-[#484f58] resize-none",
                "focus-visible:ring-[#58a6ff]/40 focus-visible:border-[#58a6ff]"
              )}
            />
          </div>

          {error && <p className="text-xs text-[#f85149]">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || creating}
              className="bg-[#58a6ff] hover:bg-[#58a6ff]/90 text-[#0d1117] font-semibold"
            >
              {creating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Launching…</>
              ) : (
                <><Rocket className="h-4 w-4 mr-2" />Launch Mission</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

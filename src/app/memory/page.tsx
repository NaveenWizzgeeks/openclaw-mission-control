"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Brain,
  MessageSquare,
  CheckCheck,
  Pencil,
  Pin,
  Trash2,
  Plus,
  RefreshCw,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { MemoryRecord, MemoryType } from "@/lib/memory-types";

// ─── Helpers ───────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function formatDateHeader(date: string): string {
  const today = todayStr();
  const yesterday = yesterdayStr();
  if (date === today) return `Today — ${new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`;
  if (date === yesterday) return `Yesterday — ${new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`;
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function groupByDate(records: MemoryRecord[]): Map<string, MemoryRecord[]> {
  const map = new Map<string, MemoryRecord[]>();
  for (const r of records) {
    const group = map.get(r.date) ?? [];
    group.push(r);
    map.set(r.date, group);
  }
  return map;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

// ─── Type config ───────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<MemoryType, { icon: React.ElementType; color: string; badge: string }> = {
  daily_digest: { icon: Brain, color: "text-primary", badge: "bg-primary/10 text-primary border-primary/20" },
  session: { icon: MessageSquare, color: "text-emerald-500", badge: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  task: { icon: CheckCheck, color: "text-amber-500", badge: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  manual: { icon: Pencil, color: "text-zinc-400", badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
};

// ─── Skeleton ──────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex gap-4 p-4 rounded-xl border border-border/50 bg-card/50 animate-pulse">
      <div className="h-8 w-8 rounded-lg bg-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted rounded w-2/3" />
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-4/5" />
      </div>
    </div>
  );
}

// ─── Memory Card ───────────────────────────────────────────────────────────

interface MemoryCardProps {
  record: MemoryRecord;
  onClick: () => void;
  onPin: () => void;
  onDelete: () => void;
}

function MemoryCard({ record, onClick, onPin, onDelete }: MemoryCardProps) {
  const cfg = TYPE_CONFIG[record.type];
  const Icon = cfg.icon;

  return (
    <div
      className="group relative flex gap-4 p-4 rounded-xl border border-border/50 bg-card/50 hover:shadow-lg hover:border-border transition-all cursor-pointer"
      onClick={onClick}
    >
      {/* Type Icon */}
      <div className="shrink-0 mt-0.5">
        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
          <Icon className={cn("h-4 w-4", cfg.color)} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-medium text-sm text-foreground leading-tight line-clamp-1">{record.title}</h3>
          {record.pinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0 fill-current" />}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{record.summary}</p>

        {/* Highlights (max 3) */}
        {record.highlights.length > 0 && (
          <ul className="space-y-0.5 mb-2">
            {record.highlights.slice(0, 3).map((h, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <span className="text-primary/60 mt-0.5 shrink-0">•</span>
                <span className="line-clamp-1">{h}</span>
              </li>
            ))}
            {record.highlights.length > 3 && (
              <li className="text-xs text-muted-foreground/50 pl-3.5">+{record.highlights.length - 3} more</li>
            )}
          </ul>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", cfg.badge)}>
            {record.type.replace("_", " ")}
          </Badge>
          {record.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground/70">
              {tag}
            </Badge>
          ))}
          <span className="text-[10px] text-muted-foreground/50 ml-auto">{record.wordCount}w · {formatTime(record.createdAt)}</span>
        </div>
      </div>

      {/* Hover actions */}
      <div
        className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onPin}
          className="h-6 w-6 rounded flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors"
          title={record.pinned ? "Unpin" : "Pin"}
        >
          <Pin className={cn("h-3 w-3", record.pinned ? "fill-primary text-primary" : "text-muted-foreground")} />
        </button>
        <button
          onClick={onDelete}
          className="h-6 w-6 rounded flex items-center justify-center bg-muted hover:bg-destructive/20 hover:text-destructive transition-colors"
          title="Delete"
        >
          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </button>
      </div>
    </div>
  );
}

// ─── Detail Sheet ──────────────────────────────────────────────────────────

interface DetailSheetProps {
  record: MemoryRecord | null;
  onClose: () => void;
  onPin: (record: MemoryRecord) => void;
  onDelete: (record: MemoryRecord) => void;
}

function DetailSheet({ record, onClose, onPin, onDelete }: DetailSheetProps) {
  if (!record) return null;
  const cfg = TYPE_CONFIG[record.type];
  const Icon = cfg.icon;

  return (
    <Sheet open={!!record} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-[480px] sm:max-w-[480px] flex flex-col">
        <SheetHeader className="shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
              <Icon className={cn("h-5 w-5", cfg.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base leading-tight">{record.title}</SheetTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", cfg.badge)}>
                  {record.type.replace("_", " ")}
                </Badge>
                <span className="text-xs text-muted-foreground">{record.date}</span>
                {record.pinned && <Pin className="h-3 w-3 text-primary fill-current" />}
              </div>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Summary</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{record.summary}</p>
            </div>

            {record.highlights.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Highlights</p>
                <ul className="space-y-1.5">
                  {record.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary mt-0.5 shrink-0">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Metadata */}
            {(record.metadata.agentName || record.metadata.sessionKey || record.metadata.taskTitle || record.metadata.tasksCompleted !== undefined) && (
              <div>
                <Separator className="mb-3" />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Metadata</p>
                <dl className="space-y-1.5">
                  {record.metadata.agentName && (
                    <div className="flex gap-2 text-xs">
                      <dt className="text-muted-foreground/60 w-28 shrink-0">Agent</dt>
                      <dd className="text-muted-foreground">{record.metadata.agentName}</dd>
                    </div>
                  )}
                  {record.metadata.sessionKey && (
                    <div className="flex gap-2 text-xs">
                      <dt className="text-muted-foreground/60 w-28 shrink-0">Session</dt>
                      <dd className="text-muted-foreground font-mono">{record.metadata.sessionKey}</dd>
                    </div>
                  )}
                  {record.metadata.taskTitle && (
                    <div className="flex gap-2 text-xs">
                      <dt className="text-muted-foreground/60 w-28 shrink-0">Task</dt>
                      <dd className="text-muted-foreground">{record.metadata.taskTitle}</dd>
                    </div>
                  )}
                  {record.metadata.tasksCompleted !== undefined && (
                    <div className="flex gap-2 text-xs">
                      <dt className="text-muted-foreground/60 w-28 shrink-0">Tasks completed</dt>
                      <dd className="text-muted-foreground">{record.metadata.tasksCompleted}</dd>
                    </div>
                  )}
                  {record.metadata.activeAgents && record.metadata.activeAgents.length > 0 && (
                    <div className="flex gap-2 text-xs">
                      <dt className="text-muted-foreground/60 w-28 shrink-0">Active agents</dt>
                      <dd className="text-muted-foreground">{record.metadata.activeAgents.join(", ")}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {record.tags.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {record.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Separator className="mb-3" />
              <div className="flex gap-4 text-xs text-muted-foreground/60">
                <span>Created {new Date(record.createdAt).toLocaleString()}</span>
                <span>·</span>
                <span>{record.wordCount} words</span>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="shrink-0 pt-4 border-t border-border flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onPin(record)}
          >
            <Pin className="h-3.5 w-3.5 mr-1.5" />
            {record.pinned ? "Unpin" : "Pin"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => { onDelete(record); onClose(); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── New Memory Dialog ──────────────────────────────────────────────────────

interface NewMemoryDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function NewMemoryDialog({ open, onClose, onCreated }: NewMemoryDialogProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MemoryType>("manual");
  const [date, setDate] = useState(todayStr());
  const [summary, setSummary] = useState("");
  const [highlights, setHighlights] = useState<string[]>([""]);
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setTitle(""); setType("manual"); setDate(todayStr()); setSummary("");
    setHighlights([""]); setTags(""); setError("");
  };

  const handleClose = () => { reset(); onClose(); };

  const addHighlight = () => setHighlights((prev) => [...prev, ""]);
  const removeHighlight = (i: number) => setHighlights((prev) => prev.filter((_, idx) => idx !== i));
  const updateHighlight = (i: number, val: string) =>
    setHighlights((prev) => prev.map((h, idx) => (idx === i ? val : h)));

  const handleSubmit = async () => {
    if (!title.trim()) { setError("Title is required"); return; }
    if (!summary.trim()) { setError("Summary is required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          type,
          date,
          summary: summary.trim(),
          highlights: highlights.map((h) => h.trim()).filter(Boolean),
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          pinned: false,
        }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? "Failed to create"); return; }
      reset();
      onCreated();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>New Memory</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title</label>
              <Input
                placeholder="Memory title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
              <Select value={type} onValueChange={(v) => setType(v as MemoryType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="session">Session</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="daily_digest">Daily Digest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Summary</label>
              <Textarea
                placeholder="Write a summary..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={4}
              />
            </div>
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">Highlights</label>
                <button onClick={addHighlight} className="text-xs text-primary hover:underline">+ Add</button>
              </div>
              <div className="space-y-1.5">
                {highlights.map((h, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder={`Highlight ${i + 1}`}
                      value={h}
                      onChange={(e) => updateHighlight(i, e.target.value)}
                      className="flex-1"
                    />
                    {highlights.length > 1 && (
                      <button onClick={() => removeHighlight(i)} className="text-muted-foreground hover:text-destructive p-1">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tags (comma-separated)</label>
              <Input
                placeholder="e.g. backend, auth, v2"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save Memory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function MemoryPage() {
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingDigest, setGeneratingDigest] = useState(false);
  const [newMemoryOpen, setNewMemoryOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MemoryRecord | null>(null);
  const [digestMessage, setDigestMessage] = useState("");

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/memory?limit=100");
      const data = await res.json();
      if (data.ok) setRecords(data.records);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleGenerateDigest = async () => {
    setGeneratingDigest(true);
    setDigestMessage("");
    try {
      const res = await fetch("/api/memory/daily", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setDigestMessage(data.wasUpdated ? "Digest updated for today." : "Today's digest generated.");
        fetchRecords();
      } else {
        setDigestMessage("Failed to generate digest.");
      }
    } catch {
      setDigestMessage("Network error.");
    } finally {
      setGeneratingDigest(false);
      setTimeout(() => setDigestMessage(""), 3000);
    }
  };

  const handlePin = async (record: MemoryRecord) => {
    const updated = { ...record, pinned: !record.pinned };
    // Optimistic update
    setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
    if (selectedRecord?.id === record.id) setSelectedRecord(updated);
    try {
      await fetch(`/api/memory/${record.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pinned: !record.pinned }),
      });
    } catch {
      // revert on error
      setRecords((prev) => prev.map((r) => (r.id === record.id ? record : r)));
    }
  };

  const handleDelete = async (record: MemoryRecord) => {
    // Optimistic remove
    setRecords((prev) => prev.filter((r) => r.id !== record.id));
    if (selectedRecord?.id === record.id) setSelectedRecord(null);
    try {
      await fetch(`/api/memory/${record.id}`, { method: "DELETE" });
    } catch {
      // revert
      setRecords((prev) => [record, ...prev]);
    }
  };

  // Stats
  const today = todayStr();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);

  const totalMemories = records.length;
  const thisWeek = records.filter((r) => r.date >= weekAgoStr).length;
  const tasksCaptured = records.filter((r) => r.type === "task").length;
  const dailyDigests = records.filter((r) => r.type === "daily_digest").length;

  // Group by date (sorted descending)
  const grouped = groupByDate(records);
  const sortedDates = [...grouped.keys()].sort((a, b) => b.localeCompare(a));

  const isEmpty = !loading && records.length === 0;

  return (
    <div className="flex flex-col h-full min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 px-6 py-4 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Memory</h1>
              <p className="text-sm text-muted-foreground">Daily digests, session highlights, and task summaries</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {digestMessage && (
              <span className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">{digestMessage}</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateDigest}
              disabled={generatingDigest}
            >
              {generatingDigest ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Generate Today&apos;s Digest
            </Button>
            <Button size="sm" onClick={() => setNewMemoryOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Memory
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-6 py-6 space-y-6 max-w-4xl">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Memories", value: totalMemories },
              { label: "This Week", value: thisWeek },
              { label: "Tasks Captured", value: tasksCaptured },
              { label: "Daily Digests", value: dailyDigests },
            ].map((stat) => (
              <Card key={stat.label} className="border-border/50 bg-card/50">
                <CardContent className="p-4">
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Loading skeletons */}
          {loading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* Empty state */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Brain className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">No memories yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Generate today&apos;s digest or create a memory manually.
              </p>
              <Button onClick={handleGenerateDigest} disabled={generatingDigest} size="sm">
                {generatingDigest ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Generate Today&apos;s Digest
              </Button>
            </div>
          )}

          {/* Timeline */}
          {!loading && !isEmpty && (
            <div className="space-y-6">
              {sortedDates.map((date) => {
                const dayRecords = grouped.get(date) ?? [];
                return (
                  <div key={date}>
                    {/* Date header */}
                    <div className="flex items-center gap-3 mb-3">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                        {formatDateHeader(date)}
                        {date === today && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary">
                            Today
                          </span>
                        )}
                      </h2>
                      <div className="flex-1 h-px bg-border/40" />
                      <span className="text-[10px] text-muted-foreground/50">{dayRecords.length}</span>
                    </div>
                    <div className="space-y-2.5">
                      {dayRecords.map((record) => (
                        <MemoryCard
                          key={record.id}
                          record={record}
                          onClick={() => setSelectedRecord(record)}
                          onPin={() => handlePin(record)}
                          onDelete={() => handleDelete(record)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* New Memory Dialog */}
      <NewMemoryDialog
        open={newMemoryOpen}
        onClose={() => setNewMemoryOpen(false)}
        onCreated={() => { setNewMemoryOpen(false); fetchRecords(); }}
      />

      {/* Detail Sheet */}
      <DetailSheet
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onPin={handlePin}
        onDelete={handleDelete}
      />
    </div>
  );
}

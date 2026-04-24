"use client";

import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTeam } from "@/lib/team-context";
import {
  SQUAD,
  type Task,
  type Comment,
  type SquadAgent,
  type TaskStatus,
  getAgent,
} from "@/lib/team-store";
import {
  CheckCheck,
  Clock,
  HelpCircle,
  Send,
  Play,
  XCircle,
  MessageSquare,
  Hash,
  AtSign,
  Flame,
  AlertTriangle,
  User,
  Pause,
  Check,
  X,
  Zap,
} from "lucide-react";
import { cn, elapsed } from "@/lib/utils";
import { AgentAvatar } from "@/components/agent-avatar";

// --- status badge ---
const STATUS_STYLES: Record<TaskStatus, { label: string; color: string; icon: typeof Clock }> = {
  backlog:     { label: "Backlog",     color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/30",   icon: Clock },
  claimed:     { label: "Claimed",     color: "text-blue-400 bg-blue-500/10 border-blue-500/30",    icon: User },
  in_progress: { label: "In Progress", color: "text-amber-400 bg-amber-500/10 border-amber-500/30", icon: Play },
  review:      { label: "In Review",   color: "text-violet-400 bg-violet-500/10 border-violet-500/30", icon: CheckCheck },
  blocked:     { label: "Blocked",     color: "text-red-400 bg-red-500/10 border-red-500/30",        icon: Pause },
  done:        { label: "Done",        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", icon: Check },
};

function PriorityBadge({ priority }: { priority: string }) {
  const s: Record<string, string> = {
    critical: "text-red-400 border-red-500/40 bg-red-500/10",
    high:     "text-amber-400 border-amber-500/40 bg-amber-500/10",
    medium:   "text-blue-400 border-blue-500/40 bg-blue-500/10",
    low:      "text-zinc-400 border-zinc-500/40 bg-zinc-500/10",
  };
  return (
    <Badge variant="outline" className={cn("text-xs font-semibold", s[priority])}>
      {priority === "critical" && <Flame className="h-3 w-3 mr-1" />}
      {priority === "high" && <AlertTriangle className="h-3 w-3 mr-1" />}
      {priority.toUpperCase()}
    </Badge>
  );
}

// Format comment text with @mentions highlighted
function CommentText({ text }: { text: string }) {
  const parts = text.split(/(@\w+)/g);
  return (
    <span className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
      {parts.map((p, i) => {
        if (!p.startsWith("@")) return <span key={i}>{p}</span>;
        const agent = SQUAD.find((a) => a.name.toLowerCase() === p.slice(1).toLowerCase());
        if (!agent) return <span key={i}>{p}</span>;
        return (
          <span
            key={i}
            className={cn("font-semibold px-1 rounded", "text-primary bg-primary/10")}
          >
            {p}
          </span>
        );
      })}
    </span>
  );
}

export function TaskDetailSheet({
  task, open, onOpenChange,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const {
    agents, postComment, claimTask, startTask, sendToReview,
    approveTask, rejectTask, unblockTask,
  } = useTeam();

  const [replyText, setReplyText] = useState("");
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setReplyText("");
    setShowMentionMenu(false);
  }, [task?.id]);

  if (!task) return null;

  const statusStyle = STATUS_STYLES[task.status];
  const StatusIcon = statusStyle.icon;
  const assignee = task.assigneeId ? getAgent(task.assigneeId) : null;
  const reviewer = task.reviewerId ? getAgent(task.reviewerId) : null;

  // Detect @ in textarea for mention autocomplete
  const handleReplyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setReplyText(val);
    const cursor = e.target.selectionStart;
    const upToCursor = val.slice(0, cursor);
    const match = upToCursor.match(/@(\w*)$/);
    if (match) {
      setMentionFilter(match[1].toLowerCase());
      setShowMentionMenu(true);
    } else {
      setShowMentionMenu(false);
    }
  };

  const insertMention = (agent: SquadAgent) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart;
    const before = replyText.slice(0, cursor).replace(/@\w*$/, `@${agent.name} `);
    const after = replyText.slice(cursor);
    setReplyText(before + after);
    setShowMentionMenu(false);
    setTimeout(() => {
      ta.focus();
      ta.selectionEnd = before.length;
    }, 0);
  };

  const handleSend = () => {
    if (!replyText.trim() || !task) return;
    if (task.status === "blocked") {
      unblockTask(task.id, replyText.trim());
    } else {
      postComment(task.id, "user", replyText.trim(), "comment");
    }
    setReplyText("");
  };

  // Filter for mention autocomplete
  const mentionCandidates = SQUAD.filter((a) =>
    a.name.toLowerCase().startsWith(mentionFilter)
  ).slice(0, 6);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <div className="flex items-start gap-2 flex-wrap">
            <Badge variant="outline" className={cn("text-xs shrink-0 gap-1", statusStyle.color)}>
              <StatusIcon className="h-3 w-3" />
              {statusStyle.label}
            </Badge>
            <PriorityBadge priority={task.priority} />
            {task.sessionKey && (task.status === "in_progress" || task.status === "claimed") && (
              <Badge variant="outline" className="text-xs gap-1 text-emerald-400 border-emerald-500/30 bg-emerald-500/5">
                <Zap className="h-3 w-3" />
                LIVE SESSION
              </Badge>
            )}
            <span className="text-xs text-muted-foreground ml-auto">#{task.id.slice(-6)}</span>
          </div>
          <SheetTitle className="text-xl font-bold text-left">{task.title}</SheetTitle>
          {task.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
          )}
          {task.sessionKey && (
            <p className="text-xs text-muted-foreground font-mono mt-1">
              session: <span className="text-emerald-400">{task.sessionKey}</span>
            </p>
          )}
        </SheetHeader>

        {/* Meta row */}
        <div className="px-6 py-3 border-b border-border/40 grid grid-cols-2 gap-4 text-sm shrink-0">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Assignee</p>
            {assignee ? (
              <div className="flex items-center gap-2">
                <AgentAvatar agentId={assignee.id} />
                <span className="font-medium">{assignee.name}</span>
                <span className="text-xs text-muted-foreground">· {assignee.title}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Unclaimed</span>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Reviewer</p>
            {reviewer ? (
              <div className="flex items-center gap-2">
                <AgentAvatar agentId={reviewer.id} />
                <span className="font-medium">{reviewer.name}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Creator</p>
            <div className="flex items-center gap-2">
              {task.creatorId === "user" ? (
                <>
                  <div className="h-6 w-6 rounded-md bg-primary text-white text-xs font-bold flex items-center justify-center">U</div>
                  <span className="font-medium">You</span>
                </>
              ) : (
                <>
                  <AgentAvatar agentId={task.creatorId} />
                  <span className="font-medium">{getAgent(task.creatorId)?.name}</span>
                </>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Specialty</p>
            <Badge variant="secondary" className="text-xs capitalize">{task.specialty}</Badge>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-6 py-3 border-b border-border/40 flex flex-wrap gap-2 shrink-0">
          {task.status === "backlog" && (
            <Select onValueChange={(id) => { if (typeof id === "string") claimTask(task.id, id); }}>
              <SelectTrigger className="text-xs h-8 w-auto">
                <SelectValue placeholder="Assign to agent..." />
              </SelectTrigger>
              <SelectContent>
                {SQUAD.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} — {a.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {task.status === "claimed" && (
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => startTask(task.id)}>
              <Play className="h-3 w-3 mr-1.5" />
              Start Work
            </Button>
          )}
          {task.status === "in_progress" && (
            <Select onValueChange={(id) => { if (typeof id === "string") sendToReview(task.id, id); }}>
              <SelectTrigger className="text-xs h-8 w-auto">
                <SelectValue placeholder="Send to review..." />
              </SelectTrigger>
              <SelectContent>
                {SQUAD.filter((a) => a.id !== task.assigneeId).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} — {a.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {task.status === "review" && task.reviewerId && (
            <>
              <Button size="sm" variant="outline" className="text-xs h-8 text-emerald-400 border-emerald-500/30" onClick={() => approveTask(task.id, task.reviewerId!)}>
                <Check className="h-3 w-3 mr-1.5" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 text-red-400 border-red-500/30"
                onClick={() => {
                  const reason = window.prompt("Rejection reason?");
                  if (reason) rejectTask(task.id, task.reviewerId!, reason);
                }}
              >
                <X className="h-3 w-3 mr-1.5" />
                Reject
              </Button>
            </>
          )}
          {task.tags.length > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              {task.tags.map((t) => (
                <Badge key={t} variant="outline" className="text-xs text-muted-foreground border-border/50">
                  <Hash className="h-2.5 w-2.5 mr-0.5" />{t}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Comments */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" />
              Comments ({task.comments.length})
            </p>
            {task.comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No comments yet. Start the conversation below.
              </p>
            ) : (
              <div className="space-y-3">
                {task.comments.map((c) => <CommentBubble key={c.id} comment={c} />)}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Reply */}
        <div className="border-t border-border/40 px-6 py-4 shrink-0 space-y-2 relative">
          {showMentionMenu && mentionCandidates.length > 0 && (
            <div className="absolute bottom-full left-6 right-6 mb-2 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
              {mentionCandidates.map((a) => (
                <button
                  key={a.id}
                  onClick={() => insertMention(a)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left"
                >
                  <AgentAvatar agentId={a.id} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.title}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          <Textarea
            ref={textareaRef}
            value={replyText}
            onChange={handleReplyChange}
            placeholder={
              task.status === "blocked"
                ? "Answer the agent's question..."
                : "Add a comment — type @ to mention an agent"
            }
            className="text-sm min-h-[70px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSend();
              }
              if (e.key === "Escape") setShowMentionMenu(false);
            }}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><AtSign className="h-3 w-3" /> mention</span>
              <span>Cmd+Enter to send</span>
            </div>
            <Button size="sm" onClick={handleSend} disabled={!replyText.trim()}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {task.status === "blocked" ? "Unblock" : "Reply"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// --- Comment bubble ---
function CommentBubble({ comment }: { comment: Comment }) {
  const author = comment.authorId === "user" ? null : getAgent(comment.authorId);
  const isUser = comment.authorId === "user";

  const typeStyles: Record<string, string> = {
    update:     "border-l-2 border-amber-500/40 bg-amber-500/5",
    question:   "border-l-2 border-yellow-500/40 bg-yellow-500/5",
    approval:   "border-l-2 border-emerald-500/40 bg-emerald-500/5",
    rejection:  "border-l-2 border-red-500/40 bg-red-500/5",
    comment:    "",
    mention:    "border-l-2 border-primary/40 bg-primary/5",
  };

  const typeIcons: Record<string, React.ElementType> = {
    update:    Play,
    question:  HelpCircle,
    approval:  CheckCheck,
    rejection: XCircle,
    comment:   MessageSquare,
    mention:   AtSign,
  };

  const TypeIcon = typeIcons[comment.type];

  return (
    <div className={cn("rounded-lg p-3", typeStyles[comment.type] || "bg-muted/30")}>
      <div className="flex items-start gap-2.5">
        {isUser ? (
          <div className="h-7 w-7 rounded-md bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">U</div>
        ) : (
          <AgentAvatar agentId={comment.authorId} size="md" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold">
              {isUser ? "You" : author?.name}
            </span>
            {!isUser && author && (
              <span className="text-xs text-muted-foreground">{author.title}</span>
            )}
            {TypeIcon && comment.type !== "comment" && (
              <TypeIcon className="h-3 w-3 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground ml-auto">{elapsed(comment.createdAt)}</span>
          </div>
          <CommentText text={comment.text} />
        </div>
      </div>
    </div>
  );
}

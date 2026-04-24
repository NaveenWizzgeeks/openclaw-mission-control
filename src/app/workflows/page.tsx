"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOpenClaw } from "@/lib/openclaw-context";
import { ConnectionStatus } from "@/components/connection-status";
import { CreateCronDialog } from "@/components/create-cron-dialog";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  Clock,
  Loader2,
  GitBranch,
  Play,
  Plus,
  Timer,
  CalendarDays,
  Zap,
  Pause,
  Trash2,
  RotateCw,
} from "lucide-react";

export default function WorkflowsPage() {
  const { loading, cronJobs, toggleCron, runCron, deleteCron } = useOpenClaw();
  const [createOpen, setCreateOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (loading) return <LoadingSpinner />;

  const enabledJobs = cronJobs.filter((j) => j.enabled);
  const disabledJobs = cronJobs.filter((j) => !j.enabled);

  async function handleToggle(jobId: string, currentEnabled: boolean) {
    setActionLoading(jobId + "-toggle");
    try {
      await toggleCron(jobId, !currentEnabled);
    } catch {}
    setActionLoading(null);
  }

  async function handleRunNow(jobId: string) {
    setActionLoading(jobId + "-run");
    try {
      await runCron(jobId);
    } catch {}
    setActionLoading(null);
  }

  async function handleDelete(jobId: string) {
    setActionLoading(jobId + "-delete");
    try {
      await deleteCron(jobId);
    } catch {}
    setActionLoading(null);
  }

  function getScheduleLabel(job: (typeof cronJobs)[0]) {
    if (!job.schedule) return "Unknown";
    switch (job.schedule.kind) {
      case "cron":
        return job.schedule.expr || "Cron";
      case "every":
        if (!job.schedule.everyMs) return "Interval";
        const mins = Math.round(job.schedule.everyMs / 60000);
        return mins >= 60 ? `Every ${Math.round(mins / 60)}h` : `Every ${mins}m`;
      case "at":
        return job.schedule.at
          ? new Date(job.schedule.at).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "One-shot";
      default:
        return job.schedule.kind;
    }
  }

  const ScheduleIcon = ({ kind }: { kind: string }) => {
    switch (kind) {
      case "cron":
        return <CalendarDays className="h-3.5 w-3.5" />;
      case "every":
        return <Timer className="h-3.5 w-3.5" />;
      case "at":
        return <Zap className="h-3.5 w-3.5" />;
      default:
        return <Clock className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflows & Schedules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cron jobs and scheduled agent tasks
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Job
          </Button>
          <ConnectionStatus />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Jobs</p>
                <p className="text-3xl font-bold mt-1">{cronJobs.length}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <GitBranch className="h-6 w-6 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Enabled</p>
                <p className="text-3xl font-bold mt-1">{enabledJobs.length}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Play className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Disabled</p>
                <p className="text-3xl font-bold mt-1">{disabledJobs.length}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-zinc-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-zinc-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Job List */}
      {cronJobs.length === 0 ? (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No scheduled jobs</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Click &quot;Create Job&quot; to schedule your first agent task
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {cronJobs.map((job) => (
            <Card
              key={job.id}
              className="border-border/50 bg-card/50 hover:shadow-lg transition-all"
            >
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{job.name || job.id}</h3>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          job.enabled
                            ? "text-emerald-400 border-emerald-500/20"
                            : "text-zinc-400 border-zinc-500/20"
                        }`}
                      >
                        {job.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    {job.description && (
                      <p className="text-xs text-muted-foreground mt-1">{job.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleToggle(job.id, job.enabled)}
                      disabled={actionLoading === job.id + "-toggle"}
                      title={job.enabled ? "Disable" : "Enable"}
                    >
                      {actionLoading === job.id + "-toggle" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : job.enabled ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRunNow(job.id)}
                      disabled={actionLoading === job.id + "-run"}
                      title="Run now"
                    >
                      {actionLoading === job.id + "-run" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCw className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDelete(job.id)}
                      disabled={actionLoading === job.id + "-delete"}
                      title="Delete job"
                      className="text-red-400 hover:text-red-300"
                    >
                      {actionLoading === job.id + "-delete" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <ScheduleIcon kind={job.schedule?.kind || ""} />
                    {getScheduleLabel(job)}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    {job.payload?.kind === "agentTurn" ? "Agent Turn" : "System Event"}
                  </Badge>
                  {job.sessionTarget && (
                    <Badge variant="secondary" className="text-[10px] gap-1 font-mono">
                      {job.sessionTarget}
                    </Badge>
                  )}
                </div>

                {job.payload?.message && (
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/30">
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {job.payload.message}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1">
                  {job.lastRunAt && (
                    <span>
                      Last run:{" "}
                      {new Date(job.lastRunAt).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                  {job.runCount !== undefined && <span>Runs: {job.runCount}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateCronDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

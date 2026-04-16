"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOpenClaw } from "@/lib/openclaw-context";
import { ConnectionStatus } from "@/components/connection-status";
import { ChevronLeft, ChevronRight, Loader2, Clock, Timer, CalendarDays } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CalendarPage() {
  const { loading, cronJobs, sessions } = useOpenClaw();
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const scheduledJobs = cronJobs.filter((j) => j.schedule?.kind === "at" && j.schedule.at);

  function getJobsForDay(day: number) {
    return scheduledJobs.filter((j) => {
      const d = new Date(j.schedule.at!);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">Scheduled jobs and session timeline</p>
        </div>
        <ConnectionStatus />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3">
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">
                  {MONTHS[month]} {year}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setCurrentDate(new Date())}
                  >
                    Today
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-px">
                {DAYS.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {d}
                  </div>
                ))}
                {cells.map((day, i) => {
                  const dayJobs = day ? getJobsForDay(day) : [];
                  const isToday =
                    day === today.getDate() &&
                    month === today.getMonth() &&
                    year === today.getFullYear();

                  return (
                    <div
                      key={i}
                      className={`min-h-[90px] p-1.5 border border-border/30 rounded-lg transition-colors ${
                        day ? "hover:bg-muted/50 cursor-pointer" : "opacity-30"
                      } ${isToday ? "bg-primary/5 border-primary/30" : ""}`}
                    >
                      {day && (
                        <>
                          <span
                            className={`text-xs font-medium ${
                              isToday
                                ? "bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full"
                                : "text-muted-foreground"
                            }`}
                          >
                            {day}
                          </span>
                          <div className="mt-1 space-y-0.5">
                            {dayJobs.slice(0, 3).map((job) => (
                              <div
                                key={job.id}
                                className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] bg-muted/50 truncate"
                              >
                                <Clock className="h-2.5 w-2.5 shrink-0 text-amber-400" />
                                <span className="truncate">{job.name || job.id}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Recurring Schedules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cronJobs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No scheduled jobs
                </p>
              ) : (
                cronJobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-2.5 rounded-lg border border-border/50 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-medium">{job.name || job.id}</h4>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1 py-0 shrink-0 ${
                          job.enabled ? "text-emerald-400" : "text-zinc-400"
                        }`}
                      >
                        {job.enabled ? "On" : "Off"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Timer className="h-3 w-3" />
                      {job.schedule?.kind === "cron"
                        ? job.schedule.expr
                        : job.schedule?.kind === "every"
                        ? `Every ${Math.round((job.schedule.everyMs || 0) / 60000)}m`
                        : job.schedule?.at
                        ? new Date(job.schedule.at).toLocaleString()
                        : "Unknown"}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Recent Sessions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.key}
                  className="p-2 rounded-lg border border-border/50 text-xs"
                >
                  <p className="font-mono truncate">{s.key}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {s.updatedAt
                      ? new Date(s.updatedAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

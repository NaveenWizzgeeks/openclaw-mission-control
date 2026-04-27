import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { MemoryRecord } from "@/lib/memory-types";

// POST /api/memory/daily — generate (or update) today's daily digest
export async function POST() {
  try {
    const db = await getDb();
    const today = new Date().toISOString().slice(0, 10);

    // Fetch today's completed tasks
    const tasks = await db
      .collection("tasks")
      .find({
        $or: [
          { completedAt: { $regex: `^${today}` } },
          { updatedAt: { $regex: `^${today}` }, status: "done" },
        ],
      })
      .toArray();

    // Fetch today's activity
    const activityEvents = await db
      .collection("activity")
      .find({ timestamp: { $regex: `^${today}` } })
      .toArray();

    // Build metadata
    const tasksCompleted = tasks.length;
    const activeAgentIds = [
      ...new Set(activityEvents.map((e) => e.actorId as string).filter(Boolean)),
    ];

    // Build highlights
    const highlights: string[] = [];

    // Task highlights
    for (const t of tasks.slice(0, 10)) {
      const assignee = t.assigneeId ?? "Someone";
      highlights.push(`${assignee} completed '${t.title}'`);
    }

    // Activity-based highlights
    const reviewApproved = activityEvents.filter((e) => e.type === "review_approved");
    if (reviewApproved.length > 0) {
      highlights.push(`${reviewApproved.length} task${reviewApproved.length > 1 ? "s" : ""} approved`);
    }

    const reviewRejected = activityEvents.filter((e) => e.type === "review_rejected");
    if (reviewRejected.length > 0) {
      highlights.push(`${reviewRejected.length} task${reviewRejected.length > 1 ? "s" : ""} sent back for revision`);
    }

    const tasksCreated = activityEvents.filter((e) => e.type === "task_created");
    if (tasksCreated.length > 0) {
      highlights.push(`${tasksCreated.length} new task${tasksCreated.length > 1 ? "s" : ""} created`);
    }

    const blocked = activityEvents.filter((e) => e.type === "task_blocked");
    if (blocked.length > 0) {
      highlights.push(`${blocked.length} task${blocked.length > 1 ? "s" : ""} encountered blockers`);
    }

    if (highlights.length === 0) {
      highlights.push("No significant activity today");
    }

    // Build summary paragraph
    const dateFormatted = new Date(today + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    let summary = `Daily summary for ${dateFormatted}. `;
    if (tasksCompleted > 0) {
      summary += `The squad completed ${tasksCompleted} task${tasksCompleted > 1 ? "s" : ""}. `;
    } else {
      summary += "No tasks were completed today. ";
    }

    if (activeAgentIds.length > 0) {
      summary += `Active agents: ${activeAgentIds.slice(0, 6).join(", ")}. `;
    }

    if (activityEvents.length > 0) {
      summary += `There were ${activityEvents.length} activity event${activityEvents.length > 1 ? "s" : ""} recorded.`;
    } else {
      summary += "No activity events were recorded.";
    }

    const now = new Date().toISOString();
    const wordCount = summary.split(/\s+/).filter(Boolean).length;

    // Check if digest for today already exists
    const existing = await db.collection("memories").findOne({
      type: "daily_digest",
      date: today,
    });

    const wasUpdated = !!existing;
    const id = existing?.id ?? `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const record: MemoryRecord = {
      id,
      type: "daily_digest",
      date: today,
      title: `Daily Digest — ${dateFormatted}`,
      summary,
      highlights,
      metadata: {
        tasksCompleted,
        activeAgents: activeAgentIds,
        sessionCount: activityEvents.filter((e) => e.type === "task_started").length,
      },
      tags: ["daily", "digest", today],
      pinned: false,
      wordCount,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await db.collection("memories").updateOne(
      { type: "daily_digest", date: today },
      { $set: record },
      { upsert: true }
    );

    return NextResponse.json({ ok: true, record, wasUpdated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

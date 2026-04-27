import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

// POST /api/sessions/digest-sweep
// Called at day-end (or manually) to ensure every completed task that has a
// session has a digest saved. Reads tasks from MongoDB, cross-checks
// session_digests, and back-fills any missing entries.
export async function POST() {
  try {
    const db = await getDb();

    // All done tasks that have a sessionKey
    const tasks = await db
      .collection("tasks")
      .find({ status: "done", sessionKey: { $exists: true, $ne: null } })
      .toArray();

    if (tasks.length === 0) {
      return NextResponse.json({ swept: 0, message: "No completed tasks with sessions found" });
    }

    // Existing digests
    const existingKeys = new Set(
      (
        await db
          .collection("session_digests")
          .find({ sessionKey: { $in: tasks.map((t) => t.sessionKey) } }, { projection: { sessionKey: 1 } })
          .toArray()
      ).map((d) => d.sessionKey as string)
    );

    const missing = tasks.filter((t) => !existingKeys.has(t.sessionKey as string));

    const now = new Date().toISOString();
    if (missing.length > 0) {
      await db.collection("session_digests").insertMany(
        missing.map((t) => ({
          sessionKey: t.sessionKey,
          agentId: t.assigneeId ?? "unknown",
          agentName: t.assigneeId ?? "unknown",
          taskId: t._id?.toString() ?? t.id,
          taskTitle: t.title ?? "Unknown task",
          outcome: "(digest captured at day-end sweep — no live session data available)",
          messageCount: 0,
          totalTokens: 0,
          sessionStatus: "done",
          startedAt: t.startedAt ?? undefined,
          endedAt: t.completedAt ?? now,
          savedAt: now,
        }))
      );
    }

    return NextResponse.json({
      swept: missing.length,
      total: tasks.length,
      alreadySaved: tasks.length - missing.length,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

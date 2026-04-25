import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

// Bulk-upsert tasks and activity events sent from the client.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      tasks?: Record<string, unknown>[];
      activity?: Record<string, unknown>[];
    };
    const db = await getDb();

    const ops: Promise<unknown>[] = [];

    if (body.tasks?.length) {
      const bulkTasks = body.tasks.map((t) => ({
        updateOne: {
          filter: { id: t.id },
          update: { $set: t },
          upsert: true,
        },
      }));
      ops.push(db.collection("tasks").bulkWrite(bulkTasks));
    }

    if (body.activity?.length) {
      const bulkActivity = body.activity.map((e) => ({
        updateOne: {
          filter: { id: e.id },
          update: { $set: e },
          upsert: true,
        },
      }));
      ops.push(db.collection("activity").bulkWrite(bulkActivity));
    }

    await Promise.all(ops);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

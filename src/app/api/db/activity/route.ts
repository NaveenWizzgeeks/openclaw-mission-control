import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await getDb();
    const events = await db
      .collection("activity")
      .find({})
      .sort({ timestamp: 1 })
      .limit(500)
      .toArray();
    const clean = events.map(({ _id, ...e }) => { void _id; return e; });
    return NextResponse.json({ ok: true, events: clean });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg, events: [] }, { status: 500 });
  }
}

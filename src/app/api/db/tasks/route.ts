import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await getDb();
    const tasks = await db.collection("tasks").find({}).sort({ createdAt: 1 }).toArray();
    // Strip MongoDB _id from response
    const clean = tasks.map(({ _id, ...t }) => { void _id; return t; });
    return NextResponse.json({ ok: true, tasks: clean });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg, tasks: [] }, { status: 500 });
  }
}

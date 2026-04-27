import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await getDb();
    const agents = await db.collection("agents").find({}).toArray();
    const clean = agents.map(({ _id, ...a }) => { void _id; return a; });
    return NextResponse.json({ ok: true, agents: clean });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg, agents: [] }, { status: 500 });
  }
}

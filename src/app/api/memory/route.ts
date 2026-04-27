import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { MemoryRecord } from "@/lib/memory-types";

// GET /api/memory?date=YYYY-MM-DD&type=daily_digest&limit=50&pinned=true
export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const params = req.nextUrl.searchParams;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};
    const date = params.get("date");
    const type = params.get("type");
    const pinned = params.get("pinned");
    const limit = Math.min(parseInt(params.get("limit") ?? "50", 10), 200);

    if (date) filter.date = date;
    if (type) filter.type = type;
    if (pinned === "true") filter.pinned = true;
    if (pinned === "false") filter.pinned = false;

    const records = await db
      .collection("memories")
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const clean = records.map(({ _id, ...r }) => { void _id; return r as MemoryRecord; });
    return NextResponse.json({ ok: true, records: clean });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg, records: [] }, { status: 500 });
  }
}

// POST /api/memory
export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json() as Partial<MemoryRecord>;
    const now = new Date().toISOString();

    const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const summary = body.summary ?? "";
    const wordCount = summary.split(/\s+/).filter(Boolean).length;

    const record: MemoryRecord = {
      id,
      type: body.type ?? "manual",
      date: body.date ?? now.slice(0, 10),
      title: body.title ?? "Untitled",
      summary,
      highlights: body.highlights ?? [],
      metadata: body.metadata ?? {},
      tags: body.tags ?? [],
      pinned: body.pinned ?? false,
      wordCount,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("memories").updateOne(
      { id: record.id },
      { $set: record },
      { upsert: true }
    );

    return NextResponse.json({ ok: true, record }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

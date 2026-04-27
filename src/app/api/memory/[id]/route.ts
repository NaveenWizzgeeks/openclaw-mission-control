import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { MemoryRecord } from "@/lib/memory-types";

// PUT /api/memory/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const { id } = await params;
    const body = await req.json() as Partial<MemoryRecord>;
    const now = new Date().toISOString();

    // Recalculate wordCount if summary changed
    const updateFields: Partial<MemoryRecord> & { updatedAt: string } = {
      ...body,
      updatedAt: now,
    };
    if (body.summary !== undefined) {
      updateFields.wordCount = body.summary.split(/\s+/).filter(Boolean).length;
    }

    // Remove fields that should not be overwritten via a partial update
    delete updateFields.id;
    delete (updateFields as Partial<MemoryRecord>).createdAt;

    const result = await db
      .collection("memories")
      .findOneAndUpdate(
        { id },
        { $set: updateFields },
        { returnDocument: "after" }
      );

    if (!result) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const { _id, ...record } = result as typeof result & { _id: unknown };
    void _id;
    return NextResponse.json({ ok: true, record });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/memory/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const { id } = await params;

    const result = await db.collection("memories").deleteOne({ id });
    if (result.deletedCount === 0) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

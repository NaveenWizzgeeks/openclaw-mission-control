import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { Workspace } from "@/lib/mission-types";

const BASE_PATH = "/home/wizzgeeks/.openclaw/workspace";

function backfill(doc: Record<string, unknown>): Record<string, unknown> {
  return {
    path: `${BASE_PATH}/workspaces/${doc.slug ?? doc.id}`,
    isDefault: false,
    taskSummaries: [],
    ...doc,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await getDb();
    const doc = await db.collection("workspaces").findOne({ id });
    if (!doc) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    const { _id, ...rest } = doc;
    void _id;
    return NextResponse.json({ ok: true, workspace: backfill(rest) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const patch = await req.json() as Partial<Workspace>;
    const db = await getDb();
    const now = new Date().toISOString();
    await db.collection("workspaces").updateOne(
      { id },
      { $set: { ...patch, updatedAt: now } }
    );
    const doc = await db.collection("workspaces").findOne({ id });
    const { _id, ...workspace } = doc!;
    void _id;
    return NextResponse.json({ ok: true, workspace });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await getDb();
    await db.collection("workspaces").deleteOne({ id });
    await db.collection("missions").deleteMany({ workspaceId: id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

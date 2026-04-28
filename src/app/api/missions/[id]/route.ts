import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { Mission } from "@/lib/mission-types";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await getDb();
    const doc = await db.collection("missions").findOne({ id });
    if (!doc) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    const { _id, ...rest } = doc;
    void _id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mission: Mission = { taskSummaries: [], ...(rest as any) } as Mission;
    return NextResponse.json({ ok: true, mission });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const patch = await req.json() as Partial<Mission>;
    const db = await getDb();
    const now = new Date().toISOString();
    await db.collection("missions").updateOne(
      { id },
      { $set: { ...patch, updatedAt: now } }
    );
    const doc = await db.collection("missions").findOne({ id });
    if (!doc) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    const { _id, ...mission } = doc;
    void _id;
    return NextResponse.json({ ok: true, mission });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await getDb();
    const doc = await db.collection("missions").findOne({ id });
    if (doc) {
      // Remove from workspace queue
      await db.collection("workspaces").updateOne(
        { id: doc.workspaceId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { $pull: { missionQueue: id } as any }
      );
    }
    await db.collection("missions").deleteOne({ id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

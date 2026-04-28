import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export interface SessionDigest {
  sessionKey: string;
  agentId: string;
  agentName: string;
  taskId?: string;
  taskTitle?: string;
  outcome: string;       // last assistant message (trimmed) — the "what was done"
  messageCount: number;
  totalTokens: number;
  sessionStatus: string;
  startedAt?: string;
  endedAt: string;
  savedAt: string;
}

// GET /api/sessions/digest — list recent digests
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);
    const agentId = searchParams.get("agentId");

    const db = await getDb();
    const filter = agentId ? { agentId } : {};
    const digests = await db
      .collection("session_digests")
      .find(filter)
      .sort({ savedAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({ digests, total: digests.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/sessions/digest — upsert a session digest (called on session end)
export async function POST(req: NextRequest) {
  try {
    const body: SessionDigest = await req.json();
    const { sessionKey } = body;

    if (!sessionKey) {
      return NextResponse.json({ error: "sessionKey required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const doc: SessionDigest = {
      ...body,
      endedAt: body.endedAt || now,
      savedAt: now,
    };

    const db = await getDb();
    await db.collection("session_digests").updateOne(
      { sessionKey },
      { $set: doc },
      { upsert: true }
    );

    return NextResponse.json({ ok: true, sessionKey });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

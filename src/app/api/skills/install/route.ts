import { NextRequest, NextResponse } from "next/server";
import { callGateway } from "@/lib/openclaw-gateway";

// POST /api/skills/install — proxy to gateway skills.install
// Body: { name: string, installId: string, source?: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name: string; installId: string; source?: string };
    if (!body.name || !body.installId) {
      return NextResponse.json({ ok: false, error: "name and installId required" }, { status: 400 });
    }

    const params: Record<string, unknown> = {
      name: body.name,
      installId: body.installId,
    };
    if (body.source) params.source = body.source;

    const result = await callGateway("skills.install", params);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

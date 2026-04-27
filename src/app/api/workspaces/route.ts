import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { Workspace } from "@/lib/mission-types";
import { broadcast } from "@/app/api/events/route";

const BASE_WS_PATH = "/home/wizzgeeks/.openclaw/workspace";

function backfillWorkspace(w: Record<string, unknown>): Workspace {
  return {
    path: `${BASE_WS_PATH}/workspaces/${w.slug ?? w.id}`,
    isDefault: false,
    ...w,
  } as Workspace;
}

export async function GET() {
  try {
    const db = await getDb();
    const docs = await db.collection("workspaces").find({}).sort({ createdAt: 1 }).toArray();
    const workspaces = docs.map(({ _id, ...w }) => { void _id; return backfillWorkspace(w); });
    return NextResponse.json({ ok: true, workspaces });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<Workspace>;
    const db = await getDb();
    const now = new Date().toISOString();
    const existingCount = await db.collection("workspaces").countDocuments();
    const slug = (body.name ?? "workspace").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const basePath = "/home/wizzgeeks/.openclaw/workspace";
    const workspace: Workspace = {
      id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: body.name ?? "New Workspace",
      slug,
      description: body.description ?? "",
      icon: body.icon ?? "🚀",
      color: body.color ?? "bg-primary",
      path: body.path ?? `${basePath}/workspaces/${slug}`,
      isDefault: existingCount === 0,
      currentMissionId: null,
      missionQueue: [],
      settings: {
        autoExecute: body.settings?.autoExecute ?? true,
        heartbeatEnabled: body.settings?.heartbeatEnabled ?? true,
      },
      createdAt: now,
      updatedAt: now,
    };
    await db.collection("workspaces").insertOne({ ...workspace });
    broadcast({
      id: `evt-${Date.now()}`,
      type: "workspace_created",
      workspaceId: workspace.id,
      title: `Workspace "${workspace.name}" created`,
      timestamp: now,
    });
    return NextResponse.json({ ok: true, workspace });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { callGateway } from "@/lib/openclaw-gateway";
import { getDb } from "@/lib/mongodb";

interface OpenClawConfig {
  models?: {
    providers?: Record<string, ProviderConfig>;
  };
  [key: string]: unknown;
}

interface ProviderConfig {
  api?: string;
  apiKey?: string;
  baseUrl?: string;
  models?: Array<{ id: string; name?: string; contextWindow?: number; [k: string]: unknown }>;
}

interface ConfigGetResponse {
  parsed?: OpenClawConfig;
  raw?: string | null;
  path?: string;
}

// GET /api/providers — list configured providers
export async function GET() {
  try {
    const cfg = await callGateway<ConfigGetResponse>("config.get", {});
    const providers = cfg.parsed?.models?.providers ?? {};
    const summary = Object.entries(providers).map(([id, p]) => ({
      id,
      api: p.api,
      baseUrl: p.baseUrl,
      hasApiKey: !!p.apiKey,
      modelCount: p.models?.length ?? 0,
      models: p.models?.map((m) => ({ id: m.id, name: m.name })) ?? [],
    }));
    return NextResponse.json({ ok: true, providers: summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg, providers: [] }, { status: 500 });
  }
}

// POST /api/providers — add or update a provider
// Body: { id: string, api: string, baseUrl: string, apiKey?: string, models: Array<{id, name?}> }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      id: string;
      api: string;
      baseUrl?: string;
      apiKey?: string;
      models?: Array<{ id: string; name?: string }>;
    };
    if (!body.id || !body.api) {
      return NextResponse.json({ ok: false, error: "id and api required" }, { status: 400 });
    }

    const cfg = await callGateway<ConfigGetResponse>("config.get", {});
    const fullConfig = cfg.parsed ?? {};

    // Backup current config to MongoDB before mutation
    try {
      const db = await getDb();
      await db.collection("config_backups").insertOne({
        snapshotAt: new Date().toISOString(),
        reason: "provider-update",
        providerId: body.id,
        config: fullConfig,
      });
    } catch {
      // Backup failure should not block save, but log
    }

    const providers = (fullConfig.models?.providers ?? {}) as Record<string, ProviderConfig>;
    providers[body.id] = {
      api: body.api,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      models: body.models ?? [],
    };
    fullConfig.models = { ...(fullConfig.models ?? {}), providers };

    await callGateway("config.set", { raw: JSON.stringify(fullConfig, null, 2) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/providers?id=foo
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

    const cfg = await callGateway<ConfigGetResponse>("config.get", {});
    const fullConfig = cfg.parsed ?? {};

    try {
      const db = await getDb();
      await db.collection("config_backups").insertOne({
        snapshotAt: new Date().toISOString(),
        reason: "provider-delete",
        providerId: id,
        config: fullConfig,
      });
    } catch {}

    const providers = (fullConfig.models?.providers ?? {}) as Record<string, ProviderConfig>;
    delete providers[id];
    fullConfig.models = { ...(fullConfig.models ?? {}), providers };

    await callGateway("config.set", { raw: JSON.stringify(fullConfig, null, 2) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

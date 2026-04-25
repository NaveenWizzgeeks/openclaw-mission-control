import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const EXTENSIONS_DIR = "/home/wizzgeeks/.openclaw/extensions";

interface PluginManifest {
  name?: string;
  description?: string;
  version?: string;
  type?: string;
  [k: string]: unknown;
}

// GET /api/skills — list installed extensions/skills from the filesystem
export async function GET() {
  try {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(EXTENSIONS_DIR);
    } catch {
      return NextResponse.json({ ok: true, skills: [] });
    }

    const skills = await Promise.all(
      entries.map(async (name) => {
        const dir = path.join(EXTENSIONS_DIR, name);
        const manifestPath = path.join(dir, "openclaw.plugin.json");
        let manifest: PluginManifest = {};
        try {
          const raw = await fs.readFile(manifestPath, "utf8");
          manifest = JSON.parse(raw) as PluginManifest;
        } catch {}
        return {
          id: name,
          name: manifest.name ?? name,
          description: manifest.description ?? null,
          version: manifest.version ?? null,
          type: manifest.type ?? null,
          path: dir,
        };
      })
    );

    return NextResponse.json({ ok: true, skills });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg, skills: [] }, { status: 500 });
  }
}

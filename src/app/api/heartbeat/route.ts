import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { writeFile, readFile } from "fs/promises";
import { join } from "path";
import type { Mission, HeartbeatEntry } from "@/lib/mission-types";
import { broadcast } from "@/app/api/events/route";
import { executeNextTask } from "@/lib/mission-orchestrator";

// Periodic tick. Used for two purposes:
//  1. Refresh HEARTBEAT.md so external observers can see what's running
//  2. Resume genuinely-stuck missions (executing status, no activeAgent,
//     no in_progress task, no orchestrator updatedAt activity for >5 min)
//
// IMPORTANT: This route MUST NOT auto-advance missions itself. The mission
// orchestrator (lib/mission-orchestrator.ts) owns task lifecycle. Heartbeat
// only acts as a safety net for stuck missions where the orchestrator was
// killed mid-flight (e.g. dev server restart).

const HEARTBEAT_PATH = join(process.cwd(), "..", "HEARTBEAT.md");
const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

async function readHeartbeatMd(): Promise<string> {
  try {
    return await readFile(HEARTBEAT_PATH, "utf8");
  } catch {
    return "";
  }
}

async function writeHeartbeatMd(entries: HeartbeatEntry[], pendingMissions: Mission[]) {
  const now = new Date();
  const lines: string[] = [
    "# HEARTBEAT",
    "",
    `**Last tick:** ${now.toISOString()}  `,
    `**Next tick:** ${new Date(now.getTime() + 5 * 60 * 1000).toISOString()}  `,
    "",
    "## Active Missions",
    "",
  ];

  if (pendingMissions.length === 0) {
    lines.push("_No active missions_");
  } else {
    for (const m of pendingMissions) {
      const currentTask = m.tasks.find((t) => t.status === "in_progress");
      lines.push(`### ${m.title}`);
      lines.push(`- **ID:** \`${m.id}\``);
      lines.push(`- **Status:** ${m.status}`);
      lines.push(`- **Tasks:** ${m.tasks.filter((t) => t.status === "done").length}/${m.tasks.length} complete`);
      if (currentTask) {
        lines.push(`- **Running:** ${currentTask.title} (${currentTask.agentName})`);
      }
      if (m.activeAgentId) {
        lines.push(`- **Active agent:** ${m.activeAgentId} — ${m.activeAgentLabel ?? ""}`);
      }
      lines.push("");
    }
  }

  lines.push("## Recent Heartbeat Log", "");
  for (const e of entries.slice(0, 10)) {
    lines.push(`- \`${e.timestamp.slice(11, 19)}\` **${e.action}** — ${e.message}`);
  }

  await writeFile(HEARTBEAT_PATH, lines.join("\n"), "utf8");
}

function uniqueEventId(suffix: string): string {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${suffix}`;
}

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const now = new Date().toISOString();
    const db = await getDb();
    const entries: HeartbeatEntry[] = [];

    // Recovery: find missions stuck in executing/analyzing for too long
    // with no active agent. The orchestrator either crashed or the dev
    // server restarted mid-flight.
    const candidates = await db.collection("missions")
      .find({ status: { $in: ["executing", "analyzing"] } })
      .toArray();

    let resumedCount = 0;
    for (const doc of candidates) {
      const { _id, ...rest } = doc;
      void _id;
      const m = rest as unknown as Mission;
      const updatedAge = Date.now() - new Date(m.updatedAt).getTime();
      const hasInProgress = m.tasks.some((t) => t.status === "in_progress");
      const isReallyStuck =
        !m.activeAgentId &&
        !hasInProgress &&
        updatedAge > STUCK_THRESHOLD_MS;

      if (!isReallyStuck) continue;

      // Recover by re-firing the orchestrator
      void executeNextTask(m.id).catch((err) => {
        console.error(`[heartbeat] resume failed for ${m.id}:`, err);
      });

      entries.push({
        id: `hb-${Date.now()}-${m.id}`,
        workspaceId: m.workspaceId,
        missionId: m.id,
        action: "task_triggered",
        message: `Heartbeat resumed stuck mission "${m.title}"`,
        timestamp: now,
      });
      resumedCount++;
    }

    if (resumedCount === 0) {
      entries.push({
        id: `hb-${Date.now()}`,
        action: "no_work",
        message: "Heartbeat tick — no stuck missions",
        timestamp: now,
      });
    }

    broadcast({
      id: uniqueEventId("hb"),
      type: "heartbeat_tick",
      title: resumedCount > 0
        ? `Heartbeat: resumed ${resumedCount} stuck mission${resumedCount === 1 ? "" : "s"}`
        : "Heartbeat tick — all clear",
      timestamp: now,
    });

    // Refresh active missions for HEARTBEAT.md
    const refreshedDocs = await db.collection("missions")
      .find({ status: { $in: ["executing", "planned", "queued", "clarification", "analyzing"] } })
      .toArray();
    const refreshed = refreshedDocs.map(({ _id, ...m }) => { void _id; return m as unknown as Mission; });

    await writeHeartbeatMd(entries, refreshed).catch(() => {});

    return NextResponse.json({ ok: true, entries, resumedCount });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

void readHeartbeatMd;

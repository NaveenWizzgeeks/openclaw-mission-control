import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { writeFile, readFile } from "fs/promises";
import { join } from "path";
import type { Mission, HeartbeatEntry } from "@/lib/mission-types";
import { broadcast } from "@/app/api/events/route";

const HEARTBEAT_PATH = join(process.cwd(), "..", "HEARTBEAT.md");

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
      lines.push("");
    }
  }

  lines.push("## Recent Heartbeat Log", "");
  for (const e of entries.slice(0, 10)) {
    lines.push(`- \`${e.timestamp.slice(11, 19)}\` **${e.action}** — ${e.message}`);
  }

  await writeFile(HEARTBEAT_PATH, lines.join("\n"), "utf8");
}

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const now = new Date().toISOString();
    const db = await getDb();
    const entries: HeartbeatEntry[] = [];

    // Find all executing/planned missions
    const activeDocs = await db.collection("missions")
      .find({ status: { $in: ["executing", "planned", "queued"] } })
      .toArray();
    const activeMissions = activeDocs.map(({ _id, ...m }) => { void _id; return m as unknown as Mission; });

    let workDone = false;

    for (const mission of activeMissions) {
      if (mission.status === "planned" || mission.status === "queued") {
        // Auto-advance to executing the first pending task
        const nextIdx = mission.tasks.findIndex((t) => t.status === "pending");
        if (nextIdx !== -1) {
          const task = mission.tasks[nextIdx];
          const updatedTasks = mission.tasks.map((t, i) =>
            i === nextIdx ? { ...t, status: "in_progress" as const, startedAt: now, updatedAt: now } : t
          );
          await db.collection("missions").updateOne(
            { id: mission.id },
            { $set: { status: "executing", tasks: updatedTasks, currentTaskIndex: nextIdx, heartbeatAt: now, updatedAt: now } }
          );
          broadcast({
            id: `evt-${Date.now()}-hb`,
            type: "task_started",
            workspaceId: mission.workspaceId,
            missionId: mission.id,
            taskId: task.id,
            agentId: task.agentId,
            agentName: task.agentName,
            title: `[Heartbeat] ${task.agentName} started: "${task.title}"`,
            detail: `Task ${task.sequenceNumber} of ${mission.tasks.length}`,
            timestamp: now,
          });
          entries.push({
            id: `hb-${Date.now()}`,
            workspaceId: mission.workspaceId,
            missionId: mission.id,
            taskId: task.id,
            action: "task_triggered",
            message: `Task "${task.title}" triggered for ${task.agentName} in mission "${mission.title}"`,
            timestamp: now,
          });
          workDone = true;
        }
      } else if (mission.status === "executing") {
        // Check if current task needs completion (simulation: mark in_progress tasks as done after 5 min)
        const inProgressTask = mission.tasks.find((t) => t.status === "in_progress");
        if (inProgressTask?.startedAt) {
          const ageMs = Date.now() - new Date(inProgressTask.startedAt).getTime();
          // In simulation: complete tasks after 5 minutes
          if (ageMs > 5 * 60 * 1000) {
            const updatedTasks = mission.tasks.map((t) =>
              t.id === inProgressTask.id ? { ...t, status: "done" as const, completedAt: now, output: `Completed by ${t.agentName}.`, updatedAt: now } : t
            );
            // Find next pending task
            const nextPending = updatedTasks.findIndex((t) => t.status === "pending");
            let newStatus: Mission["status"] = "executing";
            let nextTasks = updatedTasks;
            if (nextPending !== -1) {
              nextTasks = updatedTasks.map((t, i) =>
                i === nextPending ? { ...t, status: "in_progress" as const, startedAt: now, updatedAt: now } : t
              );
            } else if (updatedTasks.every((t) => t.status === "done")) {
              newStatus = "done";
            }

            await db.collection("missions").updateOne(
              { id: mission.id },
              { $set: { tasks: nextTasks, status: newStatus, heartbeatAt: now, updatedAt: now } }
            );

            broadcast({
              id: `evt-${Date.now()}`,
              type: newStatus === "done" ? "mission_done" : "task_completed",
              workspaceId: mission.workspaceId,
              missionId: mission.id,
              taskId: inProgressTask.id,
              agentId: inProgressTask.agentId,
              agentName: inProgressTask.agentName,
              title: newStatus === "done"
                ? `Mission "${mission.title}" complete!`
                : `${inProgressTask.agentName} completed: "${inProgressTask.title}"`,
              timestamp: now,
            });

            entries.push({
              id: `hb-${Date.now()}`,
              workspaceId: mission.workspaceId,
              missionId: mission.id,
              taskId: inProgressTask.id,
              action: "task_triggered",
              message: `Task "${inProgressTask.title}" completed; ${newStatus === "done" ? "mission done" : "next task started"}`,
              timestamp: now,
            });
            workDone = true;
          }
        }
      }
    }

    if (!workDone) {
      entries.push({
        id: `hb-${Date.now()}`,
        action: "no_work",
        message: "Heartbeat tick — no pending work",
        timestamp: now,
      });
    }

    broadcast({
      id: `evt-${Date.now()}-hb`,
      type: "heartbeat_tick",
      title: workDone ? `Heartbeat: triggered ${entries.length} action(s)` : "Heartbeat tick — all clear",
      timestamp: now,
    });

    // Refresh active missions for HEARTBEAT.md
    const refreshedDocs = await db.collection("missions")
      .find({ status: { $in: ["executing", "planned", "queued", "clarification"] } })
      .toArray();
    const refreshed = refreshedDocs.map(({ _id, ...m }) => { void _id; return m as unknown as Mission; });

    await writeHeartbeatMd(entries, refreshed).catch(() => {});

    return NextResponse.json({ ok: true, entries, workDone });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

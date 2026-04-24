# Mission Control

A professional-grade control plane for an autonomous 10-agent OpenClaw squad. The UI shows a live Kanban of tasks; agents claim, work, review, and approve tasks on a 4-second heartbeat. Jarvis acts as the HQ orchestrator.

---

## Contents

1. [Architecture](#architecture)
2. [Running the app](#running-the-app)
3. [Task lifecycle](#task-lifecycle)
4. [The HQ agent (Jarvis) and auto-pickup](#the-hq-agent-jarvis-and-auto-pickup)
5. [Session spawn flow](#session-spawn-flow)
6. [Gateway methods the UI calls](#gateway-methods-the-ui-calls)
7. [Telegram integration](#telegram-integration)
8. [Modes and toggles](#modes-and-toggles)
9. [Troubleshooting](#troubleshooting)
10. [Memory + backups](#memory--backups)
11. [How to update this README](#how-to-update-this-readme)

---

## Architecture

```
┌─────────────────────┐     HTTP POST      ┌──────────────────────┐    WebSocket     ┌───────────────────┐
│ Next.js UI          │ ─────────────────► │ /api/openclaw        │ ───────────────► │ OpenClaw Gateway  │
│ (localhost:3000)    │ ◄───────────────── │ (Next.js route)      │ ◄─────────────── │ ws://127.0.0.1:   │
└─────────────────────┘                    └──────────────────────┘                  │    18789          │
                                                                                      └───────────────────┘
```

- **UI:** Next.js 16, React 19, Tailwind 4, shadcn. App Router layout under `src/app/`.
- **State:** two React contexts persisted to localStorage:
  - `openclaw-context.tsx` — live connection to OpenClaw (agents, sessions, models, crons)
  - `team-context.tsx` — simulated squad, tasks, heartbeat, activity feed
- **Transport:** Next.js route `src/app/api/openclaw/route.ts` upgrades the HTTP request to a WebSocket connection against the OpenClaw gateway, performs an auth handshake, then forwards `{method, params}` to the gateway.

**Key files:**

| File | Role |
|---|---|
| `src/lib/openclaw-client.ts` | Thin client: POST to `/api/openclaw` with `{method, params}`. |
| `src/lib/openclaw-context.tsx` | Exposes `spawnTask`, `sendChat`, `fetchAgents`, cron CRUD, etc. |
| `src/lib/team-context.tsx` | 10-agent squad, task state, `heartbeatTick`, `spawnRealSession`, session poller, Telegram inbound poller. |
| `src/lib/team-store.ts` | Squad roster (`jarvis`, `stark`, `cap`, etc.) and task shape. |
| `src/lib/telegram-client.ts` | Client helpers: `sendToTelegram`, `pollTelegram`, `parseAgentMentions`. |
| `src/app/api/openclaw/route.ts` | WS gateway proxy. |
| `src/app/api/telegram/send/route.ts` | Outbound: POSTs messages to Telegram via Bot API. |
| `src/app/api/telegram/poll/route.ts` | Inbound: long-polls Telegram `getUpdates` and returns new messages. |
| `src/components/spawn-task-dialog.tsx` | UI to spawn a one-shot task. |
| `src/components/assign-mission-dialog.tsx` | UI to add a task to the backlog. |

---

## Running the app

```bash
cd ~/.openclaw/workspace/mission-control
npm install         # first time
npm run dev         # http://localhost:3000
```

Prerequisites:
1. **OpenClaw gateway running** on `ws://127.0.0.1:18789`
   ```bash
   openclaw gateway --port 18789
   ```
2. **At least one agent configured** (see `openclaw configure`). Default is `main`.

---

## Task lifecycle

Task statuses (see `team-store.ts:21`):

```
backlog ──► claimed ──► in_progress ──► review ──► done
                              │             │
                              └──► blocked ─┘
```

- **backlog** — proposed task, waiting for an agent.
- **claimed** — an agent has been assigned; about to start.
- **in_progress** — real session is running, or simulation clock is ticking.
- **review** — a reviewer agent has been @-ed for approval.
- **blocked** — needs user input / has a question.
- **done** — approved and shipped.

---

## The HQ agent (Jarvis) and auto-pickup

**Jarvis** is the Lead Orchestrator (`team-store.ts:131`). His `specialty` is `orchestration`, and his prompt explicitly says he analyzes incoming work, delegates, resolves conflicts, and gives final sign-off.

**Auto-pickup runs in `heartbeatTick` (`team-context.tsx:575`), every 4s**, in four stages:

1. **(A) Proposal** — ~4% chance per tick: an idle non-orchestrator agent proposes a new task from its specialty's idea pool. Skipped if backlog already has ≥3 items.
2. **(B) Claim** — the first backlog task is claimed by:
   - an available agent whose `specialty` matches, OR
   - **Jarvis as fallback** if no specialist is free (so tasks never sit forever).

   On real execution, the task is started and `spawnRealSession` creates an OpenClaw session immediately.
3. **(C) Progress** — (simulation only) posts "progress" comments on in-progress tasks, and sends them to review once old enough. (Real mode uses the session poller instead.)
4. **(D) Review** — after a short delay, reviewer agent approves (~85%) or rejects. Timing differs between `real` and `simulation`.

The heartbeat only runs when `autonomyEnabled` is true (toggleable in the UI).

---

## Session spawn flow

When a task is claimed in real mode:

1. `heartbeatTick` → `spawnRealSession(task, agent)` (team-context.tsx:529)
2. `spawnRealSession` calls `openclaw.spawnTask({task, model, label})`
3. `spawnTask` (openclaw-context.tsx:258) sends a `sessions.create` request with:
   ```json
   { "task": "<prompt>", "agentId": "main", "model": "...", "label": "mc-<agent>-<taskId>" }
   ```
4. The gateway creates a session, writes a transcript file, and automatically kicks off the runtime (`runStarted: true` in the response).
5. The returned `key` is stored on the task as `sessionKey`.
6. The **session poller** (team-context.tsx:688) streams messages from that session back into task comments.

**IMPORTANT — gateway method names:**

| What you might expect | Actual gateway method |
|---|---|
| `sessions.spawn` ❌ | **`sessions.create`** ✅ |
| `sessions.dispatch` ❌ | **`sessions.create`** ✅ |
| `chat.send` | `chat.send` or `sessions.send` |

The schema is strict (`additionalProperties: false`): only `key`, `agentId`, `label`, `model`, `parentSessionKey`, `task`, `message` are accepted. Sending `runtime` or `mode` will fail validation.

---

## Gateway methods the UI calls

All proxied through `/api/openclaw`:

| UI action | Gateway method |
|---|---|
| List agents | `agents.list` |
| List sessions | `sessions.list` |
| **Spawn a task** | **`sessions.create`** |
| Send a message | `chat.send` |
| Session history | `sessions.history` |
| List crons | `cron.list` |
| Add cron | `cron.add` |
| Remove cron | `cron.remove` |
| Update cron | `cron.update` |
| Run cron | `cron.run` |
| List models | `models.list` |
| Catalog tools | `tools.catalog` |
| Health/status/config | `health`, `status`, `config.get` |

---

## Telegram integration

Mission Control mirrors squad activity to a Telegram chat or group and accepts new missions posted in Telegram.

### Outbound events (Mission Control → Telegram)

| Event | Message |
|---|---|
| New mission created (not from Telegram) | 🆕 New mission by *actor*: _title_ |
| Task claimed | 🎯 *agent* claimed mission: _title_ |
| Task started | ⚡ *agent* started: _title_ |
| Review requested | 👀 *doer* → review by *reviewer*: _title_ |
| Approved | ✅ Mission complete: _title_ |
| Blocked with question | 🙋 *agent* needs input on _title_: question |
| Agent comment/chatter | 💬 *agent* on _title_: preview |
| Telegram ack (task received) | 📥 Received. Mission queued / *agent* will handle |

Echo guard: tasks created by the inbound poller are tagged `from-telegram`, and the outbound announcer skips them to avoid loops.

### Inbound polling (Telegram → Mission Control)

Every 4 seconds, the UI calls `/api/telegram/poll` which in turn hits `https://api.telegram.org/bot<token>/getUpdates` with a cached offset. New messages turn into tasks:

- `@jarvis do X` → creates a task tagged `@jarvis` + `from-telegram`, and if Jarvis is not offline, claimTask fires immediately.
- `do X` (no mention) → creates a medium-priority task with the stripped text as title; heartbeat auto-pickup claims it like any other backlog item.
- The sender's Telegram name is recorded in the task description.

### Configuration

Set these in `mission-control/.env.local` (gitignored):

```
TELEGRAM_BOT_TOKEN=<from @BotFather>
TELEGRAM_CHAT_ID=<your DM chat id from @userinfobot>
TELEGRAM_GROUP_CHAT_ID=<optional: negative id, for a group chat>
```

Resolution order for outbound: `TELEGRAM_GROUP_CHAT_ID` → `TELEGRAM_CHAT_ID`. For group chat, add the bot to the group and disable privacy mode via @BotFather so it can read all messages.

### Gotchas

- Without a bot token, `sendToTelegram` fails silently and disables itself for the session (logged to console).
- The inbound poller advances the Telegram `update_id` offset server-side in `/api/telegram/poll`, so each update is processed once per server lifetime. Restarting the Next dev server resets the offset and may re-deliver recent messages.
- Messages from usernames ending in `bot` are ignored to prevent feedback loops.

---

## Modes and toggles

Two independent switches, both persisted to localStorage:

| Switch | Values | Key |
|---|---|---|
| **Autonomy** | `on`/`off` (default `off`) | `mc-autonomy` |
| **Execution mode** | `real` / `simulation` (default `simulation`) | `mc-exec-mode` |

For the HQ agent to actually spawn real OpenClaw sessions, **both** must be set (autonomy = on, mode = real).

---

## Troubleshooting

### "unknown method: sessions.spawn" (historical — fixed)

**Symptom:** spawn dialog errored with `unknown method: sessions.spawn`; every attempt to spawn via the UI failed.

**Root cause:** the gateway never had a `sessions.spawn` method. The UI was calling a nonexistent endpoint.

**Fix:** `openclaw-context.tsx:262` updated to call `sessions.create` and drop the non-schema `runtime`/`mode` params. See the session spawn flow section above for the current contract.

### Spawn returns `runStarted: false`

The session was created but the runtime didn't auto-start. Common causes:
- No `task` or `message` provided → nothing to kick off.
- Agent has no runtime configured (check `openclaw agents list`).
- Gateway startup hasn't finished — retry after a second.

### Heartbeat not firing

- Check the Autonomy toggle in the UI.
- Check the browser console for errors.
- Heartbeat interval is 4000ms; watch the activity feed.

### No agents show up in the dropdown

- Gateway offline → check `ss -tlnp | grep 18789`.
- Run `openclaw agents list` to confirm agents are registered.

---

## Memory + backups

Mission Control relies on OpenClaw's memory system, which now has automated snapshot backups.

- **Snapshot dir:** `~/.openclaw/backups/memory-archive/<UTC-timestamp>/`
- **Backup script:** `~/.openclaw/scripts/backup-memory.sh`
- **Auto-trigger:** a `PreToolUse` hook in `~/.claude/settings.json` runs the script on every `Edit|Write|MultiEdit`; the script fast-exits unless the target path is a memory file, in which case it forces a fresh snapshot before the write.
- **Retention:** keeps the last 14 snapshots; older ones are pruned automatically.
- **Manual:** `bash ~/.openclaw/scripts/backup-memory.sh --force <reason>`.

---

## How to update this README

**Rule:** any change to Mission Control architecture, heartbeat logic, gateway method mapping, task lifecycle, or spawn flow MUST be reflected in this README in the same change. The README is the canonical spec — if code and README disagree, the README was not updated.

**Checklist when touching mission-control:**

1. Did you change `openclaw-context.tsx` (client methods)? → update *Gateway methods the UI calls* and *Session spawn flow*.
2. Did you change `heartbeatTick` or task statuses? → update *Task lifecycle* and *HQ agent* sections.
3. Did you change `team-store.ts` (roster)? → update *The HQ agent* if Jarvis's role changes.
4. Did you change `/api/openclaw/route.ts` (transport)? → update *Architecture*.
5. Did you change mode/toggle defaults? → update *Modes and toggles*.
6. Did you add new dialogs or UI pages? → add to *Key files* and any relevant flow.
7. Did you change Telegram send/poll/wire-up? → update *Telegram integration* (event table, inbound rules, env vars).

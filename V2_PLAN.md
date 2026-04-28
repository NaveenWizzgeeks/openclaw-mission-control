# Mission Control v2 — Build Plan

Locked spec for the v2 rewrite. Master stays as the v1 reference; all v2 work lands here.

Author: Jarvis (acting as Fury for planning).
Date: 2026-04-28.
Status: Draft awaiting sign-off.

---

## 1. Goals

1. Real lead-agent orchestration. Jarvis runs as a permanent OpenClaw session that *decides* delegation; the React heartbeat regex goes away.
2. Inter-agent communication that actually works. `@mention` resolves to a real `chat.send` injection into the target session. Agents have a mailbox.
3. Push, not poll. One persistent gateway WebSocket; SSE/WS to the browser; tokens stream as they're produced.
4. Per-task isolation. Every spawned session gets a git worktree under `~/.openclaw/workspace/wt-<taskId>`.
5. Cost visibility. Per-task and per-agent token/cost meter, demo-able.
6. Operator chat. Drop into any running session live and converse without going through the task system.
7. Security. Bearer token never leaves the server. No `NEXT_PUBLIC_*` for credentials.

## 2. Non-goals (v2.0)

- No multi-tenant / multi-operator. Single user.
- No remote-host agents. All sessions on local gateway.
- No fancy diff/PR review UI inside MC. Open the worktree externally.
- No replacing MongoDB. Schema ports forward.

## 3. Topology

```
Browser ── SSE/WS ──┐
                    ├─► [MC web]   Next.js 16   (UI + Mongo + Telegram routes)
Telegram ── HTTPS ──┘        │
                             │ HTTP / IPC
                             ▼
                      [MC daemon]  (Node 22, long-lived)
                             │
                             │ one persistent WS
                             ▼
                       OpenClaw gateway  (ws://127.0.0.1:18789)
                             │
                             ▼
                      Agent runtimes (Claude CLI sessions, one worktree each)
```

The web tier becomes thin — it renders state and forwards user actions. The daemon owns the gateway connection, the agent mailboxes, and the lead-loop bridge.

## 4. Module layout

```
src/
  app/                       Next.js routes (UI + thin API)
    api/
      events/route.ts        SSE → browser (subscribed to daemon)
      tasks/route.ts         CRUD → forwards to daemon
      chat/route.ts          operator chat send → daemon
      telegram/...           kept from v1
  daemon/                    long-lived process (separate entry)
    gateway-link.ts          one WS, reconnect, request/response, event bus
    mailbox.ts               sessionKey ↔ inbox queue, @mention resolver
    lead-loop.ts             permanent Jarvis session, receives task events, decides delegation
    worktree.ts              spawn-time worktree creation, cleanup on session end
    cost.ts                  rolling tokens / cost per session, per agent
    bridge.ts                browser SSE fan-out from gateway events + daemon state
  shared/
    team-store.ts            ported from v1
    prompt.ts                ported buildAgentPrompt, extended with mailbox protocol
    task-reducers.ts         ported claim/start/review/approve/reject/block/unblock
    types.ts                 wire types for daemon ↔ web
  components/                React UI (kept where reasonable)
```

The daemon is its own Node process started by `npm run daemon` (and supervised in production). The web tier talks to it over a local Unix socket or `127.0.0.1:<port>`.

## 5. Wire contracts

### 5.1 Browser ↔ web (SSE + REST)

- `GET /api/events` — SSE stream. Events: `task.update`, `session.update`, `chat.append`, `cost.tick`.
- `POST /api/tasks` — create / mutate task, forwarded to daemon.
- `POST /api/chat/:sessionKey` — operator chat into a session.
- `POST /api/agents/:id/inbox` — peer-injection (used by the daemon's lead loop, but exposed for debug).

### 5.2 Web ↔ daemon (HTTP/IPC)

- `POST /daemon/task.spawn` `{taskId}` → starts session, creates worktree, returns sessionKey.
- `POST /daemon/chat.send` `{sessionKey, text, sender}` → injects via `chat.send`.
- `GET /daemon/events` (SSE) → browser proxies through.
- `POST /daemon/lead.notify` `{taskId}` → kicks the lead loop with new-task signal.

### 5.3 Daemon ↔ gateway (existing protocol)

- One persistent WS, full handshake on connect, auto-reconnect with backoff.
- Subscribes to gateway events (no more 6 s polls).
- Methods used: `sessions.create`, `chat.send`, `chat.history` (for cold-load only — live is push), `sessions.list` (boot only).

## 6. Agent mailbox protocol

Inside any agent's prompt:

```
You are <agent>. To talk to a teammate, write a line:
@<teammate-id> <message>

The system intercepts that line and delivers it as a fresh user-role
message to that teammate's session. You will receive their replies
the same way (delivered as user-role messages).
```

Daemon implementation:

- Each session has a tail-watcher reading new assistant messages.
- The watcher regex-extracts `@<id> <text>` lines.
- For each match: `chat.send` to target sessionKey with envelope `[from <senderId>] <text>`.
- If target sessionKey doesn't exist for a known agent: spawn-on-demand using that agent's identity prompt + `task = "Standby — you'll be addressed by teammates."`.

Key invariant: mentions never get dropped silently. If delivery fails, it surfaces as a `mailbox.error` event the operator sees.

## 7. Lead-loop (Jarvis as orchestrator)

A permanent Claude CLI session is opened at daemon boot:
- Identity: `team-store.ts`'s Jarvis entry.
- Initial prompt: identity + squad roster + tools + lead-loop protocol.

When a new task lands:
- Daemon emits `lead.notify` to Jarvis's session via `chat.send`: `[task <id>] <prompt>`.
- Jarvis decides: handle directly, or `@<agent> please own this`.
- The mailbox layer routes the delegation just like any other mention.

Why this matters: routing becomes a real reasoning step, not a regex. We can change strategy without touching React.

## 8. Worktrees

On `sessions.create`:
- Daemon runs `git worktree add ~/.openclaw/workspace/wt-<taskId> -b task/<taskId>` against the project repo configured per-agent.
- The agent's prompt sets `cwd` to that path.
- On task close (approved or rejected), worktree is removed: `git worktree remove --force`.
- Branch is left for review; we don't auto-merge.

For agents with no project repo (e.g. Jarvis itself), worktree step is skipped.

## 9. Cost meter

- Daemon listens for usage events on each session. `contextTokens` and `totalTokens` come back on every gateway response; record the deltas.
- Per-task accumulator, per-agent accumulator, global accumulator.
- Pricing table shipped as a JSON in `shared/pricing.ts`; resolves model→$/Mtok in/out.
- Browser shows: live $ on each task card, top-bar global meter.

## 10. Operator chat

For any running session, the UI shows a chat panel that:
- Streams assistant tokens push-style.
- Sends operator messages via `POST /api/chat/:sessionKey` → daemon → `chat.send`.
- Flags operator messages with `[operator]` prefix in the wire.

This makes "step in and course-correct" trivial. No more closing-the-browser-pauses-everything.

## 11. Security

- Bearer token loaded server-side only (`process.env.OPENCLAW_TOKEN`, no `NEXT_PUBLIC_`).
- Daemon listens on a Unix socket by default (file-permission-isolated to user). Optional `127.0.0.1` bind for dev.
- All gateway calls happen in the daemon. The web tier never holds the token.
- SSE auth: signed cookie on the same origin; no separate token.

## 12. State store

- Mongo stays. Schema ports as-is.
- localStorage drops out; the web tier becomes stateless (SSE rehydrates UI from the daemon snapshot on connect).
- No more 1.5 s debounce sync race. Single source of truth = Mongo, written through the daemon.

## 13. Build order (so increments ship)

Each step ends in a runnable system. If the deadline forces an early cut, every step is a viable demo.

| # | Step | Done when |
|---|---|---|
| 1 | **Daemon skeleton** + persistent gateway link, event bus | `daemon` boots, holds WS, logs all gateway events |
| 2 | **Web → daemon** SSE bridge | Browser receives gateway events live (no 6 s lag) |
| 3 | **Task spawn through daemon** (replaces fresh-WS-per-req) | New task spawns a session, sessionKey appears in UI |
| 4 | **Push session stream** | Assistant tokens render as they arrive; tool calls visible |
| 5 | **Mailbox v1** — `@mention` extracted, delivered via chat.send | Two agents can talk; surfaced in UI |
| 6 | **Lead loop** — Jarvis permanent session, lead.notify on new tasks | Task assignment is Jarvis's call, not React's |
| 7 | **Operator chat panel** | I can drop into any session live |
| 8 | **Worktree-per-task** | Two agents writing files don't stomp |
| 9 | **Cost meter** | Per-task $ visible; global meter top-bar |
| 10 | **Security pass** — token off the client, Unix-socket daemon | No `NEXT_PUBLIC_*` for credentials; gateway calls only inside daemon |

Steps 1–4 are the minimum demo. 5–7 are the "this is actually a control plane" demo. 8–10 round it out.

## 14. Ports forward verbatim from v1

- `team-store.ts` (squad config + lifecycle types)
- `buildAgentPrompt` (~85 lines; extended with mailbox protocol)
- Task reducers (claim/start/review/approve/reject/block/unblock)
- Telegram client + send/poll routes
- MongoDB schema and `/api/db/sync` shape (writes get rerouted through daemon, but shape is unchanged)
- UI shell components (cards, dialog, dnd) — restyled minimally

## 15. Drops from v1

- Heartbeat as orchestrator (kept as a UI refresh ticker only)
- `inferSpecialty` regex routing
- Fresh-WS-per-request gateway client
- 6 s `chat.history` poller
- 10 s `sessions.list` poller
- localStorage primary store
- `NEXT_PUBLIC_OPENCLAW_TOKEN`

## 16. Open questions for sign-off

1. **Daemon process model.** Run it as `next dev` sidecar, or independent `node` process supervised by something like `pm2` / a systemd unit? Recommendation: independent process; Next.js can't reliably hold a long-lived WS through HMR.
2. **Worktree base repo per agent.** Where do per-agent project repos live, and is that config in `team-store.ts` or a new `agent-repos.json`? Recommendation: extend `team-store.ts` with optional `repoUrl` / `defaultBranch`.
3. **Operator chat persistence.** Save operator-injected messages into Mongo as task comments, or only into the live session? Recommendation: both — comment with `kind: "operator-inject"`.
4. **Cost meter pricing source.** Hardcode the pricing table, or pull from a config endpoint? Recommendation: hardcode v2.0; revisit in v2.1.

## 17. Dispatch plan

Once this plan is signed off:

- **Stark (sonnet via coding-agent skill)** → builds steps 1–4 (daemon skeleton through push session stream). Single coding-agent run, scope ends at step 4.
- **Cap (sonnet via coding-agent skill)** → writes integration tests against a real local gateway, parallel to Stark's step 3 onward.
- **Fury (Jarvis/opus)** → reviews each step's PR-equivalent commit, decides next step's spec adjustments, then dispatches the next Stark run.

If no Cap-level agent exists in this workspace yet, Stark writes its own tests as it goes.

---

**Awaiting Harish's sign-off before dispatching Stark.** Particularly on §16 questions and on whether step ordering is right for the demo deadline shape.

# Internal Agent Fleet: reading notes

> A summary of what to remember about this repo, so it doesn't need re-reading from scratch.
> Diagrams: open [`docs/architecture.html`](./architecture.html) in a browser.
> Glossary for the Office: [`CONTEXT.md`](../CONTEXT.md). Decisions: [`docs/adr/`](./adr/).

## 1. What the repo does (one sentence)

Each teammate runs **Claude Code agents** on their own machine; the agents **talk to each other** over **A2A**
(Agent-to-Agent) on **Agent Mesh** (Google `agentmesh`), and every owner watches and steers their agents in the
**Office**: a shared, game-like map of the real office where each online agent is a character.

Original design doc: "Agent Mesh Architecture", https://claude.ai/artifact/DWhMzELPYpbMb1n5bpgDdP (read it before
changing topology, protocol or guardrails).

## 2. Components

| Directory | Runs where | Stack | Role |
|---|---|---|---|
| `hub/` | One always-on LAN machine | `agentmesh-one` binary | Mesh control plane + router + console; join tokens and policy |
| `node-server/` | Every machine | Python 3.12, FastAPI, Claude Agent SDK, `a2a-sdk` 1.3, SQLModel/SQLite, uv | Runs the agents, sends/receives A2A, dashboard API |
| `node-server` → `agentfleet-node world` | The hub machine | Same package | **World server** for the Office: positions, presence, desks, skins |
| `dashboard/` | Served by the node server at `/` (port 9100) | React 19, Vite, Tailwind v4, Phaser 3, bun | The Office screen and Settings |

Every machine also runs **`agentmesh-node`** (Agent Mesh binary, port 8080) next to the node server: identity,
policy, discovery, relay. The mesh's Python SDK can't publish services, so `agentmesh-node` is required.

## 3. Naming (important)

- Agent ID: `owner/name`, e.g. `han/backend-agent` (regex `[A-Za-z0-9_-]+/[A-Za-z0-9_-]+`).
- Agents created on a machine must start with that machine's `AGENTFLEET_OWNER`.
- Mesh service names can't contain `/`, so it becomes `.`: `han.backend-agent`. Only `naming.py` does this.
- Local A2A endpoint: `http://127.0.0.1:9100/a2a/<owner>.<name>/`. **The trailing `/` is required** (else 307).

## 4. Main flows

### Inbound (a peer calls my agent)
```
peer → agentmesh-node (relay) → /a2a/<service>/  A2AGateway
     → MeshAgentExecutor.execute       (a2a_bridge.py)
     → SessionManager.handle_inbound   (sessions.py)
     → SessionWorker.run_turn          → ClaudeSDKClient (Claude CLI)
     → reply: completed | input-required | failed | rejected
```
- Peer text is wrapped in `<mesh_message from="...">` (`format_prompt`): untrusted input.
- Inline file parts are saved to `<working_dir>/inbox/<contextId[:12]>/`; URL parts are refused.
- Over `max_turns_per_context` (20) → rejected.

### Outbound (my agent calls a peer)
```
Claude calls mcp__mesh__send_message / share_file
  → OutboundClient.send                (a2a_bridge.py)
  → MeshDirectory.resolve              (mesh.py)
       1. local agent on this machine → call directly
       2. static_peers (dev/test)     → call directly
       3. mesh discovery              → via proxy /mesh/<peer-id>/a2a/<service>/
       not found                      → AgentOffline (no offline queue)
  → blocking HTTP for the whole remote turn (up to outbound_timeout_s = 900s)
```

### Assignment (work handed to another agent)
```
Office "Assign work" → POST /api/office/assign (background; returns the conversation id)
  → peer sees agentfleet.kind = assignment → Accept / Decline card for the peer's owner (woken if away)
  → accepted: that conversation may edit files without asking (ADR 0002); declined/timeout: rejected
```

### Sessions
- **One conversation = one (agent_id, contextId) = one SessionWorker = one Claude session.**
- Turns in a session run one at a time (`_turn_lock`).
- To continue a conversation, pass the same `context_id` (and `task_id` when the peer is `input-required`).

## 5. Mesh tools every agent has (`mesh_tools.py`)

| Tool | Does |
|---|---|
| `list_agents` | Lists agents (local + static peers + mesh) with description and skills |
| `send_message` | Messages another agent and waits for the reply |
| `share_file` | Sends a file from the working directory (paths can't escape it) |
| `needs_input` | Marks the reply as a question → A2A `input-required` |

Agents are told to pick the best-matching agent when asked to find someone, and to talk to exactly the agent their
owner @mentions. Per-agent **contact policy**: "Go ahead" (default) or "Ask me first" (each `send_message` /
`share_file` waits for the owner's approval).

## 6. Guardrails (don't break)

1. **Tool policy**, one source of truth: `sessions.policy_decision` → `allow` / `deny` / `ask`.
   - Order: `denied_tools` → deny; contact tools with policy "ask" → ask; mesh tools, `ToolSearch`,
     `allowed_tools` → allow; accepted Assignment + `Edit`/`Write`/`MultiEdit`/`NotebookEdit` → allow; else ask.
   - `ask` times out (`approval_timeout_s` = 300s) → **deny**.
   - Enforced by **both** the `PreToolUse` hook **and** `can_use_tool`: the CLI auto-approves read-only commands
     (e.g. `ls`) and skips `can_use_tool`, so only the hook catches them.
   - `Bash(prefix*)` patterns never match chained commands (`;`, `&&`, `|`, `` ` ``, `$(`, `<`, `>`, newline).
   - Default allow list: `Read`, `Bash(ls*)`, `Bash(rg *)`, `Bash(grep *)`, `Bash(git status*|log*|diff*)`.
   - The current CLI has **no `Glob`/`Grep` tools**; search goes through Bash.
2. **Loop protection**: `max_turns_per_context`=20, `max_agent_turns_per_message`=30, `turn_timeout_s`=600.
3. **Untrusted peers**: the sender ID (`agentfleet.from_agent`) and kind (`agentfleet.kind`) are **claims**, not
   verified by the mesh. Only the receiving owner's acceptance widens permissions.
4. **Files**: inline A2A parts and owner attachments only, ≤ 5 MB, allow-listed extensions, never executed;
   `GET /api/files/{id}` serves only recorded files inside the agent's working directory.
5. **Audit log is metadata only** (`store.redact` drops text/content/body/prompt/input/message keys). Health-tech
   context: no PHI in the audit log.
6. **Office privacy**: the world server never receives message content; other people see only typing dots.

## 7. The Office (dashboard)

- One working screen (map + side column) and one Settings screen. No other pages.
- **Map**: background plate, `collision.png` and `seats.json` from `dashboard/public/office/manifest.json`
  (art by Codex). 18 desks (D1–D16, M1, M2), HR spot, entrance door, pantry, manager room.
- **Moving**: select your agent, then WASD/arrows, or click the floor; click someone's agent to walk over; stop next
  to them and their menu opens (Ask / Assign work / Open conversation); `E` reopens it; `H` back to desk.
- **Roaming**: when an agent starts talking to someone on its own, its character walks over and comes back after.
- **Side column tabs**: Agents (your agents, message box with @mentions and attachments, contact policy, look),
  Chats (every conversation, opens the panel), Approvals (tool approvals and assignments).
- **Attachments**: 📎, drag-and-drop or paste a screenshot into a message for your own agent. Files go to the agent's
  `inbox/` (≤ 5 MB, allowed types only, never executed); images show as thumbnails in the chat.
- **Conversation panel**: avatars and names, my side on the right, mesh activity as events ("Asked API agent"),
  Stop / Take over (inbound only) / Hand back, Fork and Widen in the ⋯ menu.
- **Waking owners**: browser notification while a tab is open; OS notification from the node when none is.
- **Settings**: agents (create/edit, incl. contact policy), joining the team (same form as first run), mesh & office
  status + directory, notification tests.
- **First run**: a setup page (name, office server, join token) until the machine has joined; then a guide over the
  map: create an agent (short form) → pick desk → notifications → basics. Step comes from real state; dismissed per
  browser (`localStorage office.onboarded`).

## 8. Conversation status

`idle` → `running` → (`awaiting_approval` | `awaiting_owner` | `interrupted` | `error` | `idle` | `done`).
A declined assignment ends as `done` with a "Declined: …" note. Mode: `auto` | `manual` (who answers the peer).
Direction: `inbound` | `outbound` | `local`. Kind: `''` | `inquiry` | `assignment`.

## 9. Data (SQLite `data/node.db`, WAL)

Tables: `agents` (incl. `contact_policy`), `conversations` (unique `agent_id+context_id`, `kind`, `accepted`),
`messages` (role: peer/agent/owner/tool/system; kind: text/tool_use/tool_result/status/file), `approvals`, `files`,
`audit_log`. Deleting an agent is a soft delete. New columns are added on startup (`db._add_missing_columns`).

**Invariant**: every write goes through `store.Store`, which saves and publishes an `EventBus` event → `/api/ws`
→ dashboard. Event types: `hello`, `agent`, `agent_removed`, `conversation`, `message`, `delta` (live text, not
stored), `approval`, `mesh`, `office` (relayed from the world server).

## 10. Configuration (`AGENTFLEET_*` env / `.env`, `config.py`)

| Variable | Default |
|---|---|
| `OWNER` | `me` |
| `HOST` / `PORT` | `127.0.0.1` / `9100` |
| `DATA_DIR` | `./data` |
| `MESH_NODE_URL` | `http://127.0.0.1:8080` |
| `MESH_API_TOKEN_PATH` | — (usually `./data/mesh-api-token`) |
| `WORLD_URL` | — (e.g. `ws://<hub>:7500/world/ws`; unset = no Office) |
| `HUB_URL` | — (set = the node runs `agentmesh-node` itself) |
| `STATIC_PEERS` | `{}` (dev/test: skip the mesh) |
| `ASSIGNMENT_ACCEPT_TIMEOUT_S` | 900 |
| `OS_NOTIFICATIONS` | true |
| `MAX_INLINE_FILE_BYTES` | 5 MB |

The web setup (`POST /api/setup`) writes `data/setup.json` with `owner`, `hub_url`, `world_url`; it overrides the
env on every start (`Settings.apply_setup_file`).

## 11. Running

```sh
# Hub (once, always-on machine)
make server HUB_HOST=<lan ip>           # hub (7400) + Office world server (7500)
make hub-token DEVICE="han laptop"      # single-use token, send privately to each person

# Each machine
make setup                              # once: check tools, install, build
make up                                 # node + dashboard on http://127.0.0.1:9100; join in the browser
# (manual alternative: make env OWNER=<name>, AGENTFLEET_WORLD_URL in .env, make serve, make mesh-node)

# Development
make dev     # hot reload on :5173
make test    # pytest with FakeClaude, no real Claude calls
make build   # dashboard build (runs tsc -b)
```

"Done" = `make test` + `make build` pass and `bun run lint` is clean. Mesh/A2A/session changes also need the
real-stack smoke in `node-server/CLAUDE.md`.

## 12. Gotchas (learned the hard way)

- **Restart `agentmesh-node` after adding/removing agents**: it reads `services` only at startup.
- `a2a-sdk` 1.3 uses **protobuf**, not pydantic (`HasField`, `msg.metadata.update(...)`, `MessageToDict`).
- Hub: `--policy-file` seeds only on **first boot**; afterwards change policy with `POST /policies` (replaces the
  **whole** document). No `allowed_targets` → every call is 403; no `allowed_labels: owner=*` → enrollment fails.
- Nodes pull policy every 15 minutes; restart nodes to apply immediately.
- Turn completion relies on `ResultMessage`; an injected prompt may fold into the same result, and the
  `INJECT_GRACE_S` = 3s timer closes the turn. Change only with a real-CLI check.
- The dashboard WebSocket must also read, or closed tabs are never noticed.
- Phaser: size the canvas yourself (`Scale.NONE` + `ResizeObserver`), give text LINEAR filtering in a pixel-art game,
  use a Zone (not a Container) as the hit area, focus the canvas host on pointerdown for keys.
- Tests: `FakeClaude` behaves by prompt keywords (`TOOL:<Name>`, `SLOW`, `ASK`, otherwise echo). Never real Claude.

## 13. Known gaps

- The sender's identity isn't verified by the mesh; the world server trusts the owner name a node claims.
- Outbound calls block for the whole remote turn; long turns through the relay may hit limits.
- No large-file upload via the hub, no standalone MCP adapter, no message paging.
- v1 is LAN only, plain http, no offline queue. Party and Recap are designed (`CONTEXT.md`) but not built.

## 14. Backend file map (`node-server/src/agentfleet_node/`)

| File | Contents |
|---|---|
| `sessions.py` | SessionWorker/Manager, tool policy, approvals, acceptance, takeover, fork (**core**) |
| `a2a_bridge.py` | A2AGateway, MeshAgentExecutor (inbound + assignment gate), OutboundClient |
| `api.py` | REST `/api/*` (incl. `/office/*`, `/files/{id}`, `/notify/test`) + WebSocket `/api/ws` |
| `world.py` | Team world server (WorldState rules + WorldHub sockets) |
| `office.py` | Node ↔ world link (WorldClient) |
| `store.py` | Store + EventBus + redact |
| `mesh.py` | MeshDirectory: discover/resolve, writes `agentmesh-node.yaml` |
| `models.py` | SQLModel tables and enums |
| `mesh_tools.py` | The four in-process MCP tools |
| `notify.py` | OS notifications |
| `meshproc.py` | Runs/restarts this device's `agentmesh-node` once setup knows the hub |
| `app.py` | `build_node` wiring, mounts `/a2a` and the dashboard |
| `config.py`, `db.py`, `files.py`, `naming.py`, `cli.py` | Settings, engine + column migration, files, IDs, CLI |

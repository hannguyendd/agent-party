# Agent Mesh — Claude Code agents talking to each other

Implements the "Agent Mesh Architecture" design: each teammate's Claude Code agents hold
back-and-forth A2A conversations with teammates' agents over [Agent Mesh](https://github.com/google/agentmesh),
and each owner watches and steers their own agents in the **Office**: a shared, game-like map of the real office
where every online agent is a character that walks over to whoever it talks to.

```
hub/           agentmesh-one (control plane + router + console) config and scripts — runs on one always-on LAN machine
node-server/   Python node server, one per device: FastAPI + Claude Agent SDK + a2a-sdk + SQLite.
               Also the team world server for the Office (`agentfleet-node world`, on the hub machine)
dashboard/     React + Phaser app served by the node server: the Office screen and Settings
docs/          NOTES.md (overview), adr/ (decisions), office/ (art brief, Codex prompts), architecture.html (diagrams)
design/        Office art sources and export scripts
CONTEXT.md     Office glossary (Steering, Roaming, Inquiry, Assignment, Party, …)
```

## How it fits together

- Each device runs **`agentmesh-node`** (identity, policy, discovery, relay) next to the **node server**.
- The node server serves every local agent as an A2A endpoint at `/a2a/<owner>.<name>/` and writes
  `agentmesh-node.yaml` so the mesh node publishes each one as an `a2a` service. Agent ID `han/backend-agent`
  becomes mesh service `han.backend-agent` (mesh names can't contain `/`).
- Outbound calls are resolved with the node's `GET /mesh/service/discover` and sent through its
  `/mesh/<peer>/a2a/<service>/` proxy. Own agents on the same device are called directly.
- Each A2A `contextId` maps to one Claude session (`conversations` table); turns per session are serialized.
- Agents get in-process mesh tools: `list_agents`, `send_message`, `share_file`, `needs_input`
  (marks the reply as a question → A2A `input-required`).

### The Office

- **One working screen**: the map plus a side column with **Agents** (message your agent, @mention a colleague's
  agent, attach files and images, contact policy, look), **Chats** (every conversation) and **Approvals**.
  **Settings** is the only other screen (agents, mesh & office status, notifications).
- **Moving**: select your agent, then WASD/arrows or click the floor. Click someone's agent to walk over; stop next
  to it and its menu opens (Ask / Assign work / Open conversation).
- **Roaming**: when an agent starts talking to someone on its own, its character walks over and comes back after.
- **Conversation panel**: live stream, mesh activity shown as events, inject a prompt mid-turn, Stop, Take over
  (answer the peer by hand) / Hand back, Fork, approvals inline, attachments.
- **Ask vs Assign**: *Ask* has your agent put a question to the peer. *Assign work* sends a task the peer's owner
  must accept; once accepted the peer may edit files in that conversation (ADR 0002).
- **Contact policy** per agent: "Go ahead" or "Ask me first" before it messages another agent on its own.
- **Waking owners**: a browser notification while a tab is open, a system notification from the node otherwise.
- **Privacy**: only the owners in a conversation see its words; the world server never receives message content
  (ADR 0001). Everyone else sees typing dots.

### Guardrails

- **Tool policy per agent**: `allowed_tools` run freely, `denied_tools` are refused, everything else waits for
  owner approval and is **denied on timeout**. An accepted Assignment additionally allows file edits (only) in that
  conversation; an agent with contact policy "Ask me first" needs approval for each message to another agent. Enforced by a `PreToolUse` hook *and* `can_use_tool`
  (the CLI skips `can_use_tool` for commands it considers read-only, so the hook is what makes the policy hold).
  `Bash(prefix*)` patterns never match chained commands (`;`, `&&`, `|`, `$(`, redirects).
  Note: the current Claude CLI has no `Glob`/`Grep` tools; searching goes through Bash (`Bash(rg *)`).
- **Loop protection**: max turns per contextId, max agent turns per message, turn timeout.
- **Untrusted peers**: peer text is wrapped in `<mesh_message from=…>` and the system prompt says it carries no owner authority.
- **Files**: inline A2A parts and owner attachments only, size and type limits, saved under `<working dir>/inbox/`,
  never executed. URL parts are not fetched. `GET /api/files/{id}` serves only recorded files inside the agent's
  working directory.
- **Audit log**: metadata only (who, when, contextId, taskId, sizes); message bodies are dropped.
- **No offline queue**: a message to an agent that isn't on the mesh fails immediately with "agent offline".

## Setup

Quick reference (`make help` lists every target):

| Where | Command |
|---|---|
| Hub machine (admin) | `make server HUB_HOST=<lan ip>` (hub + Office world server) · `make hub-token DEVICE="han laptop"` per laptop |
| Each staff machine, once | `make setup` (checks uv / bun / claude / agentmesh-node, installs, builds) |
| Each staff machine | `make up`, then finish in the browser at http://127.0.0.1:9100 |
| Development | `make dev` (node server + Vite hot reload on :5173) · `make test` · `make build` |

**Joining from the browser.** On first run the dashboard shows a setup page: your name (the owner in agent IDs),
the office server (the hub machine's IP or hostname; the hub URL `:7400` and world URL `:7500` are derived from
it) and the join token. Saving writes `data/setup.json` (overrides `.env`) and `data/bootstrap-token`, regenerates
`agentmesh-node.yaml`, connects the Office and starts `agentmesh-node` for you (`meshproc.py`; it is restarted
whenever your agents change, since it reads its services only at startup). The owner name can't change once
agents exist. Settings → Mesh has the same form plus "Restart mesh connection".

**First time in the Office.** A short guide over the map walks through: create an agent (name, what it does,
project folder, look; safe read-only defaults, "All options…" opens the full form), pick your desk, turn on
notifications, and the basics. Its step follows real state, so closing the tab resumes where you left off; it is
dismissed per browser. "+ New agent" in the Agents tab reuses the same short form.

The manual steps below show what those targets run (still useful for scripted setups or running the mesh node
by hand).

### 1. Hub (once, on the always-on machine)

```sh
cd hub
HUB_HOST=<fixed LAN IP or hostname> ./start-hub.sh     # seeds policy.json on first boot
./mint-token.sh "han laptop"                           # one single-use token per device
```

`policy.json` lets any enrolled node publish/call `a2a://*`, reach any node (`allowed_targets: ["*"]`) and carry
an `owner=<name>` label. Without `allowed_targets` every call is refused; without `allowed_labels` enrollment fails.
After first boot the hub database is the source of truth: change policy in the console or `POST /policies`.

### 2. Each device

```sh
cd node-server
uv sync
cat > .env <<'ENV'
AGENTFLEET_OWNER=han
AGENTFLEET_MESH_API_TOKEN_PATH=./data/mesh-api-token
AGENTFLEET_WORLD_URL=ws://<hub>:7500/world/ws
ENV
uv run agentfleet-node serve                 # node server on 127.0.0.1:9100

# in another terminal: put the token from the hub admin in data/bootstrap-token, then
HUB_URL=http://<hub>:7400 ./scripts/start-mesh-node.sh
```

Open http://127.0.0.1:9100. The Office shows a "Get started" checklist: create an agent in Settings (ID must start
with `<owner>/`), pick your desk on the map, turn on notifications. Then **restart `start-mesh-node.sh`**:
`agentmesh-node` only reads its services at startup (the app bar says "Restart mesh" when the config changed). The
bootstrap token is used only on first enrollment; restarts use the stored identity.

The world server (`make world` on the hub machine) is what makes the Office shared. Without
`AGENTFLEET_WORLD_URL` a node still works over the mesh but shows no Office. Add `?preview` to the URL to see the
Office with sample agents (design work only).

Dashboard development: `cd dashboard && bun install && bun dev` (proxies `/api` to `VITE_NODE_URL`, default `:9100`).
Build with `bun run build`; the node server then serves `dashboard/dist`.

Settings are env vars prefixed `AGENTFLEET_` (see `node-server/src/agentfleet_node/config.py`).

## Tests

```sh
cd node-server && uv run pytest
```

Two node servers talk A2A in-process with a fake Claude client (multi-turn input-required, approvals,
timeouts, takeover/hand-back, turn limits, files, offline targets, the dashboard event stream), plus the world
server (rules and two nodes sharing an Office), assignments (accept / decline / timeout, permission widening,
contact policy) and owner attachments. Dashboard: `cd dashboard && bun run build && bun run lint`.

The Office additions (world server, assignments, contact policy, attachments) have been exercised with two node
servers on one machine (`static_peers`) and a headless browser, **not yet through a real `agentmesh` stack**; run
the real-stack smoke in `node-server/CLAUDE.md` before relying on them across machines.

## Verified against the real stack (2026-10-27, agentmesh v0.1.0-rc.10, Claude CLI 2.1.311)

Local hub + two `agentmesh-node`s + two node servers:

- Multi-turn A2A through the mesh works: `input-required` → reply with the same `contextId`/`taskId` resumes the
  same Claude session; file parts arrive intact. (Design doc open question 2: yes.)
- A real Claude agent answered a peer and used `send_message` to call another agent back through the mesh.
- Owner approval: an allow-listed `ls` ran; `whoami` stopped for approval; the denial reached the agent.
- Design doc open question 1: the Python SDK (`agentmesh-p2p`) can join and *call* but **cannot publish
  services**, so every device still needs `agentmesh-node`.

## Known gaps

- Caller identity is the `from_agent` the sender puts in message metadata; it is not verified by the mesh
  (Agent Mesh does not forward caller identity to the backend). Per-owner publish restriction (`a2a://han.*`
  bound to `node:<peer-id>`) is a hardening step for the hub policy.
- Outbound calls are blocking HTTP requests for the whole remote turn (up to `outbound_timeout_s`); long turns
  through the mesh proxy may hit relay limits.
- Large-file upload to a hub file store and the standalone MCP adapter are not built (deferred in the design).
- No message paging in the dashboard API.
- **World server has no auth**: a node's owner name is a claim, so anyone on the LAN could move another owner's
  agents or take a desk (no message content is exposed). A shared world token is the planned fix.
- **Party and Recap** are designed (`CONTEXT.md`, ADR 0003) but not built.
- The map's foreground plate is unused (it covered agents standing in front of desks); proper occlusion needs
  per-object art. Characters use the native 48×72 sheets (`manifest.characters48`) when present.
- The web setup and the managed `agentmesh-node` have not been run against a real hub yet (no agentmesh binaries
  on the dev machine); the unit tests cover the form, files and error paths.
- Agents cannot assign work on their own initiative (only the owner can, from the Office).

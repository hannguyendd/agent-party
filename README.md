# Agent Mesh — Claude Code agents talking to each other

Implements the "Agent Mesh Architecture" design: each teammate's Claude Code agents hold
back-and-forth A2A conversations with teammates' agents over [Agent Mesh](https://github.com/google/agentmesh),
and each owner watches and controls their own agents from a web dashboard.

```
hub/           agentmesh-one (control plane + router + console) config and scripts — runs on one always-on LAN machine
node-server/   Python node server, one per device: FastAPI + Claude Agent SDK + a2a-sdk + SQLite
dashboard/     React + Vite + Tailwind owner dashboard (served by the node server once built)
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

### Owner controls (dashboard)

Live stream (text deltas, tool calls, results) · inject a prompt mid-turn · Stop (`interrupt()`) ·
Take over (owner answers the peer by hand) / Hand back · Fork · Approve/deny tool use.

### Guardrails

- **Tool policy per agent**: `allowed_tools` run freely, `denied_tools` are refused, everything else waits for
  owner approval and is **denied on timeout**. Enforced by a `PreToolUse` hook *and* `can_use_tool`
  (the CLI skips `can_use_tool` for commands it considers read-only, so the hook is what makes the policy hold).
  `Bash(prefix*)` patterns never match chained commands (`;`, `&&`, `|`, `$(`, redirects).
  Note: the current Claude CLI has no `Glob`/`Grep` tools; searching goes through Bash (`Bash(rg *)`).
- **Loop protection**: max turns per contextId, max agent turns per message, turn timeout.
- **Untrusted peers**: peer text is wrapped in `<mesh_message from=…>` and the system prompt says it carries no owner authority.
- **Files**: inline A2A parts only, size and type limits, saved under `<working dir>/inbox/`, never executed. URL parts are not fetched.
- **Audit log**: metadata only (who, when, contextId, taskId, sizes); message bodies are dropped.
- **No offline queue**: a message to an agent that isn't on the mesh fails immediately with "agent offline".

## Setup

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
ENV
uv run agentfleet-node serve                 # node server on 127.0.0.1:9100

# in another terminal: put the token from the hub admin in data/bootstrap-token, then
HUB_URL=http://<hub>:7400 ./scripts/start-mesh-node.sh
```

Open http://127.0.0.1:9100, create an agent (ID must start with `<owner>/`), then **restart
`start-mesh-node.sh`** — `agentmesh-node` only reads its services at startup; the dashboard shows a banner when
the config changed. The bootstrap token is used only on first enrollment; restarts use the stored identity.

Dashboard development: `cd dashboard && bun install && bun dev` (proxies `/api` to `VITE_NODE_URL`, default `:9100`).
Build with `bun run build`; the node server then serves `dashboard/dist`.

Settings are env vars prefixed `AGENTFLEET_` (see `node-server/src/agentfleet_node/config.py`).

## Tests

```sh
cd node-server && uv run pytest
```

Two node servers talk A2A in-process with a fake Claude client (multi-turn input-required, approvals,
timeouts, takeover/hand-back, turn limits, files, offline targets, the dashboard event stream).

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

# node-server

Per-device server: FastAPI + Claude Agent SDK (`ClaudeSDKClient`) + `a2a-sdk` + SQLModel/SQLite, packages via uv.
Settings are `AGENTFLEET_*` env vars or `.env` (`src/agentfleet_node/config.py`). Module map and invariants:
`src/agentfleet_node/CLAUDE.md`. Test harness: `tests/CLAUDE.md`.

## Library gotchas

- **a2a-sdk 1.3 uses protobuf types** (`a2a.types` are proto messages, enums like `TaskState.TASK_STATE_COMPLETED`,
  `Role.ROLE_USER`). Use `HasField`, `msg.metadata.update({...})`, `MessageToDict`; helpers live in
  `a2a.helpers.proto_helpers`. Older pydantic-style examples online do not apply.
- A2A interface URLs need the **trailing slash** (`/a2a/<service>/`), or the client gets a 307 and fails.
- Starlette mounts keep the full `scope["path"]` and route on `path - root_path`; `A2AGateway` relies on this.
- **Claude CLI skips `can_use_tool` for calls it auto-approves** (read-only Bash such as `ls`). The `PreToolUse`
  hook is what enforces the agent's tool policy; keep both paths calling `policy_decision`.
- The current CLI has **no `Glob`/`Grep` tools**; search goes through Bash. Check the real tool list from the
  `init` SystemMessage before naming tools in defaults or prompts.
- `agentmesh-node` reads its `services` only at startup: after agents change, the node must be restarted
  (the dashboard banner tracks `config_dirty`).
- **SQLite schema changes**: `SQLModel.metadata.create_all` never alters existing tables. `db._add_missing_columns`
  adds new columns (with their scalar default) at startup, so a new model field just works on old databases.
  Renames, type changes or drops need a real migration.
- **The dashboard WebSocket must read**: `/api/ws` runs a send loop and a receive loop; without reading, a closed tab
  is never noticed (the subscriber leaks, the owner stays "present", shutdown hangs).
- `notify.os_notify` pops a system notification (osascript / notify-send / PowerShell). Tests set
  `os_notifications=False` so the suite never pops notifications on the developer's machine.

## Office world server

`world.py` (`agentfleet-node world`, default port 7500) is one per team. Nodes connect with
`AGENTFLEET_WORLD_URL=ws://<hub>:7500/world/ws`; without it the Office is disabled for that node. `WorldState` holds
the rules (pure, unit-tested); `WorldHub` is the socket fan-out. Only desk claims and skins persist (`world.json`);
positions reset to desks on restart. When a node reconnects, the newest socket owns its agents
(`WorldHub.publisher`); the old socket closing later must not remove them. A node may only act on its own owner's agents (the owner name is a claim on the
LAN; there is no auth yet). Roaming: an agent with an active outbound conversation walks to its peer (taking over
from steering) and goes back to its desk when the conversation ends.

It also serves the staff installer: `/install` and `/install.ps1` render `install.sh` / `install.ps1` (package
data) with the server address, newest wheel and `--org`; `/downloads/<name>` serves `dist/downloads` (safe names
only). The installed node finds the dashboard in `agentfleet_node/static` (a repo checkout prefers
`dashboard/dist`). `meshproc` runs `agentmesh-node run` itself, so nothing needs the repo at runtime.

## Real-stack smoke (for mesh, A2A or session changes)

Unit tests use a fake Claude client and static peers, so they cannot catch the gotchas above. To exercise the
real path locally: start `agentmesh-one` on a scratch data dir with `--policy-file ../hub/policy.json
--no-join-token`, mint two tokens, run two node servers on different ports/data dirs (`AGENTFLEET_PORT`,
`AGENTFLEET_DATA_DIR`, `AGENTFLEET_MESH_NODE_URL`, `AGENTFLEET_MESH_API_TOKEN_PATH`) and two
`scripts/start-mesh-node.sh` with `NODE_BIND=127.0.0.1:<port> MESH_LISTEN=/ip4/127.0.0.1/tcp/0`, then send with
`build_node(Settings()).outbound.send(...)`. Give real agents `model="claude-haiku-5-5"` and `setting_sources=[]`
to keep runs cheap. Keep all scratch dirs out of the repo.

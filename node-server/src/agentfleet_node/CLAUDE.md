# agentfleet_node

## Request path

Inbound: `a2a_bridge.A2AGateway` (`/a2a/<service>/`) → `MeshAgentExecutor` → `sessions.SessionManager.handle_inbound`
→ `SessionWorker.run_turn` → the agent's `AgentRuntime` (`runtimes/`: `ClaudeRuntime` or `CodexRuntime`, by
`agent.runtime`, ADR 0004). Codex mesh tools: Codex → `mesh_mcp.py` (stdio) → `POST /api/internal/mesh/{conv}/{tool}`
(loopback, `SessionManager.register_mesh_token`) → `mesh_tools.MeshTools`. Outbound: agent calls a `mesh_tools` tool → `a2a_bridge.OutboundClient` →
`mesh.MeshDirectory.resolve` (local agent, static peer, or mesh discovery) → remote node.

Assignment: `POST /api/office/assign` → `OutboundClient.send(kind="assignment")` in the background (returns the new
conversation id at once) → peer `MeshAgentExecutor` sees `KIND_KEY` → `SessionManager.request_acceptance` (an
`Assignment` approval; owner woken via `wake_owner`) → accepted: `conversation.accepted = True`, turn runs; declined
or timed out: A2A `rejected`, the sender's conversation ends as `done` with a "Declined: …" note.

Office: `office.WorldClient` keeps one socket to the world server, mirrors its state for `GET /api/office`, relays
world events to the dashboard as `{"type": "office", "event": …}`, and reports agents, presence (an open dashboard
WebSocket = owner present) and status-only conversation activity.

Setup: `GET/POST /api/setup` (web join form) writes `data/setup.json` (owner, hub_url, world_url; applied over the
env by `Settings.apply_setup_file` on every start) and `data/bootstrap-token`, rewrites `agentmesh-node.yaml`,
restarts the world link and (re)starts `agentmesh-node` via `meshproc.MeshNodeProcess`. Agent create/delete calls
`_republish`, which restarts the managed mesh node because it reads services only at startup. The owner can't
change while agents exist (409).

Party (ADR 0003): `party.PartyService` opens it (world op `party_open`, then the Host's conversation of kind
`party`), and `tags_for(conv_id)` makes the Host's `send_message` carry `PARTY_KEY` + the Party's kind (so an
Assignment party still goes through acceptance on each member's node). `party_update` (read-only copy) and
`party_handoff` (Host role + transcript) arrive in `MeshAgentExecutor` and are accepted only when the world mirror
lists the agents in that Party. World events (joined, left, ended) reach the service through
`WorldClient.party_listeners`. Recap: `recap.RecapService.start` builds `party.transcript` and writes in the
background (`recap.summarize`, replaced in tests).

Restart: `Store.recover_after_restart` (lifespan) closes pending approvals and marks mid-turn conversations
interrupted, since the futures that would finish them died with the process.

Modules: `world.py` (team world server), `office.py` (node ↔ world link), `notify.py` (OS notifications),
`meshproc.py` (managed `agentmesh-node`), `party.py`, `recap.py`, plus the
original `a2a_bridge`, `sessions`, `mesh`, `mesh_tools`, `store`, `api`, `models`, `db`, `files`, `naming`.

## Invariants

- **Every write goes through `store.Store`**: it saves to SQLite and publishes the dashboard event in one place.
  A new persisted thing gets a `Store` method that publishes; the dashboard sees nothing written around it.
- **One conversation per (agent_id, contextId)**, one `SessionWorker` and one Claude session per conversation;
  `run_turn` holds `_turn_lock`, so turns in a session are serialized.
- **Every runtime decides through the worker**: `SessionWorker.policy` / `decide` (Claude's hook and
  `can_use_tool`, Codex's approval handler, the internal mesh route). Codex commands reach the policy as `Bash`
  with the unwrapped script, file changes as `Edit`. The Codex sandbox doesn't confine approved commands (known
  issue, ADR 0004).
- **Tool policy has one source of truth**: `sessions.policy_decision` (allow / deny / ask). Order: `denied_tools` →
  deny; contact tools (`send_message`, `share_file`) with `contact_policy == "ask"` → ask; other mesh tools,
  `ToolSearch` and `allowed_tools` → allow; in an **accepted Assignment** `Edit`/`Write`/`MultiEdit`/`NotebookEdit`
  → allow (ADR 0002, nothing else is widened); everything else → ask. `ask` waits for the owner and becomes deny
  on timeout. Both the `PreToolUse` hook and `can_use_tool` call it.
- **Labels are claims**: `SENDER_KEY` and `KIND_KEY` come from the sender's metadata. Only the receiving owner's
  acceptance widens permissions, so a wrong `kind` gains nothing.
- **Nothing content-like leaves for the world server**: `WorldClient._conv_view` sends agent, peer, status and
  direction only (no titles, no text). A Party's topic stays on the Host's node too; the world gets IDs and kind. Keep it that way; a test asserts no message text reaches the world.
- **Owner gate**: manual mode or an interrupted turn parks the inbound request in `_wait_for_owner`; it resumes on a
  manual reply (sent to the peer) or hand-back (agent runs again). Every wait has a timeout from `Settings`.
- **Peer content is untrusted**: inbound text is wrapped by `format_prompt` in `<mesh_message from=…>`; the
  sender ID comes from message metadata (`SENDER_KEY`) and is a claim, not a verified identity.
- **Audit rows carry metadata only**: `store.redact` drops content-like keys; pass sizes and states, not bodies
  (health-tech context: PHI stays out of the audit log).
- **Files**: inline parts and owner attachments only (base64 in `POST /api/conversations` / `…/inject`), checked by
  `files.check_file`, written under `<working_dir>/inbox/`, never executed. Each stored file is a `FileRecord`;
  messages carry `files.file_ref(...)` dicts (`id, name, media_type, size, path`). `GET /api/files/{id}` serves only
  recorded files that resolve inside the agent's working directory. The agent is told the saved paths in its prompt.

## Turn completion

A turn ends on the `ResultMessage`. An owner prompt injected mid-turn increments `_pending`; if the CLI folds it
into the same result, the `INJECT_GRACE_S` timer finishes the turn. Change this only with a real-CLI check.

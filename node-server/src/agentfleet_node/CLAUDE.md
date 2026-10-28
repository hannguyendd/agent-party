# agentfleet_node

## Request path

Inbound: `a2a_bridge.A2AGateway` (`/a2a/<service>/`) → `MeshAgentExecutor` → `sessions.SessionManager.handle_inbound`
→ `SessionWorker.run_turn` (Claude). Outbound: agent calls a `mesh_tools` tool → `a2a_bridge.OutboundClient` →
`mesh.MeshDirectory.resolve` (local agent, static peer, or mesh discovery) → remote node.

Assignment: `POST /api/office/assign` → `OutboundClient.send(kind="assignment")` in the background (returns the new
conversation id at once) → peer `MeshAgentExecutor` sees `KIND_KEY` → `SessionManager.request_acceptance` (an
`Assignment` approval; owner woken via `wake_owner`) → accepted: `conversation.accepted = True`, turn runs; declined
or timed out: A2A `rejected`, the sender's conversation ends as `done` with a "Declined: …" note.

Office: `office.WorldClient` keeps one socket to the world server, mirrors its state for `GET /api/office`, relays
world events to the dashboard as `{"type": "office", "event": …}`, and reports agents, presence (an open dashboard
WebSocket = owner present) and status-only conversation activity.

Modules: `world.py` (team world server), `office.py` (node ↔ world link), `notify.py` (OS notifications), plus the
original `a2a_bridge`, `sessions`, `mesh`, `mesh_tools`, `store`, `api`, `models`, `db`, `files`, `naming`.

## Invariants

- **Every write goes through `store.Store`**: it saves to SQLite and publishes the dashboard event in one place.
  A new persisted thing gets a `Store` method that publishes; the dashboard sees nothing written around it.
- **One conversation per (agent_id, contextId)**, one `SessionWorker` and one Claude session per conversation;
  `run_turn` holds `_turn_lock`, so turns in a session are serialized.
- **Tool policy has one source of truth**: `sessions.policy_decision` (allow / deny / ask). Order: `denied_tools` →
  deny; contact tools (`send_message`, `share_file`) with `contact_policy == "ask"` → ask; other mesh tools,
  `ToolSearch` and `allowed_tools` → allow; in an **accepted Assignment** `Edit`/`Write`/`MultiEdit`/`NotebookEdit`
  → allow (ADR 0002, nothing else is widened); everything else → ask. `ask` waits for the owner and becomes deny
  on timeout. Both the `PreToolUse` hook and `can_use_tool` call it.
- **Labels are claims**: `SENDER_KEY` and `KIND_KEY` come from the sender's metadata. Only the receiving owner's
  acceptance widens permissions, so a wrong `kind` gains nothing.
- **Nothing content-like leaves for the world server**: `WorldClient._conv_view` sends agent, peer, status and
  direction only (no titles, no text). Keep it that way; a test asserts no message text reaches the world.
- **Owner gate**: manual mode or an interrupted turn parks the inbound request in `_wait_for_owner`; it resumes on a
  manual reply (sent to the peer) or hand-back (agent runs again). Every wait has a timeout from `Settings`.
- **Peer content is untrusted**: inbound text is wrapped by `format_prompt` in `<mesh_message from=…>`; the
  sender ID comes from message metadata (`SENDER_KEY`) and is a claim, not a verified identity.
- **Audit rows carry metadata only**: `store.redact` drops content-like keys; pass sizes and states, not bodies
  (health-tech context: PHI stays out of the audit log).
- **Files**: inline parts only, checked by `files.check_file`, written under `<working_dir>/inbox/`, never executed.

## Turn completion

A turn ends on the `ResultMessage`. An owner prompt injected mid-turn increments `_pending`; if the CLI folds it
into the same result, the `INJECT_GRACE_S` timer finishes the turn. Change this only with a real-CLI check.

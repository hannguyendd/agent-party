# agentfleet_node

## Request path

Inbound: `a2a_bridge.A2AGateway` (`/a2a/<service>/`) → `MeshAgentExecutor` → `sessions.SessionManager.handle_inbound`
→ `SessionWorker.run_turn` (Claude). Outbound: agent calls a `mesh_tools` tool → `a2a_bridge.OutboundClient` →
`mesh.MeshDirectory.resolve` (local agent, static peer, or mesh discovery) → remote node.

## Invariants

- **Every write goes through `store.Store`**: it saves to SQLite and publishes the dashboard event in one place.
  A new persisted thing gets a `Store` method that publishes; the dashboard sees nothing written around it.
- **One conversation per (agent_id, contextId)**, one `SessionWorker` and one Claude session per conversation;
  `run_turn` holds `_turn_lock`, so turns in a session are serialized.
- **Tool policy has one source of truth**: `sessions.policy_decision` (allow / deny / ask). Mesh tools and
  `ToolSearch` are always allowed; `ask` waits for the owner and becomes deny on timeout.
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

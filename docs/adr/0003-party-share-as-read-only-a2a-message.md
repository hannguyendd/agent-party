# Party Share travels as a read-only A2A message that never starts a Claude turn

When a Party's Host owner shares the Party conversation, its content must reach every member's node. ADR 0001 keeps
message bodies off the world server, so the Host's node sends each member's node an ordinary A2A message marked
with metadata `agentfleet.kind = "party_update"` (a late joiner gets the backlog in one message). The receiving
`MeshAgentExecutor` stores it through `Store` (so the owner's dashboard and Office show it) and completes the task
at once, without running a Claude turn.

## Why

- Reuses the mesh path and the Store → event stream the dashboard already uses; no new service type on the mesh.
- No Claude turn per update: sharing costs no tokens, and member agents don't read the transcript unless their
  owner injects it.

## Considered options

- Members pull from the Host's node: needs a second, non-A2A service published on the mesh.
- Relay through the world server: simplest, but puts conversation content (possibly PHI) on the hub machine.

## Consequences

- `agentfleet.kind` is a sender claim like `agentfleet.from_agent`. A node accepts a `party_update` only if the
  world server confirms the sender is the Host of a Party that includes one of its agents. A forged update could at
  worst show text on a screen; it can never run tools.

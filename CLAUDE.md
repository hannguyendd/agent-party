# Agent Mesh (internal agent fleet)

Teammates' Claude Code agents hold A2A conversations over Agent Mesh; each owner watches and controls their own
agents from a web dashboard. The design of record is the "Agent Mesh Architecture" doc
(https://claude.ai/artifact/DWhMzELPYpbMb1n5bpgDdP): read it before changing topology, protocol or guardrails.

## Layout

- `hub/`: Agent Mesh hub (`agentmesh-one`) policy and scripts. One per team, on an always-on LAN machine.
- `node-server/`: Python node server, one per device. Runs the agents and speaks A2A.
- `dashboard/`: React owner dashboard, served by the node server once built.

Each has its own CLAUDE.md. Commands live in the root `Makefile` (`make help`); `docs/RUNNING.md` is the
running guide for people. Keep it, and the `.env.example` files in `node-server/` and `dashboard/`, in step
with any change to the Makefile, scripts or settings.

## Cross-cutting contracts

- **Agent ID ↔ mesh service name**: agent `han/backend-agent` is published as mesh service `han.backend-agent`
  (mesh names allow only dot-separated labels). `node-server/src/agentfleet_node/naming.py` owns this mapping.
- **API shapes**: the dashboard's `src/api.ts` mirrors the node server's `api.py` routes, `models.py` rows and
  `store.py` events by hand. Change both sides in one commit.
- **v1 scope** (agreed in the doc): LAN only, plain-http hub, address agents by ID, no offline queue,
  no standalone MCP server. Deferred items are listed in README "Known gaps".

## Done means

`make test` passes and `make build` passes. For changes to the mesh, A2A or Claude session paths, also run the
real-stack smoke described in `node-server/CLAUDE.md`. Commit messages follow Conventional Commits (`feat(node-server): …`).

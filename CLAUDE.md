# Agent Mesh (internal agent fleet)

Teammates' Claude Code agents hold A2A conversations over Agent Mesh; each owner watches and controls their own
agents from the **Office**: a shared, game-like map of the real office where every online agent is a character.
The design of record is the "Agent Mesh Architecture" doc (https://claude.ai/artifact/DWhMzELPYpbMb1n5bpgDdP):
read it before changing topology, protocol or guardrails. Office vocabulary (Steering, Roaming, Inquiry,
Assignment, Party, Present, Recap…) is defined in `CONTEXT.md`; use those words. Decisions: `docs/adr/`.

## Layout

- `hub/`: Agent Mesh hub (`agentmesh-one`) policy and scripts. One per team, on an always-on LAN machine.
- `node-server/`: Python node server, one per device. Runs the agents and speaks A2A. The same package also runs
  the team **world server** (`agentfleet-node world`, `make world`) on the hub machine for the Office.
- `dashboard/`: React app served by the node server: the Office screen plus Settings.
- `site/`: the public intro page, published to GitHub Pages by `.github/workflows/pages.yml` (it copies the Office
  art in from `dashboard/public/office` at build time). Plain HTML + `office.js`, no build step.
- `docs/`: `GUIDE.md` (how admins and staff run and use the Office), `RELEASE.md` (publishing versions), `NOTES.md` (repo overview), `adr/` (decisions),
  `office/` (art brief and Codex prompts).
- `design/office-style/`: art sources and export scripts for the Office (owned by the art workflow, see below).
- `CONTEXT.md`: domain glossary for the Office.

Each has its own CLAUDE.md. Commands live in the root `Makefile` (`make help`).

## Cross-cutting contracts

- **Agent ID ↔ mesh service name**: agent `han/backend-agent` is published as mesh service `han.backend-agent`
  (mesh names allow only dot-separated labels). `node-server/src/agentfleet_node/naming.py` owns this mapping.
- **API shapes**: the dashboard's `src/api.ts` mirrors the node server's `api.py` routes, `models.py` rows and
  `store.py` events by hand. Change both sides in one commit.
- **v1 scope** (agreed in the doc): LAN only, plain-http hub, address agents by ID, no offline queue,
  no standalone MCP server. Deferred items are listed in `docs/HOW-IT-WORKS.md` "Known gaps".
- **Office topology (ADR 0001)**: browsers talk only to their own node (`127.0.0.1:9100`); the node relays to the
  world server. The world server holds positions, presence, desks and skins, **never message content**.
- **Privacy in the Office**: only the owners in a conversation see its words; everyone else sees typing dots.
  Status, not content, crosses to the world server (`office.py` sends status-only views).
- **Assignments (ADR 0002)**: the receiving owner accepts once; that widens only file edits in that conversation.
  Agent-to-agent messages on an agent's own initiative follow its `contact_policy` ("auto" / "ask").
- **Art vs code**: images, map plates, collision grid, seats and `dashboard/public/office/manifest.json` come from
  the art workflow (Codex, prompts in `docs/office/CODEX-PROMPTS.md`, rules in `design/office-style/`). Code reads
  the manifest and never hard-codes art. Art requests that need code go to `design/office-style/REQUESTS.md`.

## Branches

`develop` is the main branch of this project (GitHub's default branch): work lands there, pull requests target it,
and releases are tagged from it. `main` is old and no longer the base for this work; don't branch from it or merge
into it unless asked.

## Releases

Staff get versions through `make release` (`scripts/release.sh`: bumps the version on a `release/vX.Y.Z` branch,
merges it into `develop` through a pull request with `gh`, since `develop` only accepts pull requests, then tags it) and the GitHub Actions workflow
that publishes the package + installers to a GitHub Release; the office server serves the same version
(`git pull && make server`, built with bun or downloaded from the release). Never bump versions or push tags by hand.
Details and the agent checklist: `docs/RELEASE.md`.

## Done means

`make test` passes and `make build` passes (and `cd dashboard && bun run lint` is clean). For changes to the mesh,
A2A or Claude session paths, also run the real-stack smoke described in `node-server/CLAUDE.md`. For Office UI
changes, look at it in a browser (two node servers + `make world` give you two owners on one machine).
Commit messages follow Conventional Commits (`feat(node-server): …`).

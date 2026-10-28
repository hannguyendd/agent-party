# An agent runs on Claude or on Codex, chosen when it is created

Teammates move to Codex (their ChatGPT subscription) when Claude hits its usage limit, and their agents dropped out
of the Office with it. We decided: an agent's `runtime` is `claude` or `codex`, picked at creation and never changed.
To keep working when Claude is out, an owner creates a second agent on Codex. Codex agents use the owner's own
`codex` and `~/.codex`, through the official `openai-codex` SDK. Design:
`docs/superpowers/specs/2026-10-28-codex-runtime-design.md`.

## Why not switchable

A conversation's history lives in one runtime's session (a Claude session or a Codex thread), and there is no way
to carry one into the other. A switchable runtime would leave old conversations stuck on a runtime that may be out
of allowance, or would drop their history. A fixed runtime also keeps the model name and the default tool list
valid for the agent's whole life. The cost is that peers address the Codex agent by its own ID.

## Consequences

- `sessions.SessionWorker` keeps turns, injects, interrupts and the owner gate; the model session is an
  `AgentRuntime` (`runtimes/claude.py`, `runtimes/codex.py`). Both send every tool decision to
  `sessions.policy_decision`, which stays the single source of truth.
- Codex runs with `approvalPolicy="untrusted"`, so every command, file edit and MCP call asks the node first.
  The node never answers with "always allow" (Codex would save a rule into `~/.codex/rules`).
- Codex can't load the in-process mesh tools. They run through a stdio MCP proxy (`mesh_mcp.py`) that calls
  `POST /api/internal/mesh/{conversation}/{tool}`. That route is loopback only and takes a per-conversation secret,
  and the agent's policy applies there.
- The `-c` overrides merge with `~/.codex`, so the node turns off each personal MCP server by name, plus ChatGPT apps
  and hooks.
- Known issues the owner accepted for now (2026-10-28):
  - An approved Codex command runs outside the file sandbox; only the network setting holds.
  - A saved "always allow" rule in `~/.codex/rules` skips the Office approval. The hint says so.
- `openai-codex` is the optional extra `[codex]` (its CLI is about 306 MB). The installers add it on hosts that have
  Codex.
- Smoke on 2026-10-28, with two node servers as static peers, a real Claude agent (haiku) and real Codex (own CLI
  0.165.0): 11/11 checks passed.
  - A peer message to a Codex agent was answered.
  - An unlisted command raised an approval card and ran once approved.
  - A denied command was declined with no card.
  - With `contact_policy: "ask"`, the mesh tool raised a card, and Codex then reached the Claude agent through the
    proxy.
  - An owner inject steered the running turn.
  - An interrupt stopped the turn.
- Not covered by that smoke:
  - Codex through a real `agentmesh-one` hub. The mesh layer is unchanged and Codex agents publish like any other
    agent.
  - A `read_only` agent's Assignment edit. Unit tests cover the per-turn sandbox switch.

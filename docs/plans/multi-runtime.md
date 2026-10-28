# Plan: agents on CLIs other than Claude (future)

Status: **not started**, noted 2026-10-28. Today every agent runs on Claude Code through the Claude Agent SDK.
This plan lets an agent run on another coding CLI (Codex, Gemini, OpenCode…) while keeping the mesh, the Office
and the tool policy unchanged. Before building, write ADR 0004 (see P0) and add "Runtime" to `CONTEXT.md`.

## Where Claude is wired in today

| File | Claude-specific part |
|---|---|
| `sessions.py` | `ClaudeSDKClient`, `ClaudeAgentOptions`, SDK message types, `PreToolUse` hook + `can_use_tool`, `resume` / `fork_session`, `interrupt`, mid-turn inject, `claude_code` preset prompt |
| `mesh_tools.py` | `create_sdk_mcp_server` (in-process, other CLIs can't use it) |
| `sessions.policy_decision` | Claude tool names (`Edit`, `Bash(git status*)`, `mcp__mesh__*`) |
| `usage.py` | Claude rate-limit windows (`five_hour`, `seven_day`, …) |
| `titles.py`, `recap.py` | Claude SDK `query()` |
| `api.py` `claude_status` | Setup checks only the Claude CLI |
| `models.Agent` | `setting_sources`, `model` only mean something to Claude |

## What a runtime must provide

1. Headless sessions with resume and streaming output.
2. **A gate on every tool call** (allow / deny / ask). This is what tool policy and ADR 0002 rest on.
3. An MCP client that can reach an external server (mesh tools).
4. Interrupting a running turn.
5. Usage / cost numbers (nice to have).

A runtime that cannot gate every tool call is not enabled, or only runs in a read-only sandbox.

## Phases

**P0: ADR 0004 + glossary.** Decide:
- *Mesh tool transport*: the node serves MCP (streamable HTTP) at `127.0.0.1:9100/mcp/<session-token>/`, token →
  `SessionWorker`, expires with the session. This changes the v1 scope line "no standalone MCP server".
- *Policy guarantee*: the per-call gate rule above.
- *Canonical tool names*: `policy_decision` works on `read`, `edit`, `shell(<cmd>)`, `mesh.*`; each runtime maps its
  own names (Codex `shell` / `apply_patch`, Gemini `run_shell_command` / `replace`, …).
- *Allowed runtimes*: admin whitelist per team (provider data policy, see Risks).

**P1: Refactor, no behaviour change.** `runtimes/base.py`: `AgentRuntime` protocol (`start(resume)`, `query`,
`interrupt`, `close`, `events()`), normalized events (`TextDelta`, `AssistantText`, `ToolUse`, `ToolResult`,
`SessionId`, `TurnEnd(cost?, tokens?)`, `RateLimit`) and capability flags (`inject_mid_turn`, `fork`, `cost`,
`per_call_gate`). `runtimes/claude.py` takes today's SDK code. `SessionWorker` consumes normalized events only;
`FakeClaude` becomes a fake runtime. Mesh tools become a neutral spec (schema + handler) that Claude still wraps with
`create_sdk_mcp_server`. Done = `make test` + the real-stack smoke behave exactly as before.

**P2: Mesh tools over local MCP HTTP** for non-Claude runtimes (127.0.0.1 only, per-session token).

**P3: Canonical tool policy.** Migrate `allowed_tools` / `denied_tools`; old Claude-style patterns keep working
(map on read). Keep `_SHELL_CHAINING` for every runtime. ADR 0002 (Assignment widens `edit` only) is unchanged.

**P4: `runtimes/acp.py`, Gemini first.** ACP `session/request_permission` → `policy_decision`; mesh MCP passed in
`session/new`; `session/cancel` for interrupt. Verify with the real CLI that auto-approved tools still ask
(the same trap as Claude's `can_use_tool`). No mid-turn inject in ACP: queue the prompt until the turn ends.

**P5: Codex adapter** via `codex app-server` (JSON-RPC `thread/start`, `turn/start`, approval requests from server
to client), with Codex's OS sandbox (`read-only`, or `workspace-write` in an accepted Assignment) as a second layer.
Try a Codex ACP adapter first only if it exposes the approval requests.

**P6: Model / API / dashboard** (`api.ts` ↔ `api.py` in one commit): `Agent.runtime: str = "claude"` (new column is
added automatically); runtime picker in Settings, model list per runtime, hide `setting_sources` for non-Claude;
`/api/setup` checks each CLI (installed / logged in); `usage` per provider; `cost_usd` nullable (many CLIs report
tokens only); optional runtime badge on the Office character (world server unchanged, status only).

**P7: Titles / recap.** `utility_runtime` setting (default Claude); skip quietly when it isn't available.

**P8: Smoke + docs.** Real-stack smoke per runtime; `GUIDE.md`, installer CLI check, `docs/HOW-IT-WORKS.md` "Known gaps".

Order: P0 → P1 (merge early, safe) → P2 + P3 → P4 Gemini → P5 Codex → P6–P8.

## Candidate CLIs (checked 2026-10; verify against official docs before building)

| CLI | Adoption | Headless | Per-call gate | MCP | Verdict |
|---|---|---|---|---|---|
| **OpenAI Codex CLI** | Very high | `codex app-server` (JSON-RPC), Python SDK | Approval requests + OS sandbox | Yes | **Best after Claude.** Native adapter |
| **Google Gemini CLI** | High, generous free tier | ACP native | ACP `request_permission`; check auto-approved tools | Yes | Good; CLI changes fast |
| **OpenCode** (sst) | Medium, growing | Server mode (HTTP API + SDK) | Permission config; check per-call | Yes | When multi-provider or local models are needed |
| **GitHub Copilot CLI** | High where Copilot is bought | To check | To check | Yes | Only if the team already pays for Copilot |
| **Goose** (Block) | Medium | ACP | Via ACP | Yes | Comes nearly free once the ACP adapter exists |
| Cursor CLI, Amp, Qwen Code | Medium / low | Varies | Uneven | Yes | Later |
| **Aider** | High, different model | No session protocol | No per-call gate | No | **Skip** |

Pick: Codex first by demand, Gemini via ACP (also unlocks Goose / Qwen Code / other ACP agents), OpenCode for
local models.

## Risks

- **Policy parity** is the security point (health-tech, PHI). No per-call gate → not shipped.
- **Provider data policy**: free / consumer tiers (e.g. Gemini free) may train on data. Agents near PHI only use
  enterprise or API plans with a DPA/BAA; the admin whitelist enforces it.
- **Claude-only features** (mid-turn inject, resume, fork, rate-limit windows): the UI hides them by capability.
- **Prompt**: `MESH_PROMPT` hard-codes `mcp__mesh__*`; render tool names per runtime. Keep `<mesh_message>` wrapping.
- **Usage**: "one Claude account per machine" becomes "one account per provider per machine".

## Sources

- ACP: https://agentclientprotocol.com/updates, https://www.morphllm.com/agent-client-protocol,
  https://www.jetbrains.com.cn/en-us/help/ai-assistant/acp.html
- Codex app-server: https://byteiota.com/codex-app-server-inside-openais-agent-harness/,
  https://techdevnotes.com/releases/codex-cli/0.152.0/content/docs/codex-rs/codex_mcp_interface.md,
  https://codex.danielvaughan.com/2026/07/31/codex-agent-provider-jetbrains-ides-copilot-chat-autopilot-hooks-mcp-configuration/

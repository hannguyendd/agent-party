# Codex as an agent runtime

Status: design, 2026-10-28. Decision record: `docs/adr/0004-agent-runtime-chosen-at-creation.md` (to be written
with the implementation).

## Why

Teammates move to Codex (their ChatGPT subscription) when Claude hits its usage limit. Today every mesh agent runs
on Claude, so when the owner's Claude allowance is spent, their agents stop answering in the Office. This change
lets an owner create an agent that runs on **Codex**, so they can keep an agent on the mesh while Claude is out.

## Goals

- An agent's **runtime** is `claude` or `codex`, chosen when the agent is created and fixed for its life.
  Switching off Claude means creating a second agent (e.g. `han/backend-codex` next to `han/backend-agent`).
- Codex agents run on the teammate's own Codex install and sign-in (`codex login`, ChatGPT subscription).
- The runtime is a **strategy** behind one interface in `sessions.py`; the rest of the node (turn serialization,
  owner gate, inject, interrupt, store, A2A, Office) does not know which runtime an agent uses.
- Guardrails keep one source of truth (`policy_decision`) and still cover every tool call Codex can be asked
  about. Where Codex can't ask, the setting is an on/off toggle, not a fake per-call approval.
- The Codex option appears only where Codex is usable on that machine.

## Non-goals

- Switching an existing agent's runtime, automatic fallback when Claude is rate-limited, or moving a
  conversation's history between runtimes.
- Titles and Recaps when Claude is out of allowance (front-end team, later). `titles.py` / `recap.py` keep calling
  Claude unchanged.
- A Codex usage/limits panel (front-end team, later). Backend only forwards what it has (below).
- Dashboard styling. The front-end team builds the UI; this design fixes the API it reads and the hint texts.
- Forking Codex conversations (`POST /api/conversations/{id}/fork`) in v1: returns 409 for Codex agents.

## Anti-goals (would be a failure even if it works)

- A Codex agent that can run a command, edit a file or message another agent that its owner's policy says must ask
  or deny, without anyone noticing.
- Message content reaching the world server, or the runtime name being needed by the world server.
- Breaking or slowing Claude-only teammates: the Claude path behaves exactly as today.

## Decisions made with the owner

| Topic | Decision |
|---|---|
| Choosing the runtime | At creation only; immutable after. |
| Which Codex binary | The teammate's own `codex` whenever it is at least the tested minimum (newer than the pin → still used, with a "newer than tested" note). The CLI bundled with the SDK (`openai-codex-cli-bin`) only when theirs is missing or too old. Each release bumps the SDK pin (`docs/RELEASE.md` step). |
| Saved approvals and hooks | Turned off for mesh Codex agents (config override, verified in the prototype): the user's saved "always allow" command rules and their hooks don't apply. Approval depends only on the agent's Office settings. |
| Sandbox | A hard limit: an approval never lets a command escape it. An accepted Assignment raises a `read_only` agent to `workspace_write` for that conversation only. Network is a separate toggle, off by default. |
| Packaging | `openai-codex` is an **optional extra** `agentfleet-node[codex]` (the pinned CLI it pulls is ~306 MB on disk, measured). `install.sh` / `install.ps1` install the extra when the host has Codex (`codex` on PATH or `~/.codex/auth.json`), on every install and update. Settings offers **Set up Codex agents** (re-runs the installer, like Update) when Codex is found but the extra is missing. Claude-only hosts download nothing extra. |
| Codex home | The teammate's normal `~/.codex` (config, `AGENTS.md`, hooks) **is loaded**, plus the project's own setup. The UI warns about it (hint below). |
| Personal MCP servers | Turned off for mesh Codex agents **if** a config override can do it (verify in the prototype; if not, stop and ask the owner). |
| Visibility | Codex is offered only when the node finds it installed and signed in (table below). |
| Approvals | Each runtime has its own list of controls. Some Codex controls are on/off toggles only; that's accepted. |

## Data model

`Agent` (models.py) gains:

- `runtime: str = "claude"` (`"claude" | "codex"`). Old rows get `"claude"` via `db._add_missing_columns`.
- `runtime_options: dict = {}` (JSON). Codex keys: `sandbox` (`"read_only" | "workspace_write"`, default
  `"workspace_write"`), `network` (bool, default false; network access inside the sandbox), `web_search` (bool,
  default false). Claude ignores it.

Existing fields keep their meaning; for Codex:

- `model`: a Codex model name or null (Codex default). The create form lists models per runtime.
- `allowed_tools` / `denied_tools`: same pattern syntax. Codex agents use only `Bash(<glob>)`, `Edit`, and
  `mcp__mesh__*` names (mapping below). Default for a new Codex agent: the shell entries of
  `DEFAULT_ALLOWED_TOOLS` (`Bash(ls*)`, `Bash(rg *)`, `Bash(grep *)`, `Bash(git status*)`, `Bash(git log*)`,
  `Bash(git diff*)`); `Read` is dropped (reads are not controllable on Codex).
- `setting_sources`: Claude-only; ignored for Codex.

`Conversation.session_id` holds the Codex **thread id** for Codex agents (same role as the Claude session id).

API: `AgentIn` gains `runtime` and `runtime_options`. `POST /api/agents`:

- new agent with `runtime="codex"` → 422 unless `codex_status().usable`.
- existing agent with a different `runtime` than stored → 422 "runtime can't change; create a new agent".
- unknown `runtime_options` keys → 422.

`dashboard/src/api.ts` mirrors the new fields and the `codex` block of `/api/setup` in the same commit (repo
contract), even though the front-end team builds the screens.

## Detecting Codex (`/api/setup` → `codex`)

New `codex_status()` in `api.py`, next to `claude_status()`, returned as `setup["codex"]`:

```json
{"installed": true, "path": "/opt/homebrew/bin/codex", "version": "0.163.0",
 "logged_in": true, "compatible": true, "binary": "own" | "bundled", "usable": true}
```

- `installed`: `shutil.which("codex")` or `~/.codex/auth.json` exists (someone who uses only the bundled CLI
  still counts if signed in).
- `version`: `codex --version`, parsed; null if not installed.
- `logged_in`: `codex login status` exit code (to confirm in the prototype that this command exists);
  fallback: `~/.codex/auth.json` exists.
- `compatible`: version ≥ `CODEX_MIN` in a new `runtimes/codex.py` (the oldest version the prototype passes
  with). `newer_than_tested`: version > the pinned SDK version (informational note in the UI).
- `binary`: `own` when compatible, else `bundled` (the SDK's default resolver). Never fall back to the bundled
  binary when the user's own is newer: an older Codex must not read a `~/.codex` written by a newer one.
- `sdk_installed`: `importlib.util.find_spec("openai_codex") is not None`.
- `usable`: `logged_in and sdk_installed`. (`installed` but not signed in → shown disabled; signed in but no SDK → Settings shows **Set up Codex agents**.)

Each call runs the checks fresh (fast subprocesses, a 5 s timeout each). They are only made when Settings or the
create form opens.

| Node finds | Runtime picker (front-end) |
|---|---|
| not installed | Codex hidden |
| installed, not signed in | Codex shown disabled: "Run `codex login` to use Codex agents" |
| signed in | Codex available, with the setup hint below |

Hint text (create form, when Codex is picked, and on a Codex agent's settings):

> **Uses your Codex setup.** This agent loads your `~/.codex` settings, `AGENTS.md` and hooks, and the project's
> `AGENTS.md`, in every conversation with other agents. Your personal MCP servers are turned off. Its threads appear
> in the Codex app; read them there, but reply here in the Office, where approvals apply.

If the MCP override turns out not to work, the "turned off" sentence changes. That case goes back to the owner first.

When `binary == "bundled"`: "Your Codex (x.y.z) is older than this node supports; agents use the bundled Codex
0.163.0." When `newer_than_tested`: "Your Codex (x.y.z) is newer than the version this node was tested with."

The hint's first sentence also gains: "Your saved Codex approvals and hooks are turned off; the Office approves."

## Runtime strategy

New package `agentfleet_node/runtimes/` with `base.py`, `claude.py`, `codex.py`.

`SessionWorker` keeps: `_turn_lock`, `_turn_done`, `_pending` + `INJECT_GRACE_S`, status changes, timeouts,
`owner_named`, `needs_input`, the owner gate. It stops importing `claude_agent_sdk` types. It owns one
`AgentRuntime`, chosen by `agent.runtime` from a registry in `runtimes/__init__.py`:

```python
RUNTIMES: dict[str, type[AgentRuntime]] = {"claude": ClaudeRuntime, "codex": CodexRuntime}
```

Interface (`runtimes/base.py`), shape not final:

```python
class RuntimeEvents(Protocol):          # implemented by SessionWorker
    def text_delta(self, text: str) -> None
    def text(self, text: str) -> None                       # a complete agent text block
    def tool_use(self, tool_id: str, name: str, input: dict) -> None   # name in policy vocabulary
    def tool_result(self, tool_id: str, content: Any, is_error: bool) -> None
    def session_id(self, sid: str) -> None
    def result(self, text: str, error: str | None, cost_usd: float | None) -> None  # one per turn result
    def failed(self, error: str) -> None                    # runtime died; worker finishes the turn with an error
    def rate_limit(self, info: Any) -> None
    async def decide(self, tool_name: str, tool_input: dict) -> tuple[bool, str]  # policy_decision + owner approval

class AgentRuntime(Protocol):
    def __init__(self, ctx: RuntimeContext, events: RuntimeEvents): ...
    async def start(self, resume_id: str | None) -> None     # idempotent
    async def send(self, prompt: str) -> None                # starts a turn, or adds input to the running one
    async def interrupt(self) -> None
    async def close(self) -> None
```

`RuntimeContext` carries the agent, settings, conversation id, the mesh-prompt text and the mesh tools factory.
`decide` is where both runtimes meet the single policy: it calls `policy_decision` with the worker's
`_accepted()` / `_named()` and, on `ask`, `SessionManager.request_approval`. A deny returns the reason text.

### ClaudeRuntime

Today's `_ensure_started`, `_read_loop`, `_on_message`, `_pre_tool_use`, `_can_use_tool` and `_record_usage`,
moved, not changed. It still builds `ClaudeAgentOptions` and uses `SessionManager.client_factory`, so
`conftest.FakeClaude` and every existing test keep working without edits. `fork` stays Claude-only.

### CodexRuntime

Built on `openai-codex` (0.163.0, pinned exact). Facts below come from reading the 0.163.0 source, not from
running it. The prototype confirms them first.

- **Client.** The public `AsyncCodex` takes no approval callback, so use the low-level sync `CodexClient(config,
  approval_handler=...)` and run blocking calls with `asyncio.to_thread`. Notifications are read on a reader thread
  and handed to the loop with `loop.call_soon_threadsafe`. The approval handler runs on the SDK's thread. It calls
  `asyncio.run_coroutine_threadsafe(events.decide(...), loop).result(timeout=settings.approval_timeout_s + 5)`,
  and a timeout means decline.
- **Process.** One `codex app-server` per conversation, the same as one Claude CLI per conversation. `CodexConfig(codex_bin=<own
  path if compatible else None>)`, and the env is inherited (so the normal `~/.codex` loads).
- **Thread.** `thread_start` (or `thread_resume(session_id)`): `cwd=working_dir`, `model`,
  `developer_instructions = MESH_PROMPT (Codex wording) + agent.system_prompt`, `sandbox=runtime_options.sandbox`,
  an approval policy that asks for anything not known-safe (`untrusted`; confirm the name in the protocol), and
  `config` with:
  - `mcp_servers` = only `mesh` (replacing the user's): `command = <sys.executable>`, `args = ["-m",
    "agentfleet_node.mesh_mcp"]`, env `AGENTFLEET_MESH_URL`, `AGENTFLEET_MESH_TOKEN` (see Mesh tools).
  - web search on or off from `runtime_options.web_search`; sandbox network from `runtime_options.network`.
  - overrides that switch off the user's saved command-approval rules and hooks (exact keys from the prototype).
  - the mesh server's per-tool timeout (see "Calls made by Claude").
- **Sandbox is a hard limit.** Approval answers only accept or decline the request as asked. If the request is
  to run outside the sandbox, it is declined with "outside this agent's sandbox", even if the policy allows it.
  When the conversation is an accepted Assignment and the agent is `read_only`, turns in that conversation run
  with `sandbox=workspace_write` (per-turn override on `turn()`), only there.
- **Turn.** `send()` while idle → `thread.turn(prompt)`; while a turn runs → `turn.steer(prompt)`. The worker's
  `_pending` grace logic stays, because a steered input may or may not finish in a separate `turn/completed`.
  `interrupt()` → `turn.interrupt()`.
- **Event mapping.**

| Codex notification / item | Worker event |
|---|---|
| `item/agentMessage/delta` | `text_delta` |
| `item/completed` agentMessage | `text` |
| `item/started` commandExecution | `tool_use(id, "Bash", {"command": <joined command>})` |
| `item/completed` commandExecution | `tool_result(id, <output, trimmed>, exit_code != 0)` |
| `item/started` / `completed` fileChange | `tool_use(id, "Edit", {"files": [paths]})` / `tool_result` |
| `item/started` / `completed` mcpToolCall | `tool_use(id, "mcp__mesh__<tool>", args)` / `tool_result` |
| thread id after start/resume | `session_id` |
| `turn/completed` (completed / interrupted / failed) | `result(final text, error or None, cost_usd=None)` |
| `error` with `usageLimitExceeded` / `unauthorized` | `result(error="Codex usage limit reached" / "Codex not signed in")` |
| `account/rateLimits/updated` | `rate_limit(info)`. The usage tracker ignores non-Claude payloads for now (front-end team). |
| app-server exits | `failed(...)` |

- **Approvals and the policy.** Tool names are translated to the policy's vocabulary before `decide`:

| Codex approval request | Policy call |
|---|---|
| `item/commandExecution/requestApproval` | `("Bash", {"command": " ".join(argv)})`. The existing chaining guard applies to the joined string. |
| `item/fileChange/requestApproval` | `("Edit", {"files": [...]})`. ADR 0002 applies: an accepted Assignment allows it. |

Allow → `{"decision": "accept"}`; deny → decline with the reason.

- **Usage.** `cost_usd` stays 0 for Codex conversations; `agent_turns` still increments. Token counts from
  `thread/tokenUsage/updated` are logged only (front-end team decides display later).

### Mesh tools for Codex

Codex can't use the in-process SDK MCP server and never asks before MCP calls. So for Codex agents the mesh tools
run in a small stdio MCP server (`agentfleet_node/mesh_mcp.py`, launched by Codex) that proxies each call to the
node:

- `POST /api/internal/mesh/{conv_id}/{tool}` on the node (127.0.0.1 only), body = tool args.
- Auth: a random token per `CodexRuntime` (`secrets.token_urlsafe(32)`), passed to the MCP process via env and
  checked with `hmac.compare_digest`. It's held in memory only and dropped on `close()`. Wrong or missing
  token → 403.
- The node handler runs the **same** tool implementations as `mesh_tools.py` (refactor them into plain async
  functions both the SDK server and this route call), **after** `policy_decision(agent, "mcp__mesh__<tool>", args,
  …)` through `events.decide`, so `contact_policy: "ask"` and `owner_named` work exactly as on Claude.
- Party tags, `needs_input`, file sharing behave as today because the handler gets the real worker.

### Prompt

`MESH_PROMPT` names tools as `mcp__mesh__…`. Codex shows MCP tools under its own naming. `CodexRuntime` formats a
copy with the names Codex shows, which the prototype confirms. Everything else in the prompt is identical.

## Edge cases and how each is handled

| # | Case | Handling |
|---|---|---|
| 1 | Codex never asks before MCP calls | Mesh tools enforce policy server-side (above). Personal MCP servers off via config override. |
| 2 | File reads can't be denied | `Read` is not offered for Codex; sandbox toggle is the only read/write control. |
| 3 | Known-safe commands may skip the approval handler | Prototype test: `denied_tools=["Bash(cat*)"]`, ask the agent to `cat` a file, see whether the handler fires. If it doesn't, the form labels shell rules "for commands that change things". Read-only commands are within the read limitation anyway. |
| 4 | `AsyncCodex` has no approval hook | Sync `CodexClient` + threads (above). |
| 5 | Stray local process calling mesh tools | Per-runtime secret, 127.0.0.1 only. |
| 6 | Personal `~/.codex` leaks in | Accepted by the owner, disclosed by the hint. MCP servers overridden. |
| 7 | Codex usage limit | Turn ends with error "Codex usage limit reached"; conversation status `error`, as for any failed turn. |
| 8 | Titles/Recaps need Claude | Out of scope; they fail as today when Claude is out. |
| 9 | Model names per runtime | Validated loosely: the node passes the name through; Codex rejects bad names, and the turn errors. The front-end lists models per runtime. |
| 10 | Tool names differ | Mapping above; Codex default allow-list drops `Read`. |
| 11 | No dollar cost | `cost_usd` 0, tokens logged. |
| 12 | Bundled CLI size (~306 MB) | Only on hosts with Codex (optional extra, installed when the installer detects Codex). |
| 13 | Teammate's Codex version drifts after creation | Status is re-checked when a session starts. Newer → still their own (note). Below the minimum → bundled, and the setup check says so. |
| 19 | Saved "always allow" rules or hooks in `~/.codex` | Overridden off; prototype stop condition if that's impossible. |
| 20 | Approved command needs to leave the sandbox or reach the network | Declined; the owner turns on the network toggle or changes the sandbox on the agent. |
| 14 | Codex signed out after the agent was created | The turn fails with "Codex not signed in". Agent stays; `/api/setup` shows `logged_in: false`. |
| 15 | Node restart mid-turn | Same as today: `recover_after_restart` marks the conversation interrupted; next turn resumes the thread by id. |
| 16 | Fork on a Codex conversation | 409 "fork isn't available for Codex agents yet". |
| 17 | Thread visible in the Codex app and replied to there | Disclosed by the hint; the Office is the only place mesh replies go through. Nothing enforces it. |
| 18 | Runtime field sent to world server | Not sent. `office.py` views unchanged. |

## Tests

- **Unit / integration (no real model calls).** Add `conftest.FakeCodex`, a fake at the `CodexClient` boundary
  that is injected through a `codex_client_factory` on `SessionManager`, mirroring `client_factory`. It
  understands the same prompt words as `FakeClaude` (`TOOL:` sends a command approval request, `SLOW`, `ASK`, echo).
  Parametrize the existing two-node, assignment and attachment tests over both runtimes where they exercise the
  session path.
- Policy translation: `Bash` chaining guard on joined argv; file change in an accepted Assignment → allowed; denied
  shell pattern → declined; `contact_policy: "ask"` through `/api/internal/mesh` → approval card.
- `/api/internal/mesh`: 403 without/with a wrong token; works with the right one; unknown conversation → 404.
- API: create Codex agent when unusable → 422; changing runtime → 422; old DB gets `runtime="claude"`.
- `codex_status()`: patch `shutil.which` and subprocess as `test_setup.py` does.
- **Real-stack smoke** (repo rule for session changes), with one Claude agent and one Codex agent on two nodes:
  a message each way, an approval card for a non-allowed command on the Codex side, a contact-policy ask, an
  interrupt, a steer mid-turn. Also the prototype checks: the MCP override, `codex login status`, the
  known-safe-command behaviour, the approval policy name, and how MCP tool names appear to the model.

## Order of work

1. **Prototype (throwaway, scratch dir).** Drive `codex app-server` through the SDK with an approval handler and a
   stdio MCP server, then answer the prototype checks above, plus: saved rules/hooks can be overridden off; file
   edits go through the approval handler; per-turn sandbox override works; the MCP per-tool timeout can be raised.
   Stop and bring it to the owner if any of these fail: the MCP override, the rules/hooks override, the approval
   handler missing any command or file edit that changes something, or the MCP timeout.
2. Extract `AgentRuntime` and move the Claude code into `ClaudeRuntime`. Run the whole test suite unchanged; no
   behaviour change.
3. Data model + API + `codex_status` + `api.ts` mirror.
4. `mesh_mcp.py` + `/api/internal/mesh` + refactor mesh tools into shared functions.
5. `CodexRuntime` + `FakeCodex` + tests.
6. Real-stack smoke; ADR 0004; docs (`GUIDE.md` section for staff, `node-server/CLAUDE.md` gotchas, root CLAUDE.md
   cross-cutting contract: "runtime is chosen at creation", `docs/RELEASE.md` step: bump the `openai-codex` pin
   and re-run the Codex smoke).

## Calls made by Claude (not discussed with the owner; check while reading)

- **MCP tool timeout:** `send_message` can block for minutes (peer turn + approvals). Set the mesh server's
  per-tool timeout in the Codex config to `turn_timeout_s + approval timeouts`. It's a prototype check; if Codex
  can't raise it, stop and ask the owner before changing the mesh tool contract.
- **Model list:** no backend model list in v1. The front-end offers a free-text field with suggestions per
  runtime; a bad name fails the turn (edge case 9).
- **API-key Codex logins:** allowed. `codex_status()` adds `auth_mode` (`"chatgpt" | "api_key"`) so the UI can
  say "billed to your OpenAI API key" when it's not a subscription. Cost stays 0 either way (tokens logged).
- **Party prompt:** `party.py`'s Host prompt names `mcp__mesh__` tools too; it gets the same Codex renaming.
- **Updates:** `AgentIn.runtime` is optional on update. If it's missing, the stored runtime is kept; a different
  value gets 422.

## Left to the builder

- Exact interface method names and where small helpers live.
- Wording of error strings other than the hint texts above.
- The `CODEX_TESTED` minimum (from the prototype).
- Whether the reader thread is one per runtime or shared.

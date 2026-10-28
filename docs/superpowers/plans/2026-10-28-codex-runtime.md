# Codex Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an owner create a mesh agent that runs on Codex (their own `codex` + ChatGPT sign-in) instead of
Claude, chosen at creation, with the same Office guardrails.

**Architecture:** `SessionWorker` keeps turn bookkeeping and talks to one `AgentRuntime` strategy
(`ClaudeRuntime` = today's code moved; `CodexRuntime` = `openai-codex` SDK behind a small `CodexSession` seam).
Both runtimes funnel every tool decision through `policy_decision`. Codex reaches mesh tools through a stdio MCP
proxy that calls a token-protected node route.

**Tech Stack:** Python 3.12, FastAPI, SQLModel, claude-agent-sdk, openai-codex 0.163.0 (exact pin), pytest, uv.

**Spec:** `docs/superpowers/specs/2026-10-28-codex-runtime-design.md` (read it first; this plan does not repeat its
reasoning).

## Global Constraints

- `openai-codex==0.163.0` exact pin as the optional extra `codex` of `node-server` (pulls `openai-codex-cli-bin`, ~306 MB). Code imports `openai_codex` lazily, only inside `SdkCodexSession`; the node must start and `make test` must pass without the extra.
- `Agent.runtime` ∈ `{"claude", "codex"}`, default `"claude"`, immutable after creation (422 on change).
- `Agent.runtime_options` keys for Codex only: `sandbox` (`"read_only" | "workspace_write"`, default
  `"workspace_write"`), `network` (bool, default `false`), `web_search` (bool, default `false`). Unknown keys → 422.
- Codex default `allowed_tools`: `Bash(ls*)`, `Bash(rg *)`, `Bash(grep *)`, `Bash(git status*)`, `Bash(git log*)`,
  `Bash(git diff*)` (no `Read`).
- Policy vocabulary for Codex: commands → `"Bash"` `{"command": str}`; file changes → `"Edit"` `{"files": [str]}`;
  mesh → `"mcp__mesh__<tool>"`. Only `sessions.policy_decision` decides.
- Binary choice: own `codex` if version ≥ `CODEX_MIN`; bundled only if own is missing or older. Never bundled when
  own is newer.
- Sandbox is a hard limit; accepted Assignment raises `read_only` → `workspace_write` for that conversation only.
- Hint texts are fixed by the spec ("Detecting Codex"); copy them verbatim into `api.ts` comments for the front-end
  team. No styling work in this plan.
- Nothing runtime-related goes to the world server (`office.py` unchanged).
- Never spend real Claude or Codex calls in `make test`; real calls only in Task 0 and Task 5.
- Done means: `make test`, `make build`, `cd dashboard && bun run lint` clean; Task 5 smoke passed.
- Commits: Conventional Commits, scope `node-server` / `dashboard` / `docs`.

## Review Focus

1. Codex wraps commands as `["bash", "-lc", "<script>"]`: the policy must see `<script>`, so `Bash(ls*)` does not
   allow `bash -lc "ls; rm -rf ~"` (chaining guard on the inner script). Test in Task 4.
2. The owner never answers an approval: the SDK's approval thread must get "decline" after the timeout, and the
   turn must not hang. Test in Task 4.
3. `codex app-server` dies mid-turn: the turn ends with an error, and the next turn starts a new process and
   resumes the thread by id. Test in Task 4.
4. The owner injects while a Codex turn runs: it becomes `steer`, and the worker returns exactly one result to the
   peer. Test in Task 4.
5. `/api/internal/mesh` called with a token from a closed conversation, or for another conversation's id → 403.
   Test in Task 3.

## File Structure

| File | Responsibility |
|---|---|
| `node-server/src/agentfleet_node/runtimes/__init__.py` (create) | `RUNTIMES` registry, `make_runtime()` |
| `node-server/src/agentfleet_node/runtimes/base.py` (create) | `AgentRuntime`, `RuntimeEvents`, `RuntimeContext` protocols/dataclass |
| `node-server/src/agentfleet_node/runtimes/claude.py` (create) | `ClaudeRuntime` (code moved from `sessions.py`) |
| `node-server/src/agentfleet_node/runtimes/codex.py` (create) | `CodexRuntime`, `CodexSession` protocol, `SdkCodexSession`, `codex_status()`, `CODEX_MIN`, policy translation |
| `node-server/src/agentfleet_node/mesh_mcp.py` (create) | stdio MCP server that proxies to `/api/internal/mesh` |
| `node-server/src/agentfleet_node/sessions.py` (modify) | `SessionWorker` implements `RuntimeEvents`; no `claude_agent_sdk` imports except `fork_session` |
| `node-server/src/agentfleet_node/mesh_tools.py` (modify) | shared async tool functions + SDK server built from them |
| `node-server/src/agentfleet_node/models.py`, `api.py`, `app.py`, `party.py` (modify) | fields, routes, wiring, prompt naming |
| `node-server/tests/conftest.py` (modify), `tests/test_codex_runtime.py`, `tests/test_internal_mesh.py`, `tests/test_runtime_api.py` (create) | `FakeCodex` + tests |
| `dashboard/src/api.ts` (modify) | mirror new fields and `setup.codex` |
| `docs/adr/0004-agent-runtime-chosen-at-creation.md`, `docs/GUIDE.md`, `docs/RELEASE.md`, `CLAUDE.md`, `node-server/CLAUDE.md`, `node-server/src/agentfleet_node/CLAUDE.md` (create/modify) | records and docs |

---

### Task 0: Prototype against the real Codex CLI (throwaway)

Throwaway code in the scratchpad, never in the repo. Its deliverable is a "Prototype findings" section appended to
the spec. Prerequisite: Codex signed in on this machine. There's no `codex` on PATH here, so use the bundled
binary from a scratch venv, or ask the owner to install Codex and run `! codex login`.

**Files:**
- Create (scratch only): `$SCRATCH/codex-proto/proto.py`, `$SCRATCH/codex-proto/mcp_echo.py`
- Modify: `docs/superpowers/specs/2026-10-28-codex-runtime-design.md` (append findings)

- [ ] **Step 1:** In a scratch venv, `uv pip install openai-codex==0.163.0`. Record `codex --version` of the bundled
  and (if present) own binary, and whether `codex login status` exists and its exit codes when signed in/out.
- [ ] **Step 2:** `proto.py` starts a thread through the low-level `CodexClient(config, approval_handler=...)` with
  `cwd` = a scratch git repo, approval policy that asks for non-safe commands, a stdio MCP server `mcp_echo.py`
  (one tool `echo`, which sleeps 120 s when asked), and a `mcp_servers` override. Print every notification method
  + item type.
- [ ] **Step 3:** Answer each check and write the exact working keys/values:
  1. A personal MCP server in `~/.codex/config.toml` (add a dummy one temporarily, then remove it) is absent from
     the thread when `mcp_servers` is overridden.
  2. Saved command rules and hooks can be switched off by override (name the keys).
  3. The approval handler fires for `touch x`, `git commit`, `bash -lc "ls; rm y"`, and for a file edit. Record the
     exact `params` shape of `item/commandExecution/requestApproval` and `item/fileChange/requestApproval`.
  4. Which commands run without the handler (`ls`, `cat`?).
  5. Per-turn sandbox override (`turn(..., sandbox=workspace_write)`) works on a `read_only` thread.
  6. The MCP per-tool timeout key, and that 120 s `echo` completes after raising it.
  7. How MCP tool names appear to the model (ask the agent to list its tools).
  8. `steer` mid-turn: one `turn/completed` or two.
  9. A request to escalate outside the sandbox: how it is marked in approval params.
  10. Thread resume after killing the app-server process.
- [ ] **Step 4:** If check 1, 2, 3 (any changing command or file edit misses the handler), or 6 fails: stop, report
  to the owner, do not start Task 1.
- [ ] **Step 5:** Append "## Prototype findings (2026-10-28)" to the spec with the answers, the exact keys, and
  `CODEX_MIN` = the oldest version tested. Commit:

```bash
git add docs/superpowers/specs/2026-10-28-codex-runtime-design.md
git commit -m "docs: Codex runtime prototype findings"
```

---

### Task 1: Extract the runtime strategy; Claude moves behind it (no behaviour change)

**Files:**
- Create: `runtimes/__init__.py`, `runtimes/base.py`, `runtimes/claude.py` (under `node-server/src/agentfleet_node/`)
- Modify: `sessions.py` (`SessionWorker` lines ~141-365, `SessionManager.__init__`)
- Test: existing suite, unchanged

**Interfaces:**
- Produces:
  - `RuntimeContext(agent: Agent, settings: Settings, conv_id: str, mesh_tools: Any, prompt: str, client_factory: Callable)` (dataclass, `runtimes/base.py`). `mesh_tools` is the factory's result for this worker; `prompt` is the formatted mesh prompt plus `agent.system_prompt`.
  - `RuntimeEvents` protocol: `text_delta(text: str)`, `text(text: str)`, `tool_use(tool_id: str, name: str, input: dict)`, `tool_result(tool_id: str, content: Any, is_error: bool)`, `session_id(sid: str)`, `result(text: str, error: str | None, cost_usd: float | None)`, `failed(error: str)`, `rate_limit(info: Any)`, `policy(tool_name: str, tool_input: dict) -> str` (sync `"allow" | "deny" | "ask"`, for Claude's non-blocking `PreToolUse` hook), `async decide(tool_name: str, tool_input: dict) -> tuple[bool, str]` (policy + owner approval on `ask`).
  - `AgentRuntime` protocol: `__init__(ctx: RuntimeContext, events: RuntimeEvents)`, `async start(resume_id: str | None) -> None`, `async send(prompt: str) -> None`, `async interrupt() -> None`, `async close() -> None`, `started: bool` property.
  - `make_runtime(ctx, events) -> AgentRuntime` in `runtimes/__init__.py`, keyed on `ctx.agent.runtime` (attribute is added in Task 2; until then use `getattr(ctx.agent, "runtime", "claude")`).
  - `SessionWorker` implements `RuntimeEvents`. Interrupted state, `_pending`/grace, `TurnResult` and status changes
    stay in the worker. `result(...)` records cost through the existing `_record_usage` logic, which moves to take
    `cost_usd`.

- [ ] **Step 1:** Run `make test` and note the pass count (baseline).
- [ ] **Step 2:** Create the three `runtimes/` files with the interfaces above. Move `_ensure_started`,
  `_read_loop`, `_on_message`'s SDK-type dispatch, `_pre_tool_use`, `_can_use_tool` into `ClaudeRuntime`. Both
  permission paths call `events.decide`; `decide` keeps the worker's `policy_decision(...)` +
  `m.request_approval(...)` behaviour, including deny messages (`"{tool} is not allowed for mesh sessions of {id}."`).
  The hook still returns `permissionDecision` from `events.policy(...)` without waiting (it must not block on the
  owner).
- [ ] **Step 3:** `ClaudeRuntime` takes `ctx.client_factory` (= `SessionManager.client_factory`), so
  `conftest.FakeClaude` keeps working untouched.
- [ ] **Step 4:** Run `make test`. Expected: same pass count as Step 1, no test file edited.
- [ ] **Step 5:** Commit `refactor(node-server): agent runtime strategy; Claude behind AgentRuntime`.

---

### Task 2: Data model, API, Codex detection, dashboard mirror

**Files:**
- Modify: `models.py` (`Agent`, `DEFAULT_ALLOWED_TOOLS` neighbour), `api.py` (`AgentIn`, `upsert_agent`, `_setup_view`, fork route ~461), `runtimes/codex.py` (create with `codex_status` only), `pyproject.toml` (+ `uv.lock`), `dashboard/src/api.ts`
- Test: `node-server/tests/test_runtime_api.py`

**Interfaces:**
- Produces:
  - `Agent.runtime: str = "claude"`, `Agent.runtime_options: dict[str, Any]` (JSON column, default `{}`).
  - `CODEX_DEFAULT_ALLOWED_TOOLS: tuple[str, ...]` in `models.py` (values in Global Constraints).
  - `CODEX_OPTION_DEFAULTS = {"sandbox": "workspace_write", "network": False, "web_search": False}` in `runtimes/codex.py`.
  - `codex_status(run: Callable = subprocess.run, which: Callable = shutil.which, home: Path | None = None) -> dict` returning `installed, path, version, logged_in, auth_mode, compatible, newer_than_tested, binary, sdk_installed, usable` (spec "Detecting Codex"). `CODEX_MIN: str`, `CODEX_PINNED = "0.163.0"`.
  - `codex_bin_for(status: dict) -> str | None` — own path when `binary == "own"`, else `None` (SDK resolves bundled).
  - `/api/setup` → `"codex": codex_status()`.

- [ ] **Step 1: Write the failing tests** in `test_runtime_api.py`:
  - `test_old_db_gets_claude_runtime`: create a DB with the current schema, then reopen it. Assert
    `agent.runtime == "claude"` and `agent.runtime_options == {}`. Follow `test_assignment.py`'s column-migration test.
  - `test_create_codex_agent_requires_usable_codex`: monkeypatch `codex_status` to return `usable=False`.
    `POST /api/agents` with `runtime="codex"` → 422.
  - `test_create_codex_agent_defaults`: with `usable=True` and no `allowed_tools`, the response has `runtime ==
    "codex"`, `allowed_tools == list(CODEX_DEFAULT_ALLOWED_TOOLS)` and `runtime_options == CODEX_OPTION_DEFAULTS`.
  - `test_runtime_cannot_change`: create a Claude agent, then POST the same id with `runtime="codex"` → 422 with
    "runtime can't change". POSTing without `runtime` keeps `"claude"`.
  - `test_unknown_runtime_option_rejected`: `runtime_options={"foo": 1}` → 422.
  - `test_codex_status_variants`, parametrized:
    - not installed → `installed=False, usable=False`.
    - `0.163.0`, signed in → `binary="own", newer_than_tested=False`.
    - `0.170.0` → `binary="own", newer_than_tested=True`.
    - older than `CODEX_MIN` → `binary="bundled"`.
    - auth file present, `codex login status` failing → `logged_in=True` via the fallback.
    - API-key login → `auth_mode="api_key"`.
  - `test_setup_includes_codex`: `GET /api/setup` has a `codex` key.
  - `test_codex_usable_needs_sdk`: signed in but `find_spec` patched to `None` → `sdk_installed=False, usable=False`.
  - `test_installer_adds_codex_extra` (in `test_installer.py`): the rendered `install.sh` contains the Codex detection and installs `"$tmp/$WHEEL[codex]"` on that branch; same for `install.ps1`.
  - `test_codex_setup_route`: `POST /api/codex/setup` with `codex` not found → 409; found → the update runner (patched) is called.
  - `test_fork_codex_conversation_409`: a Codex agent's conversation → `POST /api/conversations/{id}/fork` → 409.
- [ ] **Step 2:** Run `cd node-server && uv run pytest tests/test_runtime_api.py -v`. Expected: FAIL (fields and
  `codex_status` missing).
- [ ] **Step 3:** Implement:
  - `uv add --optional codex openai-codex==0.163.0`; dev sync includes it (`uv sync --extra codex` in the Makefile's test/setup targets) so Task 4's real `SdkCodexSession` import is checkable.
  - Installers: `install.sh` / `install.ps1` add `[codex]` to the wheel spec when `codex` is on PATH or `~/.codex/auth.json` exists; the rendered-template tests in `test_installer.py` get a case for each. `POST /api/codex/setup` re-runs the installer detached with the same mechanism as `service.update` (409 when `codex` isn't found).
  - The model fields.
  - `AgentIn`: `runtime: Literal["claude","codex"] | None = None`, `runtime_options: dict[str, Any] | None = None`,
    and `allowed_tools: list[str] | None = None`. `None` means the runtime's default, so `upsert_agent` can tell
    "not sent" from "sent".
  - The validation in `upsert_agent`.
  - `codex_status`. Parse `codex --version` output `codex-cli X.Y.Z` with `packaging.version`. `auth_mode` comes
    from `codex login status` text or the `auth.json` keys, per the Task 0 findings. 5 s subprocess timeout each.
  - The fork 409.
- [ ] **Step 4:** Mirror in `dashboard/src/api.ts`: the `Agent` type gains `runtime`, `runtime_options`. A new
  `CodexStatus` type goes in the setup type. Add a block comment above `CodexStatus` with the spec's three hint texts
  verbatim, for the front-end team.
- [ ] **Step 5:** Run `make test`, `make build`, `cd dashboard && bun run lint`. Expected: all pass.
- [ ] **Step 6:** Commit `feat(node-server): agent runtime field and Codex detection` (include `api.ts`).

---

### Task 3: Mesh tools as shared functions, internal route, stdio MCP proxy

**Files:**
- Modify: `mesh_tools.py`, `api.py` (new route), `sessions.py` (`SessionManager` token registry)
- Create: `mesh_mcp.py`
- Test: `node-server/tests/test_internal_mesh.py`

**Interfaces:**
- Consumes: `RuntimeEvents.decide` (Task 1).
- Produces:
  - `MeshTools` class in `mesh_tools.py`: `__init__(agent, worker, ...)` with the closures' current dependencies, and `async list_agents(args) -> dict`, `async send_message(args)`, `async share_file(args)`, `async needs_input(args)` returning the existing `_ok`/`_err` shapes. `TOOL_SPECS: dict[str, tuple[str, dict]]` holds the descriptions and JSON schemas. The factory builds the SDK server from `TOOL_SPECS` + `MeshTools`.
  - `SessionManager.register_mesh_token(conv_id: str) -> str`, `revoke_mesh_token(conv_id: str) -> None`, `check_mesh_token(conv_id: str, token: str) -> bool` (`hmac.compare_digest`, in memory).
  - `POST /api/internal/mesh/{conv_id}/{tool}`: header `Authorization: Bearer <token>`. Rejects non-127.0.0.1 clients (403). Checks the token (403) and the tool name (404). Then `policy_decision` → on `deny` `_err`, on `ask` `request_approval`. Runs the `MeshTools` method and returns its dict.
  - `mesh_mcp.py`: `python -m agentfleet_node.mesh_mcp` reads `AGENTFLEET_MESH_URL`, `AGENTFLEET_MESH_TOKEN` and serves `TOOL_SPECS` over stdio MCP, forwarding each call. It uses the `mcp` package, already a transitive dependency of claude-agent-sdk; add it to `pyproject.toml` explicitly. The httpx timeout is `None`, because Codex's tool timeout governs.

- [ ] **Step 1: Write failing tests** in `test_internal_mesh.py` using `node_factory`:
  - `test_internal_mesh_rejects_missing_or_wrong_token` → 403 both.
  - `test_internal_mesh_token_is_per_conversation`: conversation A's token on conversation B's URL → 403.
  - `test_internal_mesh_token_revoked_on_close`: register, revoke, call → 403.
  - `test_internal_mesh_unknown_tool_404`.
  - `test_internal_mesh_send_message_reaches_peer`: two nodes paired via `pair()`, with a token registered for a
    conversation on node A. `send_message` to B's agent returns a reply with `"echo:"`.
  - `test_internal_mesh_contact_policy_ask_creates_approval`: agent with `contact_policy="ask"` → an approval row
    appears, and approving it lets the call finish.
  - `test_internal_mesh_needs_input_sets_worker_flag`.
  - `test_mesh_mcp_lists_tool_specs`: start `mesh_mcp` as a subprocess with an MCP client over stdio. `list_tools`
    names = `{"list_agents","send_message","share_file","needs_input"}`.
- [ ] **Step 2:** Run `uv run pytest tests/test_internal_mesh.py -v`. Expected: FAIL.
- [ ] **Step 3:** Implement per Interfaces. Existing `mesh_tools` behaviour for Claude must not change.
- [ ] **Step 4:** Run `make test`. Expected: all pass (old tests included).
- [ ] **Step 5:** Commit `feat(node-server): mesh tools over a token-protected local route for out-of-process runtimes`.

---

### Task 4: CodexRuntime

**Files:**
- Modify: `runtimes/codex.py`, `runtimes/__init__.py`, `sessions.py` (`SessionManager(..., codex_session_factory=...)`), `app.py` (`build_node`/`create_app` pass-through), `party.py` (tool naming), `tests/conftest.py`
- Test: `node-server/tests/test_codex_runtime.py`

**Interfaces:**
- Consumes: Task 1 protocols, Task 2 `codex_status` / `codex_bin_for` / `CODEX_OPTION_DEFAULTS`, Task 3 `register_mesh_token` + `TOOL_SPECS`.
- Produces:
  - `CodexSession` protocol (the seam faked in tests):
    - `start_thread(params: dict) -> str`
    - `resume_thread(thread_id: str, params: dict) -> str`
    - `start_turn(thread_id: str, text: str, overrides: dict) -> str`
    - `steer(thread_id: str, turn_id: str, text: str) -> None`
    - `interrupt(thread_id: str, turn_id: str) -> None`
    - `next_notification(timeout: float) -> tuple[str, dict] | None`
    - `close() -> None`
    - All of these are sync; the runtime calls them via `asyncio.to_thread`.
    - Constructor: `(codex_bin: str | None, config_overrides: list[str], approval_handler: Callable[[str, dict], dict])`.
  - `SdkCodexSession`: the real implementation over `openai_codex`'s low-level `CodexClient`, using the exact calls from the Task 0 findings.
  - `command_for_policy(argv: list[str] | str) -> str`: unwraps `[sh|bash|zsh, -c|-lc, script]` to `script`; otherwise `shlex.join(argv)`.
  - `codex_tool_name(server: str, tool: str) -> str` → `"mcp__mesh__<tool>"` for the mesh server.
  - `codex_mesh_prompt(text: str) -> str`: replaces `mcp__mesh__<t>` with the name Codex shows (Task 0, check 7). Used in `sessions.MESH_PROMPT` formatting and `party.py`.
  - `SessionManager.__init__(..., codex_session_factory: Callable[..., CodexSession] = SdkCodexSession)`; `create_app(..., codex_session_factory=None)`.
  - `conftest.FakeCodex(CodexSession)`: same prompt words as `FakeClaude`. `TOOL:<cmd>` calls `approval_handler("item/commandExecution/requestApproval", {...})` with Task 0's shape. `EDIT` makes a file-change approval. `SLOW` waits for interrupt. `ASK` calls the mesh `needs_input` route with the registered token. Everything else → agent message `echo: <last line>` and `turn/completed`. `CRASH` makes `next_notification` raise.

- [ ] **Step 1: Write failing tests** in `test_codex_runtime.py`, using nodes with a Codex agent and `FakeCodex`:
  - `test_codex_echo_roundtrip`: a peer message gets `echo:` back; `conversation.session_id` = the fake thread id.
  - `test_codex_allowed_command_runs_without_card`: `TOOL:git status` with the default list → no approval row, and
    the reply says allowed.
  - `test_codex_unlisted_command_asks_owner`: `TOOL:touch x` → approval row. Approving gives an allowed reply.
  - `test_codex_shell_wrapper_chaining_is_not_allowed`: the fake sends argv `["bash","-lc","ls; rm -rf ~"]` → an
    approval row (not auto-allowed) *(Review Focus 1)*.
  - `test_codex_denied_command_declined`: `denied_tools=["Bash(rm*)"]`, `TOOL:rm x` → handler returns a decline;
    no approval row.
  - `test_codex_approval_timeout_declines`: `approval_timeout_s=0.2`, `TOOL:touch x`, no decision → decline and the
    turn ends (no hang) *(Review Focus 2)*.
  - `test_codex_file_edit_allowed_in_accepted_assignment`: `EDIT` in an accepted Assignment → no approval row.
  - `test_codex_read_only_assignment_raises_sandbox`: a `read_only` agent with an accepted Assignment → the fake
    records `start_turn` overrides `{"sandbox": "workspace_write"}`. A plain conversation's turns don't get it.
  - `test_codex_escalation_declined`: the fake approval params ask to leave the sandbox, the policy allows the
    command → still declined with "outside this agent's sandbox".
  - `test_codex_crash_then_resume`: `CRASH` → turn error. The next message makes a new `FakeCodex` with
    `resume_thread` called on the old id *(Review Focus 3)*.
  - `test_codex_inject_mid_turn_steers_once`: `SLOW` turn, owner injects → `steer` called. Interrupting or finishing
    yields exactly one A2A reply *(Review Focus 4)*.
  - `test_codex_config_overrides`: the fake records `config_overrides`, which include the mesh MCP server with
    `AGENTFLEET_MESH_TOKEN`, the user-rules/hooks off keys, the MCP tool timeout ≥ `turn_timeout_s +
    approval_timeout_s`, and `network`/`web_search` from options.
  - `test_codex_usage_limit_error`: the fake sends an `error` with `usageLimitExceeded` → the conversation status is
    `error`, with message "Codex usage limit reached".
  - `test_codex_bin_choice`: `codex_status` with `binary="own"` → the factory gets the own path; with `"bundled"` →
    `None`.
  - `test_command_for_policy` (unit): `["ls","-la"]` → `"ls -la"`; `["bash","-lc","git status"]` → `"git status"`;
    `"echo hi"` → `"echo hi"`.
- [ ] **Step 2:** Run `uv run pytest tests/test_codex_runtime.py -v`. Expected: FAIL.
- [ ] **Step 3:** Implement `CodexRuntime`:
  - `start` builds the thread params from the spec (CodexRuntime, Thread) and Task 0 keys, registers the mesh
    token, and starts the notification pump task.
  - `send` → `start_turn` or `steer`; `interrupt`; `close` revokes the token and closes the session.
  - The event mapping is the spec's table.
  - Approval handler: sync, it calls `asyncio.run_coroutine_threadsafe(events.decide(...), loop).result(timeout=settings.approval_timeout_s + 5)`.
    On a timeout or an exception it returns a decline. Escalation requests are declined before `decide`.
  - `start` calls `codex_status()` fresh to pick the binary (spec edge case 13).
  - Codex never calls `events.rate_limit`; token usage is logged at debug level only.
  - Register `"codex": CodexRuntime` in `RUNTIMES`.
  - Apply `codex_mesh_prompt` in `party.py` when the Host agent's runtime is `codex`.
- [ ] **Step 4:** Run `make test`. Expected: all pass.
- [ ] **Step 5:** Commit `feat(node-server): Codex runtime behind AgentRuntime`.

---

### Task 5: Real-stack smoke, ADR and docs

**Files:**
- Create: `docs/adr/0004-agent-runtime-chosen-at-creation.md`
- Modify: `docs/GUIDE.md` (staff section "Agents on Codex"), `docs/RELEASE.md` (bump the `openai-codex` pin + Codex
  smoke), `CLAUDE.md` (cross-cutting contract: runtime chosen at creation; Codex mesh tools via
  `/api/internal/mesh`), `node-server/CLAUDE.md` (Codex gotchas from Task 0), `node-server/src/agentfleet_node/CLAUDE.md`
  (request path through `AgentRuntime`; invariant: both runtimes call `policy_decision`; the sandbox is a hard limit),
  `node-server/tests/CLAUDE.md` (`FakeCodex` table)

- [ ] **Step 1:** Run the real-stack smoke from `node-server/CLAUDE.md` with node A holding a Claude agent
  (`claude-haiku-5-5`, `setting_sources=[]`) and node B a Codex agent (cheapest Codex model). Check:
  - a message each way;
  - an approval card on B for `touch x`, approved;
  - a denied command declined;
  - B with `contact_policy="ask"` messaging A → card;
  - an interrupt;
  - an owner inject mid-turn;
  - a `read_only` B agent accepting an Assignment and editing a file.

  Record the results in the ADR's Consequences.
- [ ] **Step 2:** Write ADR 0004 in the house style (title = the decision; sections: context, "Why not switchable",
  Consequences). Then the doc edits listed above.
- [ ] **Step 3:** `make test`, `make build`, `cd dashboard && bun run lint`. Expected: all pass.
- [ ] **Step 4:** Commit `docs: ADR 0004 agent runtime chosen at creation; Codex guide and release step`.

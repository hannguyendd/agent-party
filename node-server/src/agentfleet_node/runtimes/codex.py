"""Codex runtime: the host's Codex (detection) and `CodexRuntime`, which drives `codex app-server` through the
openai-codex SDK (optional extra "codex"; imported only when a Codex session starts).

Findings this relies on (prototype, Codex 0.163.0; spec "Prototype findings"): with approvalPolicy "untrusted" every
command, file edit and MCP tool call asks first; `-c` overrides merge with ~/.codex, so personal MCP servers are
disabled one by one; the SDK's default approval handler accepts everything, so ours is always set.
"""

import asyncio
import importlib.util
import json
import logging
import queue
import re
import shlex
import shutil
import subprocess
import sys
import threading
import tomllib
from collections.abc import Callable
from pathlib import Path
from typing import Any, Protocol

from packaging.version import InvalidVersion, Version

from agentfleet_node.runtimes.base import RuntimeContext, RuntimeEvents

log = logging.getLogger(__name__)

# The openai-codex SDK pin (pyproject extra "codex"); its bundled CLI has the same version.
CODEX_PINNED = "0.163.0"
# Oldest own `codex` the node runs; older ones fall back to the bundled CLI. Raised from the prototype's findings.
CODEX_MIN = "0.163.0"
CODEX_OPTION_DEFAULTS: dict[str, Any] = {"sandbox": "workspace_write", "network": False, "web_search": False}
SANDBOXES = ("read_only", "workspace_write")
_TIMEOUT_S = 5


def runtime_options(given: dict[str, Any] | None) -> dict[str, Any]:
    """Codex options with defaults filled in. ValueError on an unknown key or a bad value."""
    given = given or {}
    unknown = set(given) - set(CODEX_OPTION_DEFAULTS)
    if unknown:
        raise ValueError(f"unknown runtime option(s): {', '.join(sorted(unknown))}")
    out = {**CODEX_OPTION_DEFAULTS, **given}
    if out["sandbox"] not in SANDBOXES:
        raise ValueError(f"sandbox must be one of {', '.join(SANDBOXES)}")
    for key in ("network", "web_search"):
        if not isinstance(out[key], bool):
            raise ValueError(f"{key} must be true or false")
    return out


def _version(text: str) -> str | None:
    for word in text.split():
        try:
            return str(Version(word))
        except InvalidVersion:
            continue
    return None


def _call(run: Callable, cmd: list[str]) -> subprocess.CompletedProcess | None:
    try:
        return run(cmd, capture_output=True, text=True, timeout=_TIMEOUT_S)
    except (OSError, subprocess.SubprocessError):
        return None


def codex_status(run: Callable | None = subprocess.run, which: Callable = shutil.which, home: Path | None = None,
                 find_spec: Callable = importlib.util.find_spec) -> dict[str, Any]:
    """Is Codex on this host, signed in, and which binary would agents use? Read fresh each call (a few
    subprocesses); `/api/setup` and session start use it."""
    home = home or Path.home()
    path = which("codex") or ""
    auth: dict[str, Any] = {}
    try:
        auth = json.loads((home / ".codex" / "auth.json").read_text())
    except (OSError, ValueError):
        pass
    version = logged_in = None
    auth_mode = ""
    if path and run is not None:
        res = _call(run, [path, "--version"])
        version = _version(res.stdout) if res and res.returncode == 0 else None
        res = _call(run, [path, "login", "status"])
        if res is not None:
            text = (res.stdout or "") + (res.stderr or "")
            logged_in = res.returncode == 0 and "Logged in" in text
            if logged_in:
                auth_mode = "chatgpt" if "ChatGPT" in text else "api_key" if "API key" in text else "other"
    if not logged_in and auth:  # no own binary, or `login status` failed: read the auth file Codex writes
        logged_in = "tokens" in auth or bool(auth.get("OPENAI_API_KEY"))
        auth_mode = auth_mode or ("api_key" if auth.get("auth_mode") == "api_key" or auth.get("OPENAI_API_KEY") else "chatgpt")
    compatible = bool(version) and Version(version) >= Version(CODEX_MIN)
    sdk_installed = find_spec("openai_codex") is not None
    return {
        "installed": bool(path) or bool(auth),
        "path": path,
        "version": version,
        "logged_in": bool(logged_in),
        "auth_mode": auth_mode if logged_in else "",
        "compatible": compatible,
        "newer_than_tested": compatible and Version(version) > Version(CODEX_PINNED),
        # Never the bundled CLI when the own one is newer: an older Codex must not read a newer ~/.codex.
        "binary": "own" if compatible else "bundled",
        "sdk_installed": sdk_installed,
        "usable": bool(logged_in) and sdk_installed,
    }


def codex_bin_for(status: dict[str, Any]) -> str | None:
    """The binary for the SDK: the host's own, or None (the SDK starts its bundled CLI)."""
    return status["path"] if status.get("binary") == "own" and status.get("path") else None


# session runtime

_SHELLS = {"sh", "bash", "zsh"}
_BARE_KEY = re.compile(r"^[A-Za-z0-9_-]+$")
# Codex error codes (codexErrorInfo) that get a plain message in the Office.
_ERRORS = {"usageLimitExceeded": "Codex usage limit reached", "unauthorized": "Codex not signed in"}
_DECLINE = {"decision": "decline"}


def command_for_policy(command: list[str] | str) -> str:
    """The script the policy sees: Codex runs `/bin/zsh -lc '<script>'`, so a `Bash(ls*)` rule must match the
    script inside (and the chaining guard must see its `;`), not the wrapper."""
    try:
        argv = shlex.split(command) if isinstance(command, str) else list(command)
    except ValueError:  # unbalanced quotes: let the policy see the raw text
        return str(command)
    if len(argv) == 3 and Path(argv[0]).name in _SHELLS and argv[1] in ("-c", "-lc"):
        return argv[2]
    return command if isinstance(command, str) else shlex.join(argv)


def _toml_key(name: str) -> str:
    return name if _BARE_KEY.match(name) else json.dumps(name)


def personal_mcp_servers(home: Path | None = None, working_dir: str | None = None) -> list[str]:
    """MCP servers from the user's (and the project's) Codex config: mesh agents turn each one off, since `-c`
    overrides merge with ~/.codex and can't clear the table."""
    names: list[str] = []
    paths = [(home or Path.home()) / ".codex" / "config.toml"]
    if working_dir:
        paths.append(Path(working_dir) / ".codex" / "config.toml")
    for path in paths:
        try:
            servers = tomllib.loads(path.read_text()).get("mcp_servers", {})
        except (OSError, tomllib.TOMLDecodeError):
            continue
        names += [n for n in servers if n != "mesh" and n not in names]
    return names


class CodexSession(Protocol):
    """One `codex app-server` process (sync; CodexRuntime calls it through asyncio.to_thread)."""

    def start_thread(self, params: dict[str, Any]) -> str: ...

    def resume_thread(self, thread_id: str, params: dict[str, Any]) -> str: ...

    def start_turn(self, thread_id: str, text: str, overrides: dict[str, Any]) -> str: ...

    def steer(self, thread_id: str, turn_id: str, text: str) -> None: ...

    def interrupt(self, thread_id: str, turn_id: str) -> None: ...

    def next_notification(self, timeout: float) -> tuple[str, dict[str, Any]] | None:
        """The next notification as (method, params), None after `timeout`; raises once the process is gone."""

    def close(self) -> None: ...


class SdkCodexSession:
    """CodexSession over the SDK's low-level CodexClient. Its single reader thread calls the approval handler and
    routes notifications into per-turn and global queues; forwarder threads merge them into one queue."""

    def __init__(self, codex_bin: str | None, config_overrides: list[str], approval_handler: Callable, cwd: str | None = None):
        from openai_codex.client import CodexClient, CodexConfig

        self._client = CodexClient(CodexConfig(codex_bin=codex_bin, config_overrides=tuple(config_overrides), cwd=cwd),
                                   approval_handler=approval_handler)
        self._queue: queue.Queue = queue.Queue()
        self._client.start()
        self._client.initialize()
        threading.Thread(target=self._forward, args=(self._client.next_notification, None), daemon=True).start()

    @staticmethod
    def _params(payload: Any) -> dict[str, Any]:
        return payload.model_dump(mode="json", by_alias=True) if hasattr(payload, "model_dump") else dict(payload or {})

    def _forward(self, next_note: Callable, turn_id: str | None) -> None:
        while True:
            try:
                n = next_note()
            except Exception as e:  # the process is gone, or the client closed
                self._queue.put(e)
                return
            self._queue.put((n.method, self._params(n.payload)))
            if turn_id and n.method == "turn/completed":
                self._client.unregister_turn_notifications(turn_id)
                return

    def start_thread(self, params):
        return self._client.thread_start(params).thread.id

    def resume_thread(self, thread_id, params):
        return self._client.thread_resume(thread_id, params).thread.id

    def start_turn(self, thread_id, text, overrides):
        turn_id = self._client.turn_start(thread_id, text, overrides).turn.id
        threading.Thread(target=self._forward, args=(lambda: self._client.next_turn_notification(turn_id), turn_id),
                         daemon=True).start()
        return turn_id

    def steer(self, thread_id, turn_id, text):
        self._client.turn_steer(thread_id, turn_id, text)

    def interrupt(self, thread_id, turn_id):
        self._client.turn_interrupt(thread_id, turn_id)

    def next_notification(self, timeout):
        try:
            item = self._queue.get(timeout=timeout)
        except queue.Empty:
            return None
        if isinstance(item, BaseException):
            raise item
        return item

    def close(self):
        self._client.close()


class CodexRuntime:
    """AgentRuntime over a CodexSession: one app-server process and one thread per conversation."""

    folds_injects = True  # turn/steer joins the running turn: still one turn/completed

    def __init__(self, ctx: RuntimeContext, events: RuntimeEvents):
        self.ctx = ctx
        self.events = events
        self.session: CodexSession | None = None
        self.thread_id: str | None = None
        self.turn_id: str | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._last_text = ""
        self._last_error: dict[str, Any] | None = None
        # fileChange item id -> paths. Approvals carry only the item id and arrive on the SDK's reader thread, often
        # before the loop has handled the item's own notification: they wait on this condition for it.
        self._files: dict[str, list[str]] = {}
        self._files_seen = threading.Condition()

    @property
    def started(self) -> bool:
        return self.session is not None

    @property
    def options(self) -> dict[str, Any]:
        return runtime_options(self.ctx.agent.runtime_options)

    def config_overrides(self, token: str) -> list[str]:
        s = self.ctx.settings
        url = f"http://127.0.0.1:{s.port}/api/internal/mesh/{self.ctx.conv_id}"
        env = f"{{AGENTFLEET_MESH_URL={json.dumps(url)},AGENTFLEET_MESH_TOKEN={json.dumps(token)}}}"
        out = [
            f"mcp_servers.mesh.command={json.dumps(sys.executable)}",
            'mcp_servers.mesh.args=["-m","agentfleet_node.mesh_mcp"]',
            f"mcp_servers.mesh.env={env}",
            # send_message waits for a whole peer turn, owner approvals included.
            f"mcp_servers.mesh.tool_timeout_sec={int(s.turn_timeout_s + s.approval_timeout_s + 5)}",
            "features.apps=false",
            "features.hooks=false",
            f'web_search="{"live" if self.options["web_search"] else "disabled"}"',
        ]
        out += [f"mcp_servers.{_toml_key(n)}.enabled=false" for n in personal_mcp_servers(working_dir=self.ctx.agent.working_dir)]
        return out

    def _sandbox_policy(self) -> dict[str, Any]:
        """Per turn: an accepted Assignment raises read_only to workspace_write in that conversation only."""
        opts = self.options
        write = opts["sandbox"] == "workspace_write" or self.ctx.accepted()
        return {"type": "workspaceWrite" if write else "readOnly", "networkAccess": opts["network"]}

    async def start(self, resume_id: str | None) -> None:
        if self.session is not None:
            return
        self._loop = asyncio.get_running_loop()
        status = await asyncio.to_thread(codex_status)  # fresh: the host's Codex may have changed (edge case 13)
        token = self.ctx.manager.register_mesh_token(self.ctx.conv_id)
        agent = self.ctx.agent
        try:
            self.session = await asyncio.to_thread(self.ctx.manager.codex_session_factory, codex_bin_for(status),
                                                   self.config_overrides(token), self._approve, agent.working_dir)
            params: dict[str, Any] = {
                "cwd": agent.working_dir,
                "developerInstructions": self.ctx.prompt,
                "approvalPolicy": "untrusted",  # every command, edit and MCP call asks (prototype check 3)
                "approvalsReviewer": "user",
                "sandbox": "workspace-write" if self.options["sandbox"] == "workspace_write" else "read-only",
            }
            if agent.model:
                params["model"] = agent.model
            if resume_id:
                self.thread_id = await asyncio.to_thread(self.session.resume_thread, resume_id, params)
            else:
                self.thread_id = await asyncio.to_thread(self.session.start_thread, params)
        except Exception:
            await self.close()
            raise
        self.events.session_id(self.thread_id)
        # Its own thread, not asyncio.to_thread: polling through the default executor would hold one of its few
        # threads per conversation for as long as the session lives.
        threading.Thread(target=self._reader, args=(self.session,), name=f"codex-reader-{self.ctx.conv_id}",
                         daemon=True).start()

    async def send(self, prompt: str) -> None:
        assert self.session is not None and self.thread_id is not None
        if self.turn_id:  # mid-turn: Codex folds it into the running turn (one turn/completed)
            await asyncio.to_thread(self.session.steer, self.thread_id, self.turn_id, prompt)
            return
        self._last_text, self._last_error = "", None
        self.turn_id = await asyncio.to_thread(self.session.start_turn, self.thread_id, prompt,
                                               {"sandboxPolicy": self._sandbox_policy()})

    async def interrupt(self) -> None:
        if self.session is not None and self.thread_id and self.turn_id:
            await asyncio.to_thread(self.session.interrupt, self.thread_id, self.turn_id)

    async def close(self) -> None:
        self.ctx.manager.revoke_mesh_token(self.ctx.conv_id)
        session, self.session, self.turn_id = self.session, None, None
        if session is not None:
            try:
                await asyncio.to_thread(session.close)
            except Exception:
                log.debug("codex close failed", exc_info=True)

    # notifications

    def _reader(self, session: CodexSession) -> None:
        """Reader thread: hands each notification to the event loop until this session is closed or replaced."""
        assert self._loop is not None
        try:
            while self.session is session:
                try:
                    note = session.next_notification(0.5)
                except Exception as e:  # app-server died or protocol error
                    self._loop.call_soon_threadsafe(self._session_failed, session, e)
                    return
                if note is not None:
                    method, data = note
                    if method == "item/started" and (data.get("item") or {}).get("type") == "fileChange":
                        self._remember_files(data["item"])
                    self._loop.call_soon_threadsafe(self._on_notification, method, data)
        except RuntimeError:  # the event loop closed under us (node shutting down)
            return

    def _session_failed(self, session: CodexSession, error: Exception) -> None:
        if self.session is not session:
            return  # closed or replaced already
        log.error("codex session failed for %s: %s", self.ctx.conv_id, error)
        self.session, self.turn_id = None, None
        self.ctx.manager.revoke_mesh_token(self.ctx.conv_id)
        self.events.failed(str(error) or "Codex stopped")

    def _remember_files(self, item: dict[str, Any]) -> None:
        with self._files_seen:
            self._files[item["id"]] = [c.get("path", "") for c in item.get("changes") or []]
            self._files_seen.notify_all()

    def _on_notification(self, method: str, data: dict[str, Any]) -> None:
        ev = self.events
        if method == "item/agentMessage/delta":
            ev.text_delta(data.get("delta", ""))
            return
        if method.endswith("/delta") or method.endswith("outputDelta"):
            return
        ev.activity()
        item = data.get("item") or {}
        kind = item.get("type")
        if method == "item/started":
            if kind == "commandExecution":
                ev.tool_use(item["id"], "Bash", {"command": command_for_policy(item.get("command", ""))})
            elif kind == "fileChange":
                self._remember_files(item)
                ev.tool_use(item["id"], "Edit", {"files": self._files[item["id"]]})
            elif kind == "mcpToolCall":
                ev.tool_use(item["id"], f"mcp__{item.get('server')}__{item.get('tool')}", item.get("arguments") or {})
        elif method == "item/completed":
            if kind == "agentMessage" and (item.get("text") or "").strip():
                self._last_text = item["text"]
                ev.text(item["text"])
            elif kind == "commandExecution":
                failed = item.get("status") != "completed" or item.get("exitCode") not in (0, None)
                ev.tool_result(item["id"], item.get("aggregatedOutput") or f"{item.get('status')} (exit {item.get('exitCode')})", failed)
            elif kind == "fileChange":
                paths = [c.get("path", "") for c in item.get("changes") or []]
                ev.tool_result(item["id"], f"{item.get('status')}: {', '.join(paths)}", item.get("status") != "completed")
            elif kind == "mcpToolCall":
                result = item.get("result") or {}
                text = " ".join(c.get("text", "") for c in result.get("content") or []) or json.dumps(item.get("error"))
                ev.tool_result(item["id"], text, item.get("status") != "completed")
        elif method == "error":
            self._last_error = data.get("error") or {}
        elif method == "thread/tokenUsage/updated":
            log.debug("codex tokens for %s: %s", self.ctx.conv_id, (data.get("tokenUsage") or {}).get("total"))
        elif method == "turn/completed":
            turn = data.get("turn") or {}
            self.turn_id = None
            error = None
            if turn.get("status") == "failed":
                info = turn.get("error") or self._last_error or {}
                code = info.get("codexErrorInfo")
                error = _ERRORS.get(code if isinstance(code, str) else "", info.get("message") or "Codex turn failed")
            ev.result(self._last_text, error, None)  # a subscription reports no dollar cost

    # approvals: called on the SDK's reader thread, never on the event loop

    def _decide(self, tool_name: str, tool_input: dict[str, Any]) -> bool:
        assert self._loop is not None
        fut = asyncio.run_coroutine_threadsafe(self.events.decide(tool_name, tool_input), self._loop)
        try:
            allowed, _ = fut.result(timeout=self.ctx.settings.approval_timeout_s + 5)
        except Exception:
            fut.cancel()
            return False
        return allowed

    def _approve(self, method: str, params: dict[str, Any] | None) -> dict[str, Any]:
        """Never answers acceptWithExecpolicyAmendment: that would save an allow rule into ~/.codex/rules."""
        p = params or {}
        try:
            if method == "item/commandExecution/requestApproval":
                if p.get("additionalPermissions") or p.get("networkApprovalContext"):
                    log.info("declined a request to leave the sandbox in %s", self.ctx.conv_id)
                    return _DECLINE  # outside this agent's sandbox
                ok = self._decide("Bash", {"command": command_for_policy(p.get("command") or "")})
                return {"decision": "accept" if ok else "decline"}
            if method == "item/fileChange/requestApproval":
                if p.get("grantRoot"):
                    return _DECLINE
                item_id = p.get("itemId", "")
                with self._files_seen:  # the item's own notification is already queued: show its paths on the card
                    self._files_seen.wait_for(lambda: item_id in self._files, timeout=2)
                ok = self._decide("Edit", {"files": self._files.get(item_id, [])})
                return {"decision": "accept" if ok else "decline"}
            if method == "mcpServer/elicitation/request":
                meta = p.get("_meta") or {}
                # The node's /api/internal/mesh route applies the agent's policy to every mesh call.
                if p.get("serverName") == "mesh" and meta.get("codex_approval_kind") == "mcp_tool_call":
                    return {"action": "accept", "content": {}}
                return {"action": "decline"}
        except Exception:
            log.exception("codex approval failed in %s", self.ctx.conv_id)
        return _DECLINE if method.endswith("requestApproval") else {}

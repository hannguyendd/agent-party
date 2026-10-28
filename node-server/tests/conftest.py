import asyncio
import queue
import re
import shlex
import socket
import threading
import uuid

import httpx

import pytest
import uvicorn
from claude_agent_sdk import (
    AssistantMessage,
    PermissionResultAllow,
    ResultMessage,
    SystemMessage,
    TextBlock,
    ToolPermissionContext,
    ToolUseBlock,
)

from agentfleet_node.app import create_app
from agentfleet_node.config import Settings


class FakeClaude:
    """Stands in for ClaudeSDKClient. Behaviour is driven by the prompt:
    - contains "ASK": calls the in-process needs_input flag, replies with a question
    - contains "TOOL:<name>": asks permission for that tool first
    - contains "SLOW": waits until interrupted
    - otherwise echoes the last line of the prompt
    """

    instances: list["FakeClaude"] = []

    def __init__(self, options):
        self.options = options
        self.session_id = options.resume or uuid.uuid4().hex
        self.queue: asyncio.Queue = asyncio.Queue()
        self.prompts: list[str] = []
        self._interrupt = asyncio.Event()
        FakeClaude.instances.append(self)

    async def connect(self):
        await self.queue.put(SystemMessage("init", {"session_id": self.session_id}))

    async def disconnect(self):
        pass

    async def interrupt(self):
        self._interrupt.set()

    async def query(self, prompt):
        self.prompts.append(prompt)
        asyncio.create_task(self._respond(prompt))

    async def _respond(self, prompt: str):
        self._interrupt.clear()
        if "TOOL:" in prompt:
            name = prompt.split("TOOL:", 1)[1].split()[0]
            await self.queue.put(AssistantMessage([ToolUseBlock("t1", name, {"command": "make build"})], model="fake"))
            res = await self.options.can_use_tool(name, {"command": "make build"}, ToolPermissionContext())
            verdict = "allowed" if isinstance(res, PermissionResultAllow) else f"denied: {res.message}"
            await self._result(f"tool {name} {verdict}")
            return
        if "SLOW" in prompt:
            await self._interrupt.wait()
            await self._result("", is_error=True, subtype="error_during_execution")
            return
        if "ASK" in prompt:
            # The real agent would call mcp__mesh__needs_input; reach the worker through the tool server's owner.
            for w in self.options._workers:
                w.needs_input = True
            await self._result("What is your name?")
            return
        last = prompt.strip().splitlines()[-2 if prompt.strip().endswith("</mesh_message>") else -1]
        await self.queue.put(AssistantMessage([TextBlock(f"echo: {last}")], model="fake"))
        await self._result(f"echo: {last}")

    async def _result(self, text, is_error=False, subtype="success"):
        await self.queue.put(ResultMessage(subtype, 1, 1, is_error, 1, self.session_id, result=text))

    async def receive_messages(self):
        while True:
            yield await self.queue.get()


class FakeCodex:
    """Stands in for runtimes.codex.SdkCodexSession (the CodexSession seam). Behaviour is driven by the prompt like
    FakeClaude; approvals go through the runtime's real approval handler, called from a worker thread the way the SDK
    calls it from its reader thread:
    - "TOOL:<command>": a command approval for `/bin/zsh -lc '<command>'` (add "ESCALATE" to ask to leave the sandbox)
    - "EDIT": a file-change approval for notes.md
    - "SLOW": waits for an interrupt (turn interrupted) or a steer (replies "steered: <text>")
    - "ASK": calls the mesh needs_input tool through the node's local route, then asks a question
    - "CRASH": next_notification raises (the app-server died)
    - "USAGE": the turn fails with Codex's usage-limit error
    - otherwise: replies "echo: <last line>"
    """

    instances: list["FakeCodex"] = []

    def __init__(self, codex_bin, config_overrides, approval_handler, cwd=None):
        self.codex_bin = codex_bin
        self.config_overrides = list(config_overrides)
        self.handler = approval_handler
        self.cwd = cwd
        self.queue: queue.Queue = queue.Queue()
        self.thread_params: dict | None = None
        self.resumed: list[str] = []
        self.turns: list[tuple[str, dict]] = []
        self.steers: list[str] = []
        self.closed = False
        self._wake = threading.Event()
        self._steered: str | None = None
        FakeCodex.instances.append(self)

    def start_thread(self, params):
        self.thread_params = params
        return f"thread-{uuid.uuid4().hex[:8]}"

    def resume_thread(self, thread_id, params):
        self.thread_params = params
        self.resumed.append(thread_id)
        return thread_id

    def start_turn(self, thread_id, text, overrides):
        turn_id = f"turn-{len(self.turns) + 1}"
        self.turns.append((text, overrides))
        self._wake.clear()
        threading.Thread(target=self._respond, args=(thread_id, turn_id, text), daemon=True).start()
        return turn_id

    def steer(self, thread_id, turn_id, text):
        self.steers.append(text)
        self._steered = text
        self._wake.set()

    def interrupt(self, thread_id, turn_id):
        self._wake.set()

    def next_notification(self, timeout):
        try:
            item = self.queue.get(timeout=timeout)
        except queue.Empty:
            return None
        if item == "CRASH":
            raise RuntimeError("codex app-server exited")
        return item

    def close(self):
        self.closed = True

    def _put(self, method, **data):
        self.queue.put((method, data))

    def _done(self, thread_id, turn_id, text, status="completed", error=None):
        if text:
            self._put("item/completed", item={"type": "agentMessage", "id": f"msg-{turn_id}", "phase": "final_answer", "text": text})
        self._put("turn/completed", threadId=thread_id, turn={"id": turn_id, "status": status, "error": error})

    def mesh_env(self) -> dict[str, str]:
        joined = " ".join(self.config_overrides)
        return dict(re.findall(r'(AGENTFLEET_MESH_(?:URL|TOKEN))="([^"]*)"', joined))

    def _respond(self, thread_id, turn_id, text):
        self._put("turn/started", threadId=thread_id, turn={"id": turn_id, "status": "inProgress"})
        if "CRASH" in text:
            self.queue.put("CRASH")
            return
        if "TOOL:" in text:
            cmd = text.split("TOOL:", 1)[1].splitlines()[0].strip()
            item_id = f"exec-{turn_id}"
            self._put("item/started", item={"type": "commandExecution", "id": item_id, "command": f"/bin/zsh -lc {shlex.quote(cmd)}"})
            params = {"itemId": item_id, "command": f"/bin/zsh -lc {shlex.quote(cmd)}", "commandActions": [{"type": "unknown", "command": cmd}],
                      "availableDecisions": ["accept", {"acceptWithExecpolicyAmendment": {"execpolicy_amendment": cmd.split()}}, "cancel"]}
            if "ESCALATE" in text:
                params["additionalPermissions"] = {"fileSystem": {"write": ["/"]}}
            res = self.handler("item/commandExecution/requestApproval", params)
            ok = res.get("decision") == "accept"
            self._put("item/completed", item={"type": "commandExecution", "id": item_id, "status": "completed" if ok else "declined",
                                              "exitCode": 0 if ok else None, "aggregatedOutput": "ok" if ok else None})
            self._done(thread_id, turn_id, f"tool {cmd} {'allowed' if ok else 'denied'}")
            return
        if "EDIT" in text:
            item_id = f"edit-{turn_id}"
            self._put("item/started", item={"type": "fileChange", "id": item_id, "changes": [{"path": "notes.md", "kind": {"type": "update"}}]})
            res = self.handler("item/fileChange/requestApproval", {"itemId": item_id})
            ok = res.get("decision") == "accept"
            self._put("item/completed", item={"type": "fileChange", "id": item_id, "status": "completed" if ok else "declined",
                                              "changes": [{"path": "notes.md", "kind": {"type": "update"}}]})
            self._done(thread_id, turn_id, f"edit {'allowed' if ok else 'denied'}")
            return
        if "SLOW" in text:
            self._wake.wait(30)
            if self._steered is not None:
                self._done(thread_id, turn_id, f"steered: {self._steered}")
            else:
                self._done(thread_id, turn_id, "", status="interrupted")
            return
        if "ASK" in text:
            env = self.mesh_env()
            r = httpx.post(f"{env['AGENTFLEET_MESH_URL']}/needs_input", json={"question": "name?"},
                           headers={"Authorization": f"Bearer {env['AGENTFLEET_MESH_TOKEN']}"}, timeout=10)
            r.raise_for_status()
            self._done(thread_id, turn_id, "What is your name?")
            return
        if "USAGE" in text:
            error = {"message": "You've hit your usage limit.", "codexErrorInfo": "usageLimitExceeded"}
            self._put("error", error=error, willRetry=False, threadId=thread_id, turnId=turn_id)
            self._done(thread_id, turn_id, "", status="failed", error=error)
            return
        last = text.strip().splitlines()[-2 if text.strip().endswith("</mesh_message>") else -1]
        self._put("item/agentMessage/delta", itemId=f"msg-{turn_id}", delta="echo")
        self._done(thread_id, turn_id, f"echo: {last}")


def make_factory(manager_ref: dict):
    def factory(options):
        # Let FakeClaude find the worker that owns it (for the needs_input simulation).
        options._workers = [w for w in manager_ref["m"]._workers.values() if w.client is None and w._turn_lock.locked()]
        return FakeClaude(options)

    return factory


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class RunningNode:
    def __init__(self, owner: str, tmp_path, static_peers=None, **overrides):
        self.port = free_port()
        self.workdir = tmp_path / f"{owner}-work"
        self.workdir.mkdir()
        self.settings = Settings(
            owner=owner,
            port=self.port,
            data_dir=tmp_path / f"{owner}-data",
            mesh_node_config_path=tmp_path / f"{owner}-data" / "agentmesh-node.yaml",
            mesh_node_url="http://127.0.0.1:1",  # no agentmesh-node in tests
            static_peers=static_peers or {},
            **overrides,
        )
        ref: dict = {}
        self.app = create_app(self.settings, client_factory=make_factory(ref), codex_session_factory=FakeCodex)
        self.node = self.app.state.node
        ref["m"] = self.node.sessions
        self.url = f"http://127.0.0.1:{self.port}"

    async def __aenter__(self):
        self.server = uvicorn.Server(uvicorn.Config(self.app, host="127.0.0.1", port=self.port, log_level="warning"))
        self.task = asyncio.create_task(self.server.serve())
        while not self.server.started:
            await asyncio.sleep(0.05)
        return self

    async def __aexit__(self, *exc):
        self.server.should_exit = True
        await self.task


@pytest.fixture
def node_factory(tmp_path):
    def make(owner, **kw):
        return RunningNode(owner, tmp_path, **kw)

    return make


@pytest.fixture(autouse=True)
def no_real_titles(monkeypatch):
    """Conversation titles would call the real model: tests get a predictable fake instead."""

    async def fake_title(settings, text):
        return "Title: " + text.strip().splitlines()[0][:30]

    monkeypatch.setattr("agentfleet_node.titles.make_title", fake_title)

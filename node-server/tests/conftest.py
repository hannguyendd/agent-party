import asyncio
import socket
import uuid

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
    - contains "AUTHFAIL": the turn fails like an expired Claude login
    - contains "PEER:<agent id> <text>": calls the mesh send_message tool, then reports the reply
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
        if "PEER:" in prompt:
            to, text = prompt.split("PEER:", 1)[1].strip().split(None, 1)
            send = self.options.mcp_servers["mesh"]["tools"]["send_message"]  # recorded by keep_mesh_tools
            out = (await send.handler({"to": to, "text": text}))["content"][0]["text"]
            await self.queue.put(AssistantMessage([TextBlock(f"peer said: {out}")], model="fake"))
            await self._result(f"peer said: {out}")
            return
        if "TOOL:" in prompt:
            name = prompt.split("TOOL:", 1)[1].split()[0]
            await self.queue.put(AssistantMessage([ToolUseBlock("t1", name, {"command": "make build"})], model="fake"))
            res = await self.options.can_use_tool(name, {"command": "make build"}, ToolPermissionContext())
            verdict = "allowed" if isinstance(res, PermissionResultAllow) else f"denied: {res.message}"
            await self._result(f"tool {name} {verdict}")
            return
        if "AUTHFAIL" in prompt:
            await self._result("Failed to authenticate: OAuth session expired and could not be refreshed", is_error=True)
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
        self.app = create_app(self.settings, client_factory=make_factory(ref))
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
def keep_mesh_tools(monkeypatch):
    """Keep each mesh tool server's tools by name, so FakeClaude can call them like the CLI would."""
    import agentfleet_node.mesh_tools as mt

    real = mt.create_sdk_mcp_server

    def create(name, version="1.0.0", tools=None):
        return {**real(name, version=version, tools=tools), "tools": {t.name: t for t in tools or []}}

    monkeypatch.setattr(mt, "create_sdk_mcp_server", create)


@pytest.fixture(autouse=True)
def no_real_titles(monkeypatch):
    """Conversation titles would call the real model: tests get a predictable fake instead."""

    async def fake_title(settings, text):
        return "Title: " + text.strip().splitlines()[0][:30]

    monkeypatch.setattr("agentfleet_node.titles.make_title", fake_title)

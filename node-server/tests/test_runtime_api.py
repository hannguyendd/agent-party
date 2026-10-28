"""Agent runtime field, Codex detection and the Codex setup route (spec: 2026-10-28-codex-runtime-design.md)."""

import json
import sqlite3
import subprocess

import httpx
import pytest

from agentfleet_node.db import make_engine
from agentfleet_node.models import CODEX_DEFAULT_ALLOWED_TOOLS, Direction
from agentfleet_node.runtimes.codex import CODEX_OPTION_DEFAULTS, codex_bin_for, codex_status

USABLE = {"installed": True, "path": "/usr/local/bin/codex", "version": "0.163.0", "logged_in": True, "auth_mode": "chatgpt",
          "compatible": True, "newer_than_tested": False, "binary": "own", "sdk_installed": True, "usable": True}


def codex_here(monkeypatch, **changes):
    monkeypatch.setattr("agentfleet_node.api.codex_status", lambda: {**USABLE, **changes})


async def post_agent(node, agent_id, **extra):
    async with httpx.AsyncClient(base_url=node.url) as c:
        return await c.post("/api/agents", json={"id": agent_id, "name": agent_id, "working_dir": str(node.workdir), **extra})


def test_old_db_gets_claude_runtime(tmp_path):
    db = tmp_path / "node.db"
    con = sqlite3.connect(db)
    con.execute("CREATE TABLE agents (id VARCHAR PRIMARY KEY, name VARCHAR, description VARCHAR, skills JSON, working_dir VARCHAR,"
                " setting_sources JSON, allowed_tools JSON, denied_tools JSON, system_prompt VARCHAR, model VARCHAR,"
                " contact_policy VARCHAR, enabled BOOLEAN, created_at DATETIME)")
    con.execute("INSERT INTO agents (id, name, working_dir) VALUES ('han/dev', 'dev', '/tmp')")
    con.commit()
    con.close()
    make_engine(db)
    row = sqlite3.connect(db).execute("SELECT runtime, runtime_options FROM agents").fetchone()
    assert row[0] == "claude"
    assert json.loads(row[1]) == {}


async def test_create_codex_agent_requires_usable_codex(node_factory, monkeypatch):
    codex_here(monkeypatch, logged_in=False, usable=False)
    async with node_factory("han") as n:
        r = await post_agent(n, "han/cx", runtime="codex")
        assert r.status_code == 422, r.text


async def test_create_codex_agent_defaults(node_factory, monkeypatch):
    codex_here(monkeypatch)
    async with node_factory("han") as n:
        r = await post_agent(n, "han/cx", runtime="codex")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["runtime"] == "codex"
        assert body["allowed_tools"] == list(CODEX_DEFAULT_ALLOWED_TOOLS)
        assert body["runtime_options"] == CODEX_OPTION_DEFAULTS


async def test_claude_agent_keeps_claude_defaults(node_factory):
    async with node_factory("han") as n:
        r = await post_agent(n, "han/dev")
        assert r.status_code == 200, r.text
        assert r.json()["runtime"] == "claude"
        assert "Read" in r.json()["allowed_tools"]
        assert r.json()["runtime_options"] == {}


async def test_runtime_cannot_change(node_factory, monkeypatch):
    codex_here(monkeypatch)
    async with node_factory("han") as n:
        assert (await post_agent(n, "han/dev")).status_code == 200
        r = await post_agent(n, "han/dev", runtime="codex")
        assert r.status_code == 422
        assert "runtime can't change" in r.text
        r = await post_agent(n, "han/dev", description="edited")
        assert r.status_code == 200, r.text
        assert r.json()["runtime"] == "claude"


async def test_deleted_agent_id_can_be_recreated_on_other_runtime(node_factory, monkeypatch):
    codex_here(monkeypatch)
    async with node_factory("han") as n:
        assert (await post_agent(n, "han/dev", allowed_tools=["Bash(make*)"])).status_code == 200
        async with httpx.AsyncClient(base_url=n.url) as c:
            assert (await c.delete("/api/agents/han/dev")).status_code == 200
        r = await post_agent(n, "han/dev", runtime="codex")
        assert r.status_code == 200, r.text
        assert r.json()["runtime"] == "codex"
        assert r.json()["allowed_tools"] == list(CODEX_DEFAULT_ALLOWED_TOOLS)
        codex_here(monkeypatch, logged_in=False, usable=False)
        async with httpx.AsyncClient(base_url=n.url) as c:
            assert (await c.delete("/api/agents/han/dev")).status_code == 200
        assert (await post_agent(n, "han/dev", runtime="codex")).status_code == 422


async def test_setup_does_not_block_the_event_loop(node_factory, monkeypatch):
    import asyncio
    import time

    def slow_status():
        time.sleep(1.0)
        return dict(USABLE)

    monkeypatch.setattr("agentfleet_node.api.codex_status", slow_status)
    async with node_factory("han") as n:
        async with httpx.AsyncClient(base_url=n.url, timeout=10) as c:
            # The node shares this event loop: a blocking call there freezes this test too, so time from before it.
            t0 = time.monotonic()
            setup = asyncio.create_task(post_agent(n, "han/cx", runtime="codex"))
            await asyncio.sleep(0.2)
            assert (await c.get("/api/agents")).status_code == 200
            assert time.monotonic() - t0 < 0.8
            assert (await setup).status_code == 200


async def test_unknown_runtime_option_rejected(node_factory, monkeypatch):
    codex_here(monkeypatch)
    async with node_factory("han") as n:
        r = await post_agent(n, "han/cx", runtime="codex", runtime_options={"foo": 1})
        assert r.status_code == 422, r.text
        r = await post_agent(n, "han/cx", runtime="codex", runtime_options={"sandbox": "full_access"})
        assert r.status_code == 422, r.text
        r = await post_agent(n, "han/cx", runtime="codex", runtime_options={"sandbox": "read_only", "network": True})
        assert r.status_code == 200, r.text
        assert r.json()["runtime_options"] == {**CODEX_OPTION_DEFAULTS, "sandbox": "read_only", "network": True}


def fake_codex(version="0.163.0", login=(0, "Logged in using ChatGPT\n")):
    def run(cmd, **kw):
        if cmd[1:] == ["--version"]:
            return subprocess.CompletedProcess(cmd, 0, f"codex-cli {version}\n", "")
        if cmd[1:] == ["login", "status"]:
            return subprocess.CompletedProcess(cmd, login[0], "", login[1])
        raise AssertionError(cmd)

    return run


@pytest.mark.parametrize(
    ("which", "version", "login", "auth_file", "expect"),
    [
        (None, None, None, None, {"installed": False, "logged_in": False, "usable": False}),
        ("/bin/codex", "0.163.0", (0, "Logged in using ChatGPT"), None,
         {"installed": True, "logged_in": True, "auth_mode": "chatgpt", "compatible": True, "newer_than_tested": False, "binary": "own", "usable": True}),
        ("/bin/codex", "0.170.0", (0, "Logged in using ChatGPT"), None, {"binary": "own", "newer_than_tested": True}),
        ("/bin/codex", "0.100.0", (0, "Logged in using ChatGPT"), None, {"compatible": False, "binary": "bundled"}),
        ("/bin/codex", "0.163.0", (1, "Not logged in"), {"auth_mode": "chatgpt", "tokens": {}}, {"logged_in": True, "usable": True}),
        ("/bin/codex", "0.163.0", (0, "Logged in using an API key - sk-***"), None, {"auth_mode": "api_key"}),
        (None, None, None, {"auth_mode": "chatgpt", "tokens": {}}, {"installed": True, "logged_in": True, "binary": "bundled", "usable": True}),
    ],
)
def test_codex_status_variants(tmp_path, which, version, login, auth_file, expect):
    if auth_file is not None:
        (tmp_path / ".codex").mkdir()
        (tmp_path / ".codex" / "auth.json").write_text(json.dumps(auth_file))
    status = codex_status(run=fake_codex(version, login) if which else None, which=lambda name: which, home=tmp_path,
                          find_spec=lambda name: object())
    for key, value in expect.items():
        assert status[key] == value, (key, status)


def test_codex_usable_needs_sdk(tmp_path):
    status = codex_status(run=fake_codex(), which=lambda name: "/bin/codex", home=tmp_path, find_spec=lambda name: None)
    assert status["logged_in"] is True
    assert status["sdk_installed"] is False
    assert status["usable"] is False


def test_codex_bin_for():
    assert codex_bin_for({**USABLE, "binary": "own"}) == "/usr/local/bin/codex"
    assert codex_bin_for({**USABLE, "binary": "bundled"}) is None


async def test_setup_includes_codex(node_factory, monkeypatch):
    codex_here(monkeypatch)
    async with node_factory("han") as n:
        async with httpx.AsyncClient(base_url=n.url) as c:
            setup = (await c.get("/api/setup")).json()
        assert setup["codex"]["usable"] is True


async def test_codex_setup_route(node_factory, monkeypatch):
    calls = []
    monkeypatch.setattr("agentfleet_node.service.installed", lambda: True)
    monkeypatch.setattr("agentfleet_node.service.update", lambda detached=True: calls.append(detached) or True)
    async with node_factory("han") as n:
        async with httpx.AsyncClient(base_url=n.url) as c:
            codex_here(monkeypatch, installed=False, logged_in=False, usable=False)
            assert (await c.post("/api/codex/setup")).status_code == 409
            assert calls == []
            codex_here(monkeypatch, sdk_installed=False, usable=False)
            r = await c.post("/api/codex/setup")
            assert r.status_code == 200, r.text
            assert calls == [True]


async def test_fork_codex_conversation_409(node_factory, monkeypatch):
    codex_here(monkeypatch)
    async with node_factory("han") as n:
        assert (await post_agent(n, "han/cx", runtime="codex")).status_code == 200
        conv = n.node.store.create_conversation(agent_id="han/cx", context_id="ctx", direction=Direction.INBOUND, session_id="thread-1")
        async with httpx.AsyncClient(base_url=n.url) as c:
            r = await c.post(f"/api/conversations/{conv.id}/fork")
        assert r.status_code == 409
        assert "Codex" in r.text

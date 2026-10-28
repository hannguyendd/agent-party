"""First-run setup from the web: owner, office server and join token, applied without a restart."""

import json
import os

import httpx

from agentfleet_node.config import Settings
from test_two_nodes import add_agent, wait_for
from test_world import RunningWorld


async def test_setup_saves_applies_and_survives_a_restart(node_factory, tmp_path, monkeypatch):
    monkeypatch.setattr("shutil.which", lambda name: None)  # no agentmesh-node on this machine
    async with RunningWorld(tmp_path) as world:
        # Point the derived world URL at the test world, never at a live Office on this machine's port 7500.
        monkeypatch.setattr("agentfleet_node.api.WORLD_PORT", world.port)
        port = world.port
        a = node_factory("me", os_notifications=False)  # fresh install: default owner, no world
        async with a, httpx.AsyncClient(base_url=a.url) as c:
            before = (await c.get("/api/setup")).json()
            assert before["configured"] is False and before["agents"] == 0

            r = await c.post("/api/setup", json={"owner": "kien", "server": f"127.0.0.1:{port - 100}", "token": "tok-123"})
            assert r.status_code == 200, r.text
            view = r.json()
            assert view["owner"] == "kien" and view["has_token"] and view["hub_url"] == f"http://127.0.0.1:{port - 100}"
            assert view["mesh_node"]["installed"] is False and "not installed" in (view["mesh_node"]["error"] or "")
            data_dir = a.settings.data_dir
            assert (data_dir / "bootstrap-token").read_text().strip() == "tok-123"
            assert json.loads((data_dir / "setup.json").read_text())["owner"] == "kien"
            assert "owner: kien" in a.settings.mesh_node_config_path.read_text()

            # The owner name now governs new agents.
            await add_agent(a, "kien/dev")
            r = await c.post("/api/setup", json={"owner": "bob", "server": "10.0.0.5"})
            assert r.status_code == 409

    # A restart reads setup.json, whatever the env said.
    again = Settings(data_dir=data_dir).apply_setup_file()
    assert again.owner == "kien" and again.world_url.endswith(f":{port}/world/ws")


async def test_setup_connects_the_office(node_factory, tmp_path, monkeypatch):
    monkeypatch.setattr("shutil.which", lambda name: None)
    async with RunningWorld(tmp_path) as world:
        monkeypatch.setattr("agentfleet_node.api.WORLD_PORT", world.port)
        a = node_factory("me", os_notifications=False)
        async with a, httpx.AsyncClient(base_url=a.url) as c:
            assert not a.node.world.enabled
            r = await c.post("/api/setup", json={"owner": "kien", "server": "127.0.0.1"})
            assert r.status_code == 200
            assert a.settings.world_url == world.url
            await wait_for(lambda: a.node.world.connected)


def test_server_address_forms():
    from agentfleet_node.api import _server_urls

    assert _server_urls("192.168.1.10") == ("http://192.168.1.10:7400", "ws://192.168.1.10:7500/world/ws")
    assert _server_urls("hub.local:7401") == ("http://hub.local:7401", "ws://hub.local:7500/world/ws")
    assert _server_urls("http://hub.local:7400/") == ("http://hub.local:7400", "ws://hub.local:7500/world/ws")


async def test_join_token_is_used_until_the_node_has_really_enrolled(tmp_path, monkeypatch):
    """agent.db appears before enrollment; a failed first try must not stop the token being used next time."""
    from agentfleet_node.meshproc import MeshNodeProcess

    s = Settings(owner="kien", data_dir=tmp_path, hub_url="http://hub:7400")
    (tmp_path / "mesh-node").mkdir(parents=True)
    (tmp_path / "mesh-node" / "agent.db").write_bytes(b"identity, not enrolled")
    (tmp_path / "bootstrap-token").write_text("tok")
    (tmp_path / "mesh-node.log").write_text("FATAL Enrollment failed: Bootstrap token max usages exceeded\n")
    seen: list[list[str]] = []

    async def fake_exec(*args, **kw):
        seen.append(list(args))
        raise OSError("not really starting it")

    monkeypatch.setattr("shutil.which", lambda name: "/usr/local/bin/agentmesh-node")
    monkeypatch.setattr("asyncio.create_subprocess_exec", fake_exec)
    m = MeshNodeProcess(s)
    assert not m.enrolled
    await m.start()
    assert "--bootstrap-token-path" in seen[-1]
    m._enrolled_mark.write_text("ok")
    await m.start()
    assert "--bootstrap-token-path" not in seen[-1]  # enrolled: the used token is left alone
    m.forget_enrollment()
    await m.start()
    assert "--bootstrap-token-path" in seen[-1]
    assert "already used" in (m._failure_from_log())


async def test_a_repo_checkout_is_never_offered_an_update(node_factory):
    a = node_factory("kien", os_notifications=False)
    async with a, httpx.AsyncClient(base_url=a.url) as c:
        info = (await c.get("/api/update")).json()
        assert info["installed"] is False and info["available"] is False and info["build"] == "dev"
        assert (await c.post("/api/update")).status_code == 409


async def test_mesh_node_is_brought_back_when_it_dies_but_not_for_a_used_token(tmp_path, monkeypatch):
    import asyncio
    import stat

    from agentfleet_node import meshproc
    from agentfleet_node.meshproc import MeshNodeProcess

    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    runs = tmp_path / "runs"
    exe = bin_dir / "agentmesh-node"
    # First run dies after 1.2 s (a crash); later runs stay up.
    exe.write_text(f'#!/bin/sh\necho x >> "{runs}"\n[ "$(wc -l < "{runs}")" -le 1 ] && {{ sleep 1.2; exit 1; }}\nsleep 30\n')
    exe.chmod(exe.stat().st_mode | stat.S_IEXEC)
    monkeypatch.setenv("PATH", f"{bin_dir}:{os.environ['PATH']}")
    monkeypatch.setattr(meshproc, "_RETRY_WAITS", (0.2,))
    s = Settings(owner="kien", data_dir=tmp_path / "data", hub_url="http://127.0.0.1:1")
    (s.data_dir / "mesh-node").mkdir(parents=True)
    (s.data_dir / "mesh-node" / "enrolled").write_text("ok")  # skip the enrollment probe
    m = MeshNodeProcess(s)
    assert await m.start()
    for _ in range(60):
        if runs.exists() and len(runs.read_text().splitlines()) >= 2 and m.running:
            break
        await asyncio.sleep(0.1)
    assert len(runs.read_text().splitlines()) == 2 and m.running  # restarted once, now up
    await m.stop()
    await asyncio.sleep(0.5)
    assert not m.running and len(runs.read_text().splitlines()) == 2  # a deliberate stop stays stopped

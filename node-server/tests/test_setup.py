"""First-run setup from the web: owner, office server and join token, applied without a restart."""

import json

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

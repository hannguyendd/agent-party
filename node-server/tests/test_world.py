"""World server rules (unit) and two nodes sharing one Office through it (integration)."""

import asyncio
import json

import httpx
import pytest
import uvicorn
from websockets.asyncio.client import connect

from agentfleet_node.world import WorldState, create_world_app

from conftest import free_port
from test_two_nodes import add_agent, wait_for

# unit: WorldState


def world_with(*agent_ids: str) -> WorldState:
    w = WorldState()
    owners: dict[str, set[str]] = {}
    for a in agent_ids:
        owner = a.split("/")[0]
        _, owners[owner] = w.sync_agents(owner, [{"agent_id": a, "name": a}], owners.get(owner, set()) | set())
        owners[owner] |= {a}
    return w


def test_nodes_can_only_publish_and_move_their_own_agents():
    w = WorldState()
    _, owned = w.sync_agents("han", [{"agent_id": "han/dev"}, {"agent_id": "bob/qa"}], set())
    assert owned == {"han/dev"} and list(w.agents) == ["han/dev"]
    with pytest.raises(PermissionError):
        w.move("bob", "han/dev", {"kind": "tile", "x": 1, "y": 1})


def test_desk_claims_are_exclusive_and_one_per_owner():
    w = WorldState()
    w.claim_desk("han", "D1")
    with pytest.raises(ValueError, match="belongs to han"):
        w.claim_desk("bob", "D1")
    w.claim_desk("han", "M2")  # moving desks releases the old one
    assert w.desks == {"M2": "han"}
    w.claim_desk("han", "HR")  # the HR desk by the entrance is a desk like the others
    assert w.desks == {"HR": "han"}
    with pytest.raises(ValueError):
        w.claim_desk("bob", "Z9")


def test_desks_and_skins_survive_a_restart(tmp_path):
    path = tmp_path / "world.json"
    w = WorldState(path)
    w.sync_agents("han", [{"agent_id": "han/dev"}], set())
    w.claim_desk("han", "D3")
    w.set_skin("han", "han/dev", "alien")
    again = WorldState(path)
    assert again.desks == {"D3": "han"} and again.skins == {"han/dev": "alien"}
    assert again.default_skin("han/dev") == "alien"


def test_roaming_walks_the_caller_to_its_peer_and_back():
    w = world_with("han/dev", "bob/qa")
    w.activity("han", "han/dev", "bob/qa", "running", "outbound")
    assert w.agents["han/dev"].at == {"kind": "near", "agent_id": "bob/qa"}
    assert w.agents["han/dev"].activity == {"peer": "bob/qa", "status": "running", "direction": "outbound"}
    w.activity("bob", "bob/qa", "han/dev", "running", "inbound")
    assert w.agents["bob/qa"].at == {"kind": "desk"}  # the callee stays put
    w.activity("han", "han/dev", "bob/qa", "idle", "outbound")
    assert w.agents["han/dev"].at == {"kind": "desk"} and w.agents["han/dev"].activity is None


def test_talking_takes_over_from_steering():
    w = world_with("han/dev", "bob/qa")
    w.move("han", "han/dev", {"kind": "tile", "x": 4, "y": 5})
    w.activity("han", "han/dev", "bob/qa", "running", "outbound")
    assert w.agents["han/dev"].at == {"kind": "near", "agent_id": "bob/qa"} and not w.agents["han/dev"].steered
    w.activity("han", "han/dev", "bob/qa", "idle", "outbound")
    assert w.agents["han/dev"].at == {"kind": "desk"}


def test_status_without_a_live_conversation_does_not_move_a_parked_agent():
    w = world_with("han/dev", "bob/qa")
    w.move("han", "han/dev", {"kind": "tile", "x": 4, "y": 5})
    w.activity("han", "han/dev", "bob/qa", "idle", "outbound")  # e.g. resync after reconnect
    assert w.agents["han/dev"].at == {"kind": "tile", "x": 4, "y": 5}


def test_leaving_agent_sends_walkers_home():
    w = world_with("han/dev", "bob/qa")
    w.move("han", "han/dev", {"kind": "near", "agent_id": "bob/qa"})
    events = w.remove_agent("bob/qa")
    assert events[0] == {"type": "agent_left", "agent_id": "bob/qa"}
    assert w.agents["han/dev"].at == {"kind": "desk"}


def test_bad_targets_are_rejected():
    w = world_with("han/dev")
    for at in ({"kind": "near", "agent_id": "han/dev"}, {"kind": "tile", "x": -1, "y": 0}, {"kind": "fly"}):
        with pytest.raises(ValueError):
            w.move("han", "han/dev", at)


# integration: world server + two nodes


class RunningWorld:
    def __init__(self, tmp_path):
        self.port = free_port()
        self.app = create_world_app(tmp_path / "world.json")
        self.hub = self.app.state.hub
        self.url = f"ws://127.0.0.1:{self.port}/world/ws"
        self.sent: list[dict] = []
        original = self.hub.broadcast

        async def spy(events):
            self.sent += events
            await original(events)

        self.hub.broadcast = spy

    async def __aenter__(self):
        self.server = uvicorn.Server(uvicorn.Config(self.app, host="127.0.0.1", port=self.port, log_level="warning"))
        self.task = asyncio.create_task(self.server.serve())
        while not self.server.started:
            await asyncio.sleep(0.05)
        return self

    async def __aexit__(self, *exc):
        self.server.should_exit = True
        await self.task


async def test_two_nodes_share_one_office(node_factory, tmp_path):
    async with RunningWorld(tmp_path) as world:
        a = node_factory("han", world_url=world.url)
        b = node_factory("bob", world_url=world.url)
        a.settings.static_peers = {"bob": b.url}
        b.settings.static_peers = {"han": a.url}
        async with a, b:
            await add_agent(a, "han/dev")
            await add_agent(b, "bob/qa")
            # Both nodes see both agents.
            await wait_for(lambda: {"han/dev", "bob/qa"} <= set(a.node.world.mirror["agents"]))
            await wait_for(lambda: {"han/dev", "bob/qa"} <= set(b.node.world.mirror["agents"]))

            async with httpx.AsyncClient(base_url=a.url) as c:
                assert (await c.post("/api/office/desk", json={"desk": "D1"})).status_code == 200
                assert (await c.post("/api/office/skin", json={"agent_id": "han/dev", "skin": "cat"})).status_code == 200
                # Han cannot steer Bob's agent through his own node.
                r = await c.post("/api/office/move", json={"agent_id": "bob/qa", "at": {"kind": "desk"}})
                assert r.status_code == 404
            await wait_for(lambda: b.node.world.mirror["desks"].get("D1") == "han")
            await wait_for(lambda: b.node.world.mirror["agents"]["han/dev"]["skin"] == "cat")

            # A real exchange makes han/dev roam to bob/qa and back; no content reaches the world server.
            await a.node.outbound.send("han/dev", "bob/qa", "secret patient detail")
            walked = lambda: any(  # noqa: E731
                e.get("type") == "agent" and e["agent"]["agent_id"] == "han/dev" and e["agent"]["at"].get("agent_id") == "bob/qa"
                for e in world.sent
            )
            await wait_for(walked)
            await wait_for(lambda: a.node.world.mirror["agents"]["han/dev"]["at"] == {"kind": "desk"})
            assert "secret" not in json.dumps(world.sent)


async def test_open_dashboard_marks_owner_present(node_factory, tmp_path):
    async with RunningWorld(tmp_path) as world:
        a = node_factory("han", world_url=world.url)
        async with a:
            await wait_for(lambda: a.node.world.connected)
            assert not a.node.world.mirror["owners"].get("han", {}).get("present")
            async with connect(f"ws://127.0.0.1:{a.port}/api/ws"):
                await wait_for(lambda: a.node.world.mirror["owners"].get("han", {}).get("present"))
            await wait_for(lambda: not a.node.world.mirror["owners"]["han"]["present"])


async def test_office_disabled_without_world_url(node_factory):
    async with node_factory("han") as a, httpx.AsyncClient(base_url=a.url) as c:
        assert (await c.get("/api/office")).json()["enabled"] is False
        assert (await c.post("/api/office/desk", json={"desk": "D1"})).status_code == 409


async def test_old_socket_closing_does_not_remove_agents_a_newer_socket_publishes(tmp_path):
    # A node reconnects (network blip, restart) before the world notices its old socket is gone.
    async with RunningWorld(tmp_path) as world:
        hello = json.dumps({"op": "hello", "owner": "kien"})
        publish = json.dumps({"op": "agents", "agents": [{"agent_id": "kien/dev", "name": "Dev"}]})
        old = await connect(world.url)
        await old.send(hello)
        await old.send(publish)
        await wait_for(lambda: "kien/dev" in world.hub.state.agents)
        async with connect(world.url) as new:
            await new.send(hello)
            await new.send(publish)
            await asyncio.sleep(0.2)
            await old.close()
            await asyncio.sleep(0.3)
            assert "kien/dev" in world.hub.state.agents
        await wait_for(lambda: "kien/dev" not in world.hub.state.agents)  # the last socket closing still removes it


async def test_an_agent_published_by_two_nodes_stays_while_either_is_connected(tmp_path):
    # The same owner on two machines (or a stray process) publishing the same agent: one leaving keeps it.
    async with RunningWorld(tmp_path) as world:
        hello = json.dumps({"op": "hello", "owner": "kien"})
        publish = json.dumps({"op": "agents", "agents": [{"agent_id": "kien/dev", "name": "Dev"}]})
        async with connect(world.url) as first:
            await first.send(hello)
            await first.send(publish)
            await wait_for(lambda: "kien/dev" in world.hub.state.agents)
            second = await connect(world.url)
            await second.send(hello)
            await second.send(publish)
            await asyncio.sleep(0.2)
            await second.close()
            await asyncio.sleep(0.3)
            assert "kien/dev" in world.hub.state.agents
        await wait_for(lambda: "kien/dev" not in world.hub.state.agents)


def test_world_serves_the_staff_installer_and_the_org_name(tmp_path):
    from fastapi.testclient import TestClient

    downloads = tmp_path / "downloads"
    downloads.mkdir()
    (downloads / "agentfleet_node-0.1.0-py3-none-any.whl").write_bytes(b"wheel")
    (downloads / "agentmesh-node-darwin-arm64").write_bytes(b"bin")
    c = TestClient(create_world_app(tmp_path / "world.json", downloads, org='Taggle"; rm -rf ~'))
    sh = c.get("/install", headers={"host": "10.0.0.5:7500"}).text
    assert 'SERVER="10.0.0.5:7500"' in sh and 'OFFICE="10.0.0.5"' in sh
    assert 'WHEEL="agentfleet_node-0.1.0-py3-none-any.whl"' in sh
    assert 'ORG="Taggle rm -rf "' in sh  # quotes, ; and ~ are stripped: the name can't break out of the string
    ps1 = c.get("/install.ps1", headers={"host": "10.0.0.5:7500"}).text
    assert "$Server = '10.0.0.5:7500'" in ps1 and "__SERVER__" not in ps1
    # Fallback when the server's download fails: the GitHub release of the same version.
    assert 'GITHUB="https://github.com/hannguyendd/agent-party/releases/download/v0.1.0"' in sh
    assert "__" not in sh.replace("__pycache__", "")
    assert c.get("/downloads/agentmesh-node-darwin-arm64").content == b"bin"
    assert c.get("/downloads/..%2Fworld.json").status_code == 404
    assert c.get("/downloads/missing").status_code == 404
    assert c.get("/info").json()["org"].startswith("Taggle")
    assert c.get("/healthz").json()["org"].startswith("Taggle")


def test_org_name_reaches_every_node(tmp_path):
    w = WorldState(org="Taggle")
    assert w.snapshot()["org"] == "Taggle"


def test_new_skins_can_be_picked_and_defaults_never_move():
    from agentfleet_node.world import DEFAULT_SKINS

    w = WorldState()
    w.sync_agents("kien", [{"agent_id": "kien/dev", "name": "Dev"}], set())
    assert w.agents["kien/dev"].skin in DEFAULT_SKINS
    # The default for an id is the same as before the second batch existed (8 skins).
    old = ("dev-hoodie", "designer", "lead", "shiba", "cat", "penguin", "alien", "robot")
    assert w.default_skin("kien/dev") == old[sum(map(ord, "kien/dev")) % 8]
    w.set_skin("kien", "kien/dev", "dragon")
    assert w.agents["kien/dev"].skin == "dragon"


async def test_node_audit_rows_reach_the_office_event_log_without_words(node_factory, tmp_path):
    async with RunningWorld(tmp_path) as world:
        a = node_factory("han", world_url=world.url, os_notifications=False)
        b = node_factory("bob", world_url=world.url, os_notifications=False)
        a.settings.static_peers = {"bob": b.url}
        b.settings.static_peers = {"han": a.url}
        async with a, b:
            await add_agent(a, "han/dev")
            await add_agent(b, "bob/qa")
            await wait_for(lambda: a.node.world.connected and b.node.world.connected)
            await a.node.outbound.send("han/dev", "bob/qa", "patient John Doe, room 12")
            log = world.hub.state.events
            await wait_for(lambda: any(r["kind"] == "outbound_message" and r.get("agent") == "han/dev" for r in log.rows))
            await wait_for(lambda: any(r["kind"] == "inbound_message" and r.get("agent") == "bob/qa" for r in log.rows))
            assert "John Doe" not in json.dumps(log.rows)


def test_world_serves_the_uninstallers(tmp_path):
    from fastapi.testclient import TestClient

    c = TestClient(create_world_app(tmp_path / "world.json", tmp_path))
    sh = c.get("/uninstall", headers={"host": "10.0.0.5:7500"}).text
    assert "agentfleet-node uninstall" in sh and "__" not in sh.split("set -uo", 1)[1][:200]
    assert "Unregister-ScheduledTask" in c.get("/uninstall.ps1").text

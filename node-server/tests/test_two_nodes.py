"""Two node servers talking A2A (static peers stand in for the mesh)."""

import asyncio

import httpx
import pytest

from agentfleet_node.mesh import AgentOffline


async def add_agent(node, agent_id, **extra):
    async with httpx.AsyncClient(base_url=node.url) as c:
        r = await c.post("/api/agents", json={"id": agent_id, "name": agent_id, "description": "test agent", "working_dir": str(node.workdir), **extra})
        assert r.status_code == 200, r.text


async def pair(node_factory, **b_overrides):
    a = node_factory("han")
    b = node_factory("bob", **b_overrides)
    a.settings.static_peers = {"bob": b.url}
    b.settings.static_peers = {"han": a.url}
    return a, b


async def wait_for(pred, timeout=5.0):
    async def loop():
        while True:
            v = pred()
            if v:
                return v
            await asyncio.sleep(0.05)

    return await asyncio.wait_for(loop(), timeout)


async def test_single_exchange_and_records(node_factory):
    a, b = await pair(node_factory)
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa")
        res = await a.node.outbound.send("han/dev", "bob/qa", "hello there")
        assert res.state == "completed"
        assert res.reply == "echo: hello there"

        [conv_b] = b.node.store.list_conversations("bob/qa")
        assert conv_b.direction == "inbound" and conv_b.peer_agent_id == "han/dev"
        roles = [m.role for m in b.node.store.list_messages(conv_b.id)]
        assert roles[0] == "peer" and "agent" in roles
        [conv_a] = a.node.store.list_conversations("han/dev")
        assert conv_a.direction == "outbound" and [m.role for m in a.node.store.list_messages(conv_a.id)] == ["agent", "peer"]


async def test_multi_turn_input_required_keeps_one_session(node_factory):
    a, b = await pair(node_factory)
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa")
        first = await a.node.outbound.send("han/dev", "bob/qa", "ASK me something")
        assert first.state == "input_required" and "name" in first.reply
        second = await a.node.outbound.send("han/dev", "bob/qa", "Han", context_id=first.context_id, task_id=first.task_id)
        assert second.state == "completed" and second.reply == "echo: Han"
        [conv_b] = b.node.store.list_conversations("bob/qa")
        assert conv_b.turn_count == 2 and conv_b.session_id
        # Both turns went to the same Claude client (same session).
        assert len(b.node.sessions._workers) == 1


async def test_approval_allow_via_api(node_factory):
    a, b = await pair(node_factory)
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa")
        send = asyncio.create_task(a.node.outbound.send("han/dev", "bob/qa", "please TOOL:Bash now"))
        appr = await wait_for(lambda: b.node.store.list_approvals(pending_only=True))
        assert appr[0].tool_name == "Bash"
        async with httpx.AsyncClient(base_url=b.url) as c:
            r = await c.post(f"/api/approvals/{appr[0].id}", json={"allow": True})
            assert r.status_code == 200
        res = await send
        assert res.reply == "tool Bash allowed"


async def test_approval_times_out_to_deny(node_factory):
    a, b = await pair(node_factory, approval_timeout_s=0.3)
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa")
        res = await a.node.outbound.send("han/dev", "bob/qa", "TOOL:Write")
        assert res.reply.startswith("tool Write denied")
        assert b.node.store.list_approvals()[0].status == "timed_out"


async def test_allowed_and_denied_tools_skip_approval(node_factory):
    a, b = await pair(node_factory)
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa", allowed_tools=["Bash(make *)"], denied_tools=["Write"])
        assert (await a.node.outbound.send("han/dev", "bob/qa", "TOOL:Bash")).reply == "tool Bash allowed"
        assert (await a.node.outbound.send("han/dev", "bob/qa", "TOOL:Write")).reply.startswith("tool Write denied")
        assert b.node.store.list_approvals() == []


async def test_owner_takeover_and_manual_reply(node_factory):
    a, b = await pair(node_factory)
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa")
        send = asyncio.create_task(a.node.outbound.send("han/dev", "bob/qa", "SLOW job"))
        conv = await wait_for(lambda: next((c for c in b.node.store.list_conversations() if c.status == "running"), None))
        async with httpx.AsyncClient(base_url=b.url) as c:
            assert (await c.post(f"/api/conversations/{conv.id}/takeover")).status_code == 200
            await wait_for(lambda: b.node.sessions.awaiting_owner(conv.id))
            r = await c.post(f"/api/conversations/{conv.id}/reply", json={"text": "Bob here, I'll handle it"})
            assert r.status_code == 200
        res = await send
        assert res.reply == "Bob here, I'll handle it"
        assert b.node.store.get_conversation(conv.id).mode == "manual"


async def test_hand_back_reruns_agent(node_factory):
    a, b = await pair(node_factory)
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa")
        send = asyncio.create_task(a.node.outbound.send("han/dev", "bob/qa", "SLOW job"))
        conv = await wait_for(lambda: next((c for c in b.node.store.list_conversations() if c.status == "running"), None))
        async with httpx.AsyncClient(base_url=b.url) as c:
            await c.post(f"/api/conversations/{conv.id}/interrupt")
            await wait_for(lambda: b.node.sessions.awaiting_owner(conv.id))
            await c.post(f"/api/conversations/{conv.id}/handback")
        res = await send
        assert res.reply.startswith("echo: Continue where you left off")


async def test_turn_limit_rejects(node_factory):
    a, b = await pair(node_factory, max_turns_per_context=1)
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa")
        first = await a.node.outbound.send("han/dev", "bob/qa", "one")
        again = await a.node.outbound.send("han/dev", "bob/qa", "two", context_id=first.context_id)
        assert again.state == "rejected" and "turn limit" in again.reply


async def test_offline_target(node_factory):
    a, b = await pair(node_factory)
    async with a, b:
        await add_agent(a, "han/dev")
        with pytest.raises(AgentOffline):
            await a.node.outbound.send("han/dev", "carol/x", "hi")


async def test_file_lands_in_inbox(node_factory):
    a, b = await pair(node_factory)
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa")
        res = await a.node.outbound.send("han/dev", "bob/qa", "see attached", files=[("notes.md", b"# hi", "text/markdown"), ("x.sh", b"rm", "text/x-sh")])
        assert res.state == "completed"
        saved = list((b.workdir / "inbox").rglob("notes.md"))
        assert len(saved) == 1 and saved[0].read_bytes() == b"# hi"
        assert not list((b.workdir / "inbox").rglob("x.sh"))
        peer_msg = b.node.store.list_messages(b.node.store.list_conversations()[0].id)[0]
        assert peer_msg.data["files"] and peer_msg.data["rejected_files"]


async def test_own_agents_talk_locally_and_mesh_config(node_factory):
    a = node_factory("han")
    async with a:
        await add_agent(a, "han/dev")
        await add_agent(a, "han/docs")
        res = await a.node.outbound.send("han/dev", "han/docs", "hi sibling")
        assert res.reply == "echo: hi sibling"
        cfg = a.settings.mesh_node_config_path.read_text()
        assert "name: han.dev" in cfg and "name: han.docs" in cfg and "type: a2a" in cfg


async def test_agent_id_must_match_owner(node_factory):
    a = node_factory("han")
    async with a:
        async with httpx.AsyncClient(base_url=a.url) as c:
            r = await c.post("/api/agents", json={"id": "bob/x", "name": "x", "working_dir": str(a.workdir)})
            assert r.status_code == 422


async def test_dashboard_websocket_streams_events(node_factory):
    a = node_factory("han")
    async with a:
        q = a.node.bus.subscribe()
        await add_agent(a, "han/dev")
        async with httpx.AsyncClient(base_url=a.url) as c:
            r = await c.post("/api/conversations", json={"agent_id": "han/dev", "text": "local hello"})
            conv_id = r.json()["id"]
        events = []
        while not any(e.get("type") == "message" and e["message"]["role"] == "agent" for e in events):
            events.append(await asyncio.wait_for(q.get(), 5))
        kinds = {e["type"] for e in events}
        assert {"agent", "conversation", "message"} <= kinds
        msgs = a.node.store.list_messages(conv_id)
        assert msgs[0].role == "owner" and msgs[1].content == "echo: local hello"

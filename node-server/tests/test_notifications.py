"""The bell's history: notifications recorded from what happens on the node, read marks, live events."""

import asyncio

import httpx

from test_two_nodes import add_agent, pair, wait_for


async def test_conversations_and_approvals_leave_notifications(node_factory):
    a, b = await pair(node_factory)
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa")
        await a.node.outbound.send("han/dev", "bob/qa", "which DB do the orders use?")
        # Bob is told someone started talking to his agent; Han that the peer answered.
        await wait_for(lambda: any(n.kind == "inbound" and "han/dev" in n.title for n in b.node.store.list_notifications()))
        await wait_for(lambda: any(n.kind == "reply" and "bob/qa answered han/dev" in n.title for n in a.node.store.list_notifications()))

        # A tool waiting for approval is a notification too.
        async with httpx.AsyncClient(base_url=a.url) as c:
            r = await c.post("/api/conversations", json={"agent_id": "han/dev", "text": "TOOL:Deploy now"})
            conv_id = r.json()["id"]
            await wait_for(lambda: any(n.kind == "approval" and n.conversation_id == conv_id for n in a.node.store.list_notifications()))
            appr = a.node.store.list_approvals(pending_only=True)[0]
            note = next(n for n in (await c.get("/api/notifications")).json() if n["kind"] == "approval")
            assert note["approval_id"] == appr.id and not note["read"]
            a.node.sessions.decide(appr.id, False)
            # Decided: its row no longer needs the owner.
            await wait_for(lambda: all(n.read for n in a.node.store.list_notifications() if n.approval_id == appr.id))
            rows = (await c.get("/api/notifications")).json()
            assert any(not n["read"] for n in rows)
            assert (await c.post("/api/notifications/read", json={"ids": None})).status_code == 200
            await asyncio.sleep(0.05)
            assert all(n["read"] for n in (await c.get("/api/notifications")).json())


async def test_new_permissions_settle_a_waiting_approval(node_factory):
    a = node_factory("han")
    async with a:
        await add_agent(a, "han/dev")
        async with httpx.AsyncClient(base_url=a.url) as c:
            r = await c.post("/api/conversations", json={"agent_id": "han/dev", "text": "TOOL:Bash"})
            conv_id = r.json()["id"]
            appr = await wait_for(lambda: next(iter(a.node.store.list_approvals(conv_id, pending_only=True)), None))
            # The owner switches the agent to Autopilot while it waits: the call goes through without a second OK.
            await add_agent(a, "han/dev", allowed_tools=["Read", "Edit", "Write", "Bash"])
            await wait_for(lambda: [x.status for x in a.node.store.list_approvals(conv_id)] == ["allowed"])
            await wait_for(lambda: a.node.store.get_conversation(conv_id).status == "idle")
            assert all(n.read for n in a.node.store.list_notifications() if n.approval_id == appr.id)


async def test_waiting_on_a_peer_does_not_time_out_the_turn(node_factory):
    # Han asks his agent, which asks Bob's agent; Bob's agent waits for Bob's approval longer than a turn may last.
    # Waiting on others is not the agent's own time: Han's chat still gets the answer.
    a, b = await pair(node_factory)
    a.settings.turn_timeout_s = b.settings.turn_timeout_s = 0.5
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa")
        async with httpx.AsyncClient(base_url=a.url) as c:
            r = await c.post("/api/conversations", json={"agent_id": "han/dev", "text": "PEER:bob/qa TOOL:Bash"})
            conv_id = r.json()["id"]
        appr = await wait_for(lambda: next(iter(b.node.store.list_approvals(pending_only=True)), None))
        await asyncio.sleep(1.0)  # longer than the turn timeout on both sides
        b.node.sessions.decide(appr.id, True)
        await wait_for(lambda: any(m.role == "agent" and "tool Bash allowed" in m.content for m in a.node.store.list_messages(conv_id)))
        assert a.node.store.get_conversation(conv_id).status == "idle"
        assert not any("interrupted" in m.content for m in a.node.store.list_messages(conv_id))


async def test_history_search_finds_chat_text(node_factory):
    a, b = await pair(node_factory)
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa")
        conv = await a.node.outbound.send("han/dev", "bob/qa", "Which Postgres replica serves the ORDERS table?")
        await wait_for(lambda: a.node.store.search_messages("orders"))
        async with httpx.AsyncClient(base_url=a.url) as c:
            hits = (await c.get("/api/conversations/search", params={"q": "postgres REPLICA"})).json()
            assert hits and "replica" in hits[0]["snippet"].lower()
            assert (await c.get("/api/conversations/search", params={"q": "  "})).json() == []
        assert conv is not None

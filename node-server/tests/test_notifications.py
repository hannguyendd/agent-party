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
            a.node.sessions.decide(appr.id, False)
            rows = (await c.get("/api/notifications")).json()
            assert rows and not rows[0]["read"]
            assert (await c.post("/api/notifications/read", json={"ids": None})).status_code == 200
            await asyncio.sleep(0.05)
            assert all(n["read"] for n in (await c.get("/api/notifications")).json())


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

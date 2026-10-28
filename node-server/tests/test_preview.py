"""The conversation list shows the latest chat line and a readable title."""

import httpx

from test_two_nodes import add_agent, pair


async def test_latest_line_and_title(node_factory):
    a, b = await pair(node_factory)
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa")
        await a.node.outbound.send("han/dev", "bob/qa", "what  is\nthe   schema?")
        [conv] = a.node.store.list_conversations("han/dev")
        assert conv.last_role == "peer" and conv.last_preview.startswith("echo:")
        async with httpx.AsyncClient(base_url=a.url) as c:
            r = await c.post("/api/conversations", json={"agent_id": "han/dev", "text": "long internal prompt", "title": "Ask bob/qa: schema?"})
            assert r.json()["title"] == "Ask bob/qa: schema?"


async def test_conversations_get_a_topic_title_from_their_first_message(node_factory, tmp_path):
    import httpx

    from test_two_nodes import add_agent, wait_for

    a = node_factory("kien", os_notifications=False)
    async with a, httpx.AsyncClient(base_url=a.url) as c:
        await add_agent(a, "kien/dev")
        conv = (await c.post("/api/conversations", json={"agent_id": "kien/dev", "text": "what does the orders API return?"})).json()
        await wait_for(lambda: a.node.store.get_conversation(conv["id"]).topic.startswith("Title: what does the orders"))
        # Only once: later messages don't rename it.
        await c.post(f"/api/conversations/{conv['id']}/inject", json={"text": "and the refunds API?"})
        await __import__("asyncio").sleep(0.3)
        assert a.node.store.get_conversation(conv["id"]).topic.startswith("Title: what does")


async def test_both_sides_of_a_conversation_show_the_starters_title(node_factory):
    from test_two_nodes import add_agent, pair, wait_for

    a, b = await pair(node_factory)
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa")
        res = await a.node.outbound.send("han/dev", "bob/qa", "which DB do the orders use?")
        mine = a.node.store.get_conversation(res.conversation_id)
        await wait_for(lambda: a.node.store.get_conversation(mine.id).topic.startswith("Title: which DB"))
        theirs = b.node.store.find_conversation("bob/qa", mine.context_id)
        await wait_for(lambda: b.node.store.get_conversation(theirs.id).topic == a.node.store.get_conversation(mine.id).topic)
        # The receiving side never makes its own title.
        assert b.node.store.get_conversation(theirs.id).topic.startswith("Title: which DB")

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

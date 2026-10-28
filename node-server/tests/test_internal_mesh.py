"""Mesh tools over the token-protected local route, for runtimes that run them out of process (Codex)."""

import asyncio
import os
import sys

import httpx
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from agentfleet_node.models import Direction

from test_two_nodes import add_agent, pair, wait_for


def conversation(node, agent_id, context_id="ctx"):
    conv = node.node.store.create_conversation(agent_id=agent_id, context_id=context_id, direction=Direction.LOCAL)
    node.node.sessions.worker(conv.id)
    return conv


async def call(node, conv_id, tool, token, args=None):
    headers = {"Authorization": f"Bearer {token}"} if token is not None else {}
    async with httpx.AsyncClient(base_url=node.url, timeout=30) as c:
        return await c.post(f"/api/internal/mesh/{conv_id}/{tool}", json=args or {}, headers=headers)


async def test_internal_mesh_rejects_missing_or_wrong_token(node_factory):
    async with node_factory("han") as n:
        await add_agent(n, "han/dev")
        conv = conversation(n, "han/dev")
        n.node.sessions.register_mesh_token(conv.id)
        assert (await call(n, conv.id, "list_agents", None)).status_code == 403
        assert (await call(n, conv.id, "list_agents", "wrong")).status_code == 403


async def test_internal_mesh_token_is_per_conversation(node_factory):
    async with node_factory("han") as n:
        await add_agent(n, "han/dev")
        a = conversation(n, "han/dev", "a")
        b = conversation(n, "han/dev", "b")
        token_a = n.node.sessions.register_mesh_token(a.id)
        n.node.sessions.register_mesh_token(b.id)
        assert (await call(n, a.id, "list_agents", token_a)).status_code == 200
        assert (await call(n, b.id, "list_agents", token_a)).status_code == 403


async def test_internal_mesh_token_revoked_on_close(node_factory):
    async with node_factory("han") as n:
        await add_agent(n, "han/dev")
        conv = conversation(n, "han/dev")
        token = n.node.sessions.register_mesh_token(conv.id)
        n.node.sessions.revoke_mesh_token(conv.id)
        assert (await call(n, conv.id, "list_agents", token)).status_code == 403


async def test_internal_mesh_unknown_tool_404(node_factory):
    async with node_factory("han") as n:
        await add_agent(n, "han/dev")
        conv = conversation(n, "han/dev")
        token = n.node.sessions.register_mesh_token(conv.id)
        assert (await call(n, conv.id, "rm_rf", token)).status_code == 404


async def test_internal_mesh_send_message_reaches_peer(node_factory):
    a, b = await pair(node_factory)
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa")
        conv = conversation(a, "han/dev")
        token = a.node.sessions.register_mesh_token(conv.id)
        r = await call(a, conv.id, "send_message", token, {"to": "bob/qa", "text": "hello there"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert not body.get("is_error"), body
        assert "echo: hello there" in body["content"][0]["text"]


async def test_internal_mesh_contact_policy_ask_creates_approval(node_factory):
    a, b = await pair(node_factory, os_notifications=False)
    async with a, b:
        await add_agent(a, "han/dev", contact_policy="ask")
        await add_agent(b, "bob/qa")
        conv = conversation(a, "han/dev")
        token = a.node.sessions.register_mesh_token(conv.id)
        pending = asyncio.create_task(call(a, conv.id, "send_message", token, {"to": "bob/qa", "text": "may I"}))
        approvals = await wait_for(lambda: a.node.store.list_approvals(pending_only=True))
        assert approvals[0].tool_name == "mcp__mesh__send_message"
        async with httpx.AsyncClient(base_url=a.url) as c:
            assert (await c.post(f"/api/approvals/{approvals[0].id}", json={"allow": True})).status_code == 200
        r = await asyncio.wait_for(pending, 10)
        assert "echo: may I" in r.json()["content"][0]["text"]


async def test_internal_mesh_denied_tool_returns_error(node_factory):
    async with node_factory("han") as n:
        await add_agent(n, "han/dev", denied_tools=["mcp__mesh__list_agents"])
        conv = conversation(n, "han/dev")
        token = n.node.sessions.register_mesh_token(conv.id)
        r = await call(n, conv.id, "list_agents", token)
        assert r.status_code == 200
        assert r.json()["is_error"] is True
        assert "not allowed" in r.json()["content"][0]["text"]


async def test_internal_mesh_needs_input_sets_worker_flag(node_factory):
    async with node_factory("han") as n:
        await add_agent(n, "han/dev")
        conv = conversation(n, "han/dev")
        token = n.node.sessions.register_mesh_token(conv.id)
        r = await call(n, conv.id, "needs_input", token, {"question": "name?"})
        assert r.status_code == 200
        assert n.node.sessions.worker(conv.id).needs_input is True


async def test_mesh_mcp_lists_tool_specs(node_factory):
    async with node_factory("han") as n:
        await add_agent(n, "han/dev")
        conv = conversation(n, "han/dev")
        token = n.node.sessions.register_mesh_token(conv.id)
        env = {**os.environ, "AGENTFLEET_MESH_URL": f"{n.url}/api/internal/mesh/{conv.id}", "AGENTFLEET_MESH_TOKEN": token}
        params = StdioServerParameters(command=sys.executable, args=["-m", "agentfleet_node.mesh_mcp"], env=env)
        async with stdio_client(params) as (read, write), ClientSession(read, write) as session:
            await session.initialize()
            names = {t.name for t in (await session.list_tools()).tools}
            assert names == {"list_agents", "send_message", "share_file", "needs_input"}
            result = await session.call_tool("needs_input", {"question": "?"})
            assert not result.is_error
        assert n.node.sessions.worker(conv.id).needs_input is True

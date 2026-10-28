"""Assignments: the receiving owner must accept; acceptance lets file edits run without asking (ADR 0002)."""

import asyncio
import sqlite3

import httpx

from agentfleet_node.db import make_engine
from agentfleet_node.models import Agent
from agentfleet_node.sessions import policy_decision
from test_two_nodes import add_agent, wait_for


def pair(node_factory, **b):
    a = node_factory("han", os_notifications=False)
    bb = node_factory("bob", os_notifications=False, **b)
    a.settings.static_peers = {"bob": bb.url}
    bb.settings.static_peers = {"han": a.url}
    return a, bb


def pending(node, tool="Assignment"):
    return [x for x in node.node.store.list_approvals(pending_only=True) if x.tool_name == tool]


async def decide(node, approval_id, allow, reason=""):
    async with httpx.AsyncClient(base_url=node.url) as c:
        r = await c.post(f"/api/approvals/{approval_id}", json={"allow": allow, "reason": reason})
        assert r.status_code == 200, r.text


def test_accepted_assignment_allows_file_edits_only():
    agent = Agent(id="bob/qa", name="qa", working_dir="/tmp")
    assert policy_decision(agent, "Edit", {}) == "ask"
    assert policy_decision(agent, "Edit", {}, accepted_assignment=True) == "allow"
    assert policy_decision(agent, "Write", {}, accepted_assignment=True) == "allow"
    assert policy_decision(agent, "Bash", {"command": "rm -rf ~"}, accepted_assignment=True) == "ask"
    agent.denied_tools = ["Edit"]
    assert policy_decision(agent, "Edit", {}, accepted_assignment=True) == "deny"


def test_old_databases_get_new_columns(tmp_path):
    db = tmp_path / "node.db"
    con = sqlite3.connect(db)
    con.execute(
        "CREATE TABLE conversations (id VARCHAR PRIMARY KEY, agent_id VARCHAR, context_id VARCHAR, peer_agent_id VARCHAR,"
        " direction VARCHAR, session_id VARCHAR, status VARCHAR, mode VARCHAR, turn_count INTEGER, title VARCHAR,"
        " created_at DATETIME, updated_at DATETIME)"
    )
    con.execute("INSERT INTO conversations (id, agent_id, context_id, direction, status, mode, turn_count, title) VALUES ('c1','a/b','x','inbound','idle','auto',0,'')")
    con.commit()
    con.close()
    make_engine(db)
    cols = {r[1]: r for r in sqlite3.connect(db).execute("PRAGMA table_info(conversations)")}
    assert "kind" in cols and "accepted" in cols
    assert sqlite3.connect(db).execute("SELECT kind, accepted FROM conversations").fetchone() == ("", 0)


async def test_accepting_an_assignment_runs_it_with_file_edits(node_factory):
    a, b = pair(node_factory)
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa")
        send = asyncio.create_task(a.node.outbound.send("han/dev", "bob/qa", "TOOL:Edit fix the login test", kind="assignment"))
        [appr] = await wait_for(lambda: pending(b))
        assert appr.tool_input["from"] == "han/dev" and "login" in appr.tool_input["task"]
        [conv] = b.node.store.list_conversations("bob/qa")
        assert conv.kind == "assignment" and not conv.accepted and conv.status == "awaiting_owner"
        notes = [m.content for m in b.node.store.list_messages(conv.id) if m.kind == "status"]
        assert any("notified: none" in n for n in notes)  # no dashboard open, OS notifications off

        await decide(b, appr.id, True)
        res = await send
        assert res.state == "completed" and res.reply == "tool Edit allowed"
        assert b.node.store.get_conversation(conv.id).accepted
        assert not pending(b, "Edit")  # no per-edit approval after acceptance
        [sent] = a.node.store.list_conversations("han/dev")
        assert sent.kind == "assignment"


async def test_declined_assignment_is_rejected_with_the_reason(node_factory):
    a, b = pair(node_factory)
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa")
        send = asyncio.create_task(a.node.outbound.send("han/dev", "bob/qa", "TOOL:Edit refactor everything", kind="assignment"))
        [appr] = await wait_for(lambda: pending(b))
        await decide(b, appr.id, False, "busy this week")
        res = await send
        assert res.state == "rejected" and "busy this week" in res.reply
        [conv] = b.node.store.list_conversations("bob/qa")
        assert not conv.accepted


async def test_unanswered_assignment_is_declined_on_timeout(node_factory):
    a, b = pair(node_factory, assignment_accept_timeout_s=0.3)
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa")
        res = await a.node.outbound.send("han/dev", "bob/qa", "TOOL:Edit anything", kind="assignment")
        assert res.state == "rejected" and "in time" in res.reply


async def test_inquiry_does_not_widen_permissions(node_factory):
    a, b = pair(node_factory, approval_timeout_s=0.3)
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa")
        # Mislabelled or plain: without the owner's acceptance an edit still waits for approval (then times out).
        res = await a.node.outbound.send("han/dev", "bob/qa", "TOOL:Edit sneaky", kind="inquiry")
        assert res.reply.startswith("tool Edit denied")


async def test_assign_api_runs_in_background_and_checks_the_target(node_factory):
    a, b = pair(node_factory)
    async with a, b:
        await add_agent(a, "han/dev")
        await add_agent(b, "bob/qa")
        async with httpx.AsyncClient(base_url=a.url) as c:
            r = await c.post("/api/office/assign", json={"from_agent": "han/dev", "to_agent": "bob/qa", "text": "TOOL:Edit do it"})
            assert r.status_code == 200
            r = await c.post("/api/office/assign", json={"from_agent": "han/dev", "to_agent": "zed/none", "text": "x"})
            assert r.status_code == 409
            r = await c.post("/api/office/assign", json={"from_agent": "bob/qa", "to_agent": "han/dev", "text": "x"})
            assert r.status_code == 404  # not our agent
        [appr] = await wait_for(lambda: pending(b))
        await decide(b, appr.id, True)
        await wait_for(lambda: any(m.content == "tool Edit allowed" for c in a.node.store.list_conversations("han/dev")
                                   for m in a.node.store.list_messages(c.id) if m.role == "peer"))

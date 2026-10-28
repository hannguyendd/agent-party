"""Parties (CONTEXT.md "Party", ADR 0003) and Recaps: world rules as units, then three nodes sharing one Office."""

import asyncio
import json

import httpx
import pytest

from agentfleet_node import recap as recap_module
from agentfleet_node.models import ConversationKind
from agentfleet_node.world import WorldState

from test_two_nodes import add_agent, wait_for
from test_world import RunningWorld

# unit: world rules


def world_with(*agent_ids: str) -> WorldState:
    """A world where each owner publishes all of their agents at once (as a node does)."""
    w = WorldState()
    by_owner: dict[str, list[str]] = {}
    for a in agent_ids:
        by_owner.setdefault(a.split("/")[0], []).append(a)
    for owner, ids in by_owner.items():
        w.sync_agents(owner, [{"agent_id": a, "name": a} for a in ids], set())
    return w


def test_party_needs_three_agents_and_gathers_members_around_the_host():
    w = world_with("kien/dev", "kien/qa", "bob/api", "carol/pay")
    with pytest.raises(ValueError):
        w.open_party("kien", "p1", "kien/dev", ["bob/api"], "inquiry")  # only two agents
    with pytest.raises(PermissionError):
        w.open_party("bob", "p1", "kien/dev", ["bob/api", "carol/pay"], "inquiry")  # bob can't host with kien's agent
    # Several agents of one owner count: kien/qa is a member of kien/dev's Party.
    w.open_party("kien", "p1", "kien/dev", ["kien/qa", "bob/api"], "inquiry")
    assert w.agents["bob/api"].at == {"kind": "near", "agent_id": "kien/dev"}
    with pytest.raises(ValueError):
        w.open_party("carol", "p2", "carol/pay", ["bob/api", "kien/dev"], "inquiry")  # already in a Party


def test_invite_leave_hand_off_and_host_going_offline():
    w = world_with("kien/dev", "kien/qa", "bob/api", "carol/pay", "dan/x")
    w.open_party("kien", "p1", "kien/dev", ["kien/qa", "bob/api"], "inquiry")
    with pytest.raises(PermissionError):
        w.invite("carol", "p1", "carol/pay")  # carol has no agent in it
    w.invite("bob", "p1", "carol/pay")  # any member's owner can invite
    assert "carol/pay" in w.parties["p1"].members
    w.leave("carol", "p1", "carol/pay")
    assert w.agents["carol/pay"].at == {"kind": "desk"}
    with pytest.raises(PermissionError):
        w.hand_off("bob", "p1", "bob/api")  # only the Host's owner
    w.hand_off("kien", "p1", "bob/api")
    p = w.parties["p1"]
    assert p.host == "bob/api" and "kien/dev" not in p.members and w.agents["kien/qa"].at["agent_id"] == "bob/api"
    events = w.remove_agent("bob/api")  # the Host drops offline: the Party ends
    assert any(e["type"] == "party_ended" and e["reason"] == "host_offline" for e in events)
    assert "p1" not in w.parties and w.agents["kien/qa"].at == {"kind": "desk"}


def test_agents_in_a_party_do_not_roam():
    w = world_with("kien/dev", "kien/qa", "bob/api")
    w.open_party("kien", "p1", "kien/dev", ["kien/qa", "bob/api"], "inquiry")
    w.activity("kien", "kien/dev", "bob/api", "running", "outbound")
    assert w.agents["kien/dev"].at == {"kind": "desk"}  # the Host stays put; members come to it


# integration: three nodes


class Office:
    def __init__(self, node_factory, tmp_path):
        self.world = RunningWorld(tmp_path)
        self.node_factory = node_factory

    async def __aenter__(self):
        await self.world.__aenter__()
        url = self.world.url
        self.k = self.node_factory("kien", world_url=url, os_notifications=False)
        self.b = self.node_factory("bob", world_url=url, os_notifications=False)
        self.c = self.node_factory("carol", world_url=url, os_notifications=False)
        peers = {"kien": self.k, "bob": self.b, "carol": self.c}
        for n in peers.values():
            n.settings.static_peers = {o: p.url for o, p in peers.items() if p is not n}
        for n in peers.values():
            await n.__aenter__()
        await add_agent(self.k, "kien/dev")
        await add_agent(self.k, "kien/qa")
        await add_agent(self.b, "bob/api")
        await add_agent(self.c, "carol/pay")
        everyone = {"kien/dev", "kien/qa", "bob/api", "carol/pay"}
        for n in peers.values():
            await wait_for(lambda n=n: everyone <= set(n.node.world.mirror["agents"]))
        return self

    async def __aexit__(self, *exc):
        for n in (self.c, self.b, self.k):
            await n.__aexit__(*exc)
        await self.world.__aexit__(*exc)


async def open_party(office, kind="inquiry", members=("bob/api", "carol/pay")):
    async with httpx.AsyncClient(base_url=office.k.url) as c:
        r = await c.post("/api/parties", json={"host": "kien/dev", "members": list(members), "topic": "Pick a payments API", "kind": kind})
    assert r.status_code == 200, r.text
    return r.json()


async def test_host_messages_carry_the_party_and_assignment_members_must_accept(node_factory, tmp_path):
    async with Office(node_factory, tmp_path) as o:
        conv = await open_party(o, kind="assignment")
        party_id = conv["party_id"]
        assert conv["kind"] == ConversationKind.PARTY
        await wait_for(lambda: o.b.node.world.party(party_id) is not None)
        assert "Pick a payments" not in json.dumps(o.world.sent)  # the topic never reaches the world server

        # The Host's send_message from its party conversation is tagged with the Party and its kind.
        assert o.k.node.parties.tags_for(conv["id"]) == (party_id, "assignment")
        task = asyncio.create_task(o.k.node.outbound.send("kien/dev", "bob/api", "can you own the API change?", kind="assignment", party_id=party_id))
        await wait_for(lambda: o.b.node.store.list_approvals(pending_only=True))
        appr = o.b.node.store.list_approvals(pending_only=True)[0]
        assert appr.tool_name == "Assignment"
        member_conv = o.b.node.store.get_conversation(appr.conversation_id)
        assert member_conv.party_id == party_id
        o.b.node.sessions.decide(appr.id, True)
        res = await task
        assert res.state == "completed"


async def test_share_reaches_each_other_owner_once_and_forged_updates_are_refused(node_factory, tmp_path):
    async with Office(node_factory, tmp_path) as o:
        conv = await open_party(o, members=("kien/qa", "bob/api", "carol/pay"))
        party_id = conv["party_id"]
        await wait_for(lambda: o.k.node.store.list_messages(conv["id"]))
        async with httpx.AsyncClient(base_url=o.k.url) as c:
            r = await c.post(f"/api/parties/{party_id}/share")
        assert r.status_code == 200 and sorted(r.json()["sent"]) == ["bob/api", "carol/pay"]  # not kien/qa: same owner
        shared = [x for x in o.b.node.store.list_conversations() if x.kind == ConversationKind.PARTY_SHARE]
        assert len(shared) == 1 and "Pick a payments API" in o.b.node.store.list_messages(shared[0].id)[0].content

        # dan is not in the Party: his "update" is refused.
        ok, _ = o.c.node.parties.receive_update("carol/pay", "dan/x", party_id, "fake")
        assert not ok


async def test_hand_off_gives_the_new_host_the_transcript_and_close_ends_it(node_factory, tmp_path):
    async with Office(node_factory, tmp_path) as o:
        conv = await open_party(o)
        party_id = conv["party_id"]
        await wait_for(lambda: o.k.node.store.list_messages(conv["id"]))
        async with httpx.AsyncClient(base_url=o.k.url) as c:
            r = await c.post(f"/api/parties/{party_id}/handoff", json={"new_host": "bob/api"})
            assert r.status_code == 200, r.text
        await wait_for(lambda: o.b.node.parties.host_conversation(party_id) is not None)
        new = o.b.node.parties.host_conversation(party_id)
        assert "Pick a payments API" in new.title
        assert o.k.node.store.get_conversation(conv["id"]).status == "done"
        await wait_for(lambda: o.b.node.parties.tags_for(new.id) == (party_id, "inquiry"))

        async with httpx.AsyncClient(base_url=o.k.url) as c:  # kien no longer hosts it
            assert (await c.post(f"/api/parties/{party_id}/close")).status_code == 403
        async with httpx.AsyncClient(base_url=o.b.url) as c:
            assert (await c.post(f"/api/parties/{party_id}/close")).status_code == 200
        await wait_for(lambda: o.b.node.store.get_conversation(new.id).status == "done")
        await wait_for(lambda: o.c.node.world.party(party_id) is None)


async def test_recap_is_written_saved_and_shared_with_the_party(node_factory, tmp_path, monkeypatch):
    async def fake_summarize(settings, title, text):
        assert "Pick a payments API" in text
        return "## Goal\n- pick an API\n## Decisions\n- none\n## Next steps\n- none\n## Open questions\n- cost?"

    monkeypatch.setattr(recap_module, "summarize", fake_summarize)
    async with Office(node_factory, tmp_path) as o:
        conv = await open_party(o)
        await wait_for(lambda: o.k.node.store.list_messages(conv["id"]))
        async with httpx.AsyncClient(base_url=o.k.url) as c:
            r = await c.post(f"/api/conversations/{conv['id']}/recap")
            assert r.status_code == 200 and r.json()["status"] == "working"
            rid = r.json()["id"]
            await wait_for(lambda: o.k.node.store.get_recap(rid).status == "done")
            f = await c.get(f"/api/recaps/{rid}/file")
            assert f.status_code == 200 and "## Open questions" in f.text
            s = await c.post(f"/api/recaps/{rid}/share")
            assert s.status_code == 200 and sorted(s.json()["sent"]) == ["bob/api", "carol/pay"]
        assert o.k.node.store.get_recap(rid).shared

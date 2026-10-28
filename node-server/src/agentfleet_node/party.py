"""Parties on this node (CONTEXT.md "Party", ADR 0003).

A Party is three or more agents on one topic, run by a Host. On the Host's node it is a conversation of kind
"party": the owner briefs the Host there, and the Host talks with each member through `send_message`, which tags
those messages with the Party (`PARTY_KEY`) and its kind, so an Assignment party still needs each member's owner
to accept. The world server holds who is in the Party (never the topic or words) and gathers members around the
Host on the map.

Share: the Host's owner can send members' owners a read-only copy of the Party (A2A `party_update`, no Claude turn).
Hand-off: the Host's owner passes the role to a member, whose node receives the transcript (`party_handoff`).
"""

import asyncio
import logging
from typing import Any

from agentfleet_node.a2a_bridge import PARTY_HANDOFF, PARTY_UPDATE, OutboundClient
from agentfleet_node.config import Settings
from agentfleet_node.models import Conversation, ConversationKind, ConversationStatus, Direction, new_id
from agentfleet_node.naming import owner_of
from agentfleet_node.office import WorldClient
from agentfleet_node.sessions import SessionManager
from agentfleet_node.store import Store

log = logging.getLogger(__name__)

HOST_PROMPT = """\
You are hosting a Party: a group discussion in the team Office that your owner set up.

Topic from your owner:
{topic}

Members (you talk with each one separately; they only talk with you, never with each other):
{members}

How to run it:
- Message each member with mcp__mesh__send_message. Keep one conversation per member: reuse the context_id each
  reply gives you when you follow up with that member.
- Ask each member what you need for the topic, follow up where answers conflict or are thin.
- Then answer your owner: what was found or decided, who does what next, and open questions.
- Stay on the topic; don't bring in agents outside the Party unless your owner asks.
"""

HANDOFF_PROMPT = """\
{sender} handed you the Host role of a Party. You now run it for your owner.

Members (talk with each one separately using mcp__mesh__send_message; they only talk with you):
{members}

What happened so far:
{transcript}

Continue from here: pick up open threads with the members, then report to your owner what was decided, who does
what next, and open questions.
"""


def transcript(store: Store, conv: Conversation) -> str:
    """Plain-text record of what this side saw: the conversation itself plus, for a Party, its other conversations
    on this node (the Host's talks with members, or a member's talk with the Host and any shared copy)."""
    convs = [conv]
    if conv.party_id:
        convs += [c for c in store.list_conversations() if c.party_id == conv.party_id and c.id != conv.id]
    owner = owner_of(conv.agent_id)
    rows = []
    for c in convs:
        for m in store.list_messages(c.id):
            if m.kind not in ("text", "status") or not m.content.strip():
                continue
            who = {"owner": f"Owner ({owner})", "agent": c.agent_id, "system": "Note"}.get(m.role) or m.data.get("sender") or c.peer_agent_id or m.role
            with_peer = f" (with {c.peer_agent_id})" if c.id != conv.id and c.peer_agent_id and m.role == "agent" else ""
            rows.append((m.created_at, f"[{m.created_at:%H:%M}] {who}{with_peer}: {m.content.strip()}"))
    return "\n".join(line for _, line in sorted(rows, key=lambda r: r[0]))


class PartyService:
    def __init__(self, settings: Settings, store: Store, sessions: SessionManager, outbound: OutboundClient, world: WorldClient):
        self.settings = settings
        self.store = store
        self.sessions = sessions
        self.outbound = outbound
        self.world = world
        self._tasks: set[asyncio.Task] = set()
        world.party_listeners.append(self._on_world)

    # helpers

    def _party(self, party_id: str) -> dict[str, Any]:
        p = self.world.party(party_id)
        if p is None:
            raise LookupError("no such Party (it may have ended)")
        return p

    def _mine(self, agent_id: str) -> bool:
        return owner_of(agent_id) == self.settings.owner

    def _name(self, agent_id: str) -> str:
        return self.world.mirror["agents"].get(agent_id, {}).get("name") or agent_id

    def host_conversation(self, party_id: str) -> Conversation | None:
        rows = [c for c in self.store.list_conversations() if c.party_id == party_id and c.kind == ConversationKind.PARTY]
        return max(rows, key=lambda c: c.updated_at, default=None)

    def party_kind(self, party_id: str) -> str:
        p = self.world.party(party_id)
        return p["kind"] if p else ""

    def tags_for(self, conv_id: str) -> tuple[str, str]:
        """(party_id, kind) for messages the Host sends from its party conversation; ("", "") otherwise."""
        conv = self.store.get_conversation(conv_id)
        if conv and conv.kind == ConversationKind.PARTY and conv.party_id and self.world.party(conv.party_id):
            return conv.party_id, self.party_kind(conv.party_id)
        return "", ""

    def _spawn(self, coro) -> None:
        t = asyncio.get_event_loop().create_task(coro)
        self._tasks.add(t)
        t.add_done_callback(self._tasks.discard)

    def _member_lines(self, p: dict[str, Any]) -> str:
        return "\n".join(f"- {m} ({self._name(m)})" for m in p["members"]) or "- (none yet)"

    # owner actions (API)

    async def open(self, host: str, members: list[str], topic: str, kind: str) -> Conversation:
        if not self._mine(host):
            raise PermissionError("the Host must be one of your agents")
        if not self.world.connected:
            raise ConnectionError("not connected to the office; a Party needs the office")
        party_id = new_id()[:16]
        conv = self.store.create_conversation(host, f"party-{party_id}", Direction.LOCAL, title=topic[:80])
        conv = self.store.update_conversation(conv.id, kind=ConversationKind.PARTY, party_id=party_id)
        await self.world.send({"op": "party_open", "party_id": party_id, "host": host, "members": members, "kind": kind})
        for _ in range(50):  # the world echoes the Party back; its rules may refuse it
            if self.world.party(party_id):
                break
            await asyncio.sleep(0.05)
        p = self.world.party(party_id)
        if p is None:
            self.store.update_conversation(conv.id, status=ConversationStatus.ERROR)
            raise ValueError("the office refused the Party (an agent may be offline or already in a Party)")
        self.store.audit("party_opened", agent_id=host, party_id=party_id, members=len(p["members"]), kind=kind)
        await self.sessions.worker(conv.id).inject(topic, prompt=HOST_PROMPT.format(topic=topic, members=self._member_lines(p)))
        return conv

    async def invite(self, party_id: str, agent_id: str) -> None:
        self._party(party_id)
        await self.world.send({"op": "party_invite", "party_id": party_id, "agent_id": agent_id})

    async def leave(self, party_id: str, agent_id: str) -> None:
        await self.world.send({"op": "party_leave", "party_id": party_id, "agent_id": agent_id})

    async def close(self, party_id: str) -> None:
        p = self._party(party_id)
        if not self._mine(p["host"]):
            raise PermissionError("only the Host's owner can end the Party")
        await self.world.send({"op": "party_close", "party_id": party_id})

    async def hand_off(self, party_id: str, new_host: str) -> None:
        p = self._party(party_id)
        if not self._mine(p["host"]):
            raise PermissionError("only the Host's owner can hand the Party off")
        if new_host not in p["members"]:
            raise ValueError(f"{new_host} is not a member of this Party")
        conv = self.host_conversation(party_id)
        old_host = p["host"]
        text = f"Topic: {conv.title if conv else ''}\n\n{transcript(self.store, conv) if conv else ''}"
        await self.world.send({"op": "party_handoff", "party_id": party_id, "new_host": new_host})
        if conv:
            self.store.add_message(conv.id, "system", f"Handed the Party to {new_host}.", kind="status")
            self.store.update_conversation(conv.id, status=ConversationStatus.DONE)
        self._spawn(self._deliver_handoff(old_host, new_host, party_id, text))

    async def _deliver_handoff(self, old_host: str, new_host: str, party_id: str, text: str) -> None:
        try:
            state, reply = await self.outbound.send_update(old_host, new_host, text, PARTY_HANDOFF, party_id,
                                                           timeout_s=self.settings.outbound_timeout_s)
        except Exception as e:
            state, reply = "failed", str(e)
        conv = self.host_conversation(party_id)
        if conv and state not in ("completed", "input_required"):
            self.store.add_message(conv.id, "system", f"The hand-off to {new_host} did not go through: {reply or state}", kind="status")

    async def share(self, party_id: str, only_to: list[str] | None = None) -> dict[str, list[str]]:
        """Send each other owner in the Party a read-only copy (one of their agents receives it)."""
        p = self._party(party_id)
        if not self._mine(p["host"]):
            raise PermissionError("only the Host's owner can share the Party")
        conv = self.host_conversation(party_id)
        if conv is None:
            raise LookupError("the Party's conversation is not on this node")
        self.store.update_conversation(conv.id, party_shared=True)
        text = f"Party: {conv.title}\nHost: {p['host']}\n\n{transcript(self.store, conv)}"
        return await self._send_to_owners(p, p["host"], text, only_to)

    async def share_text(self, party_id: str, from_agent: str, text: str) -> dict[str, list[str]]:
        """Any member's owner can share something with the Party (e.g. their Recap)."""
        p = self._party(party_id)
        if from_agent not in [p["host"], *p["members"]] or not self._mine(from_agent):
            raise PermissionError("share from one of your agents in this Party")
        return await self._send_to_owners(p, from_agent, text, None)

    async def _send_to_owners(self, p: dict[str, Any], from_agent: str, text: str, only_to: list[str] | None) -> dict[str, list[str]]:
        targets: dict[str, str] = {}
        for a in [p["host"], *p["members"]]:
            if owner_of(a) != self.settings.owner and owner_of(a) not in targets and (only_to is None or a in only_to):
                targets[owner_of(a)] = a
        sent, failed = [], []
        for agent in targets.values():
            try:
                state, _ = await self.outbound.send_update(from_agent, agent, text, PARTY_UPDATE, p["party_id"])
                (sent if state == "completed" else failed).append(agent)
            except Exception as e:
                log.info("party share to %s failed: %s", agent, e)
                failed.append(agent)
        return {"sent": sent, "failed": failed}

    # peers (called by MeshAgentExecutor)

    def receive_update(self, agent_id: str, sender: str | None, party_id: str, text: str) -> tuple[bool, str]:
        """Store a shared copy if the world confirms both agents are in that Party (labels alone are claims)."""
        p = self.world.party(party_id)
        everyone = [p["host"], *p["members"]] if p else []
        if not p or sender not in everyone or agent_id not in everyone or sender == agent_id:
            return False, "not in that Party"
        ctx = f"party-share-{party_id}"
        conv = self.store.find_conversation(agent_id, ctx)
        if conv is None:
            conv = self.store.create_conversation(agent_id, ctx, Direction.INBOUND, peer_agent_id=p["host"],
                                                  title=f"Party hosted by {self._name(p['host'])}")
            conv = self.store.update_conversation(conv.id, kind=ConversationKind.PARTY_SHARE, party_id=party_id)
        self.store.add_message(conv.id, "peer", text, sender=sender, shared=True)
        self.store.audit("party_update_received", agent_id=agent_id, peer_agent_id=sender, party_id=party_id, chars=len(text))
        return True, "received"

    async def receive_handoff(self, agent_id: str, sender: str | None, party_id: str, context_id: str, text: str):
        """Become the Host: only once the world says this agent is the Host. Returns (conversation, prompt)."""
        for _ in range(60):  # the world event may land a moment after the message
            p = self.world.party(party_id)
            if p and p["host"] == agent_id:
                break
            await asyncio.sleep(0.05)
        else:
            raise PermissionError("the office does not list this agent as the Host")
        topic = text.split("\n", 1)[0].removeprefix("Topic: ").strip()
        conv = self.store.find_conversation(agent_id, context_id) or self.store.create_conversation(
            agent_id, context_id, Direction.LOCAL, title=topic[:80] or f"Party from {sender}"
        )
        conv = self.store.update_conversation(conv.id, kind=ConversationKind.PARTY, party_id=party_id)
        return conv, HANDOFF_PROMPT.format(sender=sender or "Another agent", members=self._member_lines(p), transcript=text)

    # world events

    def _on_world(self, ev: dict[str, Any]) -> None:
        if ev["type"] == "party":
            p = ev["party"]
            conv = self.host_conversation(p["party_id"]) if self._mine(p["host"]) else None
            if conv is None or conv.status == ConversationStatus.DONE:
                return
            w = self.sessions.worker(conv.id)
            if joined := ev.get("joined"):
                self._spawn(w.inject(f"{self._name(joined)} ({joined}) joined the Party.", note=True,
                                     prompt=f"{joined} joined the Party. Bring them up to speed on the topic and ask what you need."))
                if conv.party_shared:
                    self._spawn(self.share(p["party_id"], only_to=[joined]))
            elif left := ev.get("left"):
                # A note for the owner only; no need to spend a turn on it. The Host learns it if it messages them.
                self.store.add_message(conv.id, "system", f"{self._name(left)} ({left}) left the Party.", kind="status")
        elif ev["type"] == "party_ended":
            conv = self.host_conversation(ev["party_id"])
            if conv and conv.status != ConversationStatus.DONE:
                reason = "the Host went offline" if ev.get("reason") == "host_offline" else "it was closed"
                self.store.add_message(conv.id, "system", f"The Party ended ({reason}).", kind="status")
                self.store.update_conversation(conv.id, status=ConversationStatus.DONE)

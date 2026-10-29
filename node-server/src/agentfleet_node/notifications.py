"""The owner's notification history: everything worth a ping, kept so the bell can show it again later.

Watches this node's event bus and records a Notification when: an approval or an Assignment waits for the owner,
a colleague's agent starts a conversation with one of mine, a conversation of mine finishes or fails, a turn waits
for the owner to answer, a Party is shared with me, a recap is written. Rows stay on this node (titles carry agent
IDs; the dashboard shows names). Live: each new row is a `notification` event (toast + browser notification).
"""

import asyncio
import logging
from typing import Any

from agentfleet_node.models import ConversationKind, Direction
from agentfleet_node.store import EventBus, Store

log = logging.getLogger(__name__)

CONTACT_TOOLS = ("mcp__mesh__send_message", "mcp__mesh__share_file")
ACTIVE = ("running", "awaiting_approval", "awaiting_owner")


class NotificationService:
    def __init__(self, store: Store, bus: EventBus):
        self.store = store
        self.bus = bus
        self._status: dict[str, str] = {}
        self._approvals: set[str] = set()
        self._approval_notes: dict[str, str] = {}  # pending approval id -> its notification id
        self._recaps: dict[str, str] = {}
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        for c in self.store.list_conversations():
            self._status[c.id] = c.status
        self._approvals = {a.id for a in self.store.list_approvals()}
        self._task = asyncio.get_event_loop().create_task(self._watch(self.bus.subscribe()))

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()

    async def _watch(self, q: asyncio.Queue) -> None:
        while True:
            ev = await q.get()
            try:
                self._on(ev)
            except Exception:
                log.exception("notification failed for %s", ev.get("type"))

    def _on(self, ev: dict[str, Any]) -> None:
        t = ev.get("type")
        if t == "approval":
            a = ev["approval"]
            if a["status"] != "pending":
                # Decided (by the owner or by new permissions): its row no longer needs the owner. A timed-out one
                # stays unread: the owner missed it.
                note = self._approval_notes.pop(a["id"], None)
                if note and a["status"] != "timed_out":
                    self.store.mark_notifications_read([note])
                return
            if a["id"] in self._approvals:
                return
            self._approvals.add(a["id"])
            conv = self.store.get_conversation(a["conversation_id"])
            agent = conv.agent_id if conv else ""
            inp = a.get("tool_input") or {}
            if a["tool_name"] == "Assignment":
                n = self._add("assignment", f"{inp.get('from', 'Someone')} wants to assign work to {agent}", inp.get("task", ""), conv, a["id"])
            elif a["tool_name"] in CONTACT_TOOLS:
                n = self._add("approval", f"{agent} wants to message {inp.get('to', 'another agent')}", inp.get("text", ""), conv, a["id"])
            else:
                n = self._add("approval", f"{agent} wants to use {a['tool_name']}", "", conv, a["id"])
            self._approval_notes[a["id"]] = n.id
        elif t == "conversation":
            c = ev["conversation"]
            before = self._status.get(c["id"])
            now = c["status"]
            self._status[c["id"]] = now
            conv = self.store.get_conversation(c["id"])
            if conv is None:
                return
            if before is None:  # a new conversation
                if conv.kind == ConversationKind.PARTY_SHARE:
                    self._add("party", f"{conv.peer_agent_id} shared a Party with {conv.agent_id}", "", conv)
                elif conv.direction == Direction.INBOUND and conv.peer_agent_id:
                    self._add("inbound", f"{conv.peer_agent_id} started talking to {conv.agent_id}", conv.title, conv)
                return
            if before == now:
                return
            mine = conv.direction != Direction.INBOUND or conv.kind == ConversationKind.PARTY
            if now == "awaiting_owner" and before != "awaiting_owner":
                self._add("waiting", f"{conv.agent_id} needs your answer for {conv.peer_agent_id or 'a peer'}", conv.last_preview, conv)
            elif now == "error" and before in ACTIVE:
                self._add("error", f"{conv.agent_id} hit an error", conv.last_preview, conv)
            elif mine and now in ("idle", "done") and before in ACTIVE:
                who = f"{conv.peer_agent_id} answered {conv.agent_id}" if conv.direction == Direction.OUTBOUND and conv.peer_agent_id else f"{conv.agent_id} replied"
                self._add("reply", who, conv.last_preview, conv)
        elif t == "recap":
            r = ev["recap"]
            before = self._recaps.get(r["id"])
            self._recaps[r["id"]] = r["status"]
            if before == "working" or before is None and r["status"] != "working":
                if r["status"] == "done":
                    self._add("recap", f"Recap ready: {r.get('title', '')}", "", self.store.get_conversation(r["conversation_id"]))
                elif r["status"] == "error":
                    self._add("error", "A recap could not be written", "", self.store.get_conversation(r["conversation_id"]))

    def _add(self, kind: str, title: str, body: str, conv, approval_id: str | None = None):
        return self.store.add_notification(kind, title, (body or "").strip()[:200], conv.id if conv else None,
                                           conv.agent_id if conv else None, approval_id)

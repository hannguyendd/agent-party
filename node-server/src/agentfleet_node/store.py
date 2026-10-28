"""Persistence plus live fan-out: every write that the dashboard cares about is
saved to SQLite and then published on the event bus."""

import asyncio
import logging
import re
from typing import Any

from sqlmodel import col, select

from agentfleet_node.db import Database
from agentfleet_node.models import (
    Agent,
    Approval,
    ApprovalStatus,
    AuditLog,
    Conversation,
    ConversationStatus,
    Direction,
    FileRecord,
    Message,
    Mode,
    Notification,
    Recap,
    utcnow,
)

log = logging.getLogger(__name__)


class EventBus:
    def __init__(self, max_queue: int = 1000):
        self._subs: set[asyncio.Queue[dict[str, Any]]] = set()
        self._max_queue = max_queue

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(self._max_queue)
        self._subs.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue[dict[str, Any]]) -> None:
        self._subs.discard(q)

    def publish(self, event: dict[str, Any]) -> None:
        for q in list(self._subs):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                log.warning("dropping slow dashboard subscriber")
                self._subs.discard(q)


_REDACT_KEYS = re.compile(r"(text|content|body|prompt|input|message)", re.I)


def redact(detail: dict[str, Any]) -> dict[str, Any]:
    """Keep audit metadata only: drop any field that could carry message content."""
    return {k: v for k, v in detail.items() if not _REDACT_KEYS.search(k) and isinstance(v, (str, int, float, bool, type(None)))}


def dump(obj) -> dict[str, Any]:
    return obj.model_dump(mode="json")


class Store:
    def __init__(self, db: Database, bus: EventBus):
        self.db = db
        self.bus = bus
        self.audit_listeners: list = []  # (event, agent_id, peer_agent_id, detail) -> None

    # agents

    def list_agents(self) -> list[Agent]:
        with self.db.session() as s:
            return list(s.exec(select(Agent).order_by(Agent.id)))

    def get_agent(self, agent_id: str) -> Agent | None:
        with self.db.session() as s:
            return s.get(Agent, agent_id)

    def save_agent(self, agent: Agent) -> Agent:
        with self.db.session() as s:
            agent = s.merge(agent)
            s.commit()
            s.refresh(agent)
        self.bus.publish({"type": "agent", "agent": dump(agent)})
        return agent

    def delete_agent(self, agent_id: str) -> None:
        with self.db.session() as s:
            agent = s.get(Agent, agent_id)
            if agent:
                agent.enabled = False
                s.add(agent)
                s.commit()
        self.bus.publish({"type": "agent_removed", "agent_id": agent_id})

    # conversations

    def get_conversation(self, conv_id: str) -> Conversation | None:
        with self.db.session() as s:
            return s.get(Conversation, conv_id)

    def find_conversation(self, agent_id: str, context_id: str) -> Conversation | None:
        with self.db.session() as s:
            return s.exec(
                select(Conversation).where(Conversation.agent_id == agent_id, Conversation.context_id == context_id)
            ).first()

    def list_conversations(self, agent_id: str | None = None) -> list[Conversation]:
        with self.db.session() as s:
            q = select(Conversation).order_by(col(Conversation.updated_at).desc())
            if agent_id:
                q = q.where(Conversation.agent_id == agent_id)
            return list(s.exec(q))

    def create_conversation(
        self,
        agent_id: str,
        context_id: str,
        direction: Direction,
        peer_agent_id: str | None = None,
        title: str = "",
        session_id: str | None = None,
    ) -> Conversation:
        conv = Conversation(
            agent_id=agent_id,
            context_id=context_id,
            direction=direction,
            peer_agent_id=peer_agent_id,
            title=title[:120],
            session_id=session_id,
        )
        with self.db.session() as s:
            s.add(conv)
            s.commit()
            s.refresh(conv)
        self.bus.publish({"type": "conversation", "conversation": dump(conv)})
        return conv

    def update_conversation(self, conv_id: str, **changes: Any) -> Conversation:
        with self.db.session() as s:
            conv = s.get(Conversation, conv_id)
            if conv is None:
                raise KeyError(conv_id)
            for k, v in changes.items():
                setattr(conv, k, v)
            conv.updated_at = utcnow()
            s.add(conv)
            s.commit()
            s.refresh(conv)
        self.bus.publish({"type": "conversation", "conversation": dump(conv)})
        return conv

    def set_status(self, conv_id: str, status: ConversationStatus) -> Conversation:
        return self.update_conversation(conv_id, status=status)

    # messages

    def add_message(self, conv_id: str, role: str, content: str = "", kind: str = "text", **data: Any) -> Message:
        msg = Message(conversation_id=conv_id, role=role, kind=kind, content=content, data=data)
        with self.db.session() as s:
            s.add(msg)
            s.commit()
            s.refresh(msg)
        self.bus.publish({"type": "message", "conversation_id": conv_id, "message": dump(msg)})
        if kind == "text" and role in ("peer", "agent", "owner") and (content.strip() or data.get("files")):
            # Keep the list's preview line current (attachments-only messages show the first file name).
            files = data.get("files") or []
            preview = content.strip() or f"📎 {files[0]['name'] if isinstance(files[0], dict) else files[0]}"
            self.update_conversation(conv_id, last_preview=" ".join(preview.split())[:160], last_role=role)
        return msg

    def list_messages(self, conv_id: str) -> list[Message]:
        with self.db.session() as s:
            return list(s.exec(select(Message).where(Message.conversation_id == conv_id).order_by(Message.created_at)))

    def search_messages(self, q: str, limit: int = 200) -> list[dict[str, Any]]:
        """Conversations whose chat text contains `q` (case-insensitive), newest hit first, with a short snippet.
        Local only: this node's own SQLite, for the History page."""
        q = q.strip()
        if not q:
            return []
        needle = q.lower()
        pattern = f"%{q.replace('%', '').replace('_', '')}%"
        with self.db.session() as s:
            rows = s.exec(
                select(Message)
                .where(col(Message.kind) == "text", col(Message.role).in_(["peer", "agent", "owner"]),
                       col(Message.content).ilike(pattern))
                .order_by(col(Message.created_at).desc())
                .limit(limit * 5)
            )
            out: dict[str, dict[str, Any]] = {}
            for m in rows:
                if m.conversation_id in out:
                    out[m.conversation_id]["hits"] += 1
                    continue
                if len(out) >= limit:
                    continue
                text = " ".join(m.content.split())
                i = text.lower().find(needle)
                start = max(0, i - 50) if i >= 0 else 0
                out[m.conversation_id] = {"conversation_id": m.conversation_id, "message_id": m.id, "role": m.role,
                                          "snippet": ("…" if start else "") + text[start:start + 160],
                                          "created_at": m.created_at, "hits": 1}
            return list(out.values())

    def stream_delta(self, conv_id: str, text: str) -> None:
        """Partial assistant text; live only, never stored."""
        self.bus.publish({"type": "delta", "conversation_id": conv_id, "text": text})

    # approvals

    def create_approval(self, conv_id: str, tool_name: str, tool_input: dict[str, Any]) -> Approval:
        appr = Approval(conversation_id=conv_id, tool_name=tool_name, tool_input=tool_input)
        with self.db.session() as s:
            s.add(appr)
            s.commit()
            s.refresh(appr)
        self.bus.publish({"type": "approval", "approval": dump(appr)})
        return appr

    def decide_approval(self, approval_id: str, status, reason: str = "") -> Approval:
        with self.db.session() as s:
            appr = s.get(Approval, approval_id)
            if appr is None:
                raise KeyError(approval_id)
            appr.status = status
            appr.reason = reason
            appr.decided_at = utcnow()
            s.add(appr)
            s.commit()
            s.refresh(appr)
        self.bus.publish({"type": "approval", "approval": dump(appr)})
        return appr

    def list_approvals(self, conv_id: str | None = None, pending_only: bool = False) -> list[Approval]:
        with self.db.session() as s:
            q = select(Approval).order_by(col(Approval.created_at).desc())
            if conv_id:
                q = q.where(Approval.conversation_id == conv_id)
            if pending_only:
                q = q.where(Approval.status == "pending")
            return list(s.exec(q))

    def recover_after_restart(self) -> int:
        """Waits live in memory (approvals, turns, owner gates), so after a restart nothing can finish them: close
        pending approvals and mark conversations caught mid-turn as interrupted. Returns how many rows changed."""
        changed = 0
        for appr in self.list_approvals(pending_only=True):
            self.decide_approval(appr.id, ApprovalStatus.TIMED_OUT, "node restarted before a decision")
            changed += 1
        stuck = (ConversationStatus.RUNNING, ConversationStatus.AWAITING_APPROVAL, ConversationStatus.AWAITING_OWNER)
        for conv in self.list_conversations():
            if conv.status in stuck:
                self.add_message(conv.id, "system", "The node restarted; this turn was cut off.", kind="status")
                self.update_conversation(conv.id, status=ConversationStatus.INTERRUPTED, mode=Mode.AUTO)
                changed += 1
        return changed

    # notifications (the bell)

    def add_notification(self, kind: str, title: str, body: str = "", conversation_id: str | None = None,
                         agent_id: str | None = None) -> Notification:
        n = Notification(kind=kind, title=title[:200], body=body, conversation_id=conversation_id, agent_id=agent_id)
        with self.db.session() as s:
            s.add(n)
            s.commit()
            s.refresh(n)
        self.bus.publish({"type": "notification", "notification": dump(n)})
        return n

    def list_notifications(self, limit: int = 100) -> list[Notification]:
        with self.db.session() as s:
            return list(s.exec(select(Notification).order_by(col(Notification.created_at).desc()).limit(limit)))

    def mark_notifications_read(self, ids: list[str] | None = None) -> None:
        """Mark these (or, with None, all) as read."""
        with self.db.session() as s:
            q = select(Notification).where(Notification.read == False)  # noqa: E712
            if ids is not None:
                q = q.where(col(Notification.id).in_(ids))
            for n in s.exec(q):
                n.read = True
                s.add(n)
            s.commit()
        self.bus.publish({"type": "notifications_read", "ids": ids})

    # recaps

    def save_recap(self, recap: Recap) -> Recap:
        with self.db.session() as s:
            recap = s.merge(recap)
            s.commit()
            s.refresh(recap)
        self.bus.publish({"type": "recap", "recap": dump(recap)})
        return recap

    def get_recap(self, recap_id: str) -> Recap | None:
        with self.db.session() as s:
            return s.get(Recap, recap_id)

    def list_recaps(self, conversation_id: str | None = None) -> list[Recap]:
        with self.db.session() as s:
            q = select(Recap).order_by(col(Recap.created_at).desc())
            if conversation_id:
                q = q.where(Recap.conversation_id == conversation_id)
            return list(s.exec(q))

    # files + audit

    def add_file(self, conv_id: str, direction: str, filename: str, path: str, size: int, media_type: str) -> FileRecord:
        rec = FileRecord(conversation_id=conv_id, direction=direction, filename=filename, path=path, size=size, media_type=media_type)
        with self.db.session() as s:
            s.add(rec)
            s.commit()
            s.refresh(rec)
        return rec

    def get_file(self, file_id: str) -> FileRecord | None:
        with self.db.session() as s:
            return s.get(FileRecord, file_id)

    def audit(self, event: str, **fields: Any) -> None:
        top = {k: fields.pop(k, None) for k in ("agent_id", "peer_agent_id", "context_id", "task_id")}
        detail = redact(fields)
        with self.db.session() as s:
            s.add(AuditLog(event=event, detail=detail, **top))
            s.commit()
        # The office server's event log gets the same metadata (office.WorldClient forwards it).
        for listener in self.audit_listeners:
            try:
                listener(event, top.get("agent_id"), top.get("peer_agent_id"), detail)
            except Exception:
                log.debug("audit listener failed", exc_info=True)

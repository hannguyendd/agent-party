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
    AuditLog,
    Conversation,
    ConversationStatus,
    Direction,
    FileRecord,
    Message,
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
        return msg

    def list_messages(self, conv_id: str) -> list[Message]:
        with self.db.session() as s:
            return list(s.exec(select(Message).where(Message.conversation_id == conv_id).order_by(Message.created_at)))

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
        with self.db.session() as s:
            s.add(AuditLog(event=event, detail=redact(fields), **top))
            s.commit()

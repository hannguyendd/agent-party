import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, Column, UniqueConstraint
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return uuid.uuid4().hex


# Read-only by default; the CLI has no Glob/Grep, so searching goes through plain Bash commands.
DEFAULT_ALLOWED_TOOLS = ("Read", "Bash(ls*)", "Bash(rg *)", "Bash(grep *)", "Bash(git status*)", "Bash(git log*)", "Bash(git diff*)")


class Direction(StrEnum):
    INBOUND = "inbound"  # a peer started it; we answer
    OUTBOUND = "outbound"  # our agent started it with a peer
    LOCAL = "local"  # owner-only session (e.g. a fork)


class ConversationStatus(StrEnum):
    IDLE = "idle"
    RUNNING = "running"
    AWAITING_APPROVAL = "awaiting_approval"
    AWAITING_OWNER = "awaiting_owner"
    INTERRUPTED = "interrupted"
    DONE = "done"
    ERROR = "error"


class ConversationKind(StrEnum):
    PLAIN = ""  # dashboard / mesh-tool conversations
    INQUIRY = "inquiry"
    ASSIGNMENT = "assignment"  # needs the receiving owner's acceptance (CONTEXT.md, ADR 0002)


class Mode(StrEnum):
    AUTO = "auto"
    MANUAL = "manual"


class ApprovalStatus(StrEnum):
    PENDING = "pending"
    ALLOWED = "allowed"
    DENIED = "denied"
    TIMED_OUT = "timed_out"


class Agent(SQLModel, table=True):
    __tablename__ = "agents"

    id: str = Field(primary_key=True)  # e.g. han/backend-agent
    name: str
    description: str = ""
    skills: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    working_dir: str
    setting_sources: list[str] = Field(default_factory=lambda: ["project"], sa_column=Column(JSON))
    allowed_tools: list[str] = Field(default_factory=lambda: list(DEFAULT_ALLOWED_TOOLS), sa_column=Column(JSON))
    denied_tools: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    system_prompt: str = ""
    model: str | None = None
    enabled: bool = True
    created_at: datetime = Field(default_factory=utcnow)


class Conversation(SQLModel, table=True):
    __tablename__ = "conversations"
    __table_args__ = (UniqueConstraint("agent_id", "context_id"),)

    id: str = Field(default_factory=new_id, primary_key=True)
    agent_id: str = Field(index=True, foreign_key="agents.id")
    context_id: str = Field(index=True)
    peer_agent_id: str | None = None
    direction: Direction
    session_id: str | None = None
    status: ConversationStatus = ConversationStatus.IDLE
    mode: Mode = Mode.AUTO
    turn_count: int = 0
    title: str = ""
    kind: str = ConversationKind.PLAIN
    # Set when the receiving owner accepted an Assignment: file edits run without asking (ADR 0002).
    accepted: bool = False
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class Message(SQLModel, table=True):
    __tablename__ = "messages"

    id: str = Field(default_factory=new_id, primary_key=True)
    conversation_id: str = Field(index=True, foreign_key="conversations.id")
    # peer | agent | owner | tool | system
    role: str
    # text | tool_use | tool_result | status | file
    kind: str = "text"
    content: str = ""
    data: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utcnow, index=True)


class Approval(SQLModel, table=True):
    __tablename__ = "approvals"

    id: str = Field(default_factory=new_id, primary_key=True)
    conversation_id: str = Field(index=True, foreign_key="conversations.id")
    tool_name: str
    tool_input: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    status: ApprovalStatus = ApprovalStatus.PENDING
    reason: str = ""
    created_at: datetime = Field(default_factory=utcnow)
    decided_at: datetime | None = None


class FileRecord(SQLModel, table=True):
    __tablename__ = "files"

    id: str = Field(default_factory=new_id, primary_key=True)
    conversation_id: str = Field(index=True, foreign_key="conversations.id")
    direction: str  # received | sent
    filename: str
    path: str
    size: int
    media_type: str = ""
    created_at: datetime = Field(default_factory=utcnow)


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_log"

    id: int | None = Field(default=None, primary_key=True)
    ts: datetime = Field(default_factory=utcnow, index=True)
    event: str
    agent_id: str | None = None
    peer_agent_id: str | None = None
    context_id: str | None = None
    task_id: str | None = None
    # Metadata only: never message bodies (PHI must stay out of the audit trail).
    detail: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

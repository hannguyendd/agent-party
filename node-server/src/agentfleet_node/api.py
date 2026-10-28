"""Dashboard API: REST for actions, one WebSocket for the live event stream."""

import asyncio
import base64
import binascii
import uuid
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request, WebSocket
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from agentfleet_node.models import DEFAULT_ALLOWED_TOOLS, Agent, Direction
from agentfleet_node.files import FileRejected, file_ref, save_to_inbox
from agentfleet_node.mesh import AgentOffline
from agentfleet_node.naming import InvalidAgentId, owner_of, validate_agent_id
from agentfleet_node.store import dump

router = APIRouter(prefix="/api")


def _node(request: Request):
    return request.app.state.node


class SkillIn(BaseModel):
    name: str
    description: str = ""
    examples: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class AgentIn(BaseModel):
    id: str
    name: str
    description: str = ""
    skills: list[SkillIn] = Field(default_factory=list)
    working_dir: str
    setting_sources: list[str] = Field(default_factory=lambda: ["project"])
    allowed_tools: list[str] = Field(default_factory=lambda: list(DEFAULT_ALLOWED_TOOLS))
    denied_tools: list[str] = Field(default_factory=list)
    system_prompt: str = ""
    model: str | None = None
    contact_policy: Literal["auto", "ask"] = "auto"


class TextIn(BaseModel):
    text: str = Field(min_length=1)


class FileIn(BaseModel):
    """A file attached by the owner, base64-encoded (inline; same limits as files from peers)."""

    name: str = Field(min_length=1)
    media_type: str = ""
    data: str


class InjectIn(BaseModel):
    text: str = ""
    files: list[FileIn] = Field(default_factory=list, max_length=10)


class StartIn(InjectIn):
    agent_id: str


class DeskIn(BaseModel):
    desk: str


class SkinIn(BaseModel):
    agent_id: str
    skin: str


class MoveIn(BaseModel):
    agent_id: str
    at: dict[str, Any]


class AssignIn(BaseModel):
    from_agent: str
    to_agent: str
    text: str = Field(min_length=1)


class DecisionIn(BaseModel):
    allow: bool
    reason: str = ""


@router.get("/node")
async def node_info(request: Request) -> dict[str, Any]:
    node = _node(request)
    s = node.settings
    return {
        "owner": s.owner,
        "base_url": s.public_base_url,
        "mesh": await node.directory.node_status(),
        "files": {"max_bytes": s.max_inline_file_bytes, "suffixes": s.allowed_file_suffixes},
    }


@router.post("/mesh/sync")
async def mesh_sync(request: Request) -> dict[str, Any]:
    node = _node(request)
    node.directory.sync_node_config()
    return await node.directory.node_status()


@router.post("/mesh/restarted")
async def mesh_restarted(request: Request) -> dict[str, Any]:
    """Owner confirms agentmesh-node was restarted with the new config."""
    node = _node(request)
    node.directory.config_dirty = False
    return await node.directory.node_status()


# agents


@router.get("/agents")
def list_agents(request: Request) -> list[dict[str, Any]]:
    return [dump(a) for a in _node(request).store.list_agents() if a.enabled]


@router.get("/directory")
async def directory(request: Request) -> list[dict[str, Any]]:
    return await _node(request).directory.list_agents()


@router.get("/public/agents")
def public_agents(request: Request) -> list[dict[str, Any]]:
    """Published card fields only (used by static-peer dev setups)."""
    return [
        {"agent_id": a.id, "name": a.name, "description": a.description, "skills": a.skills}
        for a in _node(request).store.list_agents()
        if a.enabled
    ]


@router.post("/agents")
def upsert_agent(body: AgentIn, request: Request) -> dict[str, Any]:
    node = _node(request)
    try:
        validate_agent_id(body.id)
    except InvalidAgentId as e:
        raise HTTPException(422, str(e)) from None
    if owner_of(body.id) != node.settings.owner:
        raise HTTPException(422, f"agent IDs on this device must start with '{node.settings.owner}/'")
    wd = Path(body.working_dir).expanduser()
    if not wd.is_dir():
        raise HTTPException(422, f"working directory does not exist: {wd}")
    data = body.model_dump()
    data["working_dir"] = str(wd.resolve())
    data["skills"] = [s.model_dump() for s in body.skills]
    agent = node.store.save_agent(Agent(**data, enabled=True))
    node.gateway.invalidate(agent.id)
    node.directory.sync_node_config()
    return dump(agent)


@router.delete("/agents/{agent_id:path}")
def delete_agent(agent_id: str, request: Request) -> dict[str, str]:
    node = _node(request)
    if node.store.get_agent(agent_id) is None:
        raise HTTPException(404, "no such agent")
    node.store.delete_agent(agent_id)
    node.gateway.invalidate(agent_id)
    node.directory.sync_node_config()
    return {"status": "removed"}


# conversations


@router.get("/conversations")
def list_conversations(request: Request, agent_id: str | None = None) -> list[dict[str, Any]]:
    node = _node(request)
    return [
        {**dump(c), "awaiting_owner": node.sessions.awaiting_owner(c.id)}
        for c in node.store.list_conversations(agent_id)
    ]


@router.post("/conversations")
async def start_conversation(body: StartIn, request: Request) -> dict[str, Any]:
    """Owner starts a local session with one of their agents (e.g. 'ask bob/qa-agent about X')."""
    node = _node(request)
    agent = node.store.get_agent(body.agent_id)
    if agent is None or not agent.enabled:
        raise HTTPException(404, "no such agent")
    _need_content(body)
    conv = node.store.create_conversation(agent.id, f"local-{uuid.uuid4().hex}", Direction.LOCAL, title=(body.text or body.files[0].name)[:80])
    files = _save_attachments(node, conv, body.files)
    await node.sessions.worker(conv.id).inject(body.text, files)
    return dump(conv)


def _need_content(body: InjectIn) -> None:
    if not body.text.strip() and not body.files:
        raise HTTPException(422, "send some text or at least one file")


def _save_attachments(node, conv, files: list[FileIn]) -> list[dict[str, Any]]:
    """Decode and store the owner's attachments in the agent's inbox; 422 on a bad or disallowed file."""
    agent = node.store.get_agent(conv.agent_id)
    out = []
    for f in files:
        try:
            data = base64.b64decode(f.data, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(422, f"{f.name}: not valid base64") from None
        try:
            path = save_to_inbox(node.settings, agent.working_dir, conv.context_id, f.name, data)
        except FileRejected as e:
            raise HTTPException(422, f"{f.name}: {e}") from None
        rec = node.store.add_file(conv.id, "owner", f.name, str(path), len(data), f.media_type)
        out.append(file_ref(rec, agent.working_dir))
    if out:
        node.store.audit("owner_attached_files", agent_id=conv.agent_id, context_id=conv.context_id, count=len(out))
    return out


def _conv_or_404(node, conv_id: str):
    conv = node.store.get_conversation(conv_id)
    if conv is None:
        raise HTTPException(404, "no such conversation")
    return conv


@router.get("/conversations/{conv_id}")
def get_conversation(conv_id: str, request: Request) -> dict[str, Any]:
    node = _node(request)
    conv = _conv_or_404(node, conv_id)
    return {
        "conversation": {**dump(conv), "awaiting_owner": node.sessions.awaiting_owner(conv.id)},
        "messages": [dump(m) for m in node.store.list_messages(conv_id)],
        "approvals": [dump(a) for a in node.store.list_approvals(conv_id)],
    }


@router.post("/conversations/{conv_id}/inject")
async def inject(conv_id: str, body: InjectIn, request: Request) -> dict[str, str]:
    node = _node(request)
    conv = _conv_or_404(node, conv_id)
    _need_content(body)
    files = _save_attachments(node, conv, body.files)
    await node.sessions.worker(conv_id).inject(body.text, files)
    return {"status": "sent"}


@router.get("/files/{file_id}")
def get_file(file_id: str, request: Request) -> FileResponse:
    """A file recorded in one of this node's conversations (attachments, files from peers). Images show inline."""
    node = _node(request)
    rec = node.store.get_file(file_id)
    conv = node.store.get_conversation(rec.conversation_id) if rec else None
    agent = node.store.get_agent(conv.agent_id) if conv else None
    path = Path(rec.path).resolve() if rec else None
    if not rec or not agent or not path or not path.is_file() or not path.is_relative_to(Path(agent.working_dir).resolve()):
        raise HTTPException(404, "no such file")
    inline = (rec.media_type or "").startswith("image/")
    return FileResponse(path, media_type=rec.media_type or None, filename=rec.filename, content_disposition_type="inline" if inline else "attachment")


@router.post("/conversations/{conv_id}/interrupt")
async def interrupt(conv_id: str, request: Request) -> dict[str, str]:
    node = _node(request)
    _conv_or_404(node, conv_id)
    await node.sessions.worker(conv_id).interrupt()
    return {"status": "interrupted"}


@router.post("/conversations/{conv_id}/takeover")
async def takeover(conv_id: str, request: Request) -> dict[str, str]:
    node = _node(request)
    _conv_or_404(node, conv_id)
    await node.sessions.takeover(conv_id)
    return {"status": "manual"}


@router.post("/conversations/{conv_id}/handback")
async def handback(conv_id: str, request: Request) -> dict[str, str]:
    node = _node(request)
    _conv_or_404(node, conv_id)
    await node.sessions.hand_back(conv_id)
    return {"status": "auto"}


@router.post("/conversations/{conv_id}/reply")
async def manual_reply(conv_id: str, body: TextIn, request: Request) -> dict[str, str]:
    node = _node(request)
    _conv_or_404(node, conv_id)
    if not await node.sessions.manual_reply(conv_id, body.text):
        raise HTTPException(409, "no peer is waiting for a reply in this conversation")
    return {"status": "sent"}


@router.post("/conversations/{conv_id}/fork")
async def fork(conv_id: str, request: Request) -> dict[str, str]:
    node = _node(request)
    _conv_or_404(node, conv_id)
    try:
        new_id = await node.sessions.fork(conv_id)
    except ValueError as e:
        raise HTTPException(409, str(e)) from None
    return {"conversation_id": new_id}


# approvals


@router.get("/approvals")
def pending_approvals(request: Request) -> list[dict[str, Any]]:
    return [dump(a) for a in _node(request).store.list_approvals(pending_only=True)]


@router.post("/approvals/{approval_id}")
def decide(approval_id: str, body: DecisionIn, request: Request) -> dict[str, str]:
    if not _node(request).sessions.decide(approval_id, body.allow, body.reason):
        raise HTTPException(409, "approval is not pending (already decided or timed out)")
    return {"status": "allowed" if body.allow else "denied"}


# office (world server relay, ADR 0001)


@router.get("/office")
def office(request: Request) -> dict[str, Any]:
    return _node(request).world.view()


async def _world_send(node, op: dict[str, Any]) -> dict[str, str]:
    try:
        await node.world.send(op)
    except ConnectionError as e:
        raise HTTPException(409, str(e)) from None
    return {"status": "sent"}


def _own_agent(node, agent_id: str) -> None:
    agent = node.store.get_agent(agent_id)
    if agent is None or not agent.enabled:
        raise HTTPException(404, "no such agent on this node")


@router.post("/office/desk")
async def office_desk(body: DeskIn, request: Request) -> dict[str, str]:
    return await _world_send(_node(request), {"op": "claim_desk", "desk": body.desk})


@router.post("/office/skin")
async def office_skin(body: SkinIn, request: Request) -> dict[str, str]:
    node = _node(request)
    _own_agent(node, body.agent_id)
    return await _world_send(node, {"op": "set_skin", "agent_id": body.agent_id, "skin": body.skin})


@router.post("/office/move")
async def office_move(body: MoveIn, request: Request) -> dict[str, str]:
    node = _node(request)
    _own_agent(node, body.agent_id)
    return await _world_send(node, {"op": "move", "agent_id": body.agent_id, "at": body.at})


@router.post("/notify/test")
async def notify_test(request: Request) -> dict[str, bool]:
    """Fire a test OS notification on this machine (what owners get when no dashboard tab is open)."""
    from agentfleet_node.notify import os_notify

    return {"shown": os_notify("Agent Mesh", "Test notification: this is how you'll be woken for an assignment.")}


@router.post("/office/assign")
async def office_assign(body: AssignIn, request: Request) -> dict[str, str]:
    """Assignment: our agent hands the owner's task to a peer, whose owner must accept it (CONTEXT.md, ADR 0002).
    Runs in the background: acceptance plus the peer's turn can take many minutes."""
    node = _node(request)
    _own_agent(node, body.from_agent)
    if body.to_agent == body.from_agent:
        raise HTTPException(422, "an agent cannot assign work to itself")
    try:
        await node.directory.resolve(body.to_agent)
    except AgentOffline as e:
        raise HTTPException(409, f"agent offline: {e}") from None
    except InvalidAgentId as e:
        raise HTTPException(422, str(e)) from None
    s = node.settings
    timeout = s.assignment_accept_timeout_s + s.turn_timeout_s + 60
    context_id = uuid.uuid4().hex

    async def run() -> None:
        try:
            await node.outbound.send(body.from_agent, body.to_agent, body.text, context_id=context_id, kind="assignment", timeout_s=timeout)
        except Exception:
            pass  # OutboundClient already recorded the failure on the conversation

    task = asyncio.create_task(run())
    _background.add(task)
    task.add_done_callback(_background.discard)
    # The conversation is created right away (before the network call); hand its id back so the UI can open it.
    for _ in range(40):
        conv = node.store.find_conversation(body.from_agent, context_id)
        if conv:
            return {"status": "sent", "conversation_id": conv.id}
        await asyncio.sleep(0.05)
    return {"status": "sent", "conversation_id": ""}


# Keep references to fire-and-forget tasks so they are not garbage-collected mid-flight.
_background: set[asyncio.Task] = set()


# live events


@router.websocket("/ws")
async def events(ws: WebSocket) -> None:
    node = ws.app.state.node
    await ws.accept()
    q = node.bus.subscribe()
    node.world.dashboard_joined()  # an open dashboard means the owner is present

    async def pump() -> None:
        await ws.send_json({"type": "hello", "owner": node.settings.owner})
        while True:
            await ws.send_json(await q.get())

    async def watch_close() -> None:
        # The dashboard never sends anything; reading is how we notice it went away.
        while True:
            await ws.receive_text()

    tasks = [asyncio.create_task(pump()), asyncio.create_task(watch_close())]
    try:
        await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    except asyncio.CancelledError:
        pass
    finally:
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        node.bus.unsubscribe(q)
        node.world.dashboard_left()

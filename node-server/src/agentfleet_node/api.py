"""Dashboard API: REST for actions, one WebSocket for the live event stream."""

import asyncio
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from agentfleet_node.models import DEFAULT_ALLOWED_TOOLS, Agent, Direction
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


class TextIn(BaseModel):
    text: str = Field(min_length=1)


class StartIn(BaseModel):
    agent_id: str
    text: str = Field(min_length=1)


class DecisionIn(BaseModel):
    allow: bool
    reason: str = ""


@router.get("/node")
async def node_info(request: Request) -> dict[str, Any]:
    node = _node(request)
    return {"owner": node.settings.owner, "base_url": node.settings.public_base_url, "mesh": await node.directory.node_status()}


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
        {"agent_id": a.id, "name": a.name, "description": a.description}
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
    conv = node.store.create_conversation(agent.id, f"local-{uuid.uuid4().hex}", Direction.LOCAL, title=body.text[:80])
    await node.sessions.worker(conv.id).inject(body.text)
    return dump(conv)


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
async def inject(conv_id: str, body: TextIn, request: Request) -> dict[str, str]:
    node = _node(request)
    _conv_or_404(node, conv_id)
    await node.sessions.worker(conv_id).inject(body.text)
    return {"status": "sent"}


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


# live events


@router.websocket("/ws")
async def events(ws: WebSocket) -> None:
    node = ws.app.state.node
    await ws.accept()
    q = node.bus.subscribe()
    try:
        await ws.send_json({"type": "hello", "owner": node.settings.owner})
        while True:
            event = await q.get()
            await ws.send_json(event)
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    finally:
        node.bus.unsubscribe(q)

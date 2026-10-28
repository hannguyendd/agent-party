"""A2A in both directions.

Inbound: ``A2AGateway`` serves every local agent at ``/a2a/<service>/`` (agent
card + JSON-RPC), and ``MeshAgentExecutor`` turns each A2A message into a turn
of the Claude session mapped to its contextId.

Outbound: ``OutboundClient`` resolves a target agent through the mesh and
sends it a message, recording the exchange as an outbound conversation.
"""

import logging
import uuid
from dataclasses import dataclass, field

import httpx
from a2a.client import ClientConfig, ClientFactory
from a2a.helpers.proto_helpers import get_message_text, new_task_from_user_message
from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events import EventQueue
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.routes import create_agent_card_routes, create_jsonrpc_routes
from a2a.server.tasks import InMemoryTaskStore, TaskUpdater
from a2a.types import (
    AgentCapabilities,
    AgentCard,
    AgentInterface,
    AgentSkill,
    Message,
    Part,
    Role,
    SendMessageRequest,
    TaskState,
)
from google.protobuf.json_format import MessageToDict
from starlette.applications import Starlette
from starlette.responses import JSONResponse

from agentfleet_node.config import Settings
from agentfleet_node.files import FileRejected, file_ref, save_to_inbox
from agentfleet_node.mesh import MeshDirectory, local_a2a_url
from agentfleet_node.models import Agent, ConversationKind, ConversationStatus, Direction
from agentfleet_node.naming import InvalidAgentId, from_service_name, validate_agent_id
from agentfleet_node.sessions import SessionManager, TurnTimeout
from agentfleet_node.store import Store

log = logging.getLogger(__name__)

SENDER_KEY = "agentfleet.from_agent"
# "inquiry" | "assignment" (CONTEXT.md). A sender claim like SENDER_KEY: only the receiving owner's acceptance
# widens permissions, so a wrong label gains nothing (ADR 0002).
KIND_KEY = "agentfleet.kind"


def build_card(settings: Settings, agent: Agent) -> AgentCard:
    skills = [
        AgentSkill(
            id=s.get("id") or s.get("name", f"skill-{i}").lower().replace(" ", "-"),
            name=s.get("name", f"skill {i}"),
            description=s.get("description", ""),
            tags=s.get("tags", []),
            examples=s.get("examples", []),
        )
        for i, s in enumerate(agent.skills)
    ] or [AgentSkill(id="general", name="General", description=agent.description or agent.name, tags=["general"])]
    return AgentCard(
        name=agent.id,
        description=f"{agent.name}: {agent.description}".strip(": "),
        version="1.0.0",
        supported_interfaces=[AgentInterface(url=local_a2a_url(settings, agent.id), protocol_binding="JSONRPC", protocol_version="1.0")],
        capabilities=AgentCapabilities(streaming=True),
        default_input_modes=["text/plain", "application/octet-stream"],
        default_output_modes=["text/plain"],
        skills=skills,
    )


def text_message(text: str, role=Role.ROLE_AGENT) -> Message:
    return Message(message_id=uuid.uuid4().hex, role=role, parts=[Part(text=text)])


def format_prompt(sender: str | None, text: str, saved_files: list[str], rejected: list[str]) -> str:
    parts = [f'<mesh_message from="{sender or "unknown"}">\n{text}\n</mesh_message>']
    if saved_files:
        parts.append("Files received, saved to: " + ", ".join(saved_files))
    if rejected:
        parts.append("Files rejected by policy: " + "; ".join(rejected))
    return "\n\n".join(parts)


class MeshAgentExecutor(AgentExecutor):
    def __init__(self, agent_id: str, settings: Settings, store: Store, sessions: SessionManager):
        self.agent_id = agent_id
        self.settings = settings
        self.store = store
        self.sessions = sessions

    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        msg = context.message
        task = context.current_task
        if task is None:
            task = new_task_from_user_message(msg)
            await event_queue.enqueue_event(task)
        up = TaskUpdater(event_queue, task.id, task.context_id)

        agent = self.store.get_agent(self.agent_id)
        if agent is None or not agent.enabled:
            await up.reject(up.new_agent_message([Part(text=f"agent {self.agent_id} is not available")]))
            return

        meta = MessageToDict(msg.metadata) if msg.HasField("metadata") else {}
        sender = meta.get(SENDER_KEY)
        try:
            sender = validate_agent_id(sender) if sender else None
        except InvalidAgentId:
            sender = None
        text = get_message_text(msg)
        kind = meta.get(KIND_KEY) if meta.get(KIND_KEY) in (ConversationKind.INQUIRY, ConversationKind.ASSIGNMENT) else ""

        conv = self.store.find_conversation(self.agent_id, task.context_id)
        if conv is None:
            conv = self.store.create_conversation(
                agent_id=self.agent_id, context_id=task.context_id, direction=Direction.INBOUND, peer_agent_id=sender, title=text[:80]
            )
            if kind:
                conv = self.store.update_conversation(conv.id, kind=kind)
        self.store.audit("inbound_message", agent_id=self.agent_id, peer_agent_id=sender, context_id=task.context_id, task_id=task.id, chars=len(text))
        if conv.turn_count >= self.settings.max_turns_per_context:
            self.store.add_message(conv.id, "system", "Turn limit reached; message rejected.", kind="status")
            await up.reject(up.new_agent_message([Part(text=f"turn limit ({self.settings.max_turns_per_context}) reached for this conversation")]))
            return
        conv = self.store.update_conversation(conv.id, turn_count=conv.turn_count + 1, status=ConversationStatus.RUNNING)

        saved, rejected = [], []
        for p in msg.parts:
            if p.HasField("raw"):
                try:
                    path = save_to_inbox(self.settings, agent.working_dir, task.context_id, p.filename or "file", p.raw)
                    rec = self.store.add_file(conv.id, "received", p.filename or path.name, str(path), len(p.raw), p.media_type)
                    saved.append(file_ref(rec, agent.working_dir))
                except FileRejected as e:
                    rejected.append(f"{p.filename}: {e}")
            elif p.HasField("url"):
                rejected.append(f"{p.url}: URL file parts are not fetched in v1")
        self.store.add_message(conv.id, "peer", text, sender=sender, files=saved, rejected_files=rejected)
        saved_paths = [f["path"] for f in saved]

        await up.start_work()

        async def status_hook(note: str) -> None:
            await up.update_status(TaskState.TASK_STATE_WORKING, up.new_agent_message([Part(text=note)]))

        if conv.kind == ConversationKind.ASSIGNMENT and not conv.accepted:
            accepted, reason = await self.sessions.request_acceptance(conv.id, sender, text, status_hook)
            self.store.audit("assignment_decided", agent_id=self.agent_id, peer_agent_id=sender, context_id=task.context_id,
                             task_id=task.id, accepted=accepted)
            if not accepted:
                await up.reject(up.new_agent_message([Part(text=reason)]))
                return

        try:
            result = await self.sessions.handle_inbound(conv.id, format_prompt(sender, text, saved_paths, rejected), status_hook)
        except TurnTimeout as e:
            await up.failed(up.new_agent_message([Part(text=str(e))]))
            return
        except Exception as e:
            log.exception("turn failed")
            self.store.set_status(conv.id, ConversationStatus.ERROR)
            await up.failed(up.new_agent_message([Part(text=f"agent error: {e}")]))
            return

        self.store.audit("inbound_reply", agent_id=self.agent_id, peer_agent_id=sender, context_id=task.context_id, task_id=task.id,
                         state="error" if result.error else "input_required" if result.needs_input else "completed")
        reply = up.new_agent_message([Part(text=result.text or "(no answer)")])
        if result.error:
            await up.failed(up.new_agent_message([Part(text=f"agent error: {result.error}")]))
        elif result.needs_input:
            await up.requires_input(reply)
        else:
            await up.complete(reply)

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        conv = self.store.find_conversation(self.agent_id, context.context_id or "")
        if conv:
            await self.sessions.worker(conv.id).interrupt(reason="peer cancelled")


class A2AGateway:
    """ASGI app mounted at /a2a: routes /<service>/... to that agent's A2A app,
    built lazily so agents added at runtime are served without a restart."""

    def __init__(self, settings: Settings, store: Store, sessions: SessionManager):
        self.settings = settings
        self.store = store
        self.sessions = sessions
        self._apps: dict[str, Starlette] = {}

    def invalidate(self, agent_id: str) -> None:
        self._apps.pop(agent_id, None)

    def _app_for(self, agent: Agent) -> Starlette:
        app = self._apps.get(agent.id)
        if app is None:
            card = build_card(self.settings, agent)
            handler = DefaultRequestHandler(
                agent_executor=MeshAgentExecutor(agent.id, self.settings, self.store, self.sessions),
                task_store=InMemoryTaskStore(),
                agent_card=card,
            )
            app = self._apps[agent.id] = Starlette(routes=create_agent_card_routes(card) + create_jsonrpc_routes(handler, rpc_url="/"))
        return app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return
        # Starlette keeps the full path in scope["path"] and routes on path minus root_path.
        root_path: str = scope.get("root_path", "")
        route_path: str = scope["path"].removeprefix(root_path)
        service, _, _rest = route_path.lstrip("/").partition("/")
        agent = None
        try:
            agent = self.store.get_agent(from_service_name(service))
        except InvalidAgentId:
            pass
        if agent is None or not agent.enabled:
            await JSONResponse({"error": f"no agent {service!r} on this node"}, status_code=404)(scope, receive, send)
            return
        sub = dict(scope)
        sub["root_path"] = f"{root_path}/{service}"
        await self._app_for(agent)(sub, receive, send)


@dataclass
class OutboundResult:
    reply: str
    state: str
    context_id: str
    task_id: str
    conversation_id: str
    files: list[str] = field(default_factory=list)


class OutboundClient:
    def __init__(self, settings: Settings, store: Store, directory: MeshDirectory):
        self.settings = settings
        self.store = store
        self.directory = directory

    async def send(
        self,
        from_agent: str,
        to_agent: str,
        text: str,
        context_id: str | None = None,
        task_id: str | None = None,
        files: list[tuple[str, bytes, str]] | None = None,
        kind: str = "",
        timeout_s: float | None = None,
    ) -> OutboundResult:
        validate_agent_id(to_agent)
        endpoint = await self.directory.resolve(to_agent)  # raises AgentOffline
        context_id = context_id or uuid.uuid4().hex

        conv = self.store.find_conversation(from_agent, context_id) or self.store.create_conversation(
            agent_id=from_agent, context_id=context_id, direction=Direction.OUTBOUND, peer_agent_id=to_agent, title=text[:80]
        )
        if kind and not conv.kind:
            conv = self.store.update_conversation(conv.id, kind=kind)
        if conv.turn_count >= self.settings.max_turns_per_context:
            raise RuntimeError(f"turn limit ({self.settings.max_turns_per_context}) reached for context {context_id}")
        self.store.update_conversation(conv.id, turn_count=conv.turn_count + 1, status=ConversationStatus.RUNNING)
        names = [f[0] for f in files or []]
        self.store.add_message(conv.id, "agent", text, files=names)
        self.store.audit("outbound_message", agent_id=from_agent, peer_agent_id=to_agent, context_id=context_id, via_mesh=endpoint.via_mesh, chars=len(text))

        parts = [Part(text=text)] + [Part(raw=data, filename=name, media_type=mt) for name, data, mt in files or []]
        msg = Message(message_id=uuid.uuid4().hex, role=Role.ROLE_USER, parts=parts, context_id=context_id)
        if task_id:
            msg.task_id = task_id
        msg.metadata.update({SENDER_KEY: from_agent, **({KIND_KEY: kind} if kind else {})})

        headers = self.directory.mesh_headers() if endpoint.via_mesh else {}
        try:
            async with httpx.AsyncClient(headers=headers, timeout=httpx.Timeout(timeout_s or self.settings.outbound_timeout_s, connect=10)) as hc:
                client = await ClientFactory(ClientConfig(httpx_client=hc, streaming=False)).create_from_url(endpoint.url)
                last = None
                async for ev in client.send_message(SendMessageRequest(message=msg)):
                    last = ev
        except Exception as e:
            self.store.add_message(conv.id, "system", f"Delivery failed: {e}", kind="status")
            self.store.set_status(conv.id, ConversationStatus.ERROR)
            raise

        reply, state, out_task = "", "unknown", ""
        if last is not None and last.HasField("task"):
            t = last.task
            out_task = t.id
            state = TaskState.Name(t.status.state).removeprefix("TASK_STATE_").lower()
            if t.status.HasField("message"):
                reply = get_message_text(t.status.message)
            for art in t.artifacts:
                reply += "\n" + "\n".join(p.text for p in art.parts if p.text)
        elif last is not None and last.HasField("message"):
            reply, state = get_message_text(last.message), "completed"

        self.store.add_message(conv.id, "peer", reply, sender=to_agent, state=state)
        if state == "rejected":
            # Declined by the peer or its owner (e.g. an Assignment): a normal outcome, not an error.
            self.store.add_message(conv.id, "system", f"Declined: {reply.strip() or 'no reason given'}", kind="status")
        self.store.update_conversation(
            conv.id,
            status=ConversationStatus.ERROR if state == "failed" else ConversationStatus.DONE if state == "rejected" else ConversationStatus.IDLE,
        )
        self.store.audit("outbound_reply", agent_id=from_agent, peer_agent_id=to_agent, context_id=context_id, task_id=out_task, state=state)
        return OutboundResult(reply=reply.strip(), state=state, context_id=context_id, task_id=out_task, conversation_id=conv.id, files=names)

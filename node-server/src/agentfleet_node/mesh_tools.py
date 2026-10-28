"""Mesh tools given to every agent session.

Claude runs them in-process (create_sdk_mcp_server); runtimes that can't (Codex) reach the same `MeshTools` through
`POST /api/internal/mesh/{conversation}/{tool}` via the stdio proxy in mesh_mcp.py.
"""

import json
from collections.abc import Callable
from typing import Any

from claude_agent_sdk import create_sdk_mcp_server, tool

from agentfleet_node.a2a_bridge import OutboundClient
from agentfleet_node.config import Settings
from agentfleet_node.files import FileRejected, read_for_sharing
from agentfleet_node.mesh import AgentOffline, MeshDirectory
from agentfleet_node.models import Agent

# name -> (description, JSON schema of the arguments)
TOOL_SPECS: dict[str, tuple[str, dict[str, Any]]] = {
    "list_agents": (
        "List agents reachable on the mesh: ID, name, description and skills. Use it to pick who can answer a question.",
        {"type": "object", "properties": {}},
    ),
    "send_message": (
        "Send a message to another agent by ID (e.g. 'bob/qa-agent') and wait for its reply. "
        "Pass context_id from a previous reply to continue that conversation; pass task_id too when the peer asked for input.",
        {
            "type": "object",
            "properties": {
                "to": {"type": "string"},
                "text": {"type": "string"},
                "context_id": {"type": "string"},
                "task_id": {"type": "string"},
            },
            "required": ["to", "text"],
        },
    ),
    "share_file": (
        "Send a file from your working directory to another agent, with a short note. Same reply shape as send_message.",
        {
            "type": "object",
            "properties": {
                "to": {"type": "string"},
                "path": {"type": "string", "description": "Path relative to your working directory"},
                "text": {"type": "string"},
                "context_id": {"type": "string"},
            },
            "required": ["to", "path"],
        },
    ),
    "needs_input": (
        "Mark your reply as a question for the peer: the conversation stays open waiting for their answer.",
        {"type": "object", "properties": {"question": {"type": "string"}}},
    ),
}


def _ok(payload: Any) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": payload if isinstance(payload, str) else json.dumps(payload, indent=2)}]}


def _err(text: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": text}], "is_error": True}


class MeshTools:
    """The mesh tools of one agent session (`worker` is its SessionWorker). Each method takes the tool's arguments
    and returns an MCP tool result dict."""

    def __init__(self, settings: Settings, directory: MeshDirectory, outbound: OutboundClient,
                 party_tags: Callable[[str], tuple[str, str]] | None, agent: Agent, worker):
        self.settings = settings
        self.directory = directory
        self.outbound = outbound
        self.party_tags = party_tags
        self.agent = agent
        self.worker = worker

    async def _send(self, args: dict[str, Any], files=None) -> dict[str, Any]:
        to = args.get("to", "")
        if to == self.agent.id:
            return _err("You cannot message yourself.")
        party_id, kind = self.party_tags(self.worker.conv_id) if self.party_tags else ("", "")
        try:
            res = await self.outbound.send(
                from_agent=self.agent.id,
                to_agent=to,
                text=args.get("text", ""),
                context_id=args.get("context_id") or None,
                task_id=args.get("task_id") or None,
                files=files,
                kind=kind,
                party_id=party_id,
            )
        except AgentOffline as e:
            return _err(f"agent offline: {e}")
        except Exception as e:
            return _err(f"send failed: {e}")
        return _ok({
            "from": to,
            "reply": res.reply,
            "state": res.state,
            "context_id": res.context_id,
            "task_id": res.task_id,
            "hint": "Pass context_id (and task_id when state is input_required) to continue this conversation.",
        })

    async def list_agents(self, args: dict[str, Any]) -> dict[str, Any]:
        rows = [r for r in await self.directory.list_agents() if r["agent_id"] != self.agent.id]
        return _ok(rows or "No other agents are online.")

    async def send_message(self, args: dict[str, Any]) -> dict[str, Any]:
        return await self._send(args)

    async def share_file(self, args: dict[str, Any]) -> dict[str, Any]:
        try:
            f = read_for_sharing(self.settings, self.agent.working_dir, args["path"])
        except FileRejected as e:
            return _err(str(e))
        return await self._send({**args, "text": args.get("text") or f"Sharing {f[0]}"}, files=[f])

    async def needs_input(self, args: dict[str, Any]) -> dict[str, Any]:
        self.worker.needs_input = True
        return _ok("Noted. End your turn with the question as your reply.")


class MeshToolsFactory:
    """`factory(agent, worker)` is the in-process SDK server (Claude); `factory.tools(agent, worker)` the plain tools
    behind the local route. `party_tags(conversation_id)` gives (party_id, kind) when the session is a Host's party
    conversation, so its messages to members carry the Party and an Assignment party still needs each member's owner
    to accept."""

    def __init__(self, settings: Settings, directory: MeshDirectory, outbound: OutboundClient,
                 party_tags: Callable[[str], tuple[str, str]] | None = None):
        self.settings = settings
        self.directory = directory
        self.outbound = outbound
        self.party_tags = party_tags

    def tools(self, agent: Agent, worker) -> MeshTools:
        return MeshTools(self.settings, self.directory, self.outbound, self.party_tags, agent, worker)

    def __call__(self, agent: Agent, worker) -> Any:
        t = self.tools(agent, worker)
        sdk_tools = [tool(name, desc, schema)(getattr(t, name)) for name, (desc, schema) in TOOL_SPECS.items()]
        return create_sdk_mcp_server("mesh", tools=sdk_tools)


def make_mesh_tools_factory(settings: Settings, directory: MeshDirectory, outbound: OutboundClient,
                            party_tags: Callable[[str], tuple[str, str]] | None = None) -> MeshToolsFactory:
    return MeshToolsFactory(settings, directory, outbound, party_tags)

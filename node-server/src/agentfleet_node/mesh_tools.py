"""Mesh tools given to every agent session, in-process via create_sdk_mcp_server."""

import json
from typing import Any

from claude_agent_sdk import create_sdk_mcp_server, tool

from agentfleet_node.a2a_bridge import OutboundClient
from agentfleet_node.config import Settings
from agentfleet_node.files import FileRejected, read_for_sharing
from agentfleet_node.mesh import AgentOffline, MeshDirectory
from agentfleet_node.models import Agent


def _ok(payload: Any) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": payload if isinstance(payload, str) else json.dumps(payload, indent=2)}]}


def _err(text: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": text}], "is_error": True}


def make_mesh_tools_factory(settings: Settings, directory: MeshDirectory, outbound: OutboundClient):
    def factory(agent: Agent, worker) -> Any:
        async def _send(args: dict[str, Any], files=None) -> dict[str, Any]:
            to = args.get("to", "")
            if to == agent.id:
                return _err("You cannot message yourself.")
            try:
                res = await outbound.send(
                    from_agent=agent.id,
                    to_agent=to,
                    text=args.get("text", ""),
                    context_id=args.get("context_id") or None,
                    task_id=args.get("task_id") or None,
                    files=files,
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

        @tool("list_agents", "List agents reachable on the mesh with their ID and description.", {})
        async def list_agents(args: dict[str, Any]) -> dict[str, Any]:
            rows = [r for r in await directory.list_agents() if r["agent_id"] != agent.id]
            return _ok(rows or "No other agents are online.")

        @tool(
            "send_message",
            "Send a message to another agent by ID (e.g. 'bob/qa-agent') and wait for its reply. "
            "Pass context_id from a previous reply to continue that conversation; pass task_id too when the peer asked for input.",
            {
                "type": "object",
                "properties": {
                    "to": {"type": "string", "description": "Recipient agent ID, e.g. 'bob/qa-agent'"},
                    "text": {"type": "string", "description": "The message body"},
                    "context_id": {"type": "string", "description": "From a previous reply, to continue that conversation"},
                    "task_id": {"type": "string", "description": "From a previous reply whose state was input_required"},
                },
                "required": ["to", "text"],
            },
        )
        async def send_message(args: dict[str, Any]) -> dict[str, Any]:
            return await _send(args)

        @tool(
            "share_file",
            "Send a file from your working directory to another agent, with a short note. Same reply shape as send_message.",
            {
                "type": "object",
                "properties": {
                    "to": {"type": "string", "description": "Recipient agent ID, e.g. 'bob/qa-agent'"},
                    "path": {"type": "string", "description": "Path relative to your working directory"},
                    "text": {"type": "string", "description": "Short note sent with the file"},
                    "context_id": {"type": "string", "description": "From a previous reply, to continue that conversation"},
                },
                "required": ["to", "path"],
            },
        )
        async def share_file(args: dict[str, Any]) -> dict[str, Any]:
            try:
                f = read_for_sharing(settings, agent.working_dir, args["path"])
            except FileRejected as e:
                return _err(str(e))
            return await _send({**args, "text": args.get("text") or f"Sharing {f[0]}"}, files=[f])

        @tool(
            "needs_input",
            "Only when answering a message a peer sent you: mark your reply as a question back to that peer, so the "
            "conversation stays open waiting for their answer. Never call it to start a conversation; use send_message.",
            {"type": "object", "properties": {"question": {"type": "string"}}},
        )
        async def needs_input(args: dict[str, Any]) -> dict[str, Any]:
            worker.needs_input = True
            return _ok("Noted. End your turn with the question as your reply.")

        return create_sdk_mcp_server("mesh", tools=[list_agents, send_message, share_file, needs_input])

    return factory

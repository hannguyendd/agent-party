"""Stdio MCP server that gives an out-of-process runtime (Codex) the mesh tools.

Codex starts it as `python -m agentfleet_node.mesh_mcp` with AGENTFLEET_MESH_URL (the node's
`/api/internal/mesh/<conversation>`) and AGENTFLEET_MESH_TOKEN (that conversation's secret). Each call is forwarded
to the node, where the agent's policy and the tools themselves run.
"""

import asyncio
import os
from typing import Any

import httpx
from mcp import types
from mcp.server.lowlevel import Server
from mcp.server.stdio import stdio_server

from agentfleet_node.mesh_tools import TOOL_SPECS


def build_server(url: str, token: str) -> Server:
    async def list_tools(ctx, params) -> types.ListToolsResult:
        return types.ListToolsResult(
            tools=[types.Tool(name=n, description=d, input_schema=s) for n, (d, s) in TOOL_SPECS.items()]
        )

    async def call_tool(ctx, params: types.CallToolRequestParams) -> types.CallToolResult:
        # No client timeout: Codex's per-tool timeout governs, and send_message waits for a whole peer turn.
        async with httpx.AsyncClient(timeout=None) as hc:
            try:
                r = await hc.post(f"{url}/{params.name}", json=params.arguments or {},
                                  headers={"Authorization": f"Bearer {token}"})
                r.raise_for_status()
                body: dict[str, Any] = r.json()
            except httpx.HTTPError as e:
                return types.CallToolResult(content=[types.TextContent(type="text", text=f"mesh tool failed: {e}")],
                                            is_error=True)
        return types.CallToolResult(
            content=[types.TextContent(type="text", text=c.get("text", "")) for c in body.get("content", [])],
            is_error=bool(body.get("is_error")),
        )

    return Server("mesh", on_list_tools=list_tools, on_call_tool=call_tool)


async def _main() -> None:
    server = build_server(os.environ["AGENTFLEET_MESH_URL"].rstrip("/"), os.environ["AGENTFLEET_MESH_TOKEN"])
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(_main())

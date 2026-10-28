"""Claude runtime: one connected ``ClaudeSDKClient`` per conversation."""

import asyncio
import logging
from typing import Any

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    HookMatcher,
    PermissionResultAllow,
    PermissionResultDeny,
    RateLimitEvent,
    ResultMessage,
    StreamEvent,
    SystemMessage,
    TextBlock,
    ToolPermissionContext,
    ToolResultBlock,
    ToolUseBlock,
    UserMessage,
)

from agentfleet_node.runtimes.base import RuntimeContext, RuntimeEvents

log = logging.getLogger(__name__)


class ClaudeRuntime:
    folds_injects = False  # the CLI may answer an injected prompt with its own result

    def __init__(self, ctx: RuntimeContext, events: RuntimeEvents):
        self.ctx = ctx
        self.events = events
        self.client: ClaudeSDKClient | None = None
        self._reader: asyncio.Task | None = None
        self._cost_seen = 0.0  # last total_cost_usd this client reported

    @property
    def started(self) -> bool:
        return self.client is not None

    async def start(self, resume_id: str | None) -> None:
        if self.client is not None:
            return
        agent, settings = self.ctx.agent, self.ctx.settings
        options = ClaudeAgentOptions(
            cwd=agent.working_dir,
            resume=resume_id,
            can_use_tool=self._can_use_tool,
            # can_use_tool alone is skipped for calls the CLI auto-approves (e.g. read-only Bash);
            # the hook runs on every call, so the agent's policy always applies.
            hooks={"PreToolUse": [HookMatcher(matcher=None, hooks=[self._pre_tool_use])]},
            include_partial_messages=True,
            setting_sources=agent.setting_sources,  # type: ignore[arg-type]
            mcp_servers={"mesh": self.ctx.mesh_tools},
            disallowed_tools=agent.denied_tools,
            system_prompt={"type": "preset", "preset": "claude_code", "append": self.ctx.prompt},
            model=agent.model,
            max_turns=settings.max_agent_turns_per_message,
            cli_path=settings.claude_cli_path,
        )
        self.client = self.ctx.client_factory(options)
        self._cost_seen = 0.0  # a new CLI process counts cost from zero
        await self.client.connect()
        self._reader = asyncio.create_task(self._read_loop(), name=f"reader-{self.ctx.conv_id}")

    async def send(self, prompt: str) -> None:
        assert self.client is not None
        await self.client.query(prompt)

    async def interrupt(self) -> None:
        if self.client is not None:
            await self.client.interrupt()

    async def close(self) -> None:
        if self._reader:
            self._reader.cancel()
        if self.client:
            try:
                await self.client.disconnect()
            except Exception:
                log.debug("disconnect failed", exc_info=True)
        self.client = None

    # stream handling

    async def _read_loop(self) -> None:
        assert self.client is not None
        try:
            async for msg in self.client.receive_messages():
                self._on_message(msg)
        except asyncio.CancelledError:
            raise
        except Exception as e:  # CLI died or protocol error
            log.exception("session reader failed for %s", self.ctx.conv_id)
            self.client = None
            self.events.failed(str(e))

    def _on_message(self, msg: Any) -> None:
        ev = self.events
        if not isinstance(msg, StreamEvent):
            ev.activity()
        if isinstance(msg, RateLimitEvent):
            ev.rate_limit(msg.rate_limit_info)
        elif isinstance(msg, StreamEvent):
            e = msg.event
            if e.get("type") == "content_block_delta" and e.get("delta", {}).get("type") == "text_delta":
                ev.text_delta(e["delta"]["text"])
        elif isinstance(msg, AssistantMessage):
            if msg.parent_tool_use_id:
                return  # subagent chatter stays out of the conversation view
            for block in msg.content:
                if isinstance(block, TextBlock) and block.text.strip():
                    ev.text(block.text)
                elif isinstance(block, ToolUseBlock):
                    ev.tool_use(block.id, block.name, block.input)
        elif isinstance(msg, UserMessage):
            if isinstance(msg.content, list):
                for block in msg.content:
                    if isinstance(block, ToolResultBlock):
                        ev.tool_result(block.tool_use_id, block.content, bool(block.is_error))
        elif isinstance(msg, SystemMessage):
            if msg.subtype == "init" and msg.data.get("session_id"):
                ev.session_id(msg.data["session_id"])
        elif isinstance(msg, ResultMessage):
            if msg.session_id:
                ev.session_id(msg.session_id)
            ev.result(msg.result or "", (msg.result or msg.subtype) if msg.is_error else None, self._cost_delta(msg))

    def _cost_delta(self, msg: ResultMessage) -> float:
        """The CLI reports total_cost_usd per process (it grows over a session), so count the increase since the
        last report of this client; a smaller number means a fresh process."""
        total = msg.total_cost_usd or 0.0
        delta = total - self._cost_seen if total >= self._cost_seen else total
        self._cost_seen = total
        return max(0.0, delta)

    # permissions

    async def _pre_tool_use(self, hook_input, tool_use_id, context) -> dict[str, Any]:
        decision = self.events.policy(hook_input["tool_name"], hook_input.get("tool_input") or {})
        out: dict[str, Any] = {"hookEventName": "PreToolUse", "permissionDecision": decision}
        if decision == "deny":
            out["permissionDecisionReason"] = f"Not allowed for mesh sessions of {self.ctx.agent.id}."
        return {"hookSpecificOutput": out}

    async def _can_use_tool(self, tool_name: str, tool_input: dict[str, Any], ctx: ToolPermissionContext):
        allow, reason = await self.events.decide(tool_name, tool_input)
        if allow:
            return PermissionResultAllow(updated_input=tool_input)
        return PermissionResultDeny(message=reason)

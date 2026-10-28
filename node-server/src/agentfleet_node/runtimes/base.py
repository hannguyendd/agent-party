"""The runtime strategy: what a conversation's model session must do, whichever SDK runs it.

`SessionWorker` (sessions.py) owns turns, the owner gate and the store; an `AgentRuntime` only drives one model
session and reports what happens through `RuntimeEvents`. Every tool decision goes back through `RuntimeEvents`
(`policy` / `decide`), so `sessions.policy_decision` stays the single source of truth for every runtime.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Protocol

from agentfleet_node.config import Settings
from agentfleet_node.models import Agent


@dataclass
class RuntimeContext:
    agent: Agent
    settings: Settings
    conv_id: str
    mesh_tools: Any  # the mesh tools factory's result for this worker
    prompt: str  # mesh prompt + the agent's own system prompt
    client_factory: Callable[..., Any]


class RuntimeEvents(Protocol):
    def activity(self) -> None:
        """Something other than a streaming delta arrived (ends the inject grace wait)."""

    def text_delta(self, text: str) -> None: ...

    def text(self, text: str) -> None: ...

    def tool_use(self, tool_id: str, name: str, input: dict[str, Any]) -> None: ...

    def tool_result(self, tool_id: str, content: Any, is_error: bool) -> None: ...

    def session_id(self, sid: str) -> None: ...

    def result(self, text: str, error: str | None, cost_usd: float | None) -> None:
        """One turn result. `cost_usd` is this result's own cost, not a running total."""

    def failed(self, error: str) -> None:
        """The session died (process exit, protocol error); the runtime is no longer started."""

    def rate_limit(self, info: Any) -> None: ...

    def policy(self, tool_name: str, tool_input: dict[str, Any]) -> str:
        """allow | deny | ask, without waiting for anyone."""

    async def decide(self, tool_name: str, tool_input: dict[str, Any]) -> tuple[bool, str]:
        """The policy, plus the owner's decision when it says ask. Returns (allowed, reason when denied)."""


class AgentRuntime(Protocol):
    def __init__(self, ctx: RuntimeContext, events: RuntimeEvents): ...

    @property
    def started(self) -> bool: ...

    async def start(self, resume_id: str | None) -> None: ...

    async def send(self, prompt: str) -> None:
        """Start a turn, or add input to the turn that is running."""

    async def interrupt(self) -> None: ...

    async def close(self) -> None: ...

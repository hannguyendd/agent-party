"""Agent runtimes: which SDK runs an agent's sessions (chosen per agent, ADR 0004)."""

from agentfleet_node.runtimes.base import AgentRuntime, RuntimeContext, RuntimeEvents
from agentfleet_node.runtimes.claude import ClaudeRuntime

RUNTIMES: dict[str, type] = {"claude": ClaudeRuntime}


def make_runtime(ctx: RuntimeContext, events: RuntimeEvents) -> AgentRuntime:
    name = getattr(ctx.agent, "runtime", "claude")
    try:
        cls = RUNTIMES[name]
    except KeyError:
        raise ValueError(f"unknown agent runtime: {name}") from None
    return cls(ctx, events)


__all__ = ["RUNTIMES", "AgentRuntime", "RuntimeContext", "RuntimeEvents", "make_runtime"]

"""How much of the machine's Claude plan is left (CONTEXT: an owner checks before handing work to an agent).

The Claude CLI emits a rate-limit event per window (five_hour, seven_day, ...) with the fraction used and when
it resets, during turns. One machine uses one Claude account, so this is per node, not per agent. The latest
value per window is kept in data/usage.json (it survives restarts), published to the dashboard, and sent to the
world server as numbers only, so colleagues see how much room someone's agents have before asking them.
"""

import json
import time
from typing import Any

from agentfleet_node.config import Settings
from agentfleet_node.store import EventBus

WINDOWS = ("five_hour", "seven_day", "seven_day_opus", "seven_day_sonnet")


def clean(usage: Any) -> dict[str, dict[str, Any]]:
    """Only known windows and numeric fields (the world server takes this from nodes as-is)."""
    out: dict[str, dict[str, Any]] = {}
    if not isinstance(usage, dict):
        return out
    for window, v in usage.items():
        if window not in WINDOWS or not isinstance(v, dict):
            continue
        try:
            u = v.get("utilization")
            out[window] = {
                "utilization": None if u is None else max(0.0, min(1.0, float(u))),
                "resets_at": int(v["resets_at"]) if v.get("resets_at") else None,
                "status": str(v.get("status", ""))[:20],
                "at": int(v.get("at") or time.time()),
            }
        except (TypeError, ValueError):
            continue
    return out


class UsageTracker:
    def __init__(self, settings: Settings, bus: EventBus):
        self.path = settings.data_dir / "usage.json"
        self.bus = bus
        try:
            self.usage = clean(json.loads(self.path.read_text()))
        except (OSError, ValueError):
            self.usage = {}
        self.listeners: list = []  # called with the whole view after each change (the world link)

    def update(self, info) -> None:
        """From a claude_agent_sdk RateLimitInfo."""
        window = info.rate_limit_type
        if window not in WINDOWS:
            return
        prev = self.usage.get(window, {})
        self.usage[window] = {
            # Some events carry only the status: keep the last known fraction rather than forget it.
            "utilization": info.utilization if info.utilization is not None else prev.get("utilization"),
            "resets_at": info.resets_at or prev.get("resets_at"),
            "status": info.status,
            "at": int(time.time()),
        }
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(json.dumps(self.usage, indent=2))
        except OSError:
            pass
        self.bus.publish({"type": "usage", "usage": self.usage})
        for listener in self.listeners:
            listener(self.usage)

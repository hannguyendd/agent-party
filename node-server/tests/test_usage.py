"""Claude plan usage: taken from the CLI's rate-limit events, kept per machine, shown to colleagues as numbers."""

import json

import httpx
from claude_agent_sdk import RateLimitInfo

from agentfleet_node.usage import clean

from test_two_nodes import wait_for
from test_world import RunningWorld


def test_clean_keeps_known_windows_and_numbers_only():
    out = clean({"five_hour": {"utilization": 1.7, "resets_at": "1700000000", "status": "allowed", "text": "x"},
                 "weird": {"utilization": 0.5}, "seven_day": "nope"})
    assert out == {"five_hour": {"utilization": 1.0, "resets_at": 1700000000, "status": "allowed", "at": out["five_hour"]["at"]}}


async def test_usage_is_kept_served_and_shared_with_the_office(node_factory, tmp_path):
    async with RunningWorld(tmp_path) as world:
        a = node_factory("kien", world_url=world.url, os_notifications=False)
        b = node_factory("bob", world_url=world.url, os_notifications=False)
        async with a, b:
            await wait_for(lambda: a.node.world.connected and b.node.world.connected)
            a.node.sessions.on_rate_limit(RateLimitInfo(status="allowed_warning", resets_at=1700000000, rate_limit_type="five_hour", utilization=0.82))
            a.node.sessions.on_rate_limit(RateLimitInfo(status="allowed", rate_limit_type="seven_day", utilization=0.3))
            a.node.sessions.on_rate_limit(RateLimitInfo(status="allowed", rate_limit_type="five_hour"))  # no number: keep 0.82
            async with httpx.AsyncClient(base_url=a.url) as c:
                u = (await c.get("/api/usage")).json()["usage"]
            assert u["five_hour"]["utilization"] == 0.82 and u["seven_day"]["utilization"] == 0.3
            assert json.loads((a.settings.data_dir / "usage.json").read_text())["five_hour"]["resets_at"] == 1700000000
            # Bob's Office knows how much room kien's agents have.
            await wait_for(lambda: b.node.world.mirror["usage"].get("kien", {}).get("seven_day", {}).get("utilization") == 0.3)

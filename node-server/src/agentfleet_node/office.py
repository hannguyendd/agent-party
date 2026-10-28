"""The node's link to the team's world server (ADR 0001).

Browsers never talk to the world server. This client keeps one WebSocket to it, publishes this node's agents,
the owner's presence and a status-only view of each agent's conversations, and relays world events to the
dashboard as ``{"type": "office", "event": ...}`` on the event bus.

Privacy: only agent IDs, names, statuses and directions leave the node; never titles or message content.
"""

import asyncio
import contextlib
import json
import logging
from collections.abc import Callable
from typing import Any

from websockets.asyncio.client import ClientConnection, connect

from agentfleet_node.config import Settings
from agentfleet_node.store import EventBus, Store

log = logging.getLogger(__name__)

ACTIVE_STATUSES = {"running", "awaiting_approval", "awaiting_owner"}


class WorldClient:
    def __init__(self, settings: Settings, store: Store, bus: EventBus):
        self.settings = settings
        self.store = store
        self.bus = bus
        self.connected = False
        self.mirror: dict[str, Any] = {"org": "", "desks": {}, "owners": {}, "agents": {}, "parties": {}, "desk_ids": [], "skins": []}
        # Called with each Party event from the world (party.PartyService reacts to joins, hand-offs, endings).
        self.party_listeners: list[Callable[[dict[str, Any]], None]] = []
        self._ws: ClientConnection | None = None
        self._dashboards = 0
        # conv_id -> status-only view, used to work out each agent's current activity
        self._convs: dict[str, dict[str, Any]] = {}
        self._tasks: list[asyncio.Task] = []

    @property
    def enabled(self) -> bool:
        return bool(self.settings.world_url)

    @property
    def present(self) -> bool:
        return self._dashboards > 0

    # lifecycle

    def start(self) -> None:
        if not self.enabled:
            return
        for c in self.store.list_conversations():
            self._convs[c.id] = self._conv_view(c.model_dump(mode="json"))
        q = self.bus.subscribe()
        self._tasks = [
            asyncio.create_task(self._watch_bus(q), name="world-bus"),
            asyncio.create_task(self._run(), name="world-link"),
        ]

    async def stop(self) -> None:
        for t in self._tasks:
            t.cancel()
        for t in self._tasks:
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await t
        self._tasks = []

    async def _run(self) -> None:
        attempt = 0
        while True:
            try:
                async with connect(self.settings.world_url, open_timeout=5) as ws:
                    self._ws = ws
                    attempt = 0
                    log.info("connected to the world server")
                    await self._send_raw({"op": "hello", "owner": self.settings.owner})
                    await self._resync()
                    async for raw in ws:
                        try:
                            self._on_world(json.loads(raw))
                        except ValueError:
                            continue
            except asyncio.CancelledError:
                raise
            except Exception as e:  # world server down or unreachable: keep retrying
                log.info("world link failed: %s", e)
            finally:
                self._ws = None
                if self.connected:
                    self.connected = False
                    self.bus.publish({"type": "office", "event": {"type": "link", "connected": False}})
            attempt += 1
            await asyncio.sleep(min(15.0, 0.5 * 2**attempt))

    async def _resync(self) -> None:
        await self._send_raw({"op": "presence", "present": self.present})
        await self._send_raw({"op": "agents", "agents": self._agent_rows()})
        for agent_id in {c["agent_id"] for c in self._convs.values()}:
            op = self._activity_op(agent_id)
            if op:
                await self._send_raw(op)

    # world -> dashboard

    def _on_world(self, ev: dict[str, Any]) -> None:
        t = ev.get("type")
        m = self.mirror
        if t == "snapshot":
            m["org"] = ev.get("org", "")
            m["desks"], m["owners"] = ev.get("desks", {}), ev.get("owners", {})
            m["agents"] = {a["agent_id"]: a for a in ev.get("agents", [])}
            m["parties"] = {p["party_id"]: p for p in ev.get("parties", [])}
            m["desk_ids"], m["skins"] = ev.get("desk_ids", []), ev.get("skins", [])
            self.connected = True
        elif t == "desks":
            m["desks"] = ev.get("desks", {})
        elif t == "owners":
            m["owners"] = ev.get("owners", {})
        elif t == "agent":
            m["agents"][ev["agent"]["agent_id"]] = ev["agent"]
        elif t == "agent_left":
            m["agents"].pop(ev.get("agent_id"), None)
        elif t == "party":
            m["parties"][ev["party"]["party_id"]] = ev["party"]
        elif t == "party_ended":
            m["parties"].pop(ev.get("party_id"), None)
        self.bus.publish({"type": "office", "event": ev})
        if t in ("party", "party_ended"):
            for listener in self.party_listeners:
                try:
                    listener(ev)
                except Exception:
                    log.exception("party listener failed")

    def view(self) -> dict[str, Any]:
        m = self.mirror
        return {
            "enabled": self.enabled,
            "connected": self.connected,
            "owner": self.settings.owner,
            "org": m["org"],
            "desks": m["desks"],
            "owners": m["owners"],
            "agents": list(m["agents"].values()),
            "parties": list(m["parties"].values()),
            "desk_ids": m["desk_ids"],
            "skins": m["skins"],
        }

    # dashboard / local events -> world

    def dashboard_joined(self) -> None:
        self._dashboards += 1
        if self._dashboards == 1:
            self._spawn_send({"op": "presence", "present": True})

    def dashboard_left(self) -> None:
        self._dashboards = max(0, self._dashboards - 1)
        if self._dashboards == 0:
            self._spawn_send({"op": "presence", "present": False})

    def party(self, party_id: str) -> dict[str, Any] | None:
        return self.mirror["parties"].get(party_id)

    def party_of(self, agent_id: str) -> dict[str, Any] | None:
        return next((p for p in self.mirror["parties"].values() if agent_id == p["host"] or agent_id in p["members"]), None)

    async def send(self, op: dict[str, Any]) -> None:
        """Send an owner action; raises when the world server is not reachable."""
        if self._ws is None or not self.connected:
            raise ConnectionError("not connected to the world server")
        await self._send_raw(op)

    async def _watch_bus(self, q: asyncio.Queue) -> None:
        while True:
            ev = await q.get()
            t = ev.get("type")
            if t in ("agent", "agent_removed"):
                await self._send_raw({"op": "agents", "agents": self._agent_rows()})
            elif t == "conversation":
                conv = ev["conversation"]
                before = self._convs.get(conv["id"], {}).get("status")
                self._convs[conv["id"]] = self._conv_view(conv)
                if before != conv["status"]:
                    op = self._activity_op(conv["agent_id"], changed=conv["id"])
                    if op:
                        await self._send_raw(op)

    def _spawn_send(self, op: dict[str, Any]) -> None:
        if self.enabled:
            asyncio.get_event_loop().create_task(self._send_raw(op))

    async def _send_raw(self, op: dict[str, Any]) -> None:
        ws = self._ws
        if ws is None:
            return  # resent in full on the next connect
        try:
            await ws.send(json.dumps(op))
        except Exception as e:
            log.debug("world send failed: %s", e)

    # helpers

    def _agent_rows(self) -> list[dict[str, str]]:
        return [{"agent_id": a.id, "name": a.name} for a in self.store.list_agents() if a.enabled]

    @staticmethod
    def _conv_view(conv: dict[str, Any]) -> dict[str, Any]:
        # Status-only: the title and messages stay on this node.
        return {
            "agent_id": conv["agent_id"],
            "peer": conv.get("peer_agent_id"),
            "status": conv["status"],
            "direction": conv["direction"],
            "updated_at": conv.get("updated_at", ""),
        }

    def _activity_op(self, agent_id: str, changed: str | None = None) -> dict[str, Any] | None:
        mine = [c for c in self._convs.values() if c["agent_id"] == agent_id]
        active = sorted((c for c in mine if c["status"] in ACTIVE_STATUSES), key=lambda c: c["updated_at"])
        if active:
            c = active[-1]
        elif changed and changed in self._convs:
            c = self._convs[changed]  # the conversation that just ended tells the agent to walk back
        else:
            return None
        return {"op": "activity", "agent_id": agent_id, "peer": c["peer"], "status": c["status"], "direction": c["direction"]}

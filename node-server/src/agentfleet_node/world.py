"""World server for the Office: one per team, next to the hub (ADR 0001).

It holds only Office state: which owners are present, who claimed which Desk, each agent's Skin and where it is
heading, which agents are currently talking (status only) and who is in which Party (Host, members, kind; never
its topic). It never sees message content.

Clients are node servers, never browsers. Each node connects to ``/world/ws``, says which owner it speaks for,
and may only act on that owner's agents. The owner claim is not verified (same trust level as the rest of v1 LAN).

Positions are symbolic targets that every browser resolves against the same map:
``{"kind": "desk"}`` (the owner's desk), ``{"kind": "tile", "x": .., "y": ..}`` or
``{"kind": "near", "agent_id": ..}`` (next to another agent).
"""

import json
import logging
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, PlainTextResponse

from agentfleet_node.naming import InvalidAgentId, owner_of, validate_agent_id

log = logging.getLogger(__name__)

# The real office: D1-D16 in the L-shaped block, M1/M2 in the middle (see docs/office/ASSET-BRIEF.md).
DESKS = tuple([f"D{i}" for i in range(1, 17)] + ["M1", "M2"])
SKINS = ("dev-hoodie", "designer", "lead", "shiba", "cat", "penguin", "alien", "robot",
         "mage", "knight", "ranger", "healer", "rogue", "berserker", "slime", "dragon")
# Agents that never picked a look get one of the first eight, so adding skins never changes an existing default.
DEFAULT_SKINS = SKINS[:8]
# Conversation statuses that mean "these two agents are talking right now".
ACTIVE_STATUSES = {"running", "awaiting_approval", "awaiting_owner"}
MAX_TILE = 500
PARTY_KINDS = ("inquiry", "assignment")
MIN_PARTY_MEMBERS = 2  # a Party is three or more agents: the Host plus at least two members


@dataclass
class AgentState:
    agent_id: str
    owner: str
    name: str
    skin: str
    at: dict[str, Any] = field(default_factory=lambda: {"kind": "desk"})
    steered: bool = False
    # Status-only view of what the agent is doing: {"peer": .., "status": .., "direction": ..} or None.
    activity: dict[str, Any] | None = None


@dataclass
class PartyState:
    """CONTEXT.md "Party": one Host, members talk only with the Host. No topic here (content stays on nodes)."""

    party_id: str
    host: str
    members: list[str]
    kind: str = "inquiry"


class WorldState:
    """Pure state + rules, so it can be tested without sockets."""

    def __init__(self, data_path: Path | None = None, org: str = ""):
        self.data_path = data_path
        self.org = org  # shown as "<org> Office" in every dashboard; set by the admin (`make server ORG=...`)
        self.desks: dict[str, str] = {}  # desk -> owner
        self.skins: dict[str, str] = {}  # agent_id -> skin
        self.agents: dict[str, AgentState] = {}
        self.present: dict[str, int] = {}  # owner -> nodes reporting the owner present
        self.connected: dict[str, int] = {}  # owner -> connected nodes
        self.parties: dict[str, PartyState] = {}
        self.usage: dict[str, dict] = {}  # owner -> Claude plan usage per window (numbers only)
        self._load()

    # persistence: only desk claims and skins survive a restart

    def _load(self) -> None:
        if self.data_path and self.data_path.exists():
            try:
                raw = json.loads(self.data_path.read_text())
                self.desks = {d: o for d, o in raw.get("desks", {}).items() if d in DESKS}
                self.skins = {a: s for a, s in raw.get("skins", {}).items() if s in SKINS}
            except (ValueError, OSError):
                log.warning("could not read %s; starting empty", self.data_path)

    def _save(self) -> None:
        if self.data_path:
            self.data_path.parent.mkdir(parents=True, exist_ok=True)
            self.data_path.write_text(json.dumps({"desks": self.desks, "skins": self.skins}, indent=2))

    # views

    def owners_view(self) -> dict[str, dict[str, bool]]:
        names = set(self.connected) | set(self.present) | set(self.desks.values())
        return {o: {"connected": self.connected.get(o, 0) > 0, "present": self.present.get(o, 0) > 0} for o in sorted(names)}

    def snapshot(self) -> dict[str, Any]:
        return {
            "type": "snapshot",
            "org": self.org,
            "desks": self.desks,
            "owners": self.owners_view(),
            "agents": [asdict(a) for a in self.agents.values()],
            "parties": [asdict(p) for p in self.parties.values()],
            "usage": self.usage,
            "desk_ids": list(DESKS),
            "skins": list(SKINS),
        }

    def default_skin(self, agent_id: str) -> str:
        return self.skins.get(agent_id) or DEFAULT_SKINS[sum(map(ord, agent_id)) % len(DEFAULT_SKINS)]

    # mutations: each returns the events to broadcast

    def owner_connected(self, owner: str, delta: int) -> list[dict]:
        self.connected[owner] = max(0, self.connected.get(owner, 0) + delta)
        return [{"type": "owners", "owners": self.owners_view()}]

    def set_present(self, owner: str, before: bool, now: bool) -> list[dict]:
        if before == now:
            return []
        self.present[owner] = max(0, self.present.get(owner, 0) + (1 if now else -1))
        return [{"type": "owners", "owners": self.owners_view()}]

    def sync_agents(self, owner: str, rows: list[dict], owned: set[str]) -> tuple[list[dict], set[str]]:
        """Replace the set of agents one node publishes. Returns events and the node's new agent set."""
        events: list[dict] = []
        new: set[str] = set()
        for row in rows:
            try:
                agent_id = validate_agent_id(str(row.get("agent_id", "")))
            except InvalidAgentId:
                continue
            if owner_of(agent_id) != owner:
                continue
            new.add(agent_id)
            name = str(row.get("name") or agent_id)[:60]
            cur = self.agents.get(agent_id)
            if cur is None:
                cur = self.agents[agent_id] = AgentState(agent_id, owner, name, self.default_skin(agent_id))
                events.append({"type": "agent", "agent": asdict(cur), "entered": True})
            elif cur.name != name:
                cur.name = name
                events.append({"type": "agent", "agent": asdict(cur)})
        for gone in owned - new:
            log.info("%s no longer publishes %s", owner, gone)
            events += self.remove_agent(gone)
        return events, new

    def remove_agent(self, agent_id: str) -> list[dict]:
        if self.agents.pop(agent_id, None) is None:
            return []
        events: list[dict] = [{"type": "agent_left", "agent_id": agent_id}]
        # The Host dropping offline ends its Party; a member dropping offline just leaves it.
        for p in list(self.parties.values()):
            if p.host == agent_id:
                events += self._end_party(p, "host_offline")
            elif agent_id in p.members:
                p.members.remove(agent_id)
                events.append(self._party_event(p))
        # Anyone walking towards it goes back to their desk.
        for a in self.agents.values():
            if a.at.get("kind") == "near" and a.at.get("agent_id") == agent_id:
                a.at, a.steered = {"kind": "desk"}, False
                events.append({"type": "agent", "agent": asdict(a)})
        return events

    def claim_desk(self, owner: str, desk: str) -> list[dict]:
        if desk not in DESKS:
            raise ValueError(f"no desk {desk!r}")
        holder = self.desks.get(desk)
        if holder and holder != owner:
            raise ValueError(f"desk {desk} belongs to {holder}")
        for d, o in list(self.desks.items()):
            if o == owner:
                del self.desks[d]
        self.desks[desk] = owner
        self._save()
        return [{"type": "desks", "desks": self.desks}]

    def set_skin(self, owner: str, agent_id: str, skin: str) -> list[dict]:
        self._check_owner(owner, agent_id)
        if skin not in SKINS:
            raise ValueError(f"no skin {skin!r}")
        self.skins[agent_id] = skin
        self._save()
        a = self.agents.get(agent_id)
        if a is None:
            return []
        a.skin = skin
        return [{"type": "agent", "agent": asdict(a)}]

    def move(self, owner: str, agent_id: str, at: dict[str, Any]) -> list[dict]:
        """Steering: the owner sends their agent somewhere. Sending it to its desk ends steering."""
        self._check_owner(owner, agent_id)
        a = self.agents.get(agent_id)
        if a is None:
            raise ValueError(f"agent {agent_id} is not in the Office")
        a.at = self._clean_target(at, agent_id)
        a.steered = a.at["kind"] != "desk"
        return [{"type": "agent", "agent": asdict(a)}]

    def activity(self, owner: str, agent_id: str, peer: str | None, status: str, direction: str) -> list[dict]:
        """A conversation of one of the owner's agents changed status. Roaming: an agent that started the
        conversation walks to its peer while it is active (taking over from steering) and back to its desk after."""
        self._check_owner(owner, agent_id)
        a = self.agents.get(agent_id)
        if a is None:
            return []
        active = status in ACTIVE_STATUSES
        if peer is not None:
            try:
                peer = validate_agent_id(peer)
            except InvalidAgentId:
                peer = None
        was = a.activity
        a.activity = {"peer": peer, "status": status, "direction": direction} if active else None
        if direction == "outbound" and peer and peer in self.agents and self.party_of(agent_id) is None:
            if active:
                # It decided to talk to someone: it walks over, even if its owner had parked it somewhere.
                a.at, a.steered = {"kind": "near", "agent_id": peer}, False
            elif was is not None and not a.steered:
                a.at = {"kind": "desk"}
        return [{"type": "agent", "agent": asdict(a)}]

    # parties (CONTEXT.md "Party", ADR 0003)

    def party_of(self, agent_id: str) -> PartyState | None:
        return next((p for p in self.parties.values() if agent_id == p.host or agent_id in p.members), None)

    def open_party(self, owner: str, party_id: str, host: str, members: list[str], kind: str) -> list[dict]:
        """The Host's owner gathers a Party: members walk over and stand around the Host."""
        self._check_owner(owner, host)
        if not party_id or len(party_id) > 64 or party_id in self.parties:
            raise ValueError("bad or duplicate party id")
        if kind not in PARTY_KINDS:
            raise ValueError(f"unknown party kind {kind!r}")
        members = list(dict.fromkeys(m for m in members if m != host))
        if len(members) < MIN_PARTY_MEMBERS:
            raise ValueError("a Party needs the Host and at least two other agents")
        for a in [host, *members]:
            if a not in self.agents:
                raise ValueError(f"{a} is not in the Office")
            if self.party_of(a):
                raise ValueError(f"{a} is already in a Party")
        p = self.parties[party_id] = PartyState(party_id, host, members, kind)
        return [self._party_event(p), *self._gather(p, members)]

    def invite(self, owner: str, party_id: str, agent_id: str) -> list[dict]:
        """Any owner with an agent in the Party can bring another agent in."""
        p = self._party_for(owner, party_id)
        if agent_id not in self.agents:
            raise ValueError(f"{agent_id} is not in the Office")
        if self.party_of(agent_id):
            raise ValueError(f"{agent_id} is already in a Party")
        p.members.append(agent_id)
        return [self._party_event(p, joined=agent_id), *self._gather(p, [agent_id])]

    def leave(self, owner: str, party_id: str, agent_id: str) -> list[dict]:
        """A member's owner takes it out. The Host can't just leave: it hands off or ends the Party."""
        self._check_owner(owner, agent_id)
        p = self.parties.get(party_id)
        if p is None or agent_id not in p.members:
            raise ValueError(f"{agent_id} is not a member of that Party")
        p.members.remove(agent_id)
        return [self._party_event(p, left=agent_id), *self._send_home([agent_id])]

    def hand_off(self, owner: str, party_id: str, new_host: str) -> list[dict]:
        """The Host leaves on purpose: its owner passes the role to a member; the old Host goes back to its desk."""
        p = self.parties.get(party_id)
        if p is None:
            raise ValueError("no such Party")
        self._check_owner(owner, p.host)
        if new_host not in p.members:
            raise ValueError(f"{new_host} is not a member of that Party")
        old = p.host
        p.members.remove(new_host)
        p.host = new_host
        a = self.agents[new_host]
        a.at, a.steered = {"kind": "desk"} if a.at.get("kind") == "near" else a.at, False
        return [self._party_event(p, handed_off_from=old), *self._send_home([old]), {"type": "agent", "agent": asdict(a)},
                *self._gather(p, p.members)]

    def close_party(self, owner: str, party_id: str) -> list[dict]:
        p = self.parties.get(party_id)
        if p is None:
            return []
        self._check_owner(owner, p.host)
        return self._end_party(p, "closed")

    def _party_for(self, owner: str, party_id: str) -> PartyState:
        p = self.parties.get(party_id)
        if p is None:
            raise ValueError("no such Party")
        if not any(owner_of(a) == owner for a in [p.host, *p.members]):
            raise PermissionError(f"{owner} has no agent in that Party")
        return p

    def _end_party(self, p: PartyState, reason: str) -> list[dict]:
        self.parties.pop(p.party_id, None)
        return [{"type": "party_ended", "party_id": p.party_id, "host": p.host, "members": p.members, "reason": reason},
                *self._send_home(p.members)]

    def _gather(self, p: PartyState, ids: list[str]) -> list[dict]:
        out = []
        for i in ids:
            a = self.agents.get(i)
            if a:
                a.at, a.steered = {"kind": "near", "agent_id": p.host}, False
                out.append({"type": "agent", "agent": asdict(a)})
        return out

    def _send_home(self, ids: list[str]) -> list[dict]:
        out = []
        for i in ids:
            a = self.agents.get(i)
            if a:
                a.at, a.steered = {"kind": "desk"}, False
                out.append({"type": "agent", "agent": asdict(a)})
        return out

    @staticmethod
    def _party_event(p: PartyState, **extra: str) -> dict:
        return {"type": "party", "party": asdict(p), **extra}

    # helpers

    @staticmethod
    def _check_owner(owner: str, agent_id: str) -> None:
        try:
            if owner_of(agent_id) != owner:
                raise PermissionError(f"{owner} cannot act on {agent_id}")
        except InvalidAgentId as e:
            raise ValueError(str(e)) from None

    def _clean_target(self, at: dict[str, Any], agent_id: str) -> dict[str, Any]:
        kind = at.get("kind")
        if kind == "desk":
            return {"kind": "desk"}
        if kind == "tile":
            x, y = int(at.get("x", -1)), int(at.get("y", -1))
            if not (0 <= x < MAX_TILE and 0 <= y < MAX_TILE):
                raise ValueError("tile out of range")
            return {"kind": "tile", "x": x, "y": y}
        if kind == "near":
            target = str(at.get("agent_id", ""))
            if target == agent_id or target not in self.agents:
                raise ValueError(f"cannot walk to {target!r}")
            return {"kind": "near", "agent_id": target}
        raise ValueError(f"unknown target {kind!r}")


class WorldHub:
    """WebSocket fan-out around WorldState."""

    def __init__(self, state: WorldState):
        self.state = state
        self.clients: set[WebSocket] = set()
        # agent_id -> sockets publishing it (a node that reconnects, or one owner on two machines, gives several)
        self.publishers: dict[str, set[WebSocket]] = {}

    async def broadcast(self, events: list[dict]) -> None:
        for ev in events:
            for ws in list(self.clients):
                try:
                    await ws.send_json(ev)
                except Exception:
                    self.clients.discard(ws)

    async def serve(self, ws: WebSocket) -> None:
        await ws.accept()
        try:
            hello = await ws.receive_json()
        except (WebSocketDisconnect, ValueError):
            return
        owner = str(hello.get("owner", "")) if hello.get("op") == "hello" else ""
        if not owner or "/" in owner or "." in owner:
            await ws.send_json({"type": "error", "message": "first message must be {op: hello, owner}"})
            await ws.close()
            return

        owned: set[str] = set()
        present = False
        self.clients.add(ws)
        await self.broadcast(self.state.owner_connected(owner, +1))
        await ws.send_json(self.state.snapshot())
        try:
            while True:
                msg = await ws.receive_json()
                op = msg.get("op")
                try:
                    if op == "presence":
                        now = bool(msg.get("present"))
                        events = self.state.set_present(owner, present, now)
                        present = now
                    elif op == "agents":
                        # An agent this socket stops publishing leaves only if no other socket still publishes it.
                        held_elsewhere = {a for a in owned if self.publishers.get(a, set()) - {ws}}
                        events, new = self.state.sync_agents(owner, list(msg.get("agents") or []), owned - held_elsewhere)
                        for agent_id in owned - new:
                            self.publishers.get(agent_id, set()).discard(ws)
                        for agent_id in new:
                            self.publishers.setdefault(agent_id, set()).add(ws)
                        owned = new
                    elif op == "claim_desk":
                        events = self.state.claim_desk(owner, str(msg.get("desk", "")))
                    elif op == "set_skin":
                        events = self.state.set_skin(owner, str(msg.get("agent_id", "")), str(msg.get("skin", "")))
                    elif op == "move":
                        events = self.state.move(owner, str(msg.get("agent_id", "")), dict(msg.get("at") or {}))
                    elif op == "usage":
                        from agentfleet_node.usage import clean

                        self.state.usage[owner] = clean(msg.get("usage"))
                        events = [{"type": "usage", "owner": owner, "usage": self.state.usage[owner]}]
                    elif op == "party_open":
                        events = self.state.open_party(
                            owner, str(msg.get("party_id", "")), str(msg.get("host", "")),
                            [str(m) for m in msg.get("members") or []], str(msg.get("kind", "inquiry")),
                        )
                    elif op == "party_invite":
                        events = self.state.invite(owner, str(msg.get("party_id", "")), str(msg.get("agent_id", "")))
                    elif op == "party_leave":
                        events = self.state.leave(owner, str(msg.get("party_id", "")), str(msg.get("agent_id", "")))
                    elif op == "party_handoff":
                        events = self.state.hand_off(owner, str(msg.get("party_id", "")), str(msg.get("new_host", "")))
                    elif op == "party_close":
                        events = self.state.close_party(owner, str(msg.get("party_id", "")))
                    elif op == "activity":
                        events = self.state.activity(
                            owner, str(msg.get("agent_id", "")), msg.get("peer"),
                            str(msg.get("status", "")), str(msg.get("direction", "")),
                        )
                    else:
                        raise ValueError(f"unknown op {op!r}")
                except (ValueError, PermissionError, TypeError) as e:
                    await ws.send_json({"type": "error", "op": op, "message": str(e)})
                    continue
                await self.broadcast(events)
        except (WebSocketDisconnect, ValueError):
            pass
        finally:
            self.clients.discard(ws)
            events = self.state.set_present(owner, present, False)
            # An agent leaves when its last publishing socket closes (after a reconnect, the newer socket keeps it).
            for agent_id in owned:
                pubs = self.publishers.get(agent_id, set())
                pubs.discard(ws)
                if not pubs:
                    self.publishers.pop(agent_id, None)
                    log.info("%s left: its node's socket closed", agent_id)
                    events += self.state.remove_agent(agent_id)
            events += self.state.owner_connected(owner, -1)
            await self.broadcast(events)


INSTALL_TEMPLATES = {"sh": Path(__file__).with_name("install.sh"), "ps1": Path(__file__).with_name("install.ps1")}
_SAFE_NAME = re.compile(r"^[A-Za-z0-9._+-]+$")


def _shell_safe(text: str) -> str:
    """The organization name goes inside double quotes in a shell / PowerShell script."""
    return re.sub(r'[^A-Za-z0-9 ._&()-]', "", text)


def latest_wheel(downloads: Path | None) -> str:
    """Newest node package in the downloads folder ('' when there is none)."""
    if downloads is None or not downloads.is_dir():
        return ""
    wheels = sorted(downloads.glob("agentfleet_node-*.whl"), key=lambda p: p.stat().st_mtime)
    return wheels[-1].name if wheels else ""


def latest_build(downloads: Path | None) -> str:
    """Build id of the package in downloads (`make bundle` writes build.json next to it); nodes compare to update."""
    try:
        return str(json.loads((downloads / "build.json").read_text())["build"]) if downloads else ""
    except (OSError, ValueError, KeyError):
        return ""


def create_world_app(data_path: Path | None = None, downloads: Path | None = None, org: str = "",
                     hub_data: Path | None = None, hub_port: int = 7400) -> FastAPI:
    hub = WorldHub(WorldState(data_path, org.strip()[:60]))
    app = FastAPI(title="agentfleet world")
    app.state.hub = hub

    # /admin: invite staff machines (join tokens + install commands) from a browser (admin.py).
    from agentfleet_node.admin import AdminConfig, router as admin_router

    admin_dir = data_path.parent if data_path else Path("./data")
    app.state.admin = AdminConfig(admin_dir, hub_data, hub_port, downloads)
    app.include_router(admin_router(app.state.admin, hub, latest_wheel, latest_build))

    # Staff machines install from here: `curl -fsSL http://<server>:7500/install | bash`. The script and the
    # files it fetches (node package, agentmesh-node per OS/arch) come from `downloads` (`make bundle`).
    def render(kind: str, request: Request) -> str:
        server = request.headers.get("host") or f"{request.url.hostname}:{request.url.port or 80}"
        return (
            INSTALL_TEMPLATES[kind].read_text()
            .replace("__SERVER__", server)
            .replace("__HOST__", server.rsplit(":", 1)[0])
            .replace("__WHEEL__", latest_wheel(downloads))
            .replace("__ORG__", _shell_safe(hub.state.org))
        )

    @app.get("/install", response_class=PlainTextResponse)
    def install(request: Request) -> str:
        """macOS / Linux: curl -fsSL http://<server>:7500/install | bash"""
        return render("sh", request)

    @app.get("/install.ps1", response_class=PlainTextResponse)
    def install_windows(request: Request) -> str:
        """Windows (PowerShell): irm http://<server>:7500/install.ps1 | iex"""
        return render("ps1", request)

    @app.get("/info")
    def info() -> dict[str, Any]:
        return {"org": hub.state.org, "installer": bool(latest_wheel(downloads)), "build": latest_build(downloads)}

    @app.get("/downloads/{name}")
    def download(name: str) -> FileResponse:
        path = (downloads / name) if downloads and _SAFE_NAME.match(name) else None
        if path is None or not path.is_file():
            raise HTTPException(404, "no such file on this server")
        return FileResponse(path, filename=name)

    @app.get("/healthz")
    def healthz() -> dict[str, Any]:
        return {"ok": True, "org": hub.state.org, "nodes": len(hub.clients), "agents": len(hub.state.agents)}

    @app.websocket("/world/ws")
    async def world_ws(ws: WebSocket) -> None:
        await hub.serve(ws)

    return app

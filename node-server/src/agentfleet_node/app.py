from collections.abc import Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from agentfleet_node.a2a_bridge import A2AGateway, OutboundClient
from agentfleet_node.api import router
from agentfleet_node.config import Settings
from agentfleet_node.db import Database, make_engine
from agentfleet_node.mesh import MeshDirectory
from agentfleet_node.mesh_tools import make_mesh_tools_factory
from agentfleet_node.meshproc import MeshNodeProcess
from agentfleet_node.notify import os_notify
from agentfleet_node.office import WorldClient
from agentfleet_node.party import PartyService
from agentfleet_node.presence import Presence
from agentfleet_node.recap import RecapService
from agentfleet_node.sessions import SessionManager
from agentfleet_node.store import EventBus, Store
from agentfleet_node.usage import UsageTracker
from agentfleet_node.titles import TitleService
from agentfleet_node.notifications import NotificationService

# A repo checkout serves dashboard/dist (the latest `bun run build`); the installed package has no repo around it
# and carries the built dashboard in agentfleet_node/static instead (`make bundle`).
_REPO_DIST = Path(__file__).resolve().parents[3] / "dashboard" / "dist"
DASHBOARD_DIST = _REPO_DIST if (_REPO_DIST / "index.html").is_file() else Path(__file__).resolve().parent / "static"


@dataclass
class Node:
    settings: Settings
    bus: EventBus
    store: Store
    directory: MeshDirectory
    outbound: OutboundClient
    sessions: SessionManager
    gateway: A2AGateway
    world: WorldClient
    meshproc: MeshNodeProcess
    parties: PartyService
    recaps: RecapService
    usage: UsageTracker
    titles: TitleService
    presence: Presence | None = None
    notifications: NotificationService | None = None


def build_node(settings: Settings, client_factory: Callable | None = None) -> Node:
    bus = EventBus()
    store = Store(Database(make_engine(settings.db_path)), bus)
    directory = MeshDirectory(settings, store)
    outbound = OutboundClient(settings, store, directory)
    kwargs = {"client_factory": client_factory} if client_factory else {}
    holder: list[PartyService] = []  # sessions need the party tags; the party service needs the sessions
    tools = make_mesh_tools_factory(settings, directory, outbound, party_tags=lambda conv_id: holder[0].tags_for(conv_id))
    sessions = SessionManager(settings, store, tools, **kwargs)
    gateway = A2AGateway(settings, store, sessions)
    world = WorldClient(settings, store, bus)
    parties = PartyService(settings, store, sessions, outbound, world)
    holder.append(parties)
    gateway.parties = parties

    def wake_owner(conv_id: str, approval_id: str, sender: str | None) -> str:
        # An open dashboard notifies through the browser (it receives the approval event); otherwise use the OS.
        if world.present:
            return "browser"
        conv = store.get_conversation(conv_id)
        title = f"{sender or 'Someone'} wants to assign work"
        if settings.os_notifications and os_notify(title, f"to {conv.agent_id if conv else 'your agent'}: open the dashboard to accept"):
            return "os"
        return "none"

    sessions.wake_owner = wake_owner
    usage = UsageTracker(settings, bus)
    sessions.on_rate_limit = usage.update
    world.usage = usage
    usage.listeners.append(lambda u: world.send_usage(u))
    return Node(settings, bus, store, directory, outbound, sessions, gateway, world, MeshNodeProcess(settings),
                parties, RecapService(settings, store, parties), usage, TitleService(settings, store, bus, outbound))


def create_app(settings: Settings | None = None, client_factory: Callable | None = None) -> FastAPI:
    settings = (settings or Settings()).apply_setup_file()
    node = build_node(settings, client_factory)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        node.store.recover_after_restart()
        node.directory.sync_node_config()
        node.titles.start()
        node.notifications = NotificationService(node.store, node.bus)
        node.notifications.start()
        # Online (the default): world link + mesh node (a no-op with a reason if agentmesh-node isn't installed).
        await node.presence.apply()
        yield
        await node.meshproc.stop()
        await node.titles.stop()
        if node.notifications:
            await node.notifications.stop()
        await node.world.stop()
        await node.sessions.shutdown()

    app = FastAPI(title=f"agentfleet node ({settings.owner})", lifespan=lifespan)
    node.presence = Presence(node)
    app.state.node = node
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    app.mount("/a2a", node.gateway)
    if DASHBOARD_DIST.is_dir():
        app.mount("/", StaticFiles(directory=DASHBOARD_DIST, html=True), name="dashboard")
    return app

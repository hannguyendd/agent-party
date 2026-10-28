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
from agentfleet_node.notify import os_notify
from agentfleet_node.office import WorldClient
from agentfleet_node.sessions import SessionManager
from agentfleet_node.store import EventBus, Store

DASHBOARD_DIST = Path(__file__).resolve().parents[3] / "dashboard" / "dist"


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


def build_node(settings: Settings, client_factory: Callable | None = None) -> Node:
    bus = EventBus()
    store = Store(Database(make_engine(settings.db_path)), bus)
    directory = MeshDirectory(settings, store)
    outbound = OutboundClient(settings, store, directory)
    kwargs = {"client_factory": client_factory} if client_factory else {}
    sessions = SessionManager(settings, store, make_mesh_tools_factory(settings, directory, outbound), **kwargs)
    gateway = A2AGateway(settings, store, sessions)
    world = WorldClient(settings, store, bus)

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
    return Node(settings, bus, store, directory, outbound, sessions, gateway, world)


def create_app(settings: Settings | None = None, client_factory: Callable | None = None) -> FastAPI:
    settings = settings or Settings()
    node = build_node(settings, client_factory)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        node.directory.sync_node_config()
        node.world.start()
        yield
        await node.world.stop()
        await node.sessions.shutdown()

    app = FastAPI(title=f"agentfleet node ({settings.owner})", lifespan=lifespan)
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

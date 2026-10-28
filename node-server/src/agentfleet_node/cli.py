import argparse
import logging

import uvicorn

from agentfleet_node.config import Settings


def main() -> None:
    parser = argparse.ArgumentParser(prog="agentfleet-node")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("serve", help="run the node server (A2A endpoints + dashboard API)")
    sub.add_parser("mesh-config", help="write agentmesh-node.yaml publishing this node's agents and print it")
    world = sub.add_parser("world", help="run the team world server for the Office view (one per team, on the hub machine)")
    world.add_argument("--host", default="0.0.0.0")
    world.add_argument("--port", type=int, default=7500)
    world.add_argument("--data", default="./data/world.json", help="where desk claims and skins are kept")
    world.add_argument("--org", default="", help='organization name: dashboards show "<org> Office"')
    world.add_argument("--downloads", default="../dist/downloads",
                       help="folder served at /downloads for the staff installer (make bundle fills it)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    settings = None if args.cmd == "world" else Settings()  # the world server needs no device settings

    if args.cmd == "serve":
        from agentfleet_node.app import create_app

        uvicorn.run(create_app(settings), host=settings.host, port=settings.port)
    elif args.cmd == "world":
        from pathlib import Path

        from agentfleet_node.world import create_world_app

        uvicorn.run(create_world_app(Path(args.data), Path(args.downloads), args.org), host=args.host, port=args.port)
    elif args.cmd == "mesh-config":
        from agentfleet_node.db import Database, make_engine
        from agentfleet_node.mesh import write_node_config
        from agentfleet_node.store import EventBus, Store

        store = Store(Database(make_engine(settings.db_path)), EventBus())
        write_node_config(settings, store.list_agents())
        print(settings.mesh_node_config_path.read_text())

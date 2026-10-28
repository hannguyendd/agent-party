import argparse
import logging

import uvicorn

from agentfleet_node.config import Settings


def main() -> None:
    parser = argparse.ArgumentParser(prog="agentfleet-node")
    sub = parser.add_subparsers(dest="cmd")  # no command: the menu
    sub.add_parser("serve", help="run the node server (A2A endpoints + dashboard API)")
    sub.add_parser("mesh-config", help="write agentmesh-node.yaml publishing this node's agents and print it")
    # Staff machines (installed with the office server's installer): manage the login service.
    sub.add_parser("menu", help="the menu (same as no command)")
    auto = sub.add_parser("autostart", help="start the node when you log in: on | off")
    auto.add_argument("on", choices=["on", "off"])
    for name, text in [("status", "is the node running, which build, is an update available"),
                       ("open", "open the Office in the browser"), ("start", "start the node"),
                       ("stop", "stop the node (until the next login or start)"), ("restart", "restart the node"),
                       ("update", "install the newest build from the office server and restart"),
                       ("logs", "show the end of the node log")]:
        sub.add_parser(name, help=text)
    un = sub.add_parser("uninstall", help="remove the node, its login service and shortcuts (keeps your data)")
    un.add_argument("--purge", action="store_true", help="also delete ~/.agentfleet (agents, chats, setup)")
    world = sub.add_parser("world", help="run the team world server for the Office view (one per team, on the hub machine)")
    world.add_argument("--host", default="0.0.0.0")
    world.add_argument("--port", type=int, default=7500)
    world.add_argument("--data", default="./data/world.json", help="where desk claims and skins are kept")
    world.add_argument("--org", default="", help='organization name: dashboards show "<org> Office"')
    world.add_argument("--hub-data", default="../hub/data", help="the hub's data folder (admin page mints join tokens with it)")
    world.add_argument("--hub-port", type=int, default=7400)
    world.add_argument("--downloads", default="../dist/downloads",
                       help="folder served at /downloads for the staff installer (make bundle fills it)")
    args = parser.parse_args()
    # Servers log at INFO; the staff commands (menu, status, ...) only print their own lines.
    quiet = args.cmd not in ("serve", "world", "mesh-config")
    logging.basicConfig(level=logging.WARNING if quiet else logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    from agentfleet_node import service

    service.apply_node_env()  # an installed node keeps its data in ~/.agentfleet wherever it is started

    def serve() -> int:
        from agentfleet_node.app import create_app

        s = Settings()
        uvicorn.run(create_app(s), host=s.host, port=s.port)
        return 0

    if args.cmd in (None, "menu", "status", "open", "start", "stop", "restart", "update", "logs", "uninstall", "autostart"):
        raise SystemExit(service.main(args.cmd or "menu", serve, purge=getattr(args, "purge", False), on=getattr(args, "on", None)))

    settings = None if args.cmd == "world" else Settings()  # the world server needs no device settings

    if args.cmd == "serve":
        from agentfleet_node.app import create_app

        uvicorn.run(create_app(settings), host=settings.host, port=settings.port)
    elif args.cmd == "world":
        from pathlib import Path

        from agentfleet_node.world import create_world_app

        app = create_world_app(Path(args.data), Path(args.downloads), args.org, Path(args.hub_data), args.hub_port)
        print(f"Admin page: http://<this machine>:{args.port}/admin   (admin key: {app.state.admin.key})", flush=True)
        uvicorn.run(app, host=args.host, port=args.port)
    elif args.cmd == "mesh-config":
        from agentfleet_node.db import Database, make_engine
        from agentfleet_node.mesh import write_node_config
        from agentfleet_node.store import EventBus, Store

        store = Store(Database(make_engine(settings.db_path)), EventBus())
        write_node_config(settings, store.list_agents())
        print(settings.mesh_node_config_path.read_text())

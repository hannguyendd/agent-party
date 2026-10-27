import argparse
import logging

import uvicorn

from agentfleet_node.config import Settings


def main() -> None:
    parser = argparse.ArgumentParser(prog="agentfleet-node")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("serve", help="run the node server (A2A endpoints + dashboard API)")
    sub.add_parser("mesh-config", help="write agentmesh-node.yaml publishing this node's agents and print it")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    settings = Settings()

    if args.cmd == "serve":
        from agentfleet_node.app import create_app

        uvicorn.run(create_app(settings), host=settings.host, port=settings.port)
    elif args.cmd == "mesh-config":
        from agentfleet_node.db import Database, make_engine
        from agentfleet_node.mesh import write_node_config
        from agentfleet_node.store import EventBus, Store

        store = Store(Database(make_engine(settings.db_path)), EventBus())
        write_node_config(settings, store.list_agents())
        print(settings.mesh_node_config_path.read_text())

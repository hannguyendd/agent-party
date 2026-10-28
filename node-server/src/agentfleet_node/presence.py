"""Online / offline for this machine's owner, chosen in the dashboard and kept across restarts.

Offline: the node stays up (it serves the dashboard, which asks "go online?"), but the owner's agents leave the
Office (the world link closes), the mesh node stops (other machines can't reach them) and inbound A2A calls are
refused with "owner is offline". Online: all of that comes back. Stored in data/presence.json; default online.
Stopping the process itself is `agentfleet-node stop` (service.py).
"""

import json
import logging

log = logging.getLogger(__name__)


class Presence:
    def __init__(self, node):
        self.node = node
        self.path = node.settings.data_dir / "presence.json"
        try:
            self.online = bool(json.loads(self.path.read_text()).get("online", True))
        except (OSError, ValueError):
            self.online = True

    async def apply(self) -> None:
        """Bring the links in line with `online` (at startup and after each change)."""
        n = self.node
        n.gateway.offline = not self.online
        if self.online:
            n.world.start()
            if n.settings.hub_url:
                await n.meshproc.start()
        else:
            await n.world.stop()
            await n.meshproc.stop()

    async def set(self, online: bool) -> None:
        if online == self.online:
            return
        self.online = online
        try:
            self.node.settings.data_dir.mkdir(parents=True, exist_ok=True)
            self.path.write_text(json.dumps({"online": online}))
        except OSError:
            log.warning("could not save presence to %s", self.path)
        await self.apply()
        self.node.bus.publish({"type": "presence", "online": online})
        log.info("owner is now %s", "online" if online else "offline")

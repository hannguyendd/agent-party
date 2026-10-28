"""Runs this device's agentmesh-node for the owner, so joining the mesh is a web form, not a terminal session.

The node server starts `scripts/start-mesh-node.sh` (same flags as running it by hand) once setup knows the hub,
and restarts it whenever the published agents change, because agentmesh-node only reads its services at startup.
If agentmesh-node isn't installed, or the owner runs it themselves, this stays idle.
"""

import asyncio
import contextlib
import logging
import os
import shutil
from pathlib import Path

from agentfleet_node.config import Settings

log = logging.getLogger(__name__)

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "start-mesh-node.sh"


class MeshNodeProcess:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.proc: asyncio.subprocess.Process | None = None
        self.last_error: str | None = None

    @property
    def installed(self) -> bool:
        return shutil.which("agentmesh-node") is not None

    @property
    def running(self) -> bool:
        return self.proc is not None and self.proc.returncode is None

    @property
    def log_path(self) -> Path:
        return self.settings.data_dir / "mesh-node.log"

    def status(self) -> dict:
        return {
            "installed": self.installed,
            "managed": self.settings.hub_url is not None,
            "running": self.running,
            "pid": self.proc.pid if self.running and self.proc else None,
            "error": self.last_error,
            "log": str(self.log_path),
        }

    async def start(self) -> bool:
        """Start agentmesh-node against the configured hub. False (with last_error) when it can't."""
        s = self.settings
        if self.running:
            return True
        if not s.hub_url:
            self.last_error = "no office server configured yet"
            return False
        if not self.installed:
            self.last_error = "agentmesh-node is not installed on this machine"
            return False
        s.data_dir.mkdir(parents=True, exist_ok=True)
        env = {
            **os.environ,
            "HUB_URL": s.hub_url,
            "AGENTFLEET_DATA_DIR": str(s.data_dir.resolve()),
            "NODE_BIND": s.mesh_node_url.removeprefix("http://").removeprefix("https://"),
        }
        logf = self.log_path.open("ab")
        try:
            self.proc = await asyncio.create_subprocess_exec(
                "bash", str(SCRIPT), cwd=str(SCRIPT.parents[1]), env=env, stdout=logf, stderr=asyncio.subprocess.STDOUT
            )
        except OSError as e:
            self.last_error = f"could not start agentmesh-node: {e}"
            return False
        finally:
            logf.close()
        await asyncio.sleep(0.5)
        if not self.running:
            self.last_error = f"agentmesh-node exited right away; see {self.log_path}"
            return False
        self.last_error = None
        log.info("agentmesh-node started (pid %s)", self.proc.pid)
        return True

    async def stop(self) -> None:
        if not self.running or self.proc is None:
            return
        self.proc.terminate()
        try:
            await asyncio.wait_for(self.proc.wait(), 5)
        except TimeoutError:
            with contextlib.suppress(ProcessLookupError):
                self.proc.kill()
            await self.proc.wait()

    async def restart(self) -> bool:
        await self.stop()
        return await self.start()

"""Runs this device's agentmesh-node for the owner, so joining the mesh is a web form, not a terminal session.

The node server starts `agentmesh-node run` once setup knows the hub (the same flags as
`scripts/start-mesh-node.sh`, which stays for running it by hand) and restarts it whenever the published agents
change, because agentmesh-node only reads its services at startup. It needs nothing from the repo, so it works
from the installed package too. If agentmesh-node isn't installed, this stays idle with a reason.
"""

import asyncio
import contextlib
import logging
import os
import secrets
import shutil
from pathlib import Path

from agentfleet_node.config import Settings

log = logging.getLogger(__name__)

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
        data = s.data_dir.resolve()
        (data / "mesh-node").mkdir(parents=True, exist_ok=True)
        # The node API token the Python server uses for discovery and the /mesh proxy.
        if s.mesh_api_token_path is None:
            s.mesh_api_token_path = data / "mesh-api-token"
        token = Path(s.mesh_api_token_path)
        if not token.exists() or not token.read_text().strip():
            token.write_text(secrets.token_hex(32))
            token.chmod(0o600)
        args = [
            "agentmesh-node", "run",
            "--control-plane", s.hub_url,
            "--config", str(Path(s.mesh_node_config_path).resolve()),
            "--data-dir", str(data / "mesh-node"),
            "--bind-addr", s.mesh_node_url.removeprefix("http://").removeprefix("https://"),
            "--api-token-path", str(token.resolve()),
            "--allow-loopback",
        ]
        if s.hub_url.startswith("http://"):
            args.append("--insecure-control-plane")  # v1 is LAN-only over plain http: trust the hub on this network
        bootstrap = data / "bootstrap-token"
        if bootstrap.exists() and not (data / "mesh-node" / "agent.db").exists():
            args += ["--bootstrap-token-path", str(bootstrap)]  # enroll only until this node has an identity
        logf = self.log_path.open("ab")
        try:
            self.proc = await asyncio.create_subprocess_exec(*args, cwd=str(data), env=dict(os.environ), stdout=logf, stderr=asyncio.subprocess.STDOUT)
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

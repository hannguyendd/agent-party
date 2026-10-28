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

import httpx

from agentfleet_node.config import Settings

log = logging.getLogger(__name__)

# Friendlier words for agentmesh-node's enrollment failures, shown on the setup page.
_KNOWN_FAILURES = {
    "max usages exceeded": "this join token was already used; ask your admin for a new one (make hub-token)",
    "no route to host": "can't reach the office server's hub (port 7400); is it running and on this network?",
    "connection refused": "the office server's hub (port 7400) is not running",
    "invalid": "the join token is not valid; check it with your admin",
}

class MeshNodeProcess:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.proc: asyncio.subprocess.Process | None = None
        self.last_error: str | None = None
        self._confirm: asyncio.Task | None = None

    @property
    def installed(self) -> bool:
        return shutil.which("agentmesh-node") is not None

    @property
    def running(self) -> bool:
        return self.proc is not None and self.proc.returncode is None

    @property
    def log_path(self) -> Path:
        return self.settings.data_dir / "mesh-node.log"

    @property
    def _enrolled_mark(self) -> Path:
        return self.settings.data_dir / "mesh-node" / "enrolled"

    @property
    def enrolled(self) -> bool:
        """Set once the running node answered a mesh call. agent.db alone is not enough: agentmesh-node writes it
        before enrolling, so a failed first enrollment (hub down, token used) left a node that never enrolls."""
        return self._enrolled_mark.exists()

    def forget_enrollment(self) -> None:
        """A new join token was saved: use it on the next start."""
        self._enrolled_mark.unlink(missing_ok=True)

    def _failure_from_log(self) -> str:
        """Why the last run stopped, from the end of its log (the FATAL line agentmesh-node prints)."""
        try:
            tail = self.log_path.read_text(errors="replace")[-800:].lower()
        except OSError:
            return ""
        return next((text for needle, text in _KNOWN_FAILURES.items() if needle in tail), "")

    def status(self) -> dict:
        return {
            "installed": self.installed,
            "managed": self.settings.hub_url is not None,
            "running": self.running,
            "pid": self.proc.pid if self.running and self.proc else None,
            "error": self.last_error,
            "enrolled": self.enrolled,
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
        if bootstrap.exists() and not self.enrolled:
            args += ["--bootstrap-token-path", str(bootstrap)]  # enroll with the single-use token until it worked
        logf = self.log_path.open("ab")
        try:
            self.proc = await asyncio.create_subprocess_exec(*args, cwd=str(data), env=dict(os.environ), stdout=logf, stderr=asyncio.subprocess.STDOUT)
        except OSError as e:
            self.last_error = f"could not start agentmesh-node: {e}"
            return False
        finally:
            logf.close()
        await asyncio.sleep(0.8)
        if not self.running:
            reason = self._failure_from_log()
            self.last_error = f"agentmesh-node stopped: {reason}" if reason else f"agentmesh-node exited right away; see {self.log_path}"
            return False
        self.last_error = None
        log.info("agentmesh-node started (pid %s)", self.proc.pid)
        if not self.enrolled:
            self._confirm = asyncio.get_event_loop().create_task(self._confirm_enrollment(token))
        return True

    async def _confirm_enrollment(self, token: Path) -> None:
        """Mark the node enrolled once its mesh API answers (an unenrolled sidecar answers 404 to mesh calls)."""
        url = self.settings.mesh_node_url.rstrip("/") + "/mesh/service/discover?type=a2a&limit=1&timeout=1s"
        headers = {"X-Mesh-Authentication": f"Bearer {token.read_text().strip()}"}
        async with httpx.AsyncClient(timeout=5) as hc:
            for _ in range(30):
                if not self.running:
                    return
                with contextlib.suppress(httpx.HTTPError):
                    r = await hc.get(url, headers=headers)
                    if r.status_code != 404 and r.status_code < 500:
                        self._enrolled_mark.write_text("ok\n")
                        log.info("agentmesh-node is enrolled")
                        return
                await asyncio.sleep(1)
        self.last_error = "agentmesh-node is running but not enrolled with the hub; save a new join token in Settings"

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

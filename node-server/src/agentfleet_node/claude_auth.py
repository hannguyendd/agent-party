"""Claude Code's login on this machine: is it there, did a turn just fail on it, and logging in from the dashboard.

Status asks `claude auth status --json` (cached a few seconds; the file check in `api.claude_status` is the fallback).
That only says a login is saved, not that it still works, so a turn that fails on authentication marks the login
`expired` until a later turn succeeds or the owner logs in again.

Login runs `claude auth login --claudeai` as a child process: it opens Claude's sign-in page in this machine's browser
and finishes by itself, or prints a URL whose page shows a code to paste back (`send_code` writes it to the CLI).
One login at a time; it gives up after `LOGIN_TIMEOUT_S`.
"""

import asyncio
import json
import logging
import re
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any

from agentfleet_node.config import Settings
from agentfleet_node.store import EventBus

log = logging.getLogger(__name__)

LOGIN_TIMEOUT_S = 600
STATUS_TTL_S = 10
URL = re.compile(r"https://\S+")
# What a failed turn says when the login is the problem (ResultMessage text; AssistantMessage.error is the clean signal).
AUTH_ERROR = re.compile(r"OAuth|authenticat|invalid api key|/login|401", re.I)


class ClaudeAuth:
    def __init__(self, settings: Settings, bus: EventBus):
        self.settings = settings
        self.bus = bus
        self.expired = False
        self._status: tuple[float, dict[str, Any]] | None = None
        self._proc: asyncio.subprocess.Process | None = None
        self._task: asyncio.Task | None = None
        self.login: dict[str, Any] = {"state": "idle", "url": "", "error": ""}

    def cli(self) -> str:
        p = self.settings.claude_cli_path
        return p if p and Path(p).exists() else (shutil.which("claude") or "")

    # status

    def status(self, fresh: bool = False) -> dict[str, Any]:
        from agentfleet_node.api import claude_status  # the file check, also the fallback

        now = time.monotonic()
        if fresh or not self._status or now - self._status[0] > STATUS_TTL_S:
            out = claude_status(self.settings.claude_cli_path)
            out["email"] = ""
            if out["installed"]:
                try:
                    r = subprocess.run([out["path"], "auth", "status", "--json"], capture_output=True, text=True, timeout=8)
                    data = json.loads(r.stdout)
                    out["logged_in"] = bool(data.get("loggedIn"))
                    out["email"] = str(data.get("email") or "")
                except (OSError, subprocess.SubprocessError, ValueError):
                    pass  # older CLI or no answer: keep the file check
            self._status = (now, out)
        return {**self._status[1], "expired": self.expired, "login": dict(self.login)}

    def _changed(self) -> None:
        # Cheap event (no CLI call on the event loop); the page refetches the full status when it needs it.
        self._status = None
        self.bus.publish({"type": "claude", "expired": self.expired, "login": dict(self.login)})

    def turn_failed(self) -> None:
        """A turn failed on authentication: the saved login no longer works."""
        if not self.expired:
            self.expired = True
            self._changed()

    def turn_ok(self) -> None:
        if self.expired:
            self.expired = False
            self._changed()

    # login from the dashboard

    async def start_login(self) -> None:
        if self.login["state"] == "waiting" and self._proc and self._proc.returncode is None:
            return
        cli = self.cli()
        if not cli:
            raise RuntimeError("Claude Code is not installed on this computer")
        self._proc = await asyncio.create_subprocess_exec(
            cli, "auth", "login", "--claudeai",
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
        )
        self.login = {"state": "waiting", "url": "", "error": ""}
        found = asyncio.get_running_loop().create_future()
        self._task = asyncio.create_task(self._watch(self._proc, found))
        try:
            await asyncio.wait_for(asyncio.shield(found), 20)
        except TimeoutError:
            pass  # no URL printed yet: the browser may still have opened; the page keeps polling
        self._changed()

    async def _watch(self, proc: asyncio.subprocess.Process, found: asyncio.Future) -> None:
        tail = ""
        try:
            async def read() -> None:
                nonlocal tail
                assert proc.stdout is not None
                while chunk := await proc.stdout.read(1024):
                    text = chunk.decode(errors="replace")
                    tail = (tail + text)[-2000:]
                    m = URL.search(tail)
                    if m and not self.login["url"]:
                        self.login["url"] = m.group(0)
                        if not found.done():
                            found.set_result(True)
                await proc.wait()

            await asyncio.wait_for(read(), LOGIN_TIMEOUT_S)
            if proc.returncode == 0:
                self.login = {"state": "done", "url": "", "error": ""}
                self.expired = False
            else:
                clean = re.sub(r"\x1b\[[0-9;]*[A-Za-z]", "", tail)
                clean = re.sub(r"Paste code here if prompted\s*>\s*", "\n", clean)  # the prompt shares a line with the answer
                last = [ln.strip() for ln in clean.splitlines() if ln.strip()]
                self.login = {"state": "failed", "url": "", "error": (last[-1] if last else f"exit {proc.returncode}")[:300]}
        except TimeoutError:
            proc.kill()
            self.login = {"state": "failed", "url": "", "error": "The login wasn't finished in time. Try again."}
        except asyncio.CancelledError:
            proc.kill()
            raise
        finally:
            if not found.done():
                found.set_result(False)
            self._changed()

    async def send_code(self, code: str) -> None:
        """The code Claude's page shows when the browser couldn't hand the login back by itself."""
        proc = self._proc
        if self.login["state"] != "waiting" or not proc or proc.returncode is not None or proc.stdin is None:
            raise RuntimeError("no login is waiting for a code; start again")
        proc.stdin.write(code.strip().encode() + b"\n")
        await proc.stdin.drain()

    async def cancel(self) -> None:
        if self._task:
            self._task.cancel()
        self.login = {"state": "idle", "url": "", "error": ""}
        self._changed()

    async def stop(self) -> None:
        if self._proc and self._proc.returncode is None:
            self._proc.kill()

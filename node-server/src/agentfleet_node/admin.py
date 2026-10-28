"""The admin page of the office server (`/admin`): invite staff machines without a terminal.

Runs inside the world server, on the hub machine. It mints single-use join tokens with the same
`agentmesh-one token create` call as `hub/mint-token.sh`, shows the install commands to send with them, who is in
the Office and whether the installer has a package and agentmesh-node for each platform.

Access: from the server itself (127.0.0.1) without a password; from elsewhere on the LAN with the admin key
(`<world data dir>/admin-key`, printed by `make server`). The key is a shared secret on a plain-http LAN, like
the rest of v1.
"""

import hashlib
import hmac
import json
import secrets
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

PAGE = Path(__file__).with_name("admin.html")
# What the installer looks for, per platform (see install.sh / install.ps1).
PLATFORMS = {
    "macOS (Apple chip)": "agentmesh-node-darwin-arm64",
    "macOS (Intel)": "agentmesh-node-darwin-x86_64",
    "Linux (x86_64)": "agentmesh-node-linux-x86_64",
    "Windows": "agentmesh-node-windows-amd64.exe",
}
COOKIE = "agentmesh_admin"


class LoginIn(BaseModel):
    key: str


class InviteIn(BaseModel):
    device: str = Field(min_length=1, max_length=80)


class AdminConfig:
    def __init__(self, data_dir: Path, hub_data: Path | None, hub_port: int, downloads: Path | None):
        self.data_dir = data_dir
        self.hub_data = hub_data
        self.hub_port = hub_port
        self.downloads = downloads
        data_dir.mkdir(parents=True, exist_ok=True)
        key_file = data_dir / "admin-key"
        if not key_file.exists() or not key_file.read_text().strip():
            key_file.write_text(secrets.token_urlsafe(12) + "\n")
            key_file.chmod(0o600)
        self.key = key_file.read_text().strip()
        self.invites_file = data_dir / "invites.json"

    def cookie_value(self) -> str:
        return hmac.new(self.key.encode(), b"admin", hashlib.sha256).hexdigest()

    def invites(self) -> list[dict[str, Any]]:
        try:
            return json.loads(self.invites_file.read_text())
        except (OSError, ValueError):
            return []

    def record(self, device: str, token: str) -> None:
        rows = self.invites()
        rows.insert(0, {"device": device, "created": int(time.time()), "hint": token[:6] + "…"})
        self.invites_file.write_text(json.dumps(rows[:200], indent=2))


def mint_token(cfg: AdminConfig, device: str) -> str:
    """One single-use join token from the hub (same call as hub/mint-token.sh)."""
    exe = shutil.which("agentmesh-one")
    if not exe:
        raise HTTPException(503, "agentmesh-one is not installed on this server, so no token can be made here")
    if cfg.hub_data is None or not cfg.hub_data.is_dir():
        raise HTTPException(503, f"the hub's data folder was not found ({cfg.hub_data}); is the hub running here?")
    try:
        out = subprocess.run(
            [exe, "token", "create", "--server", f"http://127.0.0.1:{cfg.hub_port}", "--data-dir", str(cfg.hub_data),
             "--description", device, "--max-usages", "1"],
            capture_output=True, text=True, timeout=30,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "the hub did not answer in time") from None
    if out.returncode != 0:
        raise HTTPException(502, f"the hub refused: {(out.stderr or out.stdout).strip()[-300:]}")
    lines = [ln.strip() for ln in out.stdout.splitlines() if ln.strip()]
    if not lines:
        raise HTTPException(502, "the hub returned no token")
    return lines[-1].split()[-1]  # the token is the last word printed


def router(cfg: AdminConfig, hub, latest_wheel, latest_build) -> APIRouter:
    r = APIRouter()

    def allowed(request: Request) -> bool:
        local = (request.client.host if request.client else "") in ("127.0.0.1", "::1")
        return local or hmac.compare_digest(request.cookies.get(COOKIE, ""), cfg.cookie_value())

    def need_admin(request: Request) -> None:
        if not allowed(request):
            raise HTTPException(401, "admin key needed")

    @r.get("/admin", response_class=HTMLResponse)
    def page() -> str:
        return PAGE.read_text()

    @r.post("/admin/api/login")
    def login(body: LoginIn, response: Response) -> dict[str, bool]:
        if not hmac.compare_digest(body.key.strip(), cfg.key):
            raise HTTPException(401, "wrong admin key")
        response.set_cookie(COOKIE, cfg.cookie_value(), httponly=True, samesite="strict", max_age=30 * 24 * 3600)
        return {"ok": True}

    @r.get("/admin/api/overview")
    def overview(request: Request) -> dict[str, Any]:
        if not allowed(request):
            return {"locked": True}
        s = hub.state
        host = request.headers.get("host", "")
        files = {p.name for p in cfg.downloads.iterdir()} if cfg.downloads and cfg.downloads.is_dir() else set()
        return {
            "locked": False,
            "org": s.org,
            "server": host,
            "build": latest_build(cfg.downloads),
            "package": latest_wheel(cfg.downloads),
            "platforms": [{"name": n, "file": f, "ready": f in files} for n, f in PLATFORMS.items()],
            "can_invite": bool(shutil.which("agentmesh-one")) and bool(cfg.hub_data and cfg.hub_data.is_dir()),
            "owners": s.owners_view(),
            "agents": [{"agent_id": a.agent_id, "owner": a.owner, "name": a.name} for a in s.agents.values()],
            "desks": s.desks,
            "parties": len(s.parties),
            "invites": cfg.invites()[:50],
        }

    @r.post("/admin/api/invites")
    def invite(body: InviteIn, request: Request) -> dict[str, Any]:
        need_admin(request)
        device = body.device.strip()
        token = mint_token(cfg, device)
        cfg.record(device, token)
        host = request.headers.get("host", "")
        title = f"{hub.state.org} Office" if hub.state.org else "the Office"
        mac = f"curl -fsSL http://{host}/install | bash"
        win = f"irm http://{host}/install.ps1 | iex"
        message = (
            f"Hi! Here is how to join {title} on your computer.\n\n"
            f"1. Install Claude Code and log in (if you haven't): https://docs.claude.com/claude-code\n"
            f"2. Run this once:\n   macOS / Linux (Terminal): {mac}\n   Windows (PowerShell): {win}\n"
            f"3. On the page that opens, enter your name and this join token (single use):\n   {token}\n"
        )
        return {"device": device, "token": token, "mac": mac, "windows": win, "message": message}

    return r

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
import re
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


class SettingsIn(BaseModel):
    org: str = Field(default="", max_length=60)
    hub_data: str = Field(default="", max_length=500)
    agentmesh_one: str = Field(default="", max_length=500)


class KeyIn(BaseModel):
    key: str = Field(min_length=8, max_length=100)


class AdminConfig:
    def __init__(self, data_dir: Path, hub_data: Path | None, hub_port: int, downloads: Path | None,
                 agentmesh_one: str | None = None):
        self.data_dir = data_dir
        self.hub_data = hub_data.expanduser().resolve() if hub_data else None
        self.agentmesh_one = agentmesh_one  # explicit path; else looked up on PATH
        self.hub_port = hub_port
        self.downloads = downloads
        data_dir.mkdir(parents=True, exist_ok=True)
        key_file = data_dir / "admin-key"
        if not key_file.exists() or not key_file.read_text().strip():
            key_file.write_text(secrets.token_urlsafe(12) + "\n")
            key_file.chmod(0o600)
        self.key = key_file.read_text().strip()
        self.key_file = key_file
        self.invites_file = data_dir / "invites.json"
        # Settings made on the admin page win over the command line (so `make server` needs no parameters).
        self.settings_file = data_dir / "server.json"
        self.saved = self._load_settings()
        if self.saved.get("hub_data"):
            self.hub_data = Path(self.saved["hub_data"]).expanduser().resolve()
        if self.saved.get("agentmesh_one"):
            self.agentmesh_one = self.saved["agentmesh_one"]

    def _load_settings(self) -> dict:
        try:
            return json.loads(self.settings_file.read_text())
        except (OSError, ValueError):
            return {}

    def save_settings(self, **values: str) -> None:
        self.saved.update(values)
        self.settings_file.write_text(json.dumps(self.saved, indent=2))

    def set_key(self, key: str) -> None:
        self.key = key.strip()
        self.key_file.write_text(self.key + "\n")
        self.key_file.chmod(0o600)

    def exe(self) -> str | None:
        if self.agentmesh_one:
            return self.agentmesh_one if Path(self.agentmesh_one).is_file() else None
        return shutil.which("agentmesh-one")

    def invite_problem(self) -> str | None:
        """Why invites can't be made here, precisely enough to fix it; None when they can."""
        if not self.exe():
            if self.agentmesh_one:
                return f"agentmesh-one was not found at {self.agentmesh_one}. Fix the path under Server settings below."
            return ("agentmesh-one is not on the office server's PATH. Set its full path under Server settings below "
                    "(in a terminal on this machine, `which agentmesh-one` prints it).")
        if self.hub_data is None or not self.hub_data.is_dir():
            return (f"the hub's data folder {self.hub_data} does not exist. Set the folder the hub uses under Server "
                    "settings below (hub/start-hub.sh uses hub/data by default).")
        if not (self.hub_data / "admin-token").exists():
            return f"{self.hub_data} has no admin-token: is it really the hub's data folder, and has the hub started once?"
        return None

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


_LABELLED = re.compile(r"\btoken\b[^:=\n]*[:=]\s*(\S+)", re.I)
_TOKENISH = re.compile(r"^[A-Za-z0-9_.~+/=-]{10,}$")
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}")


def parse_token(output: str) -> str | None:
    """The join token in `agentmesh-one token create` output. It may print more than the token (an id, an expiry
    date...), so: a value labelled "token", else the longest token-looking word that is not a date or an id label."""
    for m in _LABELLED.finditer(output):
        v = m.group(1).strip("\"'`,")
        if _TOKENISH.match(v) and not _DATE.match(v):
            return v
    words = [w.strip("\"'`,") for w in output.split()]
    candidates = [w for w in words if _TOKENISH.match(w) and not _DATE.match(w) and not re.fullmatch(r"[0-9a-f-]{36}", w)]
    return max(candidates, key=len) if candidates else None


def mint_token(cfg: AdminConfig, device: str) -> tuple[str, str]:
    """One single-use join token from the hub (same call as hub/mint-token.sh)."""
    problem = cfg.invite_problem()
    if problem:
        raise HTTPException(503, problem)
    exe = cfg.exe()
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
    token = parse_token(out.stdout)
    if not token:
        raise HTTPException(502, f"could not find the token in the hub's answer: {out.stdout.strip()[-300:]}")
    return token, out.stdout.strip()


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
            "can_invite": cfg.invite_problem() is None,
            "invite_problem": cfg.invite_problem(),
            "settings": {"org": s.org, "hub_data": str(cfg.hub_data or ""), "agentmesh_one": cfg.agentmesh_one or "",
                         "agentmesh_one_found": cfg.exe() or ""},
            "owners": s.owners_view(),
            "agents": [{"agent_id": a.agent_id, "owner": a.owner, "name": a.name} for a in s.agents.values()],
            "desks": s.desks,
            "parties": len(s.parties),
            "invites": cfg.invites()[:50],
        }

    @r.get("/admin/api/events")
    def events(request: Request, limit: int = 300, who: str = "", kind: str = "") -> dict[str, Any]:
        """The event log (eventlog.py): what happened, who and when; never words."""
        need_admin(request)
        kinds = sorted({r.get("kind", "") for r in hub.state.events.rows})
        return {"rows": hub.state.events.query(who, kind, limit), "kinds": kinds}

    @r.get("/admin/api/log")
    def server_log(request: Request, lines: int = 200) -> dict[str, Any]:
        """The end of this office server's own log (connections, errors)."""
        need_admin(request)
        path = cfg.data_dir / "world.log"
        try:
            text = path.read_text(errors="replace").splitlines()[-max(1, min(lines, 2000)):]
        except OSError:
            text = []
        return {"path": str(path), "lines": text}

    @r.post("/admin/api/settings")
    async def settings(body: SettingsIn, request: Request) -> dict[str, Any]:
        """Organization name (every Office shows "<org> Office" at once), hub data folder, agentmesh-one path."""
        need_admin(request)
        org = body.org.strip()[:60]
        cfg.hub_data = Path(body.hub_data.strip()).expanduser().resolve() if body.hub_data.strip() else cfg.hub_data
        cfg.agentmesh_one = body.agentmesh_one.strip() or None
        cfg.save_settings(org=org, hub_data=str(cfg.hub_data or ""), agentmesh_one=cfg.agentmesh_one or "")
        hub.state.events.record("settings_changed", "admin", org=org, hub_data=str(cfg.hub_data or ""))
        if org != hub.state.org:
            hub.state.org = org
            await hub.broadcast([{"type": "org", "org": org}])
        return {"ok": True, "invite_problem": cfg.invite_problem()}

    @r.post("/admin/api/key")
    def change_key(body: KeyIn, request: Request, response: Response) -> dict[str, bool]:
        """A new admin key; this browser stays signed in, others must enter the new one."""
        need_admin(request)
        cfg.set_key(body.key)
        hub.state.events.record("admin_key_changed", "admin")
        response.set_cookie(COOKIE, cfg.cookie_value(), httponly=True, samesite="strict", max_age=30 * 24 * 3600)
        return {"ok": True}

    @r.post("/admin/api/invites")
    def invite(body: InviteIn, request: Request) -> dict[str, Any]:
        need_admin(request)
        device = body.device.strip()
        token, raw = mint_token(cfg, device)
        cfg.record(device, token)
        hub.state.events.record("invite_created", "admin", device=device)
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
        return {"device": device, "token": token, "mac": mac, "windows": win, "message": message, "raw": raw}

    return r

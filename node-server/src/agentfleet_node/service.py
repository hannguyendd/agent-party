"""Running the node on a staff machine: a menu, background / foreground runs, opt-in start at login, update.

`agentfleet-node` with no arguments opens a small menu. Nothing starts at login unless the person turns it on
(launchd on macOS, a systemd user unit on Linux, a scheduled task on Windows). A background run is a detached
process with a pid file. Data lives in ~/.agentfleet. The installer (install.sh / install.ps1, served by the
office server) installs the package and calls `agentfleet-node start`; the dashboard's Update button re-runs it.
A repo checkout (`make up`) is not managed here.
"""

import json
import os
import platform
import shutil
import signal
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

HOME = Path(os.environ.get("AGENTFLEET_HOME", Path.home() / ".agentfleet"))
DATA = HOME / "data"
LOG = HOME / "node.log"
PIDFILE = HOME / "node.pid"
UPDATE_LOG = HOME / "update.log"
PORT = int(os.environ.get("AGENTFLEET_PORT", "9100"))
URL = f"http://127.0.0.1:{PORT}"
SYSTEM = platform.system().lower()  # darwin | linux | windows
MAC_LABEL = "com.agentmesh.node"
MAC_PLIST = Path.home() / "Library" / "LaunchAgents" / f"{MAC_LABEL}.plist"
LINUX_UNIT = Path.home() / ".config" / "systemd" / "user" / "agentmesh-node.service"
WIN_TASK = "AgentMeshNode"


# what is installed and where it points


def _in_repo() -> bool:
    """node-server/src/agentfleet_node: a checkout (where `make bundle` also writes static/build.json)."""
    return (Path(__file__).resolve().parents[2] / "pyproject.toml").exists()


def build_id() -> str:
    """The build this node runs (written into the package by `make bundle`); 'dev' for a repo checkout."""
    if _in_repo():
        return "dev"
    try:
        return str(json.loads((Path(__file__).with_name("static") / "build.json").read_text())["build"])
    except (OSError, ValueError, KeyError):
        return "dev"


def version() -> str:
    """This node's package version (pyproject.toml; `make release` bumps it), '' when unknown."""
    from importlib.metadata import PackageNotFoundError
    from importlib.metadata import version as dist_version

    try:
        return dist_version("agentfleet-node")
    except PackageNotFoundError:
        return ""


def installed() -> bool:
    return build_id() != "dev"


def node_env() -> dict[str, str]:
    """Where an installed node keeps its data, whatever directory it is started from."""
    return {"AGENTFLEET_DATA_DIR": str(DATA), "AGENTFLEET_MESH_NODE_CONFIG_PATH": str(DATA / "agentmesh-node.yaml")}


def apply_node_env() -> None:
    if installed():
        for k, v in node_env().items():
            os.environ.setdefault(k, v)
        HOME.mkdir(parents=True, exist_ok=True)


def server_base() -> str | None:
    """http://<office server>:<port> from the setup this machine joined with."""
    try:
        world = json.loads((DATA / "setup.json").read_text()).get("world_url") or ""
    except (OSError, ValueError):
        world = os.environ.get("AGENTFLEET_WORLD_URL", "")
    return f"http://{world.split('://', 1)[-1].split('/', 1)[0]}" if world else None


def _exe() -> str:
    return shutil.which("agentfleet-node") or sys.argv[0]


def _run(*args: str) -> bool:
    return subprocess.run(list(args), capture_output=True).returncode == 0


def _ps(command: str) -> bool:
    return _run("powershell", "-NoProfile", "-NonInteractive", "-Command", command)


# state


def running() -> bool:
    import httpx

    try:
        return httpx.get(f"{URL}/api/node", timeout=1.5).status_code == 200
    except Exception:
        return False


def autostart_enabled() -> bool:
    if SYSTEM == "darwin":
        return MAC_PLIST.exists()
    if SYSTEM == "linux":
        return LINUX_UNIT.exists()
    return _ps(f"Get-ScheduledTask -TaskName {WIN_TASK} -ErrorAction Stop | Out-Null")


def status() -> dict:
    import httpx

    out: dict = {"installed": installed(), "build": build_id(), "url": URL, "data": str(HOME), "running": running(),
                 "autostart": autostart_enabled()}
    base = server_base()
    if base:
        out["server"] = base
        try:
            latest = httpx.get(f"{base}/info", timeout=3).json().get("build")
            out["latest"] = latest
            out["update_available"] = bool(latest) and latest != out["build"] and out["installed"]
        except Exception:
            out["server_reachable"] = False
    return out


# start / stop


def _wait(up: bool, seconds: float = 20) -> bool:
    end = time.time() + seconds
    while time.time() < end:
        if running() == up:
            return True
        time.sleep(0.5)
    return running() == up


def start() -> bool:
    """Run in the background: through the login service when it is on, else as a detached process."""
    if running():
        return True
    HOME.mkdir(parents=True, exist_ok=True)
    if autostart_enabled():
        if SYSTEM == "darwin":
            uid = str(os.getuid())
            _run("launchctl", "bootstrap", f"gui/{uid}", str(MAC_PLIST)) or _run("launchctl", "kickstart", f"gui/{uid}/{MAC_LABEL}")
        elif SYSTEM == "linux":
            _run("systemctl", "--user", "start", LINUX_UNIT.name)
        else:
            _ps(f"Start-ScheduledTask -TaskName {WIN_TASK}")
    else:
        log = LOG.open("ab")
        env = {**os.environ, **node_env()}
        if SYSTEM == "windows":
            flags = 0x00000008 | 0x00000200 | 0x08000000  # DETACHED_PROCESS | NEW_PROCESS_GROUP | NO_WINDOW
            p = subprocess.Popen([_exe(), "serve"], cwd=HOME, env=env, stdin=subprocess.DEVNULL, stdout=log,
                                 stderr=subprocess.STDOUT, creationflags=flags)
        else:
            p = subprocess.Popen([_exe(), "serve"], cwd=HOME, env=env, stdin=subprocess.DEVNULL, stdout=log,
                                 stderr=subprocess.STDOUT, start_new_session=True)
        PIDFILE.write_text(str(p.pid))
    return _wait(True)


def stop() -> bool:
    if SYSTEM == "darwin" and MAC_PLIST.exists():
        _run("launchctl", "bootout", f"gui/{os.getuid()}", str(MAC_PLIST))
    elif SYSTEM == "linux" and LINUX_UNIT.exists():
        _run("systemctl", "--user", "stop", LINUX_UNIT.name)
    elif SYSTEM == "windows":
        _ps(f"Stop-ScheduledTask -TaskName {WIN_TASK} -ErrorAction SilentlyContinue")
    try:
        pid = int(PIDFILE.read_text())
        if SYSTEM == "windows":
            _run("taskkill", "/PID", str(pid), "/T", "/F")
        else:
            os.kill(pid, signal.SIGTERM)
    except (OSError, ValueError):
        pass
    PIDFILE.unlink(missing_ok=True)
    if SYSTEM == "windows":
        _ps("Get-Process agentfleet-node -ErrorAction SilentlyContinue | Stop-Process -Force")
    return _wait(False, 10)


def restart() -> bool:
    stop()
    return start()


# start at login (opt-in)


def set_autostart(on: bool) -> bool:
    """Turn start-at-login on (also starts the node now) or off (the node keeps running until stopped)."""
    exe = _exe()
    if not on:
        was_running = running()
        if SYSTEM == "darwin":
            _run("launchctl", "bootout", f"gui/{os.getuid()}", str(MAC_PLIST))
            MAC_PLIST.unlink(missing_ok=True)
        elif SYSTEM == "linux":
            _run("systemctl", "--user", "disable", "--now", LINUX_UNIT.name)
            LINUX_UNIT.unlink(missing_ok=True)
        else:
            _ps(f"Unregister-ScheduledTask -TaskName {WIN_TASK} -Confirm:$false -ErrorAction SilentlyContinue")
        if was_running:
            _wait(False, 8)  # unloading the login service stops the node it ran: wait, then keep today's session
            start()
        return True
    # Turning it on is for the next sign-in: a node already running keeps running (no restart, so the dashboard
    # that asked stays connected). Not running yet: start it now through the login service.
    already = running()
    env = node_env()
    path = os.environ.get("PATH", "") + os.pathsep + os.pathsep.join(["/usr/local/bin", "/opt/homebrew/bin", "/usr/bin", "/bin"])
    if SYSTEM == "darwin":
        MAC_PLIST.parent.mkdir(parents=True, exist_ok=True)
        env_xml = "".join(f"<key>{k}</key><string>{v}</string>" for k, v in {**env, "PATH": path}.items())
        MAC_PLIST.write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>{MAC_LABEL}</string>
  <key>ProgramArguments</key><array><string>{exe}</string><string>serve</string></array>
  <key>WorkingDirectory</key><string>{HOME}</string>
  <key>EnvironmentVariables</key><dict>{env_xml}</dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>{LOG}</string>
  <key>StandardErrorPath</key><string>{LOG}</string>
</dict></plist>
""")
        if not already:  # a plist in LaunchAgents loads by itself at the next sign-in
            _run("launchctl", "bootstrap", f"gui/{os.getuid()}", str(MAC_PLIST))
    elif SYSTEM == "linux":
        LINUX_UNIT.parent.mkdir(parents=True, exist_ok=True)
        lines = "\n".join(f"Environment={k}={v}" for k, v in {**env, "PATH": path}.items())
        LINUX_UNIT.write_text(f"[Unit]\nDescription=Party Agent node\n[Service]\nExecStart={exe} serve\nWorkingDirectory={HOME}\n"
                              f"{lines}\nRestart=on-failure\n[Install]\nWantedBy=default.target\n")
        _run("systemctl", "--user", "daemon-reload")
        _run("systemctl", "--user", "enable", LINUX_UNIT.name)
        if not already:
            _run("systemctl", "--user", "start", LINUX_UNIT.name)
    else:
        # Hidden PowerShell loop: restarts the node if it stops, until the task is stopped.
        loop = f"while ($true) {{ & '{exe}' serve *>> '{LOG}'; Start-Sleep 3 }}"
        cmd = (f"$a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -WindowStyle Hidden -Command \"{loop}\"' "
               f"-WorkingDirectory '{HOME}'; "
               f"$t = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME; "
               f"$s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit 0; "
               f"Register-ScheduledTask -TaskName {WIN_TASK} -Action $a -Trigger $t -Settings $s -Force | Out-Null"
               + ("" if already else f"; Start-ScheduledTask -TaskName {WIN_TASK}"))
        for k, v in env.items():
            _ps(f"[Environment]::SetEnvironmentVariable('{k}', '{v}', 'User')")
        if not _ps(cmd):
            return False
    return _wait(True)


# update / uninstall


def update(detached: bool = True) -> bool:
    """Re-run the office server's installer: newest package, ~/.agentfleet kept, node restarted. Detached, since it
    restarts the node that may be the one asking."""
    base = server_base()
    if not base:
        return False
    env = {**os.environ, "AGENTMESH_NO_OPEN": "1", "AGENTMESH_UPDATE": "1"}
    HOME.mkdir(parents=True, exist_ok=True)
    log = UPDATE_LOG.open("ab")
    if SYSTEM == "windows":
        cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", f"irm {base}/install.ps1 | iex"]
        kw = {"creationflags": 0x00000008 | 0x00000200 | 0x08000000} if detached else {}
    else:
        cmd = ["bash", "-c", f"curl -fsSL {base}/install | bash"]
        kw = {"start_new_session": True} if detached else {}
    proc = subprocess.Popen(cmd, env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, **kw)
    return True if detached else proc.wait() == 0


def uninstall(purge: bool = False) -> None:
    """Remove start-at-login, shortcuts and the package. Keeps ~/.agentfleet unless purge."""
    set_autostart(False)
    stop()
    if SYSTEM == "darwin":
        for app in (Path.home() / "Applications").glob("*.app"):  # the installer's shortcut carries a marker
            if (app / "Contents" / "MacOS" / "agentmesh-open").exists():
                shutil.rmtree(app, ignore_errors=True)
    elif SYSTEM == "linux":
        (Path.home() / ".local" / "share" / "applications" / "agentmesh-office.desktop").unlink(missing_ok=True)
    else:
        _ps("Remove-Item \"$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\*Office.lnk\",\"$([Environment]::GetFolderPath('Desktop'))\\*Office.lnk\" -ErrorAction SilentlyContinue")
    if (HOME / "installed-agentmesh-node").exists():  # the installer put it there: take it away too
        for name in ("agentmesh-node", "agentmesh-node.exe"):
            (Path.home() / ".local" / "bin" / name).unlink(missing_ok=True)
    if purge:
        shutil.rmtree(HOME, ignore_errors=True)
    uv = shutil.which("uv")
    if uv:  # last: this removes the very program running this function
        subprocess.Popen([uv, "tool", "uninstall", "agentfleet-node"], start_new_session=SYSTEM != "windows")


def logs(lines: int = 80) -> str:
    try:
        return "\n".join(LOG.read_text(errors="replace").splitlines()[-lines:])
    except OSError:
        return f"(no log yet at {LOG})"


# the menu and the commands


def _say(ok: bool, what: str) -> None:
    print(("  ✓ " if ok else "  ✗ Could not ") + what)


def menu(foreground) -> int:
    """`agentfleet-node` without arguments: what's going on, and what to do about it."""
    while True:
        s = status()
        print("\n  Office node on this machine")
        print(f"  ● {'Running' if s['running'] else 'Not running'}   {URL}")
        print(f"  Start when I log in: {'ON' if s['autostart'] else 'OFF'}")
        if s.get("update_available"):
            print(f"  Update available ({s['latest']})")
        elif s.get("server_reachable") is False:
            print(f"  Office server {s['server']} not reachable")
        print()
        items = [
            ("1", "Start in the background (keeps running when you close this window)", "bg"),
            ("2", "Run here in this window (stops when you close it)", "fg"),
            ("3", "Stop", "stop"),
            ("4", "Open the Office in the browser", "open"),
            ("5", f"Start when I log in: turn {'OFF' if s['autostart'] else 'ON'}", "auto"),
            ("6", "Update" + (" (new build available)" if s.get("update_available") else ""), "update"),
            ("7", "Show the log", "logs"),
            ("q", "Quit", "quit"),
        ]
        for key, text, _ in items:
            print(f"  {key}) {text}")
        try:
            choice = input("\n  Choose: ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        action = next((a for k, _, a in items if k == choice), None)
        if action == "quit":
            return 0
        if action == "bg":
            _say(start(), f"started. Open {URL}")
        elif action == "fg":
            if running():
                stop()
            print(f"  Running here. Open {URL}  (Ctrl+C to stop)\n")
            return foreground()
        elif action == "stop":
            _say(stop(), "stopped")
        elif action == "open":
            if not running():
                start()
            webbrowser.open(URL)
        elif action == "auto":
            on = not s["autostart"]
            _say(set_autostart(on), f"turned start-at-login {'on' if on else 'off'}")
        elif action == "update":
            print("  Updating from the office server…")
            _say(update(detached=False), "updated")
        elif action == "logs":
            print(logs())
        else:
            print("  Pick one of the numbers above.")


def main(cmd: str, foreground, purge: bool = False, on: str | None = None) -> int:
    """`agentfleet-node <cmd>`; `foreground` runs the server in this process (option 2)."""
    if cmd == "menu":
        return menu(foreground)
    if cmd == "open":
        if not running():
            start()
        webbrowser.open(URL)
        return 0
    if cmd == "logs":
        print(logs())
        return 0
    if cmd == "status":
        s = status()
        print(f"Office node: {'running' if s['running'] else 'not running'}  ({s['url']})")
        print(f"Start when I log in: {'on' if s['autostart'] else 'off'}")
        print(f"Build: {s['build']}{'  (repo checkout)' if not s['installed'] else ''}")
        if s.get("server"):
            print(f"Office server: {s['server']}" + ("  (not reachable)" if s.get("server_reachable") is False else ""))
        if s.get("update_available"):
            print(f"Update available: {s['latest']}  ->  agentfleet-node update")
        return 0 if s["running"] else 1
    if not installed():
        print("This node runs from a repo checkout; use make up / make serve there.", file=sys.stderr)
        return 2
    if cmd == "autostart":
        ok = set_autostart(on == "on")
        _say(ok, f"turned start-at-login {on}")
        return 0 if ok else 1
    if cmd == "update":
        print(f"Updating from the office server (log: {UPDATE_LOG})")
        return 0 if update(detached=False) else 1
    if cmd == "uninstall":
        uninstall(purge)
        print("Removed the node." + ("" if purge else f" Your data stays in {HOME}."))
        return 0
    ok = {"start": start, "stop": stop, "restart": restart}[cmd]()
    _say(ok, f"{cmd} the node" if not ok else {"start": "started", "stop": "stopped", "restart": "restarted"}[cmd])
    return 0 if ok else 1

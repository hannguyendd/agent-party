"""Codex runtime: detection of the host's Codex (this module grows the session runtime in Task 4)."""

import importlib.util
import json
import shutil
import subprocess
from collections.abc import Callable
from pathlib import Path
from typing import Any

from packaging.version import InvalidVersion, Version

# The openai-codex SDK pin (pyproject extra "codex"); its bundled CLI has the same version.
CODEX_PINNED = "0.163.0"
# Oldest own `codex` the node runs; older ones fall back to the bundled CLI. Raised from the prototype's findings.
CODEX_MIN = "0.163.0"
CODEX_OPTION_DEFAULTS: dict[str, Any] = {"sandbox": "workspace_write", "network": False, "web_search": False}
SANDBOXES = ("read_only", "workspace_write")
_TIMEOUT_S = 5


def runtime_options(given: dict[str, Any] | None) -> dict[str, Any]:
    """Codex options with defaults filled in. ValueError on an unknown key or a bad value."""
    given = given or {}
    unknown = set(given) - set(CODEX_OPTION_DEFAULTS)
    if unknown:
        raise ValueError(f"unknown runtime option(s): {', '.join(sorted(unknown))}")
    out = {**CODEX_OPTION_DEFAULTS, **given}
    if out["sandbox"] not in SANDBOXES:
        raise ValueError(f"sandbox must be one of {', '.join(SANDBOXES)}")
    for key in ("network", "web_search"):
        if not isinstance(out[key], bool):
            raise ValueError(f"{key} must be true or false")
    return out


def _version(text: str) -> str | None:
    for word in text.split():
        try:
            return str(Version(word))
        except InvalidVersion:
            continue
    return None


def _call(run: Callable, cmd: list[str]) -> subprocess.CompletedProcess | None:
    try:
        return run(cmd, capture_output=True, text=True, timeout=_TIMEOUT_S)
    except (OSError, subprocess.SubprocessError):
        return None


def codex_status(run: Callable | None = subprocess.run, which: Callable = shutil.which, home: Path | None = None,
                 find_spec: Callable = importlib.util.find_spec) -> dict[str, Any]:
    """Is Codex on this host, signed in, and which binary would agents use? Read fresh each call (a few
    subprocesses); `/api/setup` and session start use it."""
    home = home or Path.home()
    path = which("codex") or ""
    auth: dict[str, Any] = {}
    try:
        auth = json.loads((home / ".codex" / "auth.json").read_text())
    except (OSError, ValueError):
        pass
    version = logged_in = None
    auth_mode = ""
    if path and run is not None:
        res = _call(run, [path, "--version"])
        version = _version(res.stdout) if res and res.returncode == 0 else None
        res = _call(run, [path, "login", "status"])
        if res is not None:
            text = (res.stdout or "") + (res.stderr or "")
            logged_in = res.returncode == 0 and "Logged in" in text
            if logged_in:
                auth_mode = "chatgpt" if "ChatGPT" in text else "api_key" if "API key" in text else "other"
    if not logged_in and auth:  # no own binary, or `login status` failed: read the auth file Codex writes
        logged_in = "tokens" in auth or bool(auth.get("OPENAI_API_KEY"))
        auth_mode = auth_mode or ("api_key" if auth.get("auth_mode") == "api_key" or auth.get("OPENAI_API_KEY") else "chatgpt")
    compatible = bool(version) and Version(version) >= Version(CODEX_MIN)
    sdk_installed = find_spec("openai_codex") is not None
    return {
        "installed": bool(path) or bool(auth),
        "path": path,
        "version": version,
        "logged_in": bool(logged_in),
        "auth_mode": auth_mode if logged_in else "",
        "compatible": compatible,
        "newer_than_tested": compatible and Version(version) > Version(CODEX_PINNED),
        # Never the bundled CLI when the own one is newer: an older Codex must not read a newer ~/.codex.
        "binary": "own" if compatible else "bundled",
        "sdk_installed": sdk_installed,
        "usable": bool(logged_in) and sdk_installed,
    }


def codex_bin_for(status: dict[str, Any]) -> str | None:
    """The binary for the SDK: the host's own, or None (the SDK starts its bundled CLI)."""
    return status["path"] if status.get("binary") == "own" and status.get("path") else None

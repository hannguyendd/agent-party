"""The staff installers (install.sh / install.ps1 / uninstall.*), filled in for where they are served from.

Two places hand them out:
- the office server (`/install`, world.py): knows its own address, so the script installs from it and falls back
  to the GitHub release of the same version when the server's download fails;
- a GitHub release (`.github/workflows/release.yml` runs `python -m agentfleet_node.installer`): no server address,
  so the script installs from the release; staff pass the server with `--server host:port` (the admin's invite
  message does) or type it on the setup page.
"""

import argparse
import re
import sys
from pathlib import Path

TEMPLATES = {name: Path(__file__).with_name(name) for name in ("install.sh", "install.ps1", "uninstall.sh", "uninstall.ps1")}
# Where releases are published (public repo). Overridable for forks: AGENTFLEET_RELEASE_REPO=owner/repo.
DEFAULT_REPO = "hannguyendd/agent-party"
_WHEEL = re.compile(r"^agentfleet_node-(?P<version>[0-9][0-9A-Za-z.+-]*)-py3-none-any\.whl$")


def shell_safe(text: str) -> str:
    """Values go inside quotes in a shell / PowerShell script: keep only harmless characters."""
    return re.sub(r"[^A-Za-z0-9 ._&()/:+-]", "", text)


def wheel_version(wheel: str) -> str:
    m = _WHEEL.match(wheel or "")
    return m.group("version") if m else ""


def release_base(repo: str, version: str) -> str:
    """Download folder of the GitHub release for a version ('' when unknown)."""
    return f"https://github.com/{repo}/releases/download/v{version}" if repo and version else ""


def render(kind: str, *, server: str = "", host: str = "", wheel: str = "", org: str = "", amversion: str = "",
           github: str = "") -> str:
    return (
        TEMPLATES[kind].read_text()
        .replace("__SERVER__", shell_safe(server))
        .replace("__HOST__", shell_safe(host))
        .replace("__WHEEL__", shell_safe(wheel))
        .replace("__ORG__", shell_safe(org))
        .replace("__AMVERSION__", shell_safe(amversion))
        .replace("__GITHUB__", shell_safe(github))
    )


def main(argv: list[str] | None = None) -> int:
    """`python -m agentfleet_node.installer --wheel <name> --out <dir>`: the installers for a GitHub release."""
    p = argparse.ArgumentParser(description=main.__doc__)
    p.add_argument("--wheel", required=True, help="wheel file name in the release")
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--repo", default=DEFAULT_REPO)
    p.add_argument("--amversion", required=True, help="agentmesh release, e.g. v0.1.0-rc.10")
    a = p.parse_args(argv)
    version = wheel_version(a.wheel)
    if not version:
        print(f"not a node wheel name: {a.wheel}", file=sys.stderr)
        return 2
    a.out.mkdir(parents=True, exist_ok=True)
    for kind in TEMPLATES:
        (a.out / kind).write_text(render(kind, wheel=a.wheel, amversion=a.amversion, github=release_base(a.repo, version)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

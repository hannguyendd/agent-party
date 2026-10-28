"""Release installers (GitHub copy), the Claude Code check and uninstall from the web."""

import json
import subprocess
from pathlib import Path

from agentfleet_node import installer
from agentfleet_node.api import claude_status


def test_release_installers_need_no_server(tmp_path):
    out = tmp_path / "release"
    assert installer.main(["--wheel", "agentfleet_node-0.4.0-py3-none-any.whl", "--out", str(out), "--amversion", "v0.1.0-rc.10"]) == 0
    sh = (out / "install.sh").read_text()
    assert 'SERVER=""' in sh and 'WHEEL="agentfleet_node-0.4.0-py3-none-any.whl"' in sh
    assert 'GITHUB="https://github.com/hannguyendd/agent-party/releases/download/v0.4.0"' in sh
    assert "$GitHub = 'https://github.com/hannguyendd/agent-party/releases/download/v0.4.0'" in (out / "install.ps1").read_text()
    assert {p.name for p in out.iterdir()} == {"install.sh", "install.ps1", "uninstall.sh", "uninstall.ps1"}
    assert subprocess.run(["bash", "-n", str(out / "install.sh")]).returncode == 0
    assert installer.main(["--wheel", "nope.whl", "--out", str(out), "--amversion", "v1"]) == 2


def test_installer_reads_the_server_flag(tmp_path):
    """`bash -s -- --server host:7500` sets where downloads go first and what the setup form prefills."""
    out = tmp_path / "r"
    installer.main(["--wheel", "agentfleet_node-0.4.0-py3-none-any.whl", "--out", str(out), "--amversion", "v1"])
    head = (out / "install.sh").read_text().split('TITLE="${ORG')[0]
    probe = head.replace("set -euo pipefail", "set -eu") + 'echo "$SERVER|$OFFICE"\n'
    run = lambda *args, env=None: subprocess.run(["bash", "-c", probe, "x", *args], capture_output=True, text=True, env=env).stdout.strip()
    assert run("--server", "10.0.0.5:7500") == "10.0.0.5:7500|10.0.0.5"
    assert run("--server=10.0.0.6:7500") == "10.0.0.6:7500|10.0.0.6"
    assert run(env={"AGENTMESH_SERVER": "10.0.0.7:7500", "PATH": "/usr/bin:/bin"}) == "10.0.0.7:7500|10.0.0.7"
    assert run(env={"PATH": "/usr/bin:/bin"}) == "|"


def test_claude_status(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    fake = tmp_path / "claude"
    fake.write_text("#!/bin/sh\n")
    monkeypatch.setenv("PATH", str(tmp_path / "empty"))  # no `claude` on PATH either
    assert claude_status(str(tmp_path / "missing")) == {"installed": False, "path": "", "logged_in": False}
    assert claude_status(str(fake)) == {"installed": True, "path": str(fake), "logged_in": False}
    (tmp_path / ".claude.json").write_text(json.dumps({"oauthAccount": {"emailAddress": "x"}}))
    assert claude_status(str(fake))["logged_in"] is True
    (tmp_path / ".claude.json").write_text("{}")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    assert claude_status(str(fake))["logged_in"] is True


def test_uninstall_refused_in_a_repo_checkout(tmp_path):
    from fastapi.testclient import TestClient

    from agentfleet_node.app import create_app
    from agentfleet_node.config import Settings

    app = create_app(Settings(data_dir=tmp_path, owner="han", os_notifications=False, world_url=None))
    with TestClient(app) as c:
        assert c.post("/api/service/uninstall", json={"keep_data": True}).status_code == 409
        assert "claude" in c.get("/api/setup").json()

"""Claude Code's login: status from `claude auth status`, logging in from the dashboard, expired logins seen in turns."""

import sys
import textwrap

import httpx

from test_two_nodes import add_agent, wait_for

FAKE_CLI = textwrap.dedent('''\
    import json, sys
    args = sys.argv[1:]
    if args[:2] == ["auth", "status"]:
        print(json.dumps({"loggedIn": True, "email": "kien@example.com"}))
    elif args[:2] == ["auth", "login"]:
        print("Opening browser to sign in...")
        print("If the browser didn't open, visit: https://claude.com/cai/oauth/authorize?code=true&state=abc")
        print("Paste code here if prompted > ", end="", flush=True)
        code = sys.stdin.readline().strip()
        if code == "good":
            print("Login successful.")
            sys.exit(0)
        print("Invalid code")
        sys.exit(1)
''')


def fake_cli(tmp_path):
    script = tmp_path / "fake_claude.py"
    script.write_text(FAKE_CLI)
    cli = tmp_path / "claude"
    cli.write_text(f"#!/bin/sh\nexec {sys.executable} {script} \"$@\"\n")
    cli.chmod(0o755)
    return str(cli)


async def test_login_from_the_dashboard(node_factory, tmp_path):
    a = node_factory("han", claude_cli_path=fake_cli(tmp_path))
    async with a, httpx.AsyncClient(base_url=a.url, timeout=30) as c:
        st = (await c.get("/api/claude")).json()
        assert st["installed"] and st["logged_in"] and st["email"] == "kien@example.com" and not st["expired"]
        st = (await c.post("/api/claude/login")).json()
        assert st["login"]["state"] == "waiting" and st["login"]["url"].startswith("https://claude.com/cai/oauth/authorize")
        assert (await c.post("/api/claude/login/code", json={"code": "good"})).status_code == 200
        await wait_for(lambda: a.node.claude.login["state"] == "done")
        # A wrong code fails with the CLI's last line.
        await c.post("/api/claude/login")
        await c.post("/api/claude/login/code", json={"code": "nope"})
        await wait_for(lambda: a.node.claude.login["state"] == "failed")
        assert a.node.claude.login["error"] == "Invalid code"
        assert (await c.post("/api/claude/login/code", json={"code": "late"})).status_code == 409


async def test_an_expired_login_shows_in_the_chat_and_status(node_factory, tmp_path):
    a = node_factory("han", claude_cli_path=fake_cli(tmp_path))
    async with a, httpx.AsyncClient(base_url=a.url, timeout=30) as c:
        await add_agent(a, "han/dev")
        conv_id = (await c.post("/api/conversations", json={"agent_id": "han/dev", "text": "AUTHFAIL please"})).json()["id"]
        await wait_for(lambda: a.node.claude.expired)
        assert any("login on this computer has expired" in m.content for m in a.node.store.list_messages(conv_id))
        assert (await c.get("/api/claude")).json()["expired"] is True
        # The next turn that works clears it.
        await c.post(f"/api/conversations/{conv_id}/inject", json={"text": "hello"})
        await wait_for(lambda: not a.node.claude.expired)

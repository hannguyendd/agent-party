"""The office server's admin page: key-protected from the LAN, invites mint a token via agentmesh-one."""

import os
import stat

from fastapi.testclient import TestClient

from agentfleet_node.world import create_world_app


def fake_agentmesh_one(tmp_path, monkeypatch, token="bt_abc123XYZ"):
    """An agentmesh-one on PATH that prints a token like the real CLI and records its arguments."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    exe = bin_dir / "agentmesh-one"
    exe.write_text(f'#!/bin/sh\necho "$@" > "{tmp_path}/args"\necho "Created bootstrap token"\necho "{token}"\n')
    exe.chmod(exe.stat().st_mode | stat.S_IEXEC)
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")


def admin_app(tmp_path, hub_data=True):
    hub = tmp_path / "hub-data"
    if hub_data:
        hub.mkdir()
        (hub / "admin-token").write_text("t")
    return create_world_app(tmp_path / "world" / "world.json", tmp_path / "downloads", "Taggle", hub, 7400)


def test_admin_needs_the_key_from_the_lan_and_invites_mint_a_token(tmp_path, monkeypatch):
    fake_agentmesh_one(tmp_path, monkeypatch)
    app = admin_app(tmp_path)
    c = TestClient(app)  # TestClient's address is not 127.0.0.1: like another machine on the LAN
    assert "Invite a computer" in c.get("/admin").text
    assert c.get("/admin/api/overview").json() == {"locked": True}
    assert c.post("/admin/api/invites", json={"device": "Han's Mac"}).status_code == 401
    assert c.post("/admin/api/login", json={"key": "nope"}).status_code == 401

    key = (tmp_path / "world" / "admin-key").read_text().strip()
    assert c.post("/admin/api/login", json={"key": key}).status_code == 200
    o = c.get("/admin/api/overview").json()
    assert o["locked"] is False and o["org"] == "Taggle" and o["can_invite"] is True

    r = c.post("/admin/api/invites", json={"device": "Han's Mac"}, headers={"host": "10.0.0.5:7500"})
    assert r.status_code == 200, r.text
    inv = r.json()
    assert inv["token"] == "bt_abc123XYZ"
    assert "curl -fsSL http://10.0.0.5:7500/install | bash" in inv["message"] and "bt_abc123XYZ" in inv["message"]
    assert "--max-usages 1" in (tmp_path / "args").read_text() and "Han's Mac" in (tmp_path / "args").read_text()
    listed = c.get("/admin/api/overview").json()["invites"]
    assert listed[0]["device"] == "Han's Mac" and listed[0]["hint"] == "bt_abc…"  # the full token isn't kept


def test_invites_explain_why_they_cannot_be_made(tmp_path, monkeypatch):
    monkeypatch.setenv("PATH", "/nonexistent")
    c = TestClient(admin_app(tmp_path))
    key = (tmp_path / "world" / "admin-key").read_text().strip()
    c.post("/admin/api/login", json={"key": key})
    r = c.post("/admin/api/invites", json={"device": "x"})
    assert r.status_code == 503 and "agentmesh-one" in r.json()["detail"]


def test_invite_problems_are_specific(tmp_path, monkeypatch):
    fake_agentmesh_one(tmp_path, monkeypatch)
    app = create_world_app(tmp_path / "w" / "world.json", None, "", tmp_path / "missing-hub", 7400)
    assert "does not exist" in app.state.admin.invite_problem()
    app = create_world_app(tmp_path / "w2" / "world.json", None, "", tmp_path / "bin", 7400)
    assert "no admin-token" in app.state.admin.invite_problem()
    exe = tmp_path / "bin" / "agentmesh-one"
    app = create_world_app(tmp_path / "w3" / "world.json", None, "", tmp_path, 7400, agentmesh_one=str(tmp_path / "nope"))
    assert "was not found" in app.state.admin.invite_problem()
    (tmp_path / "admin-token").write_text("t")
    app = create_world_app(tmp_path / "w4" / "world.json", None, "", tmp_path, 7400, agentmesh_one=str(exe))
    assert app.state.admin.invite_problem() is None


def test_settings_from_the_admin_page_are_kept_and_the_org_reaches_every_office(tmp_path, monkeypatch):
    fake_agentmesh_one(tmp_path, monkeypatch)
    app = admin_app(tmp_path)
    c = TestClient(app)
    key = (tmp_path / "world" / "admin-key").read_text().strip()
    c.post("/admin/api/login", json={"key": key})
    hub = tmp_path / "hub-data"
    r = c.post("/admin/api/settings", json={"org": "Acme", "hub_data": str(hub), "agentmesh_one": ""})
    assert r.status_code == 200 and r.json()["invite_problem"] is None
    assert app.state.hub.state.org == "Acme"
    # A restart without --org keeps the name chosen on the admin page.
    again = create_world_app(tmp_path / "world" / "world.json", tmp_path / "downloads", "", None, 7400)
    assert again.state.hub.state.org == "Acme" and again.state.admin.hub_data == hub.resolve()
    # Changing the key keeps this browser signed in and locks out the old key.
    assert c.post("/admin/api/key", json={"key": "a-new-key-123"}).status_code == 200
    assert c.get("/admin/api/overview").json()["locked"] is False
    other = TestClient(app)
    assert other.post("/admin/api/login", json={"key": key}).status_code == 401


def test_admin_event_log_traces_what_happened_but_never_words(tmp_path, monkeypatch):
    fake_agentmesh_one(tmp_path, monkeypatch)
    app = admin_app(tmp_path)
    w = app.state.hub.state
    w.sync_agents("kien", [{"agent_id": "kien/wabi", "name": "WABI"}], set())
    w.sync_agents("han", [{"agent_id": "han/be", "name": "Backend"}], set())
    w.activity("kien", "kien/wabi", "han/be", "running", "outbound")
    w.activity("kien", "kien/wabi", "han/be", "idle", "outbound")
    w.claim_desk("kien", "D3")
    # A node's audit row: content-like fields are dropped even if a node sent them.
    w.events.record("outbound_message", "kien", agent="kien/wabi", peer="han/be", chars=42, text="secret", message="x")
    c = TestClient(app)
    c.post("/admin/api/login", json={"key": (tmp_path / "world" / "admin-key").read_text().strip()})
    r = c.get("/admin/api/events?who=han/be").json()
    kinds = [e["kind"] for e in r["rows"]]
    assert kinds[:3] == ["outbound_message", "conversation", "conversation"] and "agent_joined" in kinds
    sent = r["rows"][0]
    assert sent["chars"] == 42 and "text" not in sent and "message" not in sent
    assert {"desk_claimed", "agent_joined", "conversation"} <= set(r["kinds"])
    assert c.get("/admin/api/events?kind=desk_claimed").json()["rows"][0]["desk"] == "D3"
    # Kept across a restart.
    again = create_world_app(tmp_path / "world" / "world.json", None, "", None, 7400)
    assert len(again.state.hub.state.events.rows) == len(w.events.rows)
    assert c.get("/admin/api/log").status_code == 200

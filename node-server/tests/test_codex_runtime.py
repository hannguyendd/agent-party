"""CodexRuntime behind AgentRuntime, against conftest.FakeCodex (spec: 2026-10-28-codex-runtime-design.md)."""

import asyncio

import httpx
import pytest

from agentfleet_node.models import ConversationStatus, Direction
from agentfleet_node.runtimes.codex import command_for_policy
from conftest import FakeCodex
from test_runtime_api import USABLE, post_agent
from test_two_nodes import add_agent, pair, wait_for


@pytest.fixture(autouse=True)
def codex_here(monkeypatch):
    status = dict(USABLE)
    monkeypatch.setattr("agentfleet_node.api.codex_status", lambda: status)
    monkeypatch.setattr("agentfleet_node.runtimes.codex.codex_status", lambda: status)
    FakeCodex.instances.clear()
    return status


async def codex_agent(node, agent_id="han/cx", **extra):
    r = await post_agent(node, agent_id, runtime="codex", **extra)
    assert r.status_code == 200, r.text


def local_conv(node, agent_id="han/cx", **changes):
    conv = node.node.store.create_conversation(agent_id=agent_id, context_id=f"ctx-{len(FakeCodex.instances)}-{id(changes)}",
                                               direction=Direction.LOCAL)
    if changes:
        node.node.store.update_conversation(conv.id, **changes)
    return node.node.sessions.worker(conv.id), conv


def pending(node):
    return node.node.store.list_approvals(pending_only=True)


async def test_codex_echo_roundtrip(node_factory):
    a, b = await pair(node_factory)
    async with a, b:
        await add_agent(a, "han/dev")
        await codex_agent(b, "bob/cx")
        res = await a.node.outbound.send("han/dev", "bob/cx", "hello codex")
        assert res.state == "completed"
        assert res.reply == "echo: hello codex"
        [conv] = b.node.store.list_conversations("bob/cx")
        assert conv.session_id and conv.session_id.startswith("thread-")
        assert [m.role for m in b.node.store.list_messages(conv.id)][-1] == "agent"


async def test_codex_allowed_command_runs_without_card(node_factory):
    async with node_factory("han") as n:
        await codex_agent(n)
        w, _ = local_conv(n)
        result = await w.run_turn("TOOL:git status")
        assert result.text == "tool git status allowed"
        assert not n.node.store.list_approvals()


async def test_codex_unlisted_command_asks_owner(node_factory):
    async with node_factory("han", os_notifications=False) as n:
        await codex_agent(n)
        w, conv = local_conv(n)
        turn = asyncio.create_task(w.run_turn("TOOL:touch x"))
        [appr] = await wait_for(lambda: pending(n))
        assert appr.tool_name == "Bash" and appr.tool_input == {"command": "touch x"}
        assert n.node.sessions.decide(appr.id, True)
        assert (await asyncio.wait_for(turn, 10)).text == "tool touch x allowed"


async def test_codex_shell_wrapper_chaining_is_not_allowed(node_factory):
    async with node_factory("han", os_notifications=False) as n:
        await codex_agent(n)  # default list allows Bash(ls*)
        w, _ = local_conv(n)
        turn = asyncio.create_task(w.run_turn("TOOL:ls; rm -rf ~"))
        [appr] = await wait_for(lambda: pending(n))
        assert appr.tool_input == {"command": "ls; rm -rf ~"}
        n.node.sessions.decide(appr.id, False, "no")
        assert (await asyncio.wait_for(turn, 10)).text == "tool ls; rm -rf ~ denied"


async def test_codex_denied_command_declined(node_factory):
    async with node_factory("han") as n:
        await codex_agent(n, denied_tools=["Bash(rm*)"])
        w, _ = local_conv(n)
        assert (await w.run_turn("TOOL:rm x")).text == "tool rm x denied"
        assert not n.node.store.list_approvals()


async def test_codex_approval_timeout_declines(node_factory):
    async with node_factory("han", os_notifications=False, approval_timeout_s=0.2) as n:
        await codex_agent(n)
        w, _ = local_conv(n)
        result = await asyncio.wait_for(w.run_turn("TOOL:touch x"), 10)
        assert result.text == "tool touch x denied"


async def test_codex_file_edit_asks_outside_assignment(node_factory):
    async with node_factory("han", os_notifications=False, approval_timeout_s=0.2) as n:
        await codex_agent(n)
        w, _ = local_conv(n)
        assert (await w.run_turn("EDIT")).text == "edit denied"
        [appr] = n.node.store.list_approvals()
        assert appr.tool_name == "Edit"


async def test_codex_file_edit_allowed_in_accepted_assignment(node_factory):
    async with node_factory("han") as n:
        await codex_agent(n)
        w, _ = local_conv(n, accepted=True)
        assert (await w.run_turn("EDIT")).text == "edit allowed"
        assert not n.node.store.list_approvals()


async def test_codex_read_only_assignment_raises_sandbox(node_factory):
    async with node_factory("han") as n:
        await codex_agent(n, runtime_options={"sandbox": "read_only", "network": True})
        plain, _ = local_conv(n)
        await plain.run_turn("hello")
        assert FakeCodex.instances[-1].turns[-1][1]["sandboxPolicy"] == {"type": "readOnly", "networkAccess": True}
        assigned, _ = local_conv(n, accepted=True)
        await assigned.run_turn("hello")
        assert FakeCodex.instances[-1].turns[-1][1]["sandboxPolicy"] == {"type": "workspaceWrite", "networkAccess": True}
        assert FakeCodex.instances[-1].thread_params["sandbox"] == "read-only"


async def test_codex_escalation_declined(node_factory):
    async with node_factory("han") as n:
        await codex_agent(n, allowed_tools=["Bash(touch*)"])
        w, _ = local_conv(n)
        assert (await w.run_turn("ESCALATE TOOL:touch x")).text == "tool touch x denied"
        assert not n.node.store.list_approvals()


async def test_codex_crash_then_resume(node_factory):
    async with node_factory("han") as n:
        await codex_agent(n)
        w, conv = local_conv(n)
        first = FakeCodex.instances
        result = await asyncio.wait_for(w.run_turn("CRASH"), 10)
        assert result.error
        thread_id = n.node.store.get_conversation(conv.id).session_id
        assert thread_id
        again = await asyncio.wait_for(w.run_turn("hello again"), 10)
        assert again.text == "echo: hello again"
        assert len(first) == 2
        assert FakeCodex.instances[-1].resumed == [thread_id]


async def test_codex_inject_mid_turn_steers_once(node_factory):
    # turn_timeout_s small: a grace timer cancelled by Codex's later thread notifications would hang to it.
    async with node_factory("han", turn_timeout_s=8) as n:
        await codex_agent(n)
        w, _ = local_conv(n)
        turn = asyncio.create_task(w.run_turn("SLOW"))
        await wait_for(lambda: FakeCodex.instances and FakeCodex.instances[-1].turns)
        await w.inject("wrap it up")
        result = await asyncio.wait_for(turn, 5)
        assert result.text == "steered: wrap it up"
        assert FakeCodex.instances[-1].steers == ["wrap it up"]
        assert len(FakeCodex.instances[-1].turns) == 1


async def test_codex_interrupt(node_factory):
    async with node_factory("han") as n:
        await codex_agent(n)
        w, conv = local_conv(n)
        turn = asyncio.create_task(w.run_turn("SLOW"))
        await wait_for(lambda: FakeCodex.instances and FakeCodex.instances[-1].turns)
        await w.interrupt()
        result = await asyncio.wait_for(turn, 10)
        assert result.interrupted
        assert n.node.store.get_conversation(conv.id).status == ConversationStatus.INTERRUPTED


async def test_codex_interrupt_during_pending_approval(node_factory):
    """The SDK's reader thread is busy in the approval handler, so turn/interrupt would wait for the card; the
    interrupt answers this conversation's open cards first."""
    async with node_factory("han", os_notifications=False, approval_timeout_s=60) as n:
        await codex_agent(n)
        w, conv = local_conv(n)
        turn = asyncio.create_task(w.run_turn("TOOL:touch x"))
        await wait_for(lambda: pending(n))
        await asyncio.wait_for(w.interrupt(), 5)
        result = await asyncio.wait_for(turn, 5)
        assert result.text == "tool touch x denied"
        assert not pending(n)


async def test_codex_edit_card_shows_files(node_factory):
    async with node_factory("han", os_notifications=False) as n:
        await codex_agent(n)
        w, _ = local_conv(n)
        turn = asyncio.create_task(w.run_turn("EDIT"))
        [appr] = await wait_for(lambda: pending(n))
        assert appr.tool_input == {"files": ["notes.md"]}
        n.node.sessions.decide(appr.id, False)
        await asyncio.wait_for(turn, 5)


async def test_codex_reader_uses_no_pool_threads(node_factory, monkeypatch):
    """Polling Codex through asyncio.to_thread would hold a default-executor thread per conversation forever."""
    calls = []
    real = asyncio.to_thread

    async def counting(func, *args, **kw):
        calls.append(getattr(func, "__name__", ""))
        return await real(func, *args, **kw)

    monkeypatch.setattr("agentfleet_node.runtimes.codex.asyncio.to_thread", counting)
    async with node_factory("han") as n:
        await codex_agent(n)
        w, _ = local_conv(n)
        await w.run_turn("hello")
        calls.clear()
        await asyncio.sleep(1.5)
        assert "next_notification" not in calls


async def test_deleting_agent_closes_its_codex_sessions(node_factory):
    async with node_factory("han") as n:
        await codex_agent(n)
        w, conv = local_conv(n)
        await w.run_turn("hello")
        fake = FakeCodex.instances[-1]
        token = fake.mesh_env()["AGENTFLEET_MESH_TOKEN"]
        async with httpx.AsyncClient(base_url=n.url) as c:
            assert (await c.delete("/api/agents/han/cx")).status_code == 200
        assert fake.closed
        assert not n.node.sessions.check_mesh_token(conv.id, token)


async def test_codex_ask_sets_needs_input(node_factory):
    async with node_factory("han") as n:
        await codex_agent(n)
        w, _ = local_conv(n)
        result = await asyncio.wait_for(w.run_turn("ASK"), 10)
        assert result.needs_input is True


async def test_codex_config_overrides(node_factory, tmp_path, monkeypatch):
    home = tmp_path / "home"
    (home / ".codex").mkdir(parents=True)
    (home / ".codex" / "config.toml").write_text('[mcp_servers.personal-db]\ncommand = "db"\n[mcp_servers."other.one"]\ncommand = "x"\n')
    monkeypatch.setenv("HOME", str(home))
    async with node_factory("han", turn_timeout_s=600, approval_timeout_s=300) as n:
        await codex_agent(n, runtime_options={"web_search": True})
        w, conv = local_conv(n)
        await w.run_turn("hello")
        fake = FakeCodex.instances[-1]
        joined = "\n".join(fake.config_overrides)
        env = fake.mesh_env()
        assert env["AGENTFLEET_MESH_URL"] == f"http://127.0.0.1:{n.port}/api/internal/mesh/{conv.id}"
        assert n.node.sessions.check_mesh_token(conv.id, env["AGENTFLEET_MESH_TOKEN"])
        assert 'mcp_servers.mesh.args=["-m","agentfleet_node.mesh_mcp"]' in joined
        assert "mcp_servers.mesh.tool_timeout_sec=905" in joined
        assert "mcp_servers.personal-db.enabled=false" in joined
        assert 'mcp_servers."other.one".enabled=false' in joined
        assert "features.apps=false" in joined and "features.hooks=false" in joined
        assert 'web_search="live"' in joined
        assert fake.thread_params["approvalPolicy"] == "untrusted"
        assert fake.thread_params["approvalsReviewer"] == "user"
        assert "mcp__mesh__send_message" in fake.thread_params["developerInstructions"]
        await w.close()
        assert fake.closed
        assert not n.node.sessions.check_mesh_token(conv.id, env["AGENTFLEET_MESH_TOKEN"])


async def test_codex_usage_limit_error(node_factory):
    async with node_factory("han") as n:
        await codex_agent(n)
        w, conv = local_conv(n)
        result = await asyncio.wait_for(w.run_turn("USAGE"), 10)
        assert result.error == "Codex usage limit reached"
        assert n.node.store.get_conversation(conv.id).status == ConversationStatus.ERROR


@pytest.mark.parametrize(("binary", "expected"), [("own", "/usr/local/bin/codex"), ("bundled", None)])
async def test_codex_bin_choice(node_factory, codex_here, binary, expected):
    codex_here["binary"] = binary
    async with node_factory("han") as n:
        await codex_agent(n)
        w, _ = local_conv(n)
        await w.run_turn("hello")
        assert FakeCodex.instances[-1].codex_bin == expected


def test_command_for_policy():
    assert command_for_policy(["ls", "-la"]) == "ls -la"
    assert command_for_policy(["bash", "-lc", "git status"]) == "git status"
    assert command_for_policy("/bin/zsh -lc 'ls; rm -f x'") == "ls; rm -f x"
    assert command_for_policy("echo hi") == "echo hi"

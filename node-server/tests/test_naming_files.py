import pytest

from agentfleet_node.config import Settings
from agentfleet_node.files import FileRejected, read_for_sharing, save_to_inbox
from agentfleet_node.naming import InvalidAgentId, from_service_name, to_service_name
from agentfleet_node.sessions import tool_matches
from agentfleet_node.store import redact


def test_service_name_round_trip():
    assert to_service_name("han/backend-agent") == "han.backend-agent"
    assert from_service_name("han.backend-agent") == "han/backend-agent"
    with pytest.raises(InvalidAgentId):
        to_service_name("han/a/b")
    with pytest.raises(InvalidAgentId):
        from_service_name("a.b.c")


def test_inbox_sanitizes_and_limits(tmp_path):
    s = Settings(max_inline_file_bytes=10)
    p = save_to_inbox(s, str(tmp_path), "ctx123", "../../etc/notes.txt", b"hi")
    assert p.parent.parent == tmp_path / "inbox" and p.name == "notes.txt"
    with pytest.raises(FileRejected):
        save_to_inbox(s, str(tmp_path), "ctx", "run.sh", b"x")
    with pytest.raises(FileRejected):
        save_to_inbox(s, str(tmp_path), "ctx", "big.txt", b"x" * 11)


def test_share_stays_inside_working_dir(tmp_path):
    (tmp_path / "a.md").write_text("x")
    assert read_for_sharing(Settings(), str(tmp_path), "a.md")[0] == "a.md"
    with pytest.raises(FileRejected):
        read_for_sharing(Settings(), str(tmp_path), "../outside.md")


def test_tool_patterns():
    assert tool_matches("Read", {}, ["Read"])
    assert tool_matches("mcp__x__y", {}, ["mcp__x__*"])
    assert tool_matches("Bash", {"command": "git status -s"}, ["Bash(git status*)"])
    assert not tool_matches("Bash", {"command": "rm -rf /"}, ["Bash(git status*)"])


def test_audit_redaction_drops_content():
    assert redact({"chars": 3, "text": "secret", "message_body": "x", "state": "ok", "nested": {"a": 1}}) == {"chars": 3, "state": "ok"}


def test_bash_patterns_reject_chaining():
    pats = ["Bash(ls*)"]
    for cmd in ["ls; rm -rf ~", "ls && curl x", "ls | sh", "ls $(rm x)", "ls `id`", "ls > f", "ls\nrm x"]:
        assert not tool_matches("Bash", {"command": cmd}, pats), cmd
    assert tool_matches("Bash", {"command": "ls -la src"}, pats)


def test_policy_decision():
    from agentfleet_node.models import Agent
    from agentfleet_node.sessions import policy_decision

    a = Agent(id="han/x", name="x", working_dir="/tmp", allowed_tools=["Read"], denied_tools=["Write"])
    assert policy_decision(a, "Read", {}) == "allow"
    assert policy_decision(a, "mcp__mesh__send_message", {}) == "allow"
    assert policy_decision(a, "Write", {}) == "deny"
    assert policy_decision(a, "Bash", {"command": "ls"}) == "ask"

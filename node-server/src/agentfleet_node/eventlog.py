"""The office server's event log: what happened, who and when, never what was said.

Office events (nodes connecting, presence, agents arriving and leaving, desks, looks, Parties, conversation
statuses), admin actions (invites, settings) and the nodes' own audit rows (messages sent and received with their
size, assignments and approvals decided, recaps, attachments counted) land here, so an admin can trace what
happened. Every row is sanitized again here: content-like keys are dropped and values are short scalars, whatever a
node sends. Kept as JSON lines next to world.json; the newest MAX_ROWS are held in memory for the admin page.
"""

import json
import re
import time
from pathlib import Path
from typing import Any

# Same idea as store.redact on the nodes: anything that could carry words is dropped.
CONTENT_KEYS = re.compile(r"(text|content|body|prompt|input|message|title|topic|reason|task|reply|query)", re.I)
MAX_ROWS = 20000


def sanitize(fields: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in fields.items():
        if not isinstance(k, str) or CONTENT_KEYS.search(k) or len(k) > 40:
            continue
        if isinstance(v, bool) or isinstance(v, int | float) or v is None:
            out[k] = v
        elif isinstance(v, str):
            out[k] = v[:120]
    return out


class EventLog:
    def __init__(self, path: Path | None):
        self.path = path
        self.rows: list[dict[str, Any]] = []
        if path and path.exists():
            try:
                self.rows = [json.loads(x) for x in path.read_text().splitlines()[-MAX_ROWS:] if x.strip()]
            except (OSError, ValueError):
                self.rows = []

    def record(self, kind: str, owner: str = "", **fields: Any) -> None:
        row = {"at": int(time.time()), "kind": kind[:40], "owner": owner[:60], **sanitize(fields)}
        self.rows.append(row)
        if len(self.rows) > MAX_ROWS:
            self.rows = self.rows[-MAX_ROWS:]
        if self.path:
            try:
                with self.path.open("a") as f:
                    f.write(json.dumps(row) + "\n")
            except OSError:
                pass

    def query(self, who: str = "", kind: str = "", limit: int = 300) -> list[dict[str, Any]]:
        who = who.strip().lower()

        def matches(r: dict[str, Any]) -> bool:
            if kind and r.get("kind") != kind:
                return False
            if not who:
                return True
            return any(who == str(r.get(k, "")).lower() for k in ("owner", "agent", "peer"))

        return [r for r in reversed(self.rows) if matches(r)][: max(1, min(limit, 2000))]

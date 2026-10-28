"""Short topic titles for conversations, so the Chats list says what each one is about, not only who talks.

After a conversation's first real message, a small tool-less model writes a 3-6 word title in the message's
language. It stays on this node (the world server never sees it). `Settings.auto_titles` turns it off.
"""

import asyncio
import logging
import re

from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, TextBlock, query

from agentfleet_node.config import Settings
from agentfleet_node.models import ConversationKind
from agentfleet_node.store import EventBus, Store

log = logging.getLogger(__name__)

TITLE_SYSTEM = (
    "You name conversations. Reply with only a short title of 3 to 6 words for the conversation that starts with "
    "the message below, in the same language as the message. No quotes, no trailing punctuation, no emoji."
)


async def make_title(settings: Settings, text: str) -> str:
    """One tool-less turn of the small model. Tests replace this function."""
    options = ClaudeAgentOptions(model=settings.recap_model, system_prompt=TITLE_SYSTEM, max_turns=1, allowed_tools=[],
                                 setting_sources=[], cwd=str(settings.data_dir.resolve()), cli_path=settings.claude_cli_path)
    out: list[str] = []
    async for msg in query(prompt=text[:2000], options=options):
        if isinstance(msg, AssistantMessage):
            out += [b.text for b in msg.content if isinstance(b, TextBlock)]
    return clean_title(" ".join(out))


def clean_title(raw: str) -> str:
    t = re.sub(r"\s+", " ", raw).strip().strip("\"'`*#").strip()
    return t.rstrip(".!?:;")[:60]


class TitleService:
    def __init__(self, settings: Settings, store: Store, bus: EventBus):
        self.settings = settings
        self.store = store
        self.bus = bus
        self._done: set[str] = set()  # conversations already titled or being titled
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        if self.settings.auto_titles:
            self._task = asyncio.get_event_loop().create_task(self._watch(self.bus.subscribe()))

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()

    async def _watch(self, q: asyncio.Queue) -> None:
        while True:
            ev = await q.get()
            if ev.get("type") != "message":
                continue
            m = ev["message"]
            if m.get("role") not in ("owner", "peer") or m.get("kind") != "text" or len(m.get("content", "").strip()) < 3:
                continue
            conv_id = ev["conversation_id"]
            if conv_id in self._done:
                continue
            conv = self.store.get_conversation(conv_id)
            # Parties already carry their topic; shared copies and fixed titles are left alone.
            if conv is None or conv.topic or conv.kind in (ConversationKind.PARTY, ConversationKind.PARTY_SHARE):
                self._done.add(conv_id)
                continue
            self._done.add(conv_id)
            asyncio.get_event_loop().create_task(self._title(conv_id, m["content"]))

    async def _title(self, conv_id: str, text: str) -> None:
        try:
            title = await make_title(self.settings, text)
        except Exception as e:
            log.info("no title for %s: %s", conv_id, e)
            return
        if title:
            self.store.update_conversation(conv_id, topic=title)

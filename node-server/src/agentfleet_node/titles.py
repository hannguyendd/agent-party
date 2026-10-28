"""Short topic titles for conversations, so the Chats list says what each one is about, not only who talks.

One title per conversation, shared by both sides: the side that started it writes it (a small tool-less model,
3-6 words, in the message's language) from the first message, then sends it to the peer (A2A `topic`, no Claude
turn), whose copy of the conversation shows the same title. A private chat is titled from the owner's first
message. The world server never sees titles. `Settings.auto_titles` turns this off.
"""

import asyncio
import logging
import re

from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, TextBlock, query

from agentfleet_node.config import Settings
from agentfleet_node.models import ConversationKind, Direction
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
    def __init__(self, settings: Settings, store: Store, bus: EventBus, outbound=None):
        self.settings = settings
        self.store = store
        self.bus = bus
        self.outbound = outbound  # a2a_bridge.OutboundClient, to share the title with the peer
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
            if m.get("kind") != "text" or len(m.get("content", "").strip()) < 3:
                continue
            conv_id = ev["conversation_id"]
            if conv_id in self._done:
                continue
            conv = self.store.get_conversation(conv_id)
            if conv is None:
                continue
            # Who names it: the owner's first message in a private chat; my agent's first message when it started
            # the conversation. An inbound conversation waits for the starter's title instead of making its own.
            starter_role = "owner" if conv.direction == Direction.LOCAL else "agent" if conv.direction == Direction.OUTBOUND else None
            if m.get("role") != starter_role:
                continue
            # Parties already carry their topic; shared copies and titled ones are left alone.
            if conv.topic or conv.kind in (ConversationKind.PARTY, ConversationKind.PARTY_SHARE):
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
        if not title:
            return
        conv = self.store.update_conversation(conv_id, topic=title)
        if conv.direction == Direction.OUTBOUND and conv.peer_agent_id and self.outbound:
            from agentfleet_node.a2a_bridge import TOPIC_UPDATE

            try:  # best effort: the peer also gets it on our next message (TOPIC_KEY)
                await self.outbound.send_update(conv.agent_id, conv.peer_agent_id, title, TOPIC_UPDATE, conv.party_id,
                                                context_id=conv.context_id, timeout_s=15)
            except Exception as e:
                log.info("could not share the title of %s: %s", conv_id, e)

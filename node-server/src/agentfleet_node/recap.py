"""Recaps (CONTEXT.md "Recap"): a written summary of a Conversation or Party, made only when the owner asks.

The summary covers what this side saw (see `party.transcript`), is written by a small model with no tools, and is
saved as Markdown under `data/recaps/`. It stays on this machine unless its owner shares it with the Party.
"""

import asyncio
import logging
import re

from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, TextBlock, query

from agentfleet_node.config import Settings
from agentfleet_node.models import Recap, utcnow
from agentfleet_node.party import PartyService, transcript
from agentfleet_node.store import Store

log = logging.getLogger(__name__)

RECAP_SYSTEM = """\
You write Recaps of conversations between a team's AI agents and their owners. Use only what is in the transcript;
don't invent facts. Write Markdown with exactly these sections, short bullet points, no preamble:

## Goal
## Decisions
## Next steps
(who does what; "none" if nothing was agreed)
## Open questions
"""

MAX_TRANSCRIPT_CHARS = 60_000


async def summarize(settings: Settings, title: str, text: str) -> str:
    """One tool-less turn of the recap model. Tests replace this function."""
    if len(text) > MAX_TRANSCRIPT_CHARS:
        text = "[earlier part trimmed]\n" + text[-MAX_TRANSCRIPT_CHARS:]
    options = ClaudeAgentOptions(
        model=settings.recap_model,
        system_prompt=RECAP_SYSTEM,
        max_turns=1,
        allowed_tools=[],
        setting_sources=[],
        cwd=str(settings.data_dir.resolve()),
        cli_path=settings.claude_cli_path,
    )
    out: list[str] = []
    async for msg in query(prompt=f"Title: {title}\n\nTranscript:\n{text}", options=options):
        if isinstance(msg, AssistantMessage):
            out += [b.text for b in msg.content if isinstance(b, TextBlock)]
    return "\n".join(out).strip()


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40] or "recap"


class RecapService:
    def __init__(self, settings: Settings, store: Store, parties: PartyService):
        self.settings = settings
        self.store = store
        self.parties = parties
        self._tasks: set[asyncio.Task] = set()

    @property
    def folder(self):
        return self.settings.data_dir / "recaps"

    def start(self, conv_id: str) -> Recap:
        """Create the Recap row now ("working") and write it in the background; the dashboard follows its events."""
        conv = self.store.get_conversation(conv_id)
        if conv is None:
            raise LookupError("no such conversation")
        text = transcript(self.store, conv)
        if not text.strip():
            raise ValueError("nothing to recap yet")
        recap = self.store.save_recap(Recap(conversation_id=conv.id, agent_id=conv.agent_id, party_id=conv.party_id,
                                            title=conv.title or conv.agent_id))
        t = asyncio.get_event_loop().create_task(self._write(recap, text))
        self._tasks.add(t)
        t.add_done_callback(self._tasks.discard)
        return recap

    async def _write(self, recap: Recap, text: str) -> None:
        try:
            body = await summarize(self.settings, recap.title, text)
            if not body:
                raise RuntimeError("the model returned nothing")
        except Exception as e:
            log.warning("recap %s failed: %s", recap.id, e)
            recap.status, recap.body = "error", f"Could not write the recap: {e}"
            self.store.save_recap(recap)
            return
        self.folder.mkdir(parents=True, exist_ok=True)
        path = self.folder / f"{utcnow():%Y%m%d-%H%M}-{_slug(recap.title)}-{recap.id[:6]}.md"
        path.write_text(f"# Recap: {recap.title}\n\n_{utcnow():%Y-%m-%d %H:%M} UTC · {recap.agent_id}_\n\n{body}\n")
        recap.status, recap.body, recap.path = "done", body, str(path)
        self.store.save_recap(recap)
        self.store.audit("recap_written", agent_id=recap.agent_id, party_id=recap.party_id, chars=len(body))

    async def share(self, recap_id: str) -> dict[str, list[str]]:
        recap = self.store.get_recap(recap_id)
        if recap is None or recap.status != "done":
            raise LookupError("no finished recap with that id")
        if not recap.party_id:
            raise ValueError("only a Party's recap can be shared with the Party")
        res = await self.parties.share_text(recap.party_id, recap.agent_id, f"Recap from {recap.agent_id}: {recap.title}\n\n{recap.body}")
        recap.shared = True
        self.store.save_recap(recap)
        return res

"""Files exchanged between agents travel as inline A2A parts and land in the
receiving agent's ``inbox/`` folder. They are never executed."""

import mimetypes
import re
from pathlib import Path

from agentfleet_node.config import Settings


class FileRejected(ValueError):
    pass


_UNSAFE = re.compile(r"[^A-Za-z0-9._-]+")


def safe_name(name: str) -> str:
    base = Path(name).name or "file"
    base = _UNSAFE.sub("_", base).lstrip(".") or "file"
    return base[:120]


def check_file(settings: Settings, filename: str, size: int) -> None:
    suffix = Path(filename).suffix.lower()
    if suffix not in settings.allowed_file_suffixes:
        raise FileRejected(f"file type {suffix or '(none)'} is not allowed")
    if size > settings.max_inline_file_bytes:
        raise FileRejected(f"file is {size} bytes; limit is {settings.max_inline_file_bytes}")


def save_to_inbox(settings: Settings, working_dir: str, context_id: str, filename: str, data: bytes) -> Path:
    name = safe_name(filename)
    check_file(settings, name, len(data))
    inbox = Path(working_dir) / "inbox" / safe_name(context_id)[:12]
    inbox.mkdir(parents=True, exist_ok=True)
    target = inbox / name
    stem, suffix, n = target.stem, target.suffix, 1
    while target.exists():
        target = inbox / f"{stem}-{n}{suffix}"
        n += 1
    target.write_bytes(data)
    target.chmod(0o644)
    return target


def read_for_sharing(settings: Settings, working_dir: str, rel_path: str) -> tuple[str, bytes, str]:
    """Read a file inside the agent's working directory for sending."""
    root = Path(working_dir).resolve()
    path = (root / rel_path).resolve()
    if not path.is_relative_to(root):
        raise FileRejected("only files inside the agent's working directory can be shared")
    if not path.is_file():
        raise FileRejected(f"no such file: {rel_path}")
    check_file(settings, path.name, path.stat().st_size)
    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return path.name, path.read_bytes(), media_type

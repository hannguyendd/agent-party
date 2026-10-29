#!/usr/bin/env python3
"""Stamp CHANGELOG.md for a release (called by scripts/release.sh).

    scripts/changelog.py 0.2.1            # writes CHANGELOG.md
    scripts/changelog.py 0.2.1 --print    # only prints the new section

`## Unreleased` becomes `## v0.2.1 (today)`. Without that section, one is written from the `feat` / `fix` commits
since the previous tag, so every release has an entry under "What's new".
"""

import datetime
import re
import subprocess
import sys
from pathlib import Path

PATH = Path(__file__).resolve().parents[1] / "CHANGELOG.md"
HEADER = "# What's new\n"


def from_commits() -> str:
    prev = subprocess.run(["git", "describe", "--tags", "--abbrev=0"], capture_output=True, text=True).stdout.strip()
    span = f"{prev}..HEAD" if prev else "HEAD"
    log = subprocess.run(["git", "log", "--no-merges", "--format=%s", span], capture_output=True, text=True).stdout
    groups: dict[str, list[str]] = {"New": [], "Fixed": []}
    for subject in log.splitlines():
        m = re.match(r"(feat|fix)(\([^)]*\))?!?:\s*(.+)", subject)
        if m:
            text = m.group(3).strip()
            groups["New" if m.group(1) == "feat" else "Fixed"].append(text[:1].upper() + text[1:])
    body = "".join(f"\n### {k}\n" + "".join(f"- {x}\n" for x in v) for k, v in groups.items() if v)
    return body or "\n### Changed\n- Small improvements.\n"


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("usage: changelog.py X.Y.Z [--print]")
    version = sys.argv[1].lstrip("v")
    heading = f"## v{version} ({datetime.date.today().isoformat()})"
    text = PATH.read_text() if PATH.exists() else HEADER
    if re.search(rf"^## v{re.escape(version)}\b", text, re.M):
        sys.exit(f"CHANGELOG.md already has v{version}")
    if re.search(r"^## Unreleased\s*$", text, re.M):
        new = re.sub(r"^## Unreleased\s*$", heading, text, count=1, flags=re.M)
        section = new[new.index(heading):]
        nxt = re.search(r"^## v", section[len(heading):], re.M)
        section = section[: len(heading) + nxt.start()] if nxt else section
    else:
        section = heading + "\n" + from_commits()
        first = re.search(r"^## v", text, re.M)
        new = text[: first.start()] + section + "\n" + text[first.start():] if first else text.rstrip() + "\n\n" + section
    if "--print" in sys.argv:
        print(section.strip())
        return
    PATH.write_text(new)
    print(section.strip())


if __name__ == "__main__":
    main()

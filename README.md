![Party Agent. Your agents. One office. Zero standups.](docs/images/banner.png)

<p align="center"><a href="https://hannguyendd.github.io/agent-party/"><b>Peek inside the office →</b></a></p>

Party Agent puts your team's AI coding agents in one little pixel office. Every character on the map is someone's
agent, and when one gets stuck it walks over to the agent that knows and asks. You can watch any of it and step in
whenever you like. It all runs on your office network.

- **A real office map.** Everyone claims a real desk. Your agents hang around yours when they have nothing to do.
- **Agents ask each other.** Your agent can go ask a colleague's agent on its own, or you send it: click their
  agent, then Ask.
- **Code changes need a yes.** When you assign work to someone's agent, its owner accepts once, and the agent may
  edit files in that conversation only.
- **Parties.** Three or more agents on one topic, with a Host running it and a recap of who does what next.
- **You're in charge.** Watch a chat live, add a thought mid-turn, approve tools, or take over and reply yourself.
- **Dress them up.** 16 skins, from hoodie dev to dragon:

<p><img src="dashboard/public/office/characters/dev-hoodie-portrait.png" width="40" alt="dev-hoodie"> <img src="dashboard/public/office/characters/designer-portrait.png" width="40" alt="designer"> <img src="dashboard/public/office/characters/lead-portrait.png" width="40" alt="lead"> <img src="dashboard/public/office/characters/shiba-portrait.png" width="40" alt="shiba"> <img src="dashboard/public/office/characters/cat-portrait.png" width="40" alt="cat"> <img src="dashboard/public/office/characters/penguin-portrait.png" width="40" alt="penguin"> <img src="dashboard/public/office/characters/alien-portrait.png" width="40" alt="alien"> <img src="dashboard/public/office/characters/robot-portrait.png" width="40" alt="robot"> <img src="dashboard/public/office/characters/mage-portrait.png" width="40" alt="mage"> <img src="dashboard/public/office/characters/knight-portrait.png" width="40" alt="knight"> <img src="dashboard/public/office/characters/ranger-portrait.png" width="40" alt="ranger"> <img src="dashboard/public/office/characters/healer-portrait.png" width="40" alt="healer"> <img src="dashboard/public/office/characters/rogue-portrait.png" width="40" alt="rogue"> <img src="dashboard/public/office/characters/berserker-portrait.png" width="40" alt="berserker"> <img src="dashboard/public/office/characters/slime-portrait.png" width="40" alt="slime"> <img src="dashboard/public/office/characters/dragon-portrait.png" width="40" alt="dragon"></p>

## Install

**The admin**, on one computer that stays on, in the office:

```sh
git clone https://github.com/hannguyendd/agent-party.git && cd agent-party
make server
```

Then open **http://&lt;server&gt;:7500/admin**, name your office and create an invite for each computer.

**Everyone else**, once per computer. Install and sign in to [Claude Code](https://docs.claude.com/claude-code),
then run the command from your invite:

```sh
curl -fsSL http://<server>:7500/install | bash        # macOS / Linux
irm http://<server>:7500/install.ps1 | iex            # Windows (PowerShell)
```

Enter your name and the join token, and a short guide walks you through your first agent and desk. After that the
Office shortcut (or http://127.0.0.1:9100) is all you need.

If someone can't connect, run `make doctor` on the server. Every step, with the fixes, is in the
[guide](docs/GUIDE.md) and in [Quick start in detail](docs/HOW-IT-WORKS.md#quick-start-in-detail).

## In the office

| | |
|---|---|
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> / arrows | walk your agent |
| click the floor | walk there |
| click someone's agent | walk over, then **Ask**, **Assign work** or **Open conversation** |
| walk out the door | go offline until tomorrow |

## Commands

```
make server                  open the office (admin)
make doctor                  why can't the others reach the server?
make release                 ship a new version to everyone

agentfleet-node              menu on a staff computer: start, stop, open, update, logs
agentfleet-node update       update this computer
agentfleet-node uninstall    leave for good (--purge also deletes its data)
```

Hacking on it: `make setup` once, `make dev`, then `make test` and `make build` before you push.

## Privacy

- Only the owners in a conversation can read it. The office server sees who is where and who is talking to whom,
  and everyone else sees typing dots.
- The admin's event log records who did what, when, and how big each message was. It never stores message text.
- Your agent follows your rules even when another agent asks it to run a command or edit a file.

The full list of safeguards is in [Guardrails](docs/HOW-IT-WORKS.md#guardrails).

## Learn more

- [Guide](docs/GUIDE.md): running the office and joining it, step by step
- [How it works](docs/HOW-IT-WORKS.md): architecture, guardrails, manual setup, tests, known gaps
- [Glossary](CONTEXT.md) and [decisions](docs/adr/)

## Credits

Built on [Agent Mesh](https://github.com/google/agentmesh) and the
[Claude Agent SDK](https://docs.claude.com/en/docs/agent-sdk/overview). The pixel art was drawn for this office;
sources are in `design/office-style/`.

No agents were harmed in the making of this office. 🏢🎉

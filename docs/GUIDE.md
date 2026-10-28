# Office guide: admin and staff

How to run the team's Office and get everyone on it. Two roles:

- **Admin**: runs the office server on one always-on computer and invites people.
- **Staff**: install the Office on their own computer once, then use it in the browser.

---

## Admin

### What you need

One computer that stays on, on the office network, with a fixed LAN address (set a DHCP reservation in the
router so the address does not change). macOS or Linux.

### First time

```sh
git clone <this repo> && cd internal-agent-fleet
make server
```

`make server` checks what it needs and offers to install what is missing (`uv` and the hub program
`agentmesh-one`); answer **Y**. It also prepares the staff package: built here when **bun** is installed, otherwise
downloaded from the project's GitHub release (so bun is optional). The first run also downloads `agentmesh-node` for
every staff platform (a few minutes, once per version). When it is up it prints:

```
Server address: 192.168.1.65
Admin page (invite staff, see who is online): http://192.168.1.65:7500/admin
Staff install (macOS/Linux): curl -fsSL http://192.168.1.65:7500/install | bash
Staff install (Windows, PowerShell): irm http://192.168.1.65:7500/install.ps1 | iex
Admin page: ... (admin key: ...)
```

Keep that terminal open (or run it in `tmux` / as a service). Stop it with **Ctrl+C**.

> `make server` is the office server. `make serve` (no "r") is only a developer's own node on 127.0.0.1 and other
> computers cannot reach it.

### The admin page

Open **http://&lt;server address&gt;:7500/admin**. On the server itself it opens directly; from another computer it
asks for the **admin key** (printed by `make server`, also in `node-server/data/admin-key`).

- **Server settings**: set the **organization name** once (e.g. `Taggle`: every Office then says "Taggle Office").
  The hub folder and `agentmesh-one` path only need changing if the page says invites can't be made.
- **Invite a computer**: one invite per computer (see below).
- **In the office**: who is online, their agents and desks.
- **Installer**: the current build and the `agentmesh-node` file for each platform (all should say *ready*).
- **Events**: who did what and when (connections, online/offline, conversations, messages sent and received with
  their size, approvals, assignments, invites...). Never what was said.
- **Server log**: the server's own log, for troubleshooting.

### Inviting someone

1. Admin page → **Invite a computer** → type the computer's name (e.g. `Han's MacBook`) → **Create invite**.
2. Press **Copy message to send** and send it to the person privately (it contains a single-use join token and the
   office server address).
3. Under the invite, *The hub's answer* shows what the hub printed: the join token in the message must match it.

The message has two install commands: from the office server, and the same version from GitHub (for a computer
that can't download from the server). Either way the computer must reach the server afterwards.

One token works for one computer, once. If someone reinstalls on a new computer, create a new invite.

### Publishing an update

1. Whoever made the change (a developer or an agent) merges it into `develop` and publishes a version from there:
   `make release` (details:
   [RELEASE.md](RELEASE.md)). GitHub builds it and attaches it to a Release.
2. On the office server:

```sh
# in the server terminal: Ctrl+C, then
git pull
make server
```

Every open Office then shows **Update available** in the top bar; people click it and the app updates itself.

### If something is wrong

Run `make doctor` on the server. It shows the LAN address, whether ports 7400 (hub) and 7500 (office) are listening
for the network, a self-test through the LAN address, and the macOS firewall state.

---

## Staff

### Before you start

Install **Claude Code** and log in once (your agents run on it): https://docs.claude.com/claude-code

### Install (once)

Your admin sends you a message with one command, the office server address and a join token.

- **macOS / Linux**: open **Terminal**, paste the command, press Enter:
  `curl -fsSL http://<server address>:7500/install | bash`
- **Windows**: open **PowerShell**, paste the command, press Enter:
  `irm http://<server address>:7500/install.ps1 | iex`
- **If it can't download from the server**, use the GitHub command from the same message (same version):
  `curl -fsSL https://github.com/<repo>/releases/download/vX.Y.Z/install.sh | bash -s -- --server <server address>:7500`
  (Windows: `$env:AGENTMESH_SERVER='<server address>:7500'; irm https://github.com/<repo>/releases/download/vX.Y.Z/install.ps1 | iex`)

It installs everything it needs in your own user folder (no admin password), starts the Office in the background
(and at every login from now on), adds a **"&lt;Org&gt; Office"** shortcut (Applications / Start menu / Desktop) and
opens your browser.

Your computer may ask once:
- **macOS**: "Do you want agentmesh-node to accept incoming network connections?" → **Allow**.
- **Windows**: SmartScreen → **More info** → **Run anyway**; Windows Firewall → **Allow access**.

That's the only time you need the terminal, apart from logging in to Claude Code once (below).

### Join (once)

On the page that opens: check the **Claude Code** box at the top. If it says *Log in to Claude Code once*, open
Terminal (Windows: PowerShell), run `claude` and follow the steps; the page notices by itself. Then enter **your
name** (agents will be called `yourname/...`), check the **office server** address (filled in, or type the one from
the admin's message), paste the **join token**, press **Connect**. Then the short guide helps you create your
first agent (name, what it does, which project folder), pick your desk and turn on notifications.

### Every day

Open the **Office shortcut** or http://127.0.0.1:9100 (bookmark it). Nothing else to start.

- **Talk to your agent**: select it → **Message**. Type `@` to point it at a colleague's agent.
- **Ask a colleague's agent**: click their character; yours walks over, then **Ask** or **Assign work**.
- **Notifications**: the bell (top right) keeps every notification: replies, questions, approvals, assignments,
  errors, recaps. Approvals and assignments can be allowed / accepted right from the bell or the pop-up. The browser
  tab shows the unread count, e.g. "(3) Taggle Office".
- **History** (top bar): every past conversation. Search finds words inside messages too; filter by type, agent or
  date; open one to read it in full, copy it or export it as Markdown.
- **Under the map**: what's happening now (who is talking to whom; your own agents also show what they're doing and
  for how long), plus recent notifications and colleagues coming online.
- **Your agents** (side column): 👕 changes an agent's look, ⚙ opens its settings; the **Desk** pill opens a small map
  to pick your desk.
- **Going home**: click the entrance door on the map; your agent walks there and asks whether to go offline.
- **Office look**: **Settings → Office look** switches this browser between the 2D pixel-art map and the 3D office
  (preview). Everyone stands on the same tiles either way, so others see you in the same place. In 3D: drag to pan,
  scroll to zoom, `[` / `]` or ⟲ ⟳ under the map to turn the view. If the browser can't draw 3D (no WebGL, or the
  graphics card drops it), the Office shows the 2D map with a message.
- **Sound** (🔊 in the top bar): sound effects when a task is done, something needs you, a new chat starts or an error
  happens; optional background music. Both have their own volume and are remembered by this browser.
- **Keyboard**: ⌘K / Ctrl+K searches agents, chats and actions. `N` notifications, `M` message the selected agent,
  `G` then `O` / `H` / `S` for Office / History / Settings, `?` lists them. WASD / arrows walk the selected agent
  whenever you're not typing.
- **Permissions** (agent card): *Read only* / *Can edit files* / *Full access*; "Ask me before it contacts others".
- **Claude usage** (agent card): how much of your Claude plan's 5-hour and weekly limits is used.

### Going offline / online

- **Go offline**: account menu (top right) → **Log out (go offline)**, or walk your agent to the entrance door.
  Your agents leave the office; colleagues' agents can't reach them.
- **Come back**: open the Office; it asks **Go online now?** → **Yes**.
- Refreshing the page or restarting the computer keeps your choice.
- The account menu also has **Start when I sign in** (on by default).

### Updates

When the top bar says **Update available**, click it. The page reloads on the new version.

### Uninstall

In the Office: **Settings → This computer → Uninstall the Office…**, choose whether to keep your agents and chats
(kept by default in `~/.agentfleet`), confirm. No terminal needed.

From a terminal instead: `curl -fsSL http://<server address>:7500/uninstall | bash` (Windows:
`irm http://<server address>:7500/uninstall.ps1 | iex`).

### Everything else is in the web page

Joining, agents, permissions, desk, chats, approvals, History, notifications, sound, going online / offline, start at
sign-in, updates and uninstall are all in the Office page (**Settings → This computer** shows the version, updates,
start at sign-in, the Claude Code status and uninstall). The terminal is only for the first install and the
one-time Claude Code login.

---

## Troubleshooting

| What you see | What to do |
|---|---|
| Staff install stops with "The server has no node package yet" | Admin: Ctrl+C, `git pull`, `make server` (it rebuilds the package). |
| Other computers can't open the server address | Admin: run `make doctor`. Make sure it is `make server` (not `make serve`), the firewall allows incoming connections, and both computers are on the same network (no guest Wi-Fi, no VPN). |
| `make server` says a port is already in use | An earlier server is still running: stop it (Ctrl+C in its terminal, or `kill <pid>` as printed). |
| Admin page: "Can't create invites yet: ..." | Do what the message says: usually set the `agentmesh-one` path or the hub data folder under **Server settings**. |
| Setup page: "join token was already used" | Ask the admin for a new invite; each token works once. |
| Agents can't reach colleagues ("not reachable") | Settings → Joining the team: check the mesh connection status. A new join token fixes an unfinished enrollment. |
| Office says "You're offline" | Press **Yes, go online**. |
| Nothing opens at http://127.0.0.1:9100 | Open the Office shortcut (it starts the node), or run `agentfleet-node` and choose **1**. |
| The agent card shows no Claude usage | It appears after the agent's next turn. |
| Staff install: "Could not download the node package" | Open the server address in that computer's browser. If it works, use the GitHub command from the invite; if not, it's the network. |
| Setup page: "Log in to Claude Code once" | In Terminal run `claude` and log in; the page updates by itself (or press **Check again**). |
| `make server` without bun: "No GitHub release vX yet" | Publish that version (`make release`, see RELEASE.md) or install bun on the server. |

Commands on a staff computer, if ever needed: `agentfleet-node` (menu), `agentfleet-node status`, `agentfleet-node logs`.

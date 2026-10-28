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

`make server` checks what it needs and offers to install what is missing (`uv`, `bun`, and the hub program
`agentmesh-one`); answer **Y**. The first run also downloads `agentmesh-node` for every staff platform (a few
minutes, once per version). When it is up it prints:

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
2. Press **Copy message to send** and send it to the person privately (it contains a single-use join token).
3. Under the invite, *The hub's answer* shows what the hub printed: the join token in the message must match it.

One token works for one computer, once. If someone reinstalls on a new computer, create a new invite.

### Publishing an update

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

Your admin sends you a message with one command and a join token.

- **macOS / Linux**: open **Terminal**, paste the command, press Enter:
  `curl -fsSL http://<server address>:7500/install | bash`
- **Windows**: open **PowerShell**, paste the command, press Enter:
  `irm http://<server address>:7500/install.ps1 | iex`

It installs everything it needs, starts the Office in the background (and at every login from now on), adds a
**"&lt;Org&gt; Office"** shortcut (Applications / Start menu / Desktop) and opens your browser.

### Join (once)

On the page that opens: enter **your name** (agents will be called `yourname/...`), check the **office server**
address (already filled in), paste the **join token**, press **Connect**. Then the short guide helps you create your
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

- **macOS / Linux**: `curl -fsSL http://<server address>:7500/uninstall | bash`
- **Windows**: `irm http://<server address>:7500/uninstall.ps1 | iex`

It asks whether to delete your agents and chats too (default: keep them in `~/.agentfleet`).

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

Commands on a staff computer, if ever needed: `agentfleet-node` (menu), `agentfleet-node status`, `agentfleet-node logs`.

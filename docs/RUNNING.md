# Running Agent Mesh

How to run the system, either for the team on the LAN or as a two-person demo on one machine.
Run every command from the repo root unless a step says otherwise. `make help` lists all targets.

## Prerequisites

| Tool | Check | Used by |
|---|---|---|
| [uv](https://docs.astral.sh/uv/) | `uv --version` | node server |
| [Bun](https://bun.sh) | `bun --version` | dashboard |
| Claude Code CLI, logged in | `claude --version` | agents (the Agent SDK drives it) |
| `agentmesh-one`, `agentmesh-node` | `agentmesh-node --version` | hub and every device ([install](https://github.com/google/agentmesh)) |

Then, once per checkout:

```sh
make install     # Python and dashboard dependencies
make build       # dashboard into dashboard/dist, served by the node server
```

## Team setup on the LAN

### Hub (one always-on machine)

```sh
make hub HUB_HOST=<fixed LAN IP or hostname>         # keep it running
make hub-token DEVICE="han laptop"                   # in another terminal, once per device
```

`HUB_HOST` is the address teammates' devices use to reach the hub (it becomes the hub's external URL), so it
must resolve from the other machines, not only from the hub itself:

| Kind | Example | When to use it |
|---|---|---|
| LAN IP | `HUB_HOST=192.168.1.50` | The usual choice, if the IP is stable (DHCP reservation on the router, or static IP). |
| LAN IP, other ranges | `HUB_HOST=10.0.0.23`, `HUB_HOST=172.16.4.10` | Common on office networks. |
| mDNS / Bonjour name | `HUB_HOST=hans-mac-mini.local` | Macs on the same network; no setup, survives IP changes. |
| DNS hostname | `HUB_HOST=agentmesh.office.lan` | Only if your network has a DNS record for the machine. |
| Loopback | `HUB_HOST=127.0.0.1` | Single-machine testing only (see below); other devices can't reach it. |

To find the values on the hub Mac:

```sh
ipconfig getifaddr en0          # Wi-Fi IP, e.g. 192.168.1.50 (try en1 if empty)
scutil --get LocalHostName      # e.g. hans-mac-mini, so use hans-mac-mini.local
```

Check it from a teammate's machine with `ping <HUB_HOST>`. Without a DHCP reservation, prefer the `.local` name,
since the IP can change after a reboot. Each device passes the same value to `make mesh-node HUB_HOST=…`.

The hub reads no `.env`; `HUB_HOST`, `HUB_PORT` and `DATA_DIR` come from the command line or the shell.
`make hub-token` prints a single-use token. Send it to that teammate privately. The hub console is at
`http://<hub>:7400/console`; the admin token is in `hub/data/admin-token`.

### Each device

```sh
make env OWNER=han                                   # once: writes node-server/.env
mkdir -p node-server/data
echo <token from the hub admin> > node-server/data/bootstrap-token   # once

make serve                                           # terminal 1: node server + dashboard on http://127.0.0.1:9100
```

Open the dashboard, create your agents (IDs start with `<owner>/`), then start the mesh node:

```sh
make mesh-node HUB_HOST=<hub address>                # terminal 2
```

`make env` writes only `AGENTFLEET_OWNER`. Every other setting (ports, data dir, timeouts, file limits) is listed
with its default in `node-server/.env.example`; copy the lines you want to change into `node-server/.env`, or
start from `cp node-server/.env.example node-server/.env`. `scripts/start-mesh-node.sh` does not read `.env`: if
you change `AGENTFLEET_DATA_DIR`, export it in the mesh node's shell too.

The dashboard header shows **mesh up** once the node answers. Restart `make mesh-node` every time you add or
remove an agent: the mesh node reads its published agents only at startup. The dashboard shows a banner when a
restart is needed; click **I restarted it** afterwards.

### Dashboard development

`make dev` serves the dashboard with hot reload on http://localhost:5173 and proxies to the node server at
`http://127.0.0.1:9100`. If your node server runs on another port, `cp dashboard/.env.example dashboard/.env` and
set `VITE_NODE_URL`.

## Demo on one machine (two people)

Plays Han and Bob on one laptop: one hub, two node servers and two mesh nodes, each in its own terminal.
Data goes to `hub/data/` and `node-server/data/{han,bob}/` (all git-ignored). Settings are passed as env vars per
terminal, so move any `node-server/.env` aside first: its values would apply to both devices.

```sh
# terminal 1: hub
make hub HUB_HOST=127.0.0.1

# terminal 2: tokens (once), then leave this terminal free
mkdir -p node-server/data/han node-server/data/bob
make -s hub-token DEVICE=han | awk '/^Token:/{print $2}' > node-server/data/han/bootstrap-token
make -s hub-token DEVICE=bob | awk '/^Token:/{print $2}' > node-server/data/bob/bootstrap-token

# terminal 3: Han's node server, dashboard on http://127.0.0.1:9101
cd node-server && AGENTFLEET_OWNER=han AGENTFLEET_PORT=9101 AGENTFLEET_DATA_DIR=data/han \
  AGENTFLEET_MESH_NODE_URL=http://127.0.0.1:8181 uv run agentfleet-node serve

# terminal 4: Bob's node server, dashboard on http://127.0.0.1:9102
cd node-server && AGENTFLEET_OWNER=bob AGENTFLEET_PORT=9102 AGENTFLEET_DATA_DIR=data/bob \
  AGENTFLEET_MESH_NODE_URL=http://127.0.0.1:8182 uv run agentfleet-node serve
```

Create one agent in each dashboard. Give each its own working directory (any existing folder) and, to keep the
demo cheap, model `claude-haiku-5-5`. Then start the two mesh nodes:

```sh
# terminal 5: Han's mesh node
cd node-server && AGENTFLEET_DATA_DIR=data/han HUB_URL=http://127.0.0.1:7400 \
  NODE_BIND=127.0.0.1:8181 MESH_LISTEN=/ip4/127.0.0.1/tcp/0 ./scripts/start-mesh-node.sh

# terminal 6: Bob's mesh node
cd node-server && AGENTFLEET_DATA_DIR=data/bob HUB_URL=http://127.0.0.1:7400 \
  NODE_BIND=127.0.0.1:8182 MESH_LISTEN=/ip4/127.0.0.1/tcp/0 ./scripts/start-mesh-node.sh
```

`NODE_BIND` and `MESH_LISTEN` keep the two mesh nodes from fighting over the default ports. When **Mesh
directory** in Han's dashboard lists Bob's agent with location `mesh`, the demo is ready.

## Check it works

Agent IDs below are the demo's (`han/dev`, `bob/qa`); use yours.

1. **Agents talk.** In Han's dashboard click **▶ Start** on `han/dev` and send
   *"Ask bob/qa what tests a refund change needs, then summarise their answer."*
   Han sees an outbound session to `bob/qa`; Bob sees an inbound one from `han/dev`, streaming live.
2. **Approvals.** In that session send *"Run `whoami` with Bash."* An approval card appears and the header
   counts it. Allow or deny; the agent's reply follows your choice. Unanswered approvals are denied after 5 minutes.
3. **Take over.** Ask Bob's agent something long. While Bob's session shows **running**, Bob clicks
   **Take over** and types a reply: Han's agent receives Bob's words. **Hand back** returns it to the agent.
4. **Add context.** While an agent is running, type in the chat box; it is picked up at the agent's next step.
5. **Fork.** On an idle session, **Fork** makes a local copy in the sidebar.

Owners can also open any session in the terminal: `claude --resume <session id>` from that agent's working
directory.

## Stopping

Press Ctrl-C in each terminal. A node server waits for open dashboard tabs to disconnect, so close the tabs
first or press Ctrl-C a second time to force it. Restarting is the same commands: nodes reuse their stored
mesh identity, so no new token is needed.

To start over, stop everything and delete `hub/data/` and the device data dirs (`node-server/data/`). Every
device then needs a new token.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Mesh node exits: `Label not permitted` | Hub policy lacks `allowed_labels` for `owner=*` | Use `hub/policy.json`; for a live hub, `POST /policies` (see `hub/CLAUDE.md`) |
| Mesh node exits: `Bootstrap token max usages exceeded` | Token already used, and the node has no stored identity | Mint a new token with `make hub-token` |
| Send fails with HTTP 403, node log says `allow_network_target` | Hub policy lacks `allowed_targets` | Add `"allowed_targets": ["*"]`, then restart the mesh nodes (they pull policy every 15 min) |
| `agent offline` for an agent you just created | Its mesh node was not restarted, or discovery has not caught up | Restart that device's mesh node, wait a few seconds |
| Dashboard header says **mesh down** | Mesh node not running, or `AGENTFLEET_MESH_NODE_URL` points elsewhere | Start it; match the URL to its `NODE_BIND` |
| `Address already in use` | Another node server or mesh node holds the port | Stop it, or set a different `AGENTFLEET_PORT` / `NODE_BIND` |
| Agent reply says a tool was denied | Not on the agent's allowed list, and the approval was denied or timed out | Approve it in the dashboard, or add a pattern such as `Bash(make test*)` to the agent's allowed tools |

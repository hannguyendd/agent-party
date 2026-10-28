# Office state lives in a world server; browsers reach it only through their own node

The Office (shared, game-like room where agents are characters) needs state every owner sees: positions, who is
present, parties. The hub (`agentmesh-one`) is a third-party binary we can't extend, and each node only knows its
own agents, so we add a small **world server** on the hub machine. Browsers never talk to it directly: each owner
opens the Office from their own node server at `http://127.0.0.1:9100`, and the node relays to the world server.

## Why through the local node

- **Notifications**: browsers only grant `Notification` permission in a secure context (HTTPS or localhost).
  v1 is plain-http LAN, so a page served from the hub's LAN IP could never notify. Localhost can.
- **Presence**: the node already holds the dashboard WebSocket, so it knows whether its owner is present and can
  report that to the world server.
- **No CORS / no new auth surface in the browser**: the browser keeps talking only to its own node, as today.

## Considered options

- Serve the Office from the world server on the LAN IP: simplest, but no notifications without HTTPS.
- Web Push for notifications when no tab is open: needs a push service on the Internet; rejected for LAN-only v1.
  Instead, when no tab is open the node falls back to an OS notification on the owner's machine.

## Consequences

- The world server holds only Office state (positions, presence, parties), never message bodies; conversations
  still flow agent-to-agent over A2A.
- If the world server is down, agents still talk over the mesh; only the Office view degrades.

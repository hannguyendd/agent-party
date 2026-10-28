# dashboard

React 19 + Vite + TypeScript + Tailwind v4, packages via **bun**. `bun dev` proxies `/api` (including the
`/api/ws` WebSocket) to `VITE_NODE_URL` (default `http://127.0.0.1:9100`); `bun run build` writes `dist/`, which
the node server serves at `/`. Done means `bun run build` passes (it runs `tsc -b`); `bun run lint` is oxlint.

Two screens, chosen by plain React state (`View` in `src/App.tsx`, no router): the **Office** (`src/office/OfficeView.tsx`,
the only working screen: map + side column with Agents / Chats / Approvals tabs and the conversation panel) and
**Settings** (`src/office/SettingsView.tsx`: agents, mesh, notifications). Don't add separate pages for daily work;
put it in the Office side column. Code layout and state conventions: `src/CLAUDE.md`.

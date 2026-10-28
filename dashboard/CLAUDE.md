# dashboard

React 19 + Vite + TypeScript + Tailwind v4, packages via **bun**. `bun dev` proxies `/api` (including the
`/api/ws` WebSocket) to `VITE_NODE_URL` (default `http://127.0.0.1:9100`, set in `.env`; see `.env.example`); `bun run build` writes `dist/`, which
the node server serves at `/`. Done means `bun run build` passes (it runs `tsc -b`); `bun run lint` is oxlint.

Navigation is plain React state (`View` in `src/App.tsx`), with no router library. Code layout and state
conventions: `src/CLAUDE.md`.

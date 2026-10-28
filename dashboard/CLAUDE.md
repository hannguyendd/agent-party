# dashboard

React 19 + Vite + TypeScript + Tailwind v4, packages via **bun**. `bun dev` proxies `/api` (including the
`/api/ws` WebSocket) to `VITE_NODE_URL` (default `http://127.0.0.1:9100`); `bun run build` writes `dist/`, which
the node server serves at `/`. Done means `bun run build` passes (it runs `tsc -b`); `bun run lint` is oxlint.

Three screens, chosen by plain React state (`View` in `src/App.tsx`, no router; `conv` in a View opens that
conversation): the **Office** (`src/office/OfficeView.tsx`, the working screen: map + dock under it + side column with
Agents / Chats / Approvals tabs and the conversation panel), **History** (`src/office/HistoryView.tsx`: every
conversation, searchable, full transcript and export) and **Settings** (`src/office/SettingsView.tsx`: agents, mesh,
notifications). Daily work stays in the Office side column; History is for looking things up afterwards. UI copy is English. `?preview` in the URL shows sample agents (design work only).
Code layout and state conventions: `src/CLAUDE.md`.

## Phaser / Office gotchas (all found the hard way)

- **Canvas size**: the game uses `Scale.NONE` and a `ResizeObserver` on its host calls `game.scale.resize`. `RESIZE`
  mode kept the old size when only the host changed (widening the side column cropped the map).
- **Text in the canvas**: the game is `pixelArt`, which gives every texture NEAREST filtering and shreds glyphs.
  Create/update texts through `crisp()` in `OfficeScene.ts` (LINEAR filter), scale overlays by `1 / zoom` so they
  keep their screen size, and redraw them after `document.fonts.ready`.
- **Hit areas**: interactive Containers measure hit areas from the container's centre. Agents use a separate Zone
  (origin at the feet) as the click/hover target.
- **Keyboard**: Phaser cancels mousedown, so the canvas host never gets focus by itself; the scene focuses it on
  pointerdown, otherwise WASD does nothing.
- **Pixel art**: draw icons only at 16 or 32 px (`Icon` takes `size: 16 | 32`); in-between sizes distort them.
- **Fonts**: Fredoka (display, `--o-pixel`) + Nunito (body). Pixel fonts were rejected as hard to read;
  Pixelify Sans also lacks Vietnamese and has fi/ffi ligatures.
- `pathfinding` (PathFinding.js) finds paths; its `Util.smoothenPath` throws in strict-mode ESM, so smoothing is ours
  (`pathfind.ts`). Call `rebuildGrid()` after the map data changes.

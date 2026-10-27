# dashboard/src

- `api.ts`: typed REST client plus every backend type and `LiveEvent`. It is a hand-kept **mirror** of
  `node-server` (`api.py`, `models.py`, events published in `store.py`); update it in the same change as the backend.
- `useLiveState.ts`: the single client-side store. REST snapshot + WebSocket events go through one reducer
  (`applyEvent`); it reconnects with backoff and refetches on reconnect. A new backend event gets a `LiveEvent`
  variant and a reducer case; components read state, they never open sockets.
- `delta` events are live-only partial text: kept per conversation and cleared on the next agent message or when
  the status leaves `running`.
- `components/ui.tsx`: shared primitives (`StatusBadge`, `Pill`, `Json`, `TagInput`, time formatting, `errMsg`).
  Reuse them before adding new ones.
- Styling: colours come from the theme tokens in `index.css` (`bg-panel`, `text-muted`, `border-line`,
  `bg-agent`, …), which switch with `prefers-color-scheme`. Use tokens, so dark mode keeps working.

# dashboard/src

- `api.ts`: typed REST client plus every backend type and `LiveEvent`. It is a hand-kept **mirror** of
  `node-server` (`api.py`, `models.py`, events published in `store.py`); update it in the same change as the backend.
- `useLiveState.ts`: the single client-side store. REST snapshot + WebSocket events go through one reducer
  (`applyEvent`); it reconnects with backoff and refetches on reconnect. A new backend event gets a `LiveEvent`
  variant and a reducer case; components read state, they never open sockets.
- `delta` events are live-only partial text: kept per conversation and cleared on the next agent message or when
  the status leaves `running`.
- `components/ui.tsx`: shared components (`StatusBadge`, `Pill`, `Json`, `TagInput`, `ErrorLine`); plain helpers
  (`errMsg`, `timeAgo`, `clockTime`) live in `components/format.ts` so `ui.tsx` only exports components (fast refresh).
  Reuse them before adding new ones. Same rule everywhere: a `.tsx` file exports components only.
- Styling: colours come from the theme tokens in `index.css` (`bg-panel`, `text-muted`, `border-line`,
  `bg-agent`, …), which switch with `prefers-color-scheme`. Use tokens, so dark mode keeps working.
- `office/`: the Office.
  - `OfficeScene.ts`: the Phaser scene. Loads the map plate, `collision.png` (black = blocked, red = seat,
    blue = entrance) and `seats.json` from the manifest (`layout.ts` is only the fallback when the map is missing).
    Arcade-physics movement (keyboard driving, smoothed click-to-walk), proximity menu, desk tags, bubbles. It
    reports through `SceneCallbacks` and **never calls the API**; React pushes data in with `setSceneData`.
  - React side: `OfficeView.tsx` (screen + side column), `AppBar.tsx` (shared with Settings), `SideLists.tsx`
    (Chats, Approvals, MessageAgent), `AgentCard.tsx`, `ConversationPanel.tsx` + `OfficeChat.tsx` (transcript with
    avatars, mesh events and attachments), `PeerMenu.tsx` (Ask / Assign), `MentionInput.tsx` (@agent picker, paste),
    `attachments.ts` + `AttachBar.tsx` (pick / drop / paste files, checked against `node.files` limits, sent base64),
    `SettingsView.tsx`, `people.ts` (`who()`: display name / owner / skin for an agent ID).
  - Art comes from `public/office/manifest.json` (Codex; see `docs/office/`). Don't hard-code art; add a manifest key.
  - `office.css` scopes the pastel theme to `.office-view` and maps the shared tokens (`--panel`, `--muted`, …) so
    shared components (`ApprovalCard`, `AgentForm`, `Directory`) match it without their own restyle.
- Privacy rule in the UI: words of a conversation show only for my own agents; other agents get typing dots.

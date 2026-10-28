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
  - React side: `OfficeView.tsx` (screen, side column, status bar), `AppBar.tsx` (shared with Settings),
    `AgentCard.tsx` (selected agent: Message, Continue, Go to, contact-policy switch, look), `SideLists.tsx`
    (Chats with groups / search / unread, Approvals), `ConversationPanel.tsx` + `OfficeChat.tsx` (transcript with
    avatars, mesh events and attachments), `NewChatPanel.tsx` (private chat before its first message),
    `Composer.tsx` (the one message box: `MentionInput` @picker + `AttachBar` + Send), `PeerMenu.tsx` (Ask / Assign),
    `attachments.ts` (pick / drop / paste, checked against `node.files`, sent base64), `status.ts` (status labels and
    tones), `seen.ts` (per-browser "seen" marks for unread dots), `people.ts` (`who()`: display name / owner / skin),
    `SettingsView.tsx`, `SetupView.tsx` + `SetupForm.tsx` (first-run join page; the form is reused in Settings),
    `Onboarding.tsx` (guide over the map; its step is derived from state in `OfficeView`, and "+ New agent" opens
    its short agent form alone), `PartyPanel.tsx` (gather a Party), `PartyBar.tsx` (party controls inside a
    conversation, by role), `RecapList.tsx` (recaps of the open conversation), `trim.ts` (portraits cropped to
    their visible pixels for avatars).
  - Art comes from `public/office/manifest.json` (Codex; see `docs/office/`). Don't hard-code art; add a manifest key.
  - `office.css` scopes the pastel theme to `.office-view` and maps the shared tokens (`--panel`, `--muted`, …) so
    shared components (`ApprovalCard`, `AgentForm`, `Directory`) match it without their own restyle.
- Privacy rule in the UI: words of a conversation show only for my own agents; other agents get typing dots.

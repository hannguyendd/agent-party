# Office: art brief

What the Office art is, how it is made, and the exact contract the code reads. Vocabulary (Office, Desk, Skin,
Party…) follows `CONTEXT.md`. The prompts handed to Codex are in `CODEX-PROMPTS.md`.

> **Originality:** every design is original. Do not copy or closely imitate the characters, tiles or UI of
> Pokémon, Gather, Stardew Valley or any other game. Only the *genre* (top-down pixel office) is shared.

## Who does what

- **Codex** produces assets only: images, the collision grid, `seats.json`, and entries in
  `dashboard/public/office/manifest.json`. Sources and export scripts live in `design/office-style/`.
- **Code** reads everything through the manifest and never hard-codes art. When the art needs a code change, Codex
  writes it in `design/office-style/REQUESTS.md`.

## Style (approved: direction C, "Pastel playful")

- Top-down 3/4 view (classic 2D RPG camera), 32 px grid, crisp pixel art, no blur or gradients.
- Shared palette: `design/office-style/C/palette.txt` (32 colours: peach floor, mint and lavender accents, slate
  walls). Light from the top-left; outlines are a darker shade, never pure black.
- Reference image: `design/office-style/C/office-preview-v3.png`.

## The map (Gather-style plates)

The room is one painted plate plus data, not tiles assembled in code. Files in `dashboard/public/office/map/`,
listed under `"map"` in the manifest:

| File | Size | Contract |
|---|---|---|
| `background.png` | 1792×1152 (56×36 tiles of 32 px) | The whole office, no characters or labels |
| `foreground.png` | 1792×1152, transparent | Parts drawn over characters. **Currently unused** (it contained whole desks, which covered agents standing in front of them; see `OfficeScene.ts`) |
| `collision.png` | 56×36, one pixel per tile | black = blocked, white = floor, red = a desk's main chair (walkable), blue = entrance |
| `seats.json` | — | `[{ "id": "D1", "seat": {x,y}, "face": "right", "extras": [{x,y}, …] }]` for D1–D16, M1, M2 |

The layout follows the real office:

```
      [HR] [door]
  D1 | D2                    +----------------+
  D3 | D4                    |     Pantry     |
  D5 | D6     M1 | M2        +----------------+
  D7 | D8                    |  Manager Room  |
        D9 | D10| D11| D12   |                |
        D13| D14| D15| D16   |                |
```

"X | X" = two desks back to back across a low divider. Walkways at least 2 tiles wide; room around each desk for
extra stools (one owner's agents sit around one desk). Desk labels are drawn by code, never in the art.

## Characters (Skins)

`dashboard/public/office/characters/<skin>.png` under `"characters"` in the manifest, plus `<skin>-portrait.png`
for avatars. Skins: `dev-hoodie`, `designer`, `lead`, `shiba`, `cat`, `penguin`, `alien`, `robot`.

Sheet: **4 columns × 5 rows of 32×48 frames (128×240)**, feet on the bottom edge of each frame.

| Row | Frames |
|---|---|
| 0 | walk down ×4 |
| 1 | walk left ×4 (walk right = mirrored by code) |
| 2 | walk up ×4 |
| 3 | sit down, sit left, sit up, wave |
| 4 | type ×2, idle ×2 |

The code draws characters at **1.5×** (`CHAR_SCALE` in `skins.ts`) to match the furniture in the plate. **Wanted:**
the same sheets drawn natively at 48×72 frames (192×360), listed as `"characters48"`; then `CHAR_FRAME` becomes
48×72 and `CHAR_SCALE` 1.

## UI art

`dashboard/public/office/ui/`, under `"ui"` in the manifest. Pixel icons are 16×16 with `@2x` (32×32) versions and
are only ever shown at 16 or 32 px:

`office, agents, approvals, approvals-pending, directory, settings, zoom-in, zoom-out, fit, close, send, stop,
takeover, handback, fork, inject, inquiry, assignment, party, recap, host, desk, back, notifications-on, online, away`

Plus: `logo.png` (32) / `logo@2x.png` (64), `favicon.png`, `bubble.png` (24×24 nine-slice, 8 px corners) and
`bubble-tail.png`, `ring.png` (white, tinted with the owner colour) and `ring-selected.png`, `target.png`
(3 frames of 32×16) and `typing.png` (3 frames of 16×8).

## Checklist when art lands

- [ ] Exact pixel sizes, transparent background, no gaps between frames
- [ ] Only palette colours
- [ ] Characters keep the same face and colours in every frame
- [ ] Every red pixel in `collision.png` has a seat in `seats.json`; every walkable tile is reachable from the entrance
- [ ] Manifest updated; no text, logos or other games' characters in the images

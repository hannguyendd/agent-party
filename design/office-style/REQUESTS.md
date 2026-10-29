# Map asset integration

Latest delivery: `dashboard/public/office/map/`, based on approved pastel C preview v3.
This batch changes only assets, map metadata, the manifest map entry, and design notes/scripts.

- Load `manifest.map.background` as one 1792×1152 image at native scale, origin top-left.
- Render agents above the background, then `manifest.map.foreground` above agents at exactly the same origin and scale. Foreground pixels are copied from the background; stacking the two without agents is pixel-identical to background alone.
- Use the 56×36 `collision.png` as the authoritative grid: black blocks; white, red and blue allow walking. The blue entrance is tile `(19, 4)`. Do not derive collisions from the old procedural layout.
- Use `seats.json` for all 18 desks, their main seat direction, and three extra tiles each. Coordinates are zero-based 32px tiles. Keep main seats walkable.
- Avoid drawing the old procedural walls/desks/furniture on top of this plate. Desk labels remain code-rendered and are absent from the artwork.
- Keep the existing 128×240 character-sheet contract unchanged. Character files were untouched by this map batch.
- `collision@16x.png` is a human review image, not runtime collision data: it is the four-color grid enlarged with nearest-neighbour and blended 50% over a half-size background.
- The approved v3 open pantry and separate corridor between the bottom desk bank and Manager Room are preserved. Manager has one doorway in the upper part of its left wall and a fully closed lower wall.

Asset art was generated with the built-in image tool. Export, palette matching, foreground extraction, collision marking and validation are reproducible with `python3 design/office-style/C/map/export-map.py` (Pillow).

## Native 48×72 character batch

- Added eight new sheets under `manifest.characters48`, separate from the existing `characters` section.
- New sheet dimensions: 192×360; frame dimensions: 48×72; four columns, five rows. Animation indices and left/right mirroring stay the same as the original contract.
- Use these sheets at native size; do not enlarge the 32×48 sheets to substitute for them. No change to the 32px collision/tile grid is needed.
- Logical bottom contact is y=70 inside each 48×72 frame, leaving the final pixel row transparent. Account for that one-pixel margin when setting the feet anchor.
- Original character PNGs were preserved. No integration code was edited by the asset batch.

## Additional chrome icons

Added `attach`, `image`, `file`, `pantry`, `mention`, `question`, `search`, `keyboard`, `new-chat`, `people`, `clock`, `check` under `manifest.ui`, with matching `@2x` entries. Native icons are 16×16; @2x icons are 32×32 exact nearest-neighbour. Sources, previews and validation are in `design/office-style/C/ui-extra/`.

## Fantasy Office cast, batch 2

Add these IDs/labels to the skin picker and any skin allow-list maintained by the application owner:

| ID | Display label |
|---|---|
| mage | Coffee Mage |
| knight | Keyboard Knight |
| ranger | Paper Ranger |
| healer | Band-Aid Healer |
| rogue | Donut Rogue |
| berserker | Debug Viking |
| slime | Crowned Slime |
| dragon | Cardigan Dragon |

All eight are in `manifest.characters48` with the existing 192×360 sheet / 48×72 frame contract and animation indices. Portraits follow `office/characters/<id>-portrait.png`. Feet/slime base end at logical y=70; y=71 stays transparent. No new layers or effect files are required: mage sparkles, healer heart and dragon smoke are contained inside their frames. Slime's squat silhouette is intentional; do not stretch it to human height. The existing animation behavior is unchanged: walk-right mirrors the left row.

No application code was changed by the asset batch. Add the IDs to any server-side skin validation as needed before exposing them to owners. SHA-256 preservation and visual reviews are in `design/office-style/C/characters48-batch2/`.

## Done: desk seat in the Manager Room (MGR)

Owner request (2026-10-28): staff can pick the Manager Room as their desk. No new art: the existing green armchair
behind the large desk is the seat. `seats.json` has a 19th entry `MGR` (seat (51, 21), facing down, extras (50, 21),
(52, 21), (51, 20)); `collision.png` marks (51, 21) red. `export-map.py` reproduces both. Code: `MGR` in world.py
`DESKS`. Desk count is now 19.

## Part D shared-map correction: manager-room extension and HR seat

Owner-authorized for `feat/office-3d`, in this worktree only. The manager room now reaches the south exterior wall at row 34. Its west partition remains x=40, with the original doorway at rows 15–16; it continues through rows 29–33. The old south partition at row 28, x=41..53, is walkable floor. MGR and all previous seat records are unchanged.

Collision changes (34 tiles total):

- Make `(41..53,28)` walkable (13 tiles).
- Block `(40,29..33)` for the continuing partition (5 tiles).
- Block `(48..50,29..30)` for the lounge table, `(48..50,31..32)` for the second sofa, and `(52,32)` for its plant (13 furniture tiles).
- Make `(14,4)` and `(14,5)` walkable for the HR entry gap, and mark `(13,4)` red as seat HR (3 tiles).

`office/map/seats.json` now has **20** entries. The new record is:

```json
{"id":"HR","seat":{"x":13,"y":4},"face":"down","extras":[{"x":14,"y":4},{"x":14,"y":5},{"x":15,"y":4}]}
```

App-owner integration: recognize HR in the server/default desk lists and seat picker if not already handled. HR sits behind the shortened reception desk, facing south. The 3D desk and monitor fronts face north; the chair is the standard nonblocking seat-chair exception. The 2D chair, monitor, left plant and window frame are pixel-identical; the right desk end was shortened and its plant/mug relocated.

The scoped, reproducible export remains `python3 design/office-style/C/map/export-map.py`; it dispatches to `design/office-style/3d/src/map-export.ts` and does not edit manifest.json. It preserves unrelated 2D pixels, the existing 32-color palette, binary foreground alpha, and uses the original nearest-neighbour / 50% recipe for collision@16x.png. Before/after/diff reviews are in `design/office-style/3d/previews/map-before-after-diff.png` and `hr-before-after-diff.png`. Exact changes and validation evidence are in that package's reports.

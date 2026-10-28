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

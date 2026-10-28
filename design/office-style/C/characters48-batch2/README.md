# Fantasy Office cast, batch 2

Eight original fantasy-office roles, generated with the built-in image_gen tool and exported into the existing pastel C art system.

| ID | Display label | Main visual cue |
|---|---|---|
| mage | Coffee Mage | Oversized starry hat, hoodie under robe, coffee mug and two sparkles |
| knight | Keyboard Knight | Raised visor, lanyard badge, keyboard shield |
| ranger | Paper Ranger | Green hood/cape, paper-and-pen quiver |
| healer | Band-Aid Healer | Cream/gold cleric, plaster wand, heart on wave |
| rogue | Donut Rogue | Purple mask, fluttering scarf tails, donut |
| berserker | Debug Viking | Horned helmet, huge beard, debugging duck |
| slime | Crowned Slime | Mint crowned blob, squash/stretch walk, typing nubs/drips |
| dragon | Cardigan Dragon | Peach baby dragon, lavender wings, mint cardigan, smoke on wave |

## Runtime deliverables

- `dashboard/public/office/characters48/<id>.png`: **192×360**, four columns × five rows, twenty **48×72** frames.
- `dashboard/public/office/characters/<id>-portrait.png`: native **32×48** transparent front-standing portrait.
- `manifest.json` → `characters48`: the eight new sheet paths; all existing entries and sections are preserved.

Frame order is identical to the first cast: down walk 0–3, left walk 4–7, up walk 8–11, sit down/left/up and wave 12–15, typing down ×2 and idle down ×2 at 16–19. Rightward walking is obtained by mirroring row 1, never a separate source row.

All sprite contact pixels end at logical **y=70**, with row **y=71 transparent**. One scale per character is shared by all twenty poses, including effects. The slime is naturally shorter and wider; its stride frames are wider and flatter. Sitting poses retain the same scale and have shorter silhouettes.

The runtime images use only `../palette.txt`, never pure black, and have binary alpha (0/255). Palette conversion uses no dithering and rasterization uses nearest-neighbour with no smoothing. Portraits are rasterized independently on the native 32×48 grid directly from the high-resolution front pose, never resized from the runtime 48×72 frame.

## Sources and reproduction

Each `<id>-source.png` is the high-resolution image-generated source, with its exact `<id>-prompt.txt`. Slime additionally has a corrected source and correction prompt to normalize leftward walking and remove unwanted effects. `export-batch.py` (Pillow) slices the source poses, removes detached unrequested motion doodles, normalizes palette/alpha/alignment, exports sheets and portraits, updates only the new manifest entries, and regenerates all validation and review artifacts.

`before.json` is the pre-batch preservation snapshot. `validation.json` compares SHA-256 for **all 131 pre-existing asset files**, including all original eight sheets and portraits, and confirms all are unchanged. It also compares a canonical hash of the entire pre-existing manifest with the final manifest after removing only the eight new entries. Those hashes match.

## Review artifacts

- `poses-review.png`: front, left, back, sit, wave, type for each new character, at 2× against light/dark backgrounds.
- `cast-review.png`: all sixteen characters in the same standing row at 2×, repeated on #FDF8F2 and #2C283C.
- `sheets-review.png`: all 160 new frames at 2× for detailed inspection.
- `validation.json`: exported image dimensions, palette and alpha checks, frame bounds, unique walking/typing checks, hashes and preservation results.

All images are original role designs, with no franchise likenesses, text, logos or watermarks. Labels occur only on design review boards. No application code was edited.

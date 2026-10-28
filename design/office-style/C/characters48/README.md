# Native Office characters48

Eight transparent PNGs under `dashboard/public/office/characters48/`, listed in `manifest.json` → `characters48`:

- dev-hoodie.png
- designer.png
- lead.png
- shiba.png
- cat.png
- penguin.png
- alien.png
- robot.png

Each sheet is **192×360**, four columns by five rows, containing **20 native 48×72 frames**. All eight use the same frame order as the original character contract:

| Row | Frames | Content |
|---|---|---|
| 0 | 0–3 | Walk down/front: stride, stand, opposite stride, stand |
| 1 | 4–7 | Walk left; right is mirrored by the game |
| 2 | 8–11 | Walk up/back |
| 3 | 12–15 | Sit down, sit left, sit up, wave |
| 4 | 16–19 | Typing down ×2, idle down ×2 |

These are new 20-pose sources generated with the built-in image_gen tool, sampled **down** to 48×72. They are not enlarged from the old 32×48 assets. High-resolution sources and individual prompts are preserved in this directory. All output pixels use only the approved palette in `../palette.txt`, with no antialiasing, dithering or partial alpha.

Transparent frame bounds remain clear. Feet/bottom contact align at logical y=70 (the final row y=71 stays transparent). A single scale per skin is used for all its poses; seated sprites are naturally shorter. Character widths/heights vary by silhouette, so the penguin remains shorter than human skins.

`export-characters48.py` reproduces the sheets and manifest entries with Pillow. `validation.json` records sizes, frame counts, palette/alpha checks, distinct walk and typing poses, and hashes. It verifies that original `characters/` PNGs are unchanged.

`poses-review.png` shows front/left/back/sitting/waving/typing poses against both requested backgrounds. `sheets-review.png` shows all 160 frames at 2× for detailed review. Labels and background squares appear only in design QA boards.

No application code was changed. Integration should read `characters48` with frameWidth=48 and frameHeight=72, keeping the existing animation indices. Use the sheet at native scale; the game's logical 32px tile grid need not change.

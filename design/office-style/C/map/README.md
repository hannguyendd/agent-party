# Office C map assets

Reference: `design/office-style/C/office-preview-v3.png`.

Delivered files in `dashboard/public/office/map/`:

| File | Dimensions | Role |
|---|---|---|
| background.png | 1792×1152 | Opaque empty office, no characters, bubbles or desk labels |
| foreground.png | 1792×1152 | Transparent occluding details extracted from the same background pixels |
| collision.png | 56×36 | Exact four-color runtime tile grid |
| collision@16x.png | 896×576 | 50% collision overlay for visual review |
| seats.json | 18 desk entries | D1–D16, M1, M2; main seat, facing and three extras each |

The background and visible foreground pixels use only the 32 colors from `../palette.txt`.
Foreground alpha is binary. Export uses nearest-neighbour, with no smoothing or dithering.
Collision and the diagnostic overlay intentionally use the requested semantic colors instead of the art palette.

Collision marks solid furniture footprints conservatively, including the narrow unusable space under the Manager desk/chair bank. Main desk chairs are walkable red tiles. Rugs are walkable.

Validation confirms every red tile matches exactly one seat, all 18 desk IDs exist, all extras are walkable, and all 1,146 walkable tiles are reachable from the single blue entrance using four-direction movement. There are no disconnected walkable tiles. Background plus foreground reproduces background exactly when no agents are present.

Source art and prompt are kept here; `export-map.py` reproduces the deliverables and `validation.json`. `collision-grid-review.png` adds tile boundaries and desk identifiers for asset QA only; it is not a game image.

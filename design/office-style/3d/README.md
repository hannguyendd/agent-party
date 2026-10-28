# Part F (current): reachable workstations and meeting corner

Every station is generated in `src/layout-f.ts` from its unchanged seat centre and facing. Monitor distance is 1.2 tiles, with a 0.55 near desk edge and depth ≤1.4 (HR 0.9). Standard desks are 1.8 wide. MGR is limited to 0.92 by its one-tile blocked approach; HR has a 0.5 left-biased reception top to retain its walkable right-hand entry. Every item has an explicit own-desk support id and must fit that actual footprint. New fixed-size GLBs replace the Part E scaled bench bridges; no placement-scale integration is required by Part F.

`src/props/part-f.ts` builds desks, compact hardware, low cabinet/planter spines, lavender chair upholstery, and a four-chair meeting corner. `manifest-models3d.json` registers them without touching the shared manifest. The meeting corner is entirely inside x=48..50 / rows=29..32. Chair variants retain the existing seat positions and orientations.

The map exporter dispatches to `src/map-f.ts`: it writes **only background.png and foreground.png** and checks collision.png, collision@16x.png and seats.json against `src/map-before-f/` byte-for-byte. The frozen collision overlay intentionally retains its Part E artwork per the owner's explicit instruction. No shared map metadata is rewritten. Run the existing `python3 design/office-style/C/map/export-map.py` from the repository root to reproduce the two plate layers.

Character polish is shared by `src/characters/features.ts`: smooth heads, close-fitting caps, eye glints and soft smiles. The 16 ids, rigid node contract, hidden mug, footprint/height and eight clip timings remain unchanged. `previews/characters-before-after.png` compares the old lineup (top) and current lineup (bottom).

Build / validate / preview: `bun run build`, `bun run validate`, `bun run preview` from this package. The validator also tests monitor distance/axis/facing, desk containment, reach zones, nonempty desk surfaces, frozen map bytes and the meeting footprint. Final counts and exceptions are in REPORT.md.

---

# Part E curation (current)

The current layout follows the plate rather than filling collision padding with storage. The source pass is `src/curate-e.ts`; `reports/part-e-curation.json` records before/after counts. `reports/uncovered-allowed.json` lists connected padding/floor-shadow clusters with explicit tile arrays and reasons. Validation rejects any unlisted uncovered tile and enforces filler caps. No collision or seat changes are part of Part E.

Bottom-bank joins use `desk-long` with explicit `[x, 1, z]` placement scale, shared by footprint validation and the preview loader. The lounge armchair uses `[0.8, 1, 0.8]` to fit its original one-tile plate footprint. All raised geometry stays on blocked tiles. A focused preview refresh is available with `bun src/preview-plate.ts`; the complete workflow remains `bun run build`, `bun run validate`, `bun run preview`.

The HR mug and right-end plant are behind the unchanged monitor, so they do not obscure it. Map generation retains the existing collision and seats byte-for-byte. Part E supersedes Part D's zero-uncovered target and dense manager wall-decor requirement.

---

# Pastel Office 3D — Part D

This package builds the Office's toy-diorama assets. The current delivery includes Part D and the owner's D10–D13 corrections: solid north walls, west windows, frosted manager partitions and animated doors, a manager room extending to row 34, and the new HR seat. Palette remains **pastel**.

## Reproduce

From this directory:

```sh
bun install
bun run build
bun run validate
bun run preview
```

Install Chromium once with `bunx playwright install chromium`. Build writes all GLBs, both palette references, the manifest fragment, layout, and the authorized shared map edits. Validate reads the actual exported GLBs and the **new** collision image. Preview regenerates the four office rotations, top-down/overlay, style scene, new-props sheet, entrance/manager/HR close-ups, model turntables and character clip strips.

The shared 2D map is also reproducible through the existing entry point, from the repository root:

```sh
python3 design/office-style/C/map/export-map.py
```

Its Part D adapter runs this package's `src/map-export.ts` using the immutable original sources in `src/map-before/`. It never runs the legacy manifest-writing export. The first 19 seat records stay identical; HR is appended as seat 20. See `reports/map-d12.json` for all 34 collision edits and pixel checks. The 2D plate keeps its original 32 colors and 2px lattice, the foreground stays binary-alpha and stacks exactly, and `collision@16x.png` uses the original nearest-neighbour / 50% blend recipe.

## Shared geometry and placement

One unit is one 32px map tile. Y is up; +Z is south/down. Floor top is exactly y=0, with the slab below it; no height offset is needed. `floor-tile` is 12 triangles and uses the first 32×32 palette cell for grain/seams. This is the sole deliberate full-cell UV exception; all other meshes sample cell centres. `floor-manager` is a 12-triangle mint carpet tile. There are no external GLB files, Draco, normal maps or extra image textures.

Perimeter kits are 3.3 high, manager frosted partitions 2.8. The west `window-wall` has a 0.45 sill, clear glass (alpha 0.3), light frames, a rolled blind at the top, and `panel-gap` extras repeatEvery=3 / phase=2. Honor each instance's `panelGap` visibility flag. North/east/south are solid warm-white walls. The manager outline is x=40.5, z=14.5..34; its doorway remains z=15..17.

Chair front points where its sitter looks; desk front is its sitting side; monitor front is the screen. Desk and monitor rotations match, opposite their chair. HR is the same rule: chair `(13.5,4.5)`, rot 0; shortened reception desk and monitor rot 180. HR's top is y=0.88; the other 19 station tops are y=0.74.

Raised furniture is wholly on true-black RGB collision cells. The validator explicitly tests all three channels, preserving blue entrance and red seats as walkable. Exceptions are narrowly restricted to the 20 known seat chairs and the two known glass-door openings. Rugs/mats/stickers are at most 0.03 high. Sunlight decals are at y=0.012, zero-thickness, vertex alpha 0.6; `decal:"sunlight"` and `eveningOpacity:0` identify them for runtime evening fading.

Wall mounts carry `mount:"wall"`, `facing`, `wallId`, `rot`, and `y`. The origin is at the wall face, centre bottom; +Z faces into the room. Their backing must be a continuous same-facing wall placement, projection is at most 0.12, and deep items start at or above 1.7. Thin items at most 0.06 deep may sit lower. Coordinates are already world placements; `wallId` supports runtime parenting and cut-away visibility.

## Doors and characters

`door-glass-double` is at the entrance tile `(19,4)`, with a 3.3 solid header and ~2.3 opening. `door-glass` fills the two-tile manager doorway. Both default closed, with hinge nodes `leaf-l` / `leaf-r`, clips `open` and `close`, each 0.6 seconds and an 85° inward swing. Play these once, clamp at their end poses, and open before an agent crosses; the collision grid remains walkable at the openings. Manager glass uses milky vertex-alpha 0.8 panels and a 0.3 clear strip, with slim light aluminium rails.

All 16 skins keep their rigid-node contract, eight loopable clips and hidden held-item group. `hand-r-socket/held-items` has scale `[0,0,0]` by default and extras `shownScale:[1,1,1]`. Restore that group scale to show a prop; clips never animate it. Walk lasts 0.6 seconds; other character clips last 2 seconds. This visibility mechanism needs no glTF extension.

## Review and limits

Open `previews/index.html`. `new-props-sheet.png` shows all new models, individually framed (not to common scale). `map-before-after-diff.png` and `hr-before-after-diff.png` show before / after / highlighted difference from left to right. `entrance-door-closeup.png`, `entrance-door-open.png`, `manager-room-closeup.png` and `hr-desk-closeup.png` show the owner corrections.

`REPORT.md` starts with the exact shared-map changes and current Part D metrics; older A–C reports remain historical. `FILES.md` lists delivered files, and `reports/part-d-files.json` lists changed package/assets. `REQUESTS-3D.md` records future open-floor furniture requests that have **not** been applied. Thin trim uses a radius bounded by its thickness; the low-poly floor slab is an explicit D6 exception to rounded geometry. No dashboard or server code is part of this asset work.

# Office 3D — Part G

Three furniture sets share the same room, placements, camera and pastel palette: our baseline, KayKit Furniture Bits, and Kenney Furniture Kit. No shared map, application/server source, shared manifest or docs were changed. No commit was made. All public outputs also rebuild byte-for-byte using only the retained vendor/ sources (reports/part-g-rebuild-proof.json); ignored raw archives are not required for normal rebuilds.

## Scale and ownership

- Characters were uniformly scaled ×1.4 before the ownership handoff: standing 1.95–2.2, width ≤1.3; seated hips/seat 0.7. The polished Part F design, ids, rigid nodes, clip names and timings were retained. **The character source and GLBs are now read-only to this pipeline.** Builds read the existing character files; future agent replacements are checked against the common contract only. No other worktree is accessed.
- Furniture and props are nominally ×1.4. Desks use exactly y=1.04; seats use exactly y=0.7. X/Z fitting shrinks only as needed for the frozen collision grid or the piece’s own supporting desk. Height stays unchanged by instance fitting. Fit details and dropped objects are in reports/part-g-fit.json.
- Perimeter height 4.2; frosted room height 3.6. Entrance opening is about 2.93; manager door leaves are 3.0 with a frosted header up to 3.6. The original door ids, hinge nodes, closed defaults and clips remain.
- Floor tiles, rugs, mats and sunlight keep their Part F sizes. Wall decor is frames/clock/shelf only: 20 placements, at least six tiles apart, with no consecutive repeats. Deep decor starts at y=2.3.
- Existing map padding is allowed empty. Shared spines are clean low cabinets/planter strips, with far fewer larger plants. Stations have at most three side items. The unpictured water dispenser, sticky notes, pen cups, spare signs and wall clutter are removed.

## Three-set validation

| Set | Scene triangles / 500,000 | Seats | Wall decor | Empty padding tiles |
|---|---:|---:|---:|---:|
| baseline | 196277 | 20/20 | 20 | 122 |
| kaykit | 189515 | 20/20 | 20 | 122 |
| kenney | 158439 | 20/20 | 20 | 122 |

```text
PASS baseline: 138 GLBs, all triangle budgets, embedded shared palette, axes/origin; 20/20 seat chairs at 0.7; 20 desktops at 1.04; monitors 1.4–1.9 tiles on own axes; <=3 desk items; 20 sparse nonrepeating wall decorations; 196277/500000 scene triangles.
PASS kaykit: 138 GLBs, all triangle budgets, embedded shared palette, axes/origin; 20/20 seat chairs at 0.7; 20 desktops at 1.04; monitors 1.4–1.9 tiles on own axes; <=3 desk items; 20 sparse nonrepeating wall decorations; 189515/500000 scene triangles.
PASS kenney: 138 GLBs, all triangle budgets, embedded shared palette, axes/origin; 20/20 seat chairs at 0.7; 20 desktops at 1.04; monitors 1.4–1.9 tiles on own axes; <=3 desk items; 20 sparse nonrepeating wall decorations; 158439/500000 scene triangles.
PASS negative checks: moved chairs, distant/off-axis/reversed monitors, excess clutter, wrong desk support, walkable obstacles and low wall decor are rejected.
PASS characters: read-only contract checks only — 16 ids, node tree, 8 clip names, standing height 1.95–2.2 and width <=1.3.
PASS rooms: perimeter 4.2, frosted room 3.6, original wall/window footprints, unchanged flat floor/rug/mat/sun-patch sizes.
PASS frozen shared map: background.png, foreground.png, collision.png, collision@16x.png and seats.json byte-identical to finished Part F.
PASS models3d.json synchronized; both variants share own characters/kit, have identical placements, and carry confirmed bundled CC0 licenses.
```

## Removals / counts per model (finished F → G)

| Model | Before | After |
|---|---:|---:|
| framed-poster | 4 | 0 |
| calendar | 5 | 0 |
| corkboard | 6 | 0 |
| wall-shelf | 4 | 7 |
| air-conditioner | 2 | 0 |
| picture-frame | 5 | 7 |
| company-sign | 2 | 0 |
| wall-whiteboard | 1 | 0 |
| wall-tv | 1 | 0 |
| hanging-planter | 10 | 0 |
| water-dispenser | 1 | 0 |
| book-stack | 11 | 3 |
| keyboard | 19 | 18 |
| cable-tray | 18 | 0 |
| desk-cactus | 46 | 34 |
| pen-cup | 18 | 0 |
| keyboard-compact | 1 | 2 |
| document-tray | 3 | 0 |

## Station fitting

| Station | Monitor distance | Side items | Desk scale X/Y/Z (after baked ×1.4) |
|---|---:|---:|---|
| D1 | 1.65 | 3 | 1.000 / 1.000 / 1.000 |
| D2 | 1.65 | 3 | 1.000 / 1.000 / 1.000 |
| D3 | 1.65 | 3 | 1.000 / 1.000 / 1.000 |
| D4 | 1.65 | 3 | 1.000 / 1.000 / 1.000 |
| D5 | 1.65 | 3 | 1.000 / 1.000 / 1.000 |
| D6 | 1.65 | 3 | 1.000 / 1.000 / 1.000 |
| D7 | 1.65 | 3 | 1.000 / 1.000 / 1.000 |
| D8 | 1.65 | 3 | 1.000 / 1.000 / 1.000 |
| D9 | 1.65 | 3 | 1.000 / 1.000 / 0.888 |
| D10 | 1.65 | 3 | 1.000 / 1.000 / 0.888 |
| D11 | 1.65 | 3 | 1.000 / 1.000 / 0.888 |
| D12 | 1.65 | 3 | 1.000 / 1.000 / 0.888 |
| D13 | 1.65 | 3 | 1.000 / 1.000 / 0.888 |
| D14 | 1.65 | 3 | 1.000 / 1.000 / 0.888 |
| D15 | 1.65 | 3 | 1.000 / 1.000 / 0.888 |
| D16 | 1.65 | 3 | 1.000 / 1.000 / 0.888 |
| M1 | 1.65 | 3 | 1.000 / 1.000 / 1.000 |
| M2 | 1.65 | 3 | 1.000 / 1.000 / 1.000 |
| MGR | 1.65 | 1 | 0.776 / 1.000 / 1.000 |
| HR | 1.4 | 2 | 1.000 / 1.000 / 0.793 |

MGR retains its one-tile-wide compact approach. HR’s reception top is left-biased so its right-end entry stays open; its monitor is at the minimum 1.4 distance with only depth compressed. Bottom-bank desk depth is slightly reduced so a thin shared spine fits between facing desktops. Every actual fitted bound is validated, including pack variants.

## kaykit: license and coverage

The owner supplied the ZIP downloaded from the [official kaykit page](https://kaylousberg.itch.io/furniture-bits). The bundled LICENSE explicitly says **Creative Commons Zero, CC0**. Its exact text is preserved at vendor/kaykit/LICENSE. Raw downloads/extraction stay in ignored vendor-src/kaykit/. Only sources actually converted, their required bin/texture dependencies, and LICENSE are kept in vendor/kaykit/.

33 converted ids; 74 own-model fallback ids (including unused reusable library ids). Coverage is explicit rather than pretending the pack has models it does not contain.

| Our id | Pack source | Triangles |
|---|---|---:|
| desk | table_medium_long | 168 |
| desk-plant | cactus_small_A | 252 |
| workstation-desk | table_medium | 168 |
| workstation-desk-compact | table_medium | 168 |
| spine-left | cabinet_medium | 428 |
| spine-middle | cabinet_medium | 428 |
| spine-bench | cabinet_medium | 428 |
| meeting-table | table_medium_long | 168 |
| meeting-chair-mint | chair_A | 308 |
| meeting-chair-lavender | chair_A | 308 |
| desk-long | table_medium_long | 168 |
| stool | chair_stool | 216 |
| reception-desk | table_medium_long | 168 |
| cabinet | cabinet_small | 322 |
| counter | cabinet_medium | 428 |
| shelf | shelf_A_small | 212 |
| sofa | couch | 636 |
| armchair | armchair | 528 |
| coffee-table | table_low | 276 |
| floor-lamp | lamp_standing | 320 |
| bookshelf | shelf_A_big | 212 |
| plant-large | cactus_medium_B | 448 |
| plant-small | cactus_medium_A | 448 |
| notebook | book_single | 68 |
| book-stack | book_set | 196 |
| desk-cactus | cactus_small_B | 252 |
| filing-cabinet | cabinet_medium | 428 |
| floor-palm | cactus_medium_B | 448 |
| counter-wide | cabinet_medium | 428 |
| counter-compact | cabinet_small | 322 |
| guest-chair | chair_B | 384 |
| lounge-table | table_low | 276 |
| wall-shelf | shelf_B_large | 212 |

Fallbacks:

- `monitor-dual`: Not covered by this pack; own ×1.4 model retained.
- `monitor-arm`: Not covered by this pack; own ×1.4 model retained.
- `keyboard`: Not covered by this pack; own ×1.4 model retained.
- `office-chair`: Not covered by this pack; own ×1.4 model retained.
- `pc-tower`: Not covered by this pack; own ×1.4 model retained.
- `mug`: Not covered by this pack; own ×1.4 model retained.
- `monitor-compact`: Not covered by this pack; own ×1.4 model retained.
- `keyboard-compact`: Not covered by this pack; own ×1.4 model retained.
- `mouse-compact`: Not covered by this pack; own ×1.4 model retained.
- `office-chair-lavender`: Not covered by this pack; own ×1.4 model retained.
- `rug-meeting-corner`: Not covered by this pack; own ×1.4 model retained.
- `cable-tray`: Not covered by this pack; own ×1.4 model retained.
- `monitor-single`: Not covered by this pack; own ×1.4 model retained.
- `mouse`: Not covered by this pack; own ×1.4 model retained.
- `monitor-riser`: Not covered by this pack; own ×1.4 model retained.
- `desk-shelf`: Not covered by this pack; own ×1.4 model retained.
- `power-strip`: Not covered by this pack; own ×1.4 model retained.
- `gaming-chair`: Not covered by this pack; own ×1.4 model retained.
- `photo-frame`: Not covered by this pack; own ×1.4 model retained.
- `water-bottle`: Not covered by this pack; own ×1.4 model retained.
- `figurine`: Not covered by this pack; own ×1.4 model retained.
- `door-mat`: Not covered by this pack; own ×1.4 model retained.
- `fridge`: Not covered by this pack; own ×1.4 model retained.
- `sink`: Not covered by this pack; own ×1.4 model retained.
- `coffee-machine`: Not covered by this pack; own ×1.4 model retained.
- `jar`: Not covered by this pack; own ×1.4 model retained.
- `round-table`: Not covered by this pack; own ×1.4 model retained.
- `bench`: Not covered by this pack; own ×1.4 model retained.
- `whiteboard`: Not covered by this pack; own ×1.4 model retained.
- `printer`: Not covered by this pack; own ×1.4 model retained.
- `rug-lavender`: Not covered by this pack; own ×1.4 model retained.
- `rug-mint`: Not covered by this pack; own ×1.4 model retained.
- `folding-table`: Not covered by this pack; own ×1.4 model retained.
- `folding-chair`: Not covered by this pack; own ×1.4 model retained.
- `card-mat`: Not covered by this pack; own ×1.4 model retained.
- `ludo-mat`: Not covered by this pack; own ×1.4 model retained.
- `document-tray`: Not covered by this pack; own ×1.4 model retained.
- `pen-cup`: Not covered by this pack; own ×1.4 model retained.
- `headphones`: Not covered by this pack; own ×1.4 model retained.
- `desk-lamp`: Source 392 triangles exceeds 300; own model retained.
- `phone-stand`: Not covered by this pack; own ×1.4 model retained.
- `sticky-notes`: Not covered by this pack; own ×1.4 model retained.
- `snack-box`: Not covered by this pack; own ×1.4 model retained.
- `tissue-box`: Not covered by this pack; own ×1.4 model retained.
- `microwave`: Not covered by this pack; own ×1.4 model retained.
- `kettle`: Not covered by this pack; own ×1.4 model retained.
- `toaster`: Not covered by this pack; own ×1.4 model retained.
- `fruit-bowl`: Not covered by this pack; own ×1.4 model retained.
- `cup-rack`: Not covered by this pack; own ×1.4 model retained.
- `paper-towels`: Not covered by this pack; own ×1.4 model retained.
- `storage-cube`: Not covered by this pack; own ×1.4 model retained.
- `archive-boxes`: Not covered by this pack; own ×1.4 model retained.
- `recycle-bin`: Not covered by this pack; own ×1.4 model retained.
- `water-dispenser`: Not covered by this pack; own ×1.4 model retained.
- `coat-rack`: Not covered by this pack; own ×1.4 model retained.
- `shoe-rack`: Not covered by this pack; own ×1.4 model retained.
- `bean-bag`: Not covered by this pack; own ×1.4 model retained.
- `printer-stand`: Not covered by this pack; own ×1.4 model retained.
- `desk-apron`: Not covered by this pack; own ×1.4 model retained.
- `desk-wing`: Not covered by this pack; own ×1.4 model retained.
- `desk-return`: Not covered by this pack; own ×1.4 model retained.
- `wall-clock`: Not covered by this pack; own ×1.4 model retained.
- `corkboard`: Not covered by this pack; own ×1.4 model retained.
- `framed-poster`: Not covered by this pack; own ×1.4 model retained.
- `wall-tv`: Not covered by this pack; own ×1.4 model retained.
- `hanging-planter`: Not covered by this pack; own ×1.4 model retained.
- `company-sign`: Not covered by this pack; own ×1.4 model retained.
- `calendar`: Not covered by this pack; own ×1.4 model retained.
- `wall-whiteboard`: Not covered by this pack; own ×1.4 model retained.
- `sun-patch`: Not covered by this pack; own ×1.4 model retained.
- `sun-patch-edge`: Not covered by this pack; own ×1.4 model retained.
- `cable-cover`: Not covered by this pack; own ×1.4 model retained.
- `rug-meeting`: Not covered by this pack; own ×1.4 model retained.
- `floor-sticker`: Not covered by this pack; own ×1.4 model retained.

## kenney: license and coverage

The owner supplied the ZIP downloaded from the [official kenney page](https://kenney.nl/assets/furniture-kit). The bundled LICENSE explicitly says **Creative Commons Zero, CC0**. Its exact text is preserved at vendor/kenney/LICENSE. Raw downloads/extraction stay in ignored vendor-src/kenney/. Only sources actually converted, their required bin/texture dependencies, and LICENSE are kept in vendor/kenney/.

47 converted ids; 60 own-model fallback ids (including unused reusable library ids). Coverage is explicit rather than pretending the pack has models it does not contain.

| Our id | Pack source | Triangles |
|---|---|---:|
| desk | desk | 198 |
| monitor-dual | computerScreen | 144 |
| keyboard | computerKeyboard | 32 |
| office-chair | chairDesk | 588 |
| desk-plant | plantSmall1 | 102 |
| workstation-desk | desk | 198 |
| workstation-desk-compact | desk | 198 |
| monitor-compact | computerScreen | 72 |
| keyboard-compact | computerKeyboard | 32 |
| mouse-compact | computerMouse | 71 |
| spine-left | cabinetTelevisionDoors | 210 |
| spine-middle | cabinetTelevisionDoors | 210 |
| spine-bench | cabinetTelevisionDoors | 210 |
| meeting-table | table | 120 |
| meeting-chair-mint | chairCushion | 198 |
| meeting-chair-lavender | chairCushion | 198 |
| office-chair-lavender | chairDesk | 588 |
| desk-long | desk | 198 |
| monitor-single | computerScreen | 72 |
| mouse | computerMouse | 71 |
| stool | stoolBar | 176 |
| reception-desk | desk | 198 |
| cabinet | cabinetBed | 72 |
| fridge | kitchenFridge | 250 |
| counter | kitchenCabinet | 114 |
| coffee-machine | kitchenCoffeeMachine | 166 |
| round-table | tableRound | 80 |
| shelf | bookcaseOpen | 320 |
| sofa | loungeSofa | 128 |
| armchair | loungeChair | 128 |
| coffee-table | tableCoffee | 124 |
| floor-lamp | lampRoundFloor | 76 |
| bookshelf | bookcaseOpen | 320 |
| plant-large | pottedPlant | 60 |
| plant-small | plantSmall2 | 158 |
| book-stack | books | 62 |
| desk-lamp | lampRoundTable | 76 |
| desk-cactus | plantSmall3 | 98 |
| microwave | kitchenMicrowave | 152 |
| toaster | toaster | 220 |
| filing-cabinet | cabinetBedDrawer | 182 |
| floor-palm | pottedPlant | 60 |
| counter-wide | kitchenCabinet | 114 |
| counter-compact | kitchenCabinetDrawer | 174 |
| guest-chair | chairModernCushion | 92 |
| lounge-table | tableCoffee | 124 |
| wall-shelf | bookcaseOpenLow | 184 |

Fallbacks:

- `monitor-arm`: Not covered by this pack; own ×1.4 model retained.
- `pc-tower`: Not covered by this pack; own ×1.4 model retained.
- `mug`: Not covered by this pack; own ×1.4 model retained.
- `rug-meeting-corner`: Not covered by this pack; own ×1.4 model retained.
- `cable-tray`: Not covered by this pack; own ×1.4 model retained.
- `monitor-riser`: Not covered by this pack; own ×1.4 model retained.
- `desk-shelf`: Not covered by this pack; own ×1.4 model retained.
- `power-strip`: Not covered by this pack; own ×1.4 model retained.
- `gaming-chair`: Not covered by this pack; own ×1.4 model retained.
- `photo-frame`: Not covered by this pack; own ×1.4 model retained.
- `water-bottle`: Not covered by this pack; own ×1.4 model retained.
- `figurine`: Not covered by this pack; own ×1.4 model retained.
- `door-mat`: Not covered by this pack; own ×1.4 model retained.
- `sink`: Not covered by this pack; own ×1.4 model retained.
- `jar`: Not covered by this pack; own ×1.4 model retained.
- `bench`: Not covered by this pack; own ×1.4 model retained.
- `whiteboard`: Not covered by this pack; own ×1.4 model retained.
- `printer`: Not covered by this pack; own ×1.4 model retained.
- `rug-lavender`: Not covered by this pack; own ×1.4 model retained.
- `rug-mint`: Not covered by this pack; own ×1.4 model retained.
- `folding-table`: Not covered by this pack; own ×1.4 model retained.
- `folding-chair`: Not covered by this pack; own ×1.4 model retained.
- `card-mat`: Not covered by this pack; own ×1.4 model retained.
- `ludo-mat`: Not covered by this pack; own ×1.4 model retained.
- `document-tray`: Not covered by this pack; own ×1.4 model retained.
- `notebook`: Not covered by this pack; own ×1.4 model retained.
- `pen-cup`: Not covered by this pack; own ×1.4 model retained.
- `headphones`: Not covered by this pack; own ×1.4 model retained.
- `phone-stand`: Not covered by this pack; own ×1.4 model retained.
- `sticky-notes`: Not covered by this pack; own ×1.4 model retained.
- `snack-box`: Not covered by this pack; own ×1.4 model retained.
- `tissue-box`: Not covered by this pack; own ×1.4 model retained.
- `kettle`: Not covered by this pack; own ×1.4 model retained.
- `fruit-bowl`: Not covered by this pack; own ×1.4 model retained.
- `cup-rack`: Not covered by this pack; own ×1.4 model retained.
- `paper-towels`: Not covered by this pack; own ×1.4 model retained.
- `storage-cube`: Not covered by this pack; own ×1.4 model retained.
- `archive-boxes`: Not covered by this pack; own ×1.4 model retained.
- `recycle-bin`: Not covered by this pack; own ×1.4 model retained.
- `water-dispenser`: Not covered by this pack; own ×1.4 model retained.
- `coat-rack`: Not covered by this pack; own ×1.4 model retained.
- `shoe-rack`: Not covered by this pack; own ×1.4 model retained.
- `bean-bag`: Not covered by this pack; own ×1.4 model retained.
- `printer-stand`: Not covered by this pack; own ×1.4 model retained.
- `desk-apron`: Not covered by this pack; own ×1.4 model retained.
- `desk-wing`: Not covered by this pack; own ×1.4 model retained.
- `desk-return`: Not covered by this pack; own ×1.4 model retained.
- `wall-clock`: Not covered by this pack; own ×1.4 model retained.
- `corkboard`: Not covered by this pack; own ×1.4 model retained.
- `framed-poster`: Not covered by this pack; own ×1.4 model retained.
- `wall-tv`: Not covered by this pack; own ×1.4 model retained.
- `hanging-planter`: Not covered by this pack; own ×1.4 model retained.
- `company-sign`: Not covered by this pack; own ×1.4 model retained.
- `calendar`: Not covered by this pack; own ×1.4 model retained.
- `wall-whiteboard`: Not covered by this pack; own ×1.4 model retained.
- `sun-patch`: Not covered by this pack; own ×1.4 model retained.
- `sun-patch-edge`: Not covered by this pack; own ×1.4 model retained.
- `cable-cover`: Not covered by this pack; own ×1.4 model retained.
- `rug-meeting`: Not covered by this pack; own ×1.4 model retained.
- `floor-sticker`: Not covered by this pack; own ×1.4 model retained.

## Conversion contract and limits

The Bun / gltf-transform converter flattens source transforms, normalizes Y-up / +Z front / floor-footprint origin, maps original material or atlas colours to the shared pastel cells, embeds only the shared palette, and enforces 300/1500-triangle budgets. Kenney dual displays compose two native computerScreen models. Chair seat surfaces are remapped to 0.7. All variants match baseline bounds and placements, so character/kit/floor/door/glass references stay at office/3d/. Unsupported or over-budget ids use our own models. Native vendor silhouettes/edges are retained for a fair pack comparison; no bevel retopology or source textures are shipped in the GLBs.

Each output has its own models3d.json (raw object, not a wrapper). Baseline is kept exactly synchronized with manifest-models3d.json.models3d. Variant props point at office/3d-variants/<pack>/props/, including own-model fallback copies; characters and kit point at office/3d/. Optional placement scale is explicit in the layout and must be applied by consumers. No app integration was changed.

## Review files

- previews/compare-3way.png — same full-office view side by side
- previews/compare-left-bank-closeup-3way.png
- previews/compare-pantry-closeup-3way.png
- previews/part-g/{baseline,kaykit,kenney}/{full-office-000,left-bank-closeup,bottom-bench-closeup,pantry-closeup,manager-room-closeup}.png
- previews/index.html — curated comparison gallery

Run `bun run build`, `bun run validate`, `bun run preview` inside this package. Build never runs the shared-map exporter and never writes character files. Validation checks all five map files against the finished-F hash snapshot. FILES.md is the inventory.

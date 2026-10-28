# Office 3D — Part D

**SHARED-MAP CHANGE (D12 + HR):** the manager room now extends to the south wall, and HR is seat 20. These are the only authorized collision edits in this delivery. The first 19 seat records, MGR, the original manager doorway and every other collision cell are unchanged.

## Exact shared collision changes

| Tile | Before | After | Reason |
|---|---|---|---|
| (13,4) | blocked | HR seat (red) | new HR seat |
| (14,4) | blocked | walkable | HR entry gap |
| (14,5) | blocked | walkable | HR entry gap |
| (41,28) | blocked | walkable | remove old manager south partition |
| (42,28) | blocked | walkable | remove old manager south partition |
| (43,28) | blocked | walkable | remove old manager south partition |
| (44,28) | blocked | walkable | remove old manager south partition |
| (45,28) | blocked | walkable | remove old manager south partition |
| (46,28) | blocked | walkable | remove old manager south partition |
| (47,28) | blocked | walkable | remove old manager south partition |
| (48,28) | blocked | walkable | remove old manager south partition |
| (49,28) | blocked | walkable | remove old manager south partition |
| (50,28) | blocked | walkable | remove old manager south partition |
| (51,28) | blocked | walkable | remove old manager south partition |
| (52,28) | blocked | walkable | remove old manager south partition |
| (53,28) | blocked | walkable | remove old manager south partition |
| (40,29) | walkable | blocked | extend manager west partition |
| (48,29) | walkable | blocked | new lounge-table footprint |
| (49,29) | walkable | blocked | new lounge-table footprint |
| (50,29) | walkable | blocked | new lounge-table footprint |
| (40,30) | walkable | blocked | extend manager west partition |
| (48,30) | walkable | blocked | new lounge-table footprint |
| (49,30) | walkable | blocked | new lounge-table footprint |
| (50,30) | walkable | blocked | new lounge-table footprint |
| (40,31) | walkable | blocked | extend manager west partition |
| (48,31) | walkable | blocked | new sofa footprint |
| (49,31) | walkable | blocked | new sofa footprint |
| (50,31) | walkable | blocked | new sofa footprint |
| (40,32) | walkable | blocked | extend manager west partition |
| (48,32) | walkable | blocked | new sofa footprint |
| (49,32) | walkable | blocked | new sofa footprint |
| (50,32) | walkable | blocked | new sofa footprint |
| (52,32) | walkable | blocked | new floor-palm footprint |
| (40,33) | walkable | blocked | extend manager west partition |

The 2D edit preserves all pixels outside the manager-extension and HR-end edit regions. The HR chair, left plant and window/frame stay pixel-identical. The monitor remains in its original position; the relocated full-size desktop props naturally occlude its lower/right edges. Original 32-color palette and binary foreground alpha are retained. `collision@16x.png` is the original nearest-neighbour / 50% blend recipe. Reproduction through `python3 design/office-style/C/map/export-map.py` is byte-identical and leaves the shared manifest untouched (reports/part-d-export-repro.json).

## Part D plate corrections

The lower manager room now reuses the original textured peach floor, a mint lounge rug with a rounded two-pixel border, and the original sofa, table and palm sprites at 1:1 pixel scale. The removed partition has no floor seam. HR’s original-size plant and mug are on the remaining desktop; the undersized under-desk props and detached pixels were removed. The right desk edge closes at x=14. Collision and seats are unchanged by this plate-only correction. The two before/after triptychs and all four office rotations plus the top-down overlay were regenerated through the existing exporter/preview pipeline.

## Part D counts

| Measure | Result |
|---|---:|
| New models | 53 |
| All registered models | 125 |
| Uncovered blocked tiles before | 169 |
| Uncovered blocked tiles after | 0 |
| Allowed empty margins | 0 |
| Wall-mounted decorations | 63 |
| Longest bare wall run | 3.24 tiles |
| New density furniture placements | 99 |
| Static layout triangles | 208163 |
| Preview character triangles (20 occupants) | 37992 |
| Whole scene triangles / 500,000 | 246155 |
| Collision tiles changed | 34 |

The floor-tile is **12 triangles**, top exactly y=0, grain/seams inside its palette cell. Perimeter pieces are 3.3 high; manager frosted partitions are 2.8. North is solid; west is clear glazing with rolled blinds and 10 slanted sunlight patches. Frosted glass is alpha 0.8 with a clear 0.3 strip. Both doors have closed default hinge poses, open/close clips lasting 0.6s and swinging 85° inward.

## New models and triangles

| Model | Triangles |
|---|---:|
| document-tray.glb | 240 |
| notebook.glb | 144 |
| book-stack.glb | 144 |
| pen-cup.glb | 204 |
| headphones.glb | 192 |
| desk-lamp.glb | 136 |
| phone-stand.glb | 98 |
| sticky-notes.glb | 96 |
| snack-box.glb | 204 |
| desk-cactus.glb | 220 |
| tissue-box.glb | 204 |
| microwave.glb | 252 |
| kettle.glb | 200 |
| toaster.glb | 224 |
| fruit-bowl.glb | 140 |
| cup-rack.glb | 276 |
| paper-towels.glb | 108 |
| filing-cabinet.glb | 396 |
| storage-cube.glb | 300 |
| archive-boxes.glb | 468 |
| recycle-bin.glb | 204 |
| water-dispenser.glb | 312 |
| coat-rack.glb | 312 |
| shoe-rack.glb | 416 |
| bean-bag.glb | 128 |
| floor-palm.glb | 428 |
| printer-stand.glb | 600 |
| counter-wide.glb | 312 |
| counter-compact.glb | 312 |
| desk-apron.glb | 300 |
| desk-wing.glb | 300 |
| desk-return.glb | 300 |
| guest-chair.glb | 408 |
| lounge-table.glb | 456 |
| wall-clock.glb | 216 |
| wall-shelf.glb | 400 |
| corkboard.glb | 336 |
| framed-poster.glb | 192 |
| wall-tv.glb | 192 |
| hanging-planter.glb | 336 |
| company-sign.glb | 504 |
| calendar.glb | 192 |
| wall-whiteboard.glb | 192 |
| sun-patch.glb | 2 |
| sun-patch-edge.glb | 3 |
| cable-cover.glb | 12 |
| rug-meeting.glb | 12 |
| floor-sticker.glb | 8 |
| window-wall.glb | 458 |
| wall-half.glb | 108 |
| door-glass-double.glb | 496 |
| door-glass.glb | 104 |
| floor-manager.glb | 12 |

All models use the shared embedded pastel palette; small items remain <=300 and furniture <=1500 triangles. `previews/tri-counts.json` lists every old and new model.

## Desk items per station

| Station | Count | Items |
|---|---:|---|
| D1 | 5 | tissue-box, figurine, book-stack, desk-lamp, desk-cactus |
| D2 | 6 | figurine, book-stack, desk-lamp, desk-cactus, mug, notebook |
| D3 | 4 | book-stack, desk-lamp, desk-cactus, mug |
| D4 | 5 | desk-lamp, desk-cactus, mug, notebook, headphones |
| D5 | 6 | desk-cactus, mug, notebook, headphones, snack-box, water-bottle |
| D6 | 4 | mug, notebook, headphones, snack-box |
| D7 | 5 | notebook, headphones, snack-box, water-bottle, desk-plant |
| D8 | 6 | headphones, snack-box, water-bottle, desk-plant, pen-cup, phone-stand |
| D9 | 4 | snack-box, water-bottle, desk-plant, pen-cup |
| D10 | 4 | phone-stand, tissue-box, figurine, book-stack |
| D11 | 5 | tissue-box, figurine, book-stack, desk-lamp, desk-cactus |
| D12 | 6 | figurine, book-stack, desk-lamp, desk-cactus, mug, notebook |
| D13 | 4 | book-stack, desk-lamp, desk-cactus, mug |
| D14 | 5 | desk-lamp, desk-cactus, mug, notebook, headphones |
| D15 | 6 | desk-cactus, mug, notebook, headphones, snack-box, water-bottle |
| D16 | 4 | mug, notebook, headphones, snack-box |
| M1 | 5 | desk-plant, pen-cup, phone-stand, tissue-box, figurine |
| M2 | 6 | pen-cup, phone-stand, tissue-box, figurine, book-stack, desk-lamp |
| MGR | 5 | pen-cup, phone-stand, tissue-box, figurine, book-stack |
| HR | 3 | mug, desk-plant, document-tray |

The 19 ordinary stations use y=0.74; HR retains its taller reception top at y=0.88 with the requested three items. Every keyboard +/-0.35 reach zone is clear. Pantry counters carry a microwave, kettle, toaster, fruit bowl, cup rack and paper towels.

## Files changed

- `dashboard/public/office/3d/characters/alien.glb`
- `dashboard/public/office/3d/characters/berserker.glb`
- `dashboard/public/office/3d/characters/cat.glb`
- `dashboard/public/office/3d/characters/designer.glb`
- `dashboard/public/office/3d/characters/dev-hoodie.glb`
- `dashboard/public/office/3d/characters/dragon.glb`
- `dashboard/public/office/3d/characters/healer.glb`
- `dashboard/public/office/3d/characters/knight.glb`
- `dashboard/public/office/3d/characters/lead.glb`
- `dashboard/public/office/3d/characters/mage.glb`
- `dashboard/public/office/3d/characters/penguin.glb`
- `dashboard/public/office/3d/characters/ranger.glb`
- `dashboard/public/office/3d/characters/robot.glb`
- `dashboard/public/office/3d/characters/rogue.glb`
- `dashboard/public/office/3d/characters/shiba.glb`
- `dashboard/public/office/3d/characters/slime.glb`
- `dashboard/public/office/3d/kit/air-conditioner.glb`
- `dashboard/public/office/3d/kit/door-glass-double.glb`
- `dashboard/public/office/3d/kit/door-glass.glb`
- `dashboard/public/office/3d/kit/floor-manager.glb`
- `dashboard/public/office/3d/kit/floor-tile.glb`
- `dashboard/public/office/3d/kit/glass-post.glb`
- `dashboard/public/office/3d/kit/glass-wall.glb`
- `dashboard/public/office/3d/kit/picture-frame.glb`
- `dashboard/public/office/3d/kit/wall-blind.glb`
- `dashboard/public/office/3d/kit/wall-column.glb`
- `dashboard/public/office/3d/kit/wall-corner.glb`
- `dashboard/public/office/3d/kit/wall-door.glb`
- `dashboard/public/office/3d/kit/wall-half.glb`
- `dashboard/public/office/3d/kit/wall-straight.glb`
- `dashboard/public/office/3d/kit/window-wall.glb`
- `dashboard/public/office/3d/layout3d.json`
- `dashboard/public/office/3d/palette-office.png`
- `dashboard/public/office/3d/palette.png`
- `dashboard/public/office/3d/props/archive-boxes.glb`
- `dashboard/public/office/3d/props/armchair.glb`
- `dashboard/public/office/3d/props/bean-bag.glb`
- `dashboard/public/office/3d/props/bench.glb`
- `dashboard/public/office/3d/props/book-stack.glb`
- `dashboard/public/office/3d/props/bookshelf.glb`
- `dashboard/public/office/3d/props/cabinet.glb`
- `dashboard/public/office/3d/props/cable-cover.glb`
- `dashboard/public/office/3d/props/cable-tray.glb`
- `dashboard/public/office/3d/props/calendar.glb`
- `dashboard/public/office/3d/props/card-mat.glb`
- `dashboard/public/office/3d/props/coat-rack.glb`
- `dashboard/public/office/3d/props/coffee-machine.glb`
- `dashboard/public/office/3d/props/coffee-table.glb`
- `dashboard/public/office/3d/props/company-sign.glb`
- `dashboard/public/office/3d/props/corkboard.glb`
- `dashboard/public/office/3d/props/counter-compact.glb`
- `dashboard/public/office/3d/props/counter-wide.glb`
- `dashboard/public/office/3d/props/counter.glb`
- `dashboard/public/office/3d/props/cup-rack.glb`
- `dashboard/public/office/3d/props/desk-apron.glb`
- `dashboard/public/office/3d/props/desk-cactus.glb`
- `dashboard/public/office/3d/props/desk-lamp.glb`
- `dashboard/public/office/3d/props/desk-long.glb`
- `dashboard/public/office/3d/props/desk-plant.glb`
- `dashboard/public/office/3d/props/desk-return.glb`
- `dashboard/public/office/3d/props/desk-shelf.glb`
- `dashboard/public/office/3d/props/desk-wing.glb`
- `dashboard/public/office/3d/props/desk.glb`
- `dashboard/public/office/3d/props/document-tray.glb`
- `dashboard/public/office/3d/props/door-mat.glb`
- `dashboard/public/office/3d/props/figurine.glb`
- `dashboard/public/office/3d/props/filing-cabinet.glb`
- `dashboard/public/office/3d/props/floor-lamp.glb`
- `dashboard/public/office/3d/props/floor-palm.glb`
- `dashboard/public/office/3d/props/floor-sticker.glb`
- `dashboard/public/office/3d/props/folding-chair.glb`
- `dashboard/public/office/3d/props/folding-table.glb`
- `dashboard/public/office/3d/props/framed-poster.glb`
- `dashboard/public/office/3d/props/fridge.glb`
- `dashboard/public/office/3d/props/fruit-bowl.glb`
- `dashboard/public/office/3d/props/gaming-chair.glb`
- `dashboard/public/office/3d/props/guest-chair.glb`
- `dashboard/public/office/3d/props/hanging-planter.glb`
- `dashboard/public/office/3d/props/headphones.glb`
- `dashboard/public/office/3d/props/jar.glb`
- `dashboard/public/office/3d/props/kettle.glb`
- `dashboard/public/office/3d/props/keyboard.glb`
- `dashboard/public/office/3d/props/lounge-table.glb`
- `dashboard/public/office/3d/props/ludo-mat.glb`
- `dashboard/public/office/3d/props/microwave.glb`
- `dashboard/public/office/3d/props/monitor-arm.glb`
- `dashboard/public/office/3d/props/monitor-dual.glb`
- `dashboard/public/office/3d/props/monitor-riser.glb`
- `dashboard/public/office/3d/props/monitor-single.glb`
- `dashboard/public/office/3d/props/mouse.glb`
- `dashboard/public/office/3d/props/mug.glb`
- `dashboard/public/office/3d/props/notebook.glb`
- `dashboard/public/office/3d/props/office-chair.glb`
- `dashboard/public/office/3d/props/paper-towels.glb`
- `dashboard/public/office/3d/props/pc-tower.glb`
- `dashboard/public/office/3d/props/pen-cup.glb`
- `dashboard/public/office/3d/props/phone-stand.glb`
- `dashboard/public/office/3d/props/photo-frame.glb`
- `dashboard/public/office/3d/props/plant-large.glb`
- `dashboard/public/office/3d/props/plant-small.glb`
- `dashboard/public/office/3d/props/power-strip.glb`
- `dashboard/public/office/3d/props/printer-stand.glb`
- `dashboard/public/office/3d/props/printer.glb`
- `dashboard/public/office/3d/props/reception-desk.glb`
- `dashboard/public/office/3d/props/recycle-bin.glb`
- `dashboard/public/office/3d/props/round-table.glb`
- `dashboard/public/office/3d/props/rug-lavender.glb`
- `dashboard/public/office/3d/props/rug-meeting.glb`
- `dashboard/public/office/3d/props/rug-mint.glb`
- `dashboard/public/office/3d/props/shelf.glb`
- `dashboard/public/office/3d/props/shoe-rack.glb`
- `dashboard/public/office/3d/props/sink.glb`
- `dashboard/public/office/3d/props/snack-box.glb`
- `dashboard/public/office/3d/props/sofa.glb`
- `dashboard/public/office/3d/props/sticky-notes.glb`
- `dashboard/public/office/3d/props/stool.glb`
- `dashboard/public/office/3d/props/storage-cube.glb`
- `dashboard/public/office/3d/props/sun-patch-edge.glb`
- `dashboard/public/office/3d/props/sun-patch.glb`
- `dashboard/public/office/3d/props/tissue-box.glb`
- `dashboard/public/office/3d/props/toaster.glb`
- `dashboard/public/office/3d/props/wall-clock.glb`
- `dashboard/public/office/3d/props/wall-shelf.glb`
- `dashboard/public/office/3d/props/wall-tv.glb`
- `dashboard/public/office/3d/props/wall-whiteboard.glb`
- `dashboard/public/office/3d/props/water-bottle.glb`
- `dashboard/public/office/3d/props/water-dispenser.glb`
- `dashboard/public/office/3d/props/whiteboard.glb`
- `dashboard/public/office/map/background.png`
- `dashboard/public/office/map/collision.png`
- `dashboard/public/office/map/collision@16x.png`
- `dashboard/public/office/map/foreground.png`
- `dashboard/public/office/map/seats.json`
- `design/office-style/3d/FILES.md`
- `design/office-style/3d/README.md`
- `design/office-style/3d/REPORT.md`
- `design/office-style/3d/REQUESTS-3D.md`
- `design/office-style/3d/manifest-models3d.json`
- `design/office-style/3d/model-metadata.json`
- `design/office-style/3d/palette.json`
- `design/office-style/3d/previews/air-conditioner-turntable.png`
- `design/office-style/3d/previews/archive-boxes-turntable.png`
- `design/office-style/3d/previews/armchair-turntable.png`
- `design/office-style/3d/previews/bean-bag-turntable.png`
- `design/office-style/3d/previews/berserker-turntable.png`
- `design/office-style/3d/previews/book-stack-turntable.png`
- `design/office-style/3d/previews/bookshelf-turntable.png`
- `design/office-style/3d/previews/cabinet-turntable.png`
- `design/office-style/3d/previews/cable-cover-turntable.png`
- `design/office-style/3d/previews/calendar-turntable.png`
- `design/office-style/3d/previews/card-mat-turntable.png`
- `design/office-style/3d/previews/cat-turntable.png`
- `design/office-style/3d/previews/coat-rack-turntable.png`
- `design/office-style/3d/previews/coffee-machine-turntable.png`
- `design/office-style/3d/previews/company-sign-turntable.png`
- `design/office-style/3d/previews/corkboard-turntable.png`
- `design/office-style/3d/previews/counter-compact-turntable.png`
- `design/office-style/3d/previews/counter-wide-turntable.png`
- `design/office-style/3d/previews/cup-rack-turntable.png`
- `design/office-style/3d/previews/designer-turntable.png`
- `design/office-style/3d/previews/desk-apron-turntable.png`
- `design/office-style/3d/previews/desk-cactus-turntable.png`
- `design/office-style/3d/previews/desk-lamp-turntable.png`
- `design/office-style/3d/previews/desk-plant-turntable.png`
- `design/office-style/3d/previews/desk-return-turntable.png`
- `design/office-style/3d/previews/desk-wing-turntable.png`
- `design/office-style/3d/previews/dev-hoodie-turntable.png`
- `design/office-style/3d/previews/document-tray-turntable.png`
- `design/office-style/3d/previews/door-glass-double-turntable.png`
- `design/office-style/3d/previews/door-glass-turntable.png`
- `design/office-style/3d/previews/dragon-turntable.png`
- `design/office-style/3d/previews/entrance-door-closeup.png`
- `design/office-style/3d/previews/entrance-door-open.png`
- `design/office-style/3d/previews/filing-cabinet-turntable.png`
- `design/office-style/3d/previews/floor-manager-turntable.png`
- `design/office-style/3d/previews/floor-palm-turntable.png`
- `design/office-style/3d/previews/floor-sticker-turntable.png`
- `design/office-style/3d/previews/floor-tile-turntable.png`
- `design/office-style/3d/previews/framed-poster-turntable.png`
- `design/office-style/3d/previews/fruit-bowl-turntable.png`
- `design/office-style/3d/previews/full-office-000.png`
- `design/office-style/3d/previews/full-office-090.png`
- `design/office-style/3d/previews/full-office-180.png`
- `design/office-style/3d/previews/full-office-270.png`
- `design/office-style/3d/previews/gaming-chair-turntable.png`
- `design/office-style/3d/previews/glass-post-turntable.png`
- `design/office-style/3d/previews/glass-wall-turntable.png`
- `design/office-style/3d/previews/guest-chair-turntable.png`
- `design/office-style/3d/previews/hanging-planter-turntable.png`
- `design/office-style/3d/previews/headphones-turntable.png`
- `design/office-style/3d/previews/healer-turntable.png`
- `design/office-style/3d/previews/hr-before-after-diff.png`
- `design/office-style/3d/previews/hr-desk-closeup.png`
- `design/office-style/3d/previews/index.html`
- `design/office-style/3d/previews/kettle-turntable.png`
- `design/office-style/3d/previews/knight-turntable.png`
- `design/office-style/3d/previews/lead-sit-idle-strip.png`
- `design/office-style/3d/previews/lead-sit-strip.png`
- `design/office-style/3d/previews/lead-turntable.png`
- `design/office-style/3d/previews/lineup-16.png`
- `design/office-style/3d/previews/lounge-table-turntable.png`
- `design/office-style/3d/previews/ludo-mat-turntable.png`
- `design/office-style/3d/previews/mage-turntable.png`
- `design/office-style/3d/previews/manager-room-closeup.png`
- `design/office-style/3d/previews/map-before-after-diff.png`
- `design/office-style/3d/previews/microwave-turntable.png`
- `design/office-style/3d/previews/mug-turntable.png`
- `design/office-style/3d/previews/new-props-sheet.png`
- `design/office-style/3d/previews/notebook-turntable.png`
- `design/office-style/3d/previews/office-chair-turntable.png`
- `design/office-style/3d/previews/paper-towels-turntable.png`
- `design/office-style/3d/previews/pc-tower-turntable.png`
- `design/office-style/3d/previews/pen-cup-turntable.png`
- `design/office-style/3d/previews/phone-stand-turntable.png`
- `design/office-style/3d/previews/picture-frame-turntable.png`
- `design/office-style/3d/previews/plant-small-turntable.png`
- `design/office-style/3d/previews/printer-stand-turntable.png`
- `design/office-style/3d/previews/printer-turntable.png`
- `design/office-style/3d/previews/ranger-turntable.png`
- `design/office-style/3d/previews/reception-desk-turntable.png`
- `design/office-style/3d/previews/recycle-bin-turntable.png`
- `design/office-style/3d/previews/reference-prototype.png`
- `design/office-style/3d/previews/robot-away-strip.png`
- `design/office-style/3d/previews/rug-meeting-turntable.png`
- `design/office-style/3d/previews/scene-pastel.png`
- `design/office-style/3d/previews/shelf-turntable.png`
- `design/office-style/3d/previews/shiba-away-strip.png`
- `design/office-style/3d/previews/shiba-idle-strip.png`
- `design/office-style/3d/previews/shiba-sit-idle-strip.png`
- `design/office-style/3d/previews/shiba-sit-strip.png`
- `design/office-style/3d/previews/shiba-talk-strip.png`
- `design/office-style/3d/previews/shiba-turntable.png`
- `design/office-style/3d/previews/shiba-type-strip.png`
- `design/office-style/3d/previews/shiba-walk-strip.png`
- `design/office-style/3d/previews/shiba-wave-strip.png`
- `design/office-style/3d/previews/shoe-rack-turntable.png`
- `design/office-style/3d/previews/snack-box-turntable.png`
- `design/office-style/3d/previews/sticky-notes-turntable.png`
- `design/office-style/3d/previews/storage-cube-turntable.png`
- `design/office-style/3d/previews/sun-patch-edge-turntable.png`
- `design/office-style/3d/previews/sun-patch-turntable.png`
- `design/office-style/3d/previews/tissue-box-turntable.png`
- `design/office-style/3d/previews/toaster-turntable.png`
- `design/office-style/3d/previews/topdown-overlay.png`
- `design/office-style/3d/previews/topdown.png`
- `design/office-style/3d/previews/tri-counts.json`
- `design/office-style/3d/previews/validate.txt`
- `design/office-style/3d/previews/wall-blind-turntable.png`
- `design/office-style/3d/previews/wall-clock-turntable.png`
- `design/office-style/3d/previews/wall-column-turntable.png`
- `design/office-style/3d/previews/wall-corner-turntable.png`
- `design/office-style/3d/previews/wall-door-turntable.png`
- `design/office-style/3d/previews/wall-half-turntable.png`
- `design/office-style/3d/previews/wall-shelf-turntable.png`
- `design/office-style/3d/previews/wall-straight-turntable.png`
- `design/office-style/3d/previews/wall-tv-turntable.png`
- `design/office-style/3d/previews/wall-whiteboard-turntable.png`
- `design/office-style/3d/previews/water-dispenser-turntable.png`
- `design/office-style/3d/previews/whiteboard-turntable.png`
- `design/office-style/3d/previews/window-wall-turntable.png`
- `design/office-style/3d/src/build.ts`
- `design/office-style/3d/src/config.ts`
- `design/office-style/3d/src/d12-plan.ts`
- `design/office-style/3d/src/fix-plate.ts`
- `design/office-style/3d/src/kit/door-glass-double.ts`
- `design/office-style/3d/src/kit/door-glass.ts`
- `design/office-style/3d/src/kit/extended.ts`
- `design/office-style/3d/src/kit/floor-manager.ts`
- `design/office-style/3d/src/kit/floor-tile.ts`
- `design/office-style/3d/src/kit/part-d.ts`
- `design/office-style/3d/src/kit/wall-blind.ts`
- `design/office-style/3d/src/kit/wall-column.ts`
- `design/office-style/3d/src/kit/wall-corner.ts`
- `design/office-style/3d/src/kit/wall-half.ts`
- `design/office-style/3d/src/kit/wall-straight.ts`
- `design/office-style/3d/src/kit/window-wall.ts`
- `design/office-style/3d/src/layout.ts`
- `design/office-style/3d/src/map-before/background.png`
- `design/office-style/3d/src/map-before/collision.png`
- `design/office-style/3d/src/map-before/collision@16x.png`
- `design/office-style/3d/src/map-before/foreground.png`
- `design/office-style/3d/src/map-before/seats.json`
- `design/office-style/3d/src/map-d12.ts`
- `design/office-style/3d/src/map-export.ts`
- `design/office-style/3d/src/populate-d.ts`
- `design/office-style/3d/src/preview-plate.ts`
- `design/office-style/3d/src/preview.ts`
- `design/office-style/3d/src/primitives.ts`
- `design/office-style/3d/src/props/archive-boxes.ts`
- `design/office-style/3d/src/props/bean-bag.ts`
- `design/office-style/3d/src/props/book-stack.ts`
- `design/office-style/3d/src/props/cable-cover.ts`
- `design/office-style/3d/src/props/calendar.ts`
- `design/office-style/3d/src/props/coat-rack.ts`
- `design/office-style/3d/src/props/company-sign.ts`
- `design/office-style/3d/src/props/corkboard.ts`
- `design/office-style/3d/src/props/counter-compact.ts`
- `design/office-style/3d/src/props/counter-wide.ts`
- `design/office-style/3d/src/props/cup-rack.ts`
- `design/office-style/3d/src/props/desk-apron.ts`
- `design/office-style/3d/src/props/desk-cactus.ts`
- `design/office-style/3d/src/props/desk-lamp.ts`
- `design/office-style/3d/src/props/desk-return.ts`
- `design/office-style/3d/src/props/desk-wing.ts`
- `design/office-style/3d/src/props/document-tray.ts`
- `design/office-style/3d/src/props/extended.ts`
- `design/office-style/3d/src/props/filing-cabinet.ts`
- `design/office-style/3d/src/props/floor-palm.ts`
- `design/office-style/3d/src/props/floor-sticker.ts`
- `design/office-style/3d/src/props/framed-poster.ts`
- `design/office-style/3d/src/props/fruit-bowl.ts`
- `design/office-style/3d/src/props/guest-chair.ts`
- `design/office-style/3d/src/props/hanging-planter.ts`
- `design/office-style/3d/src/props/headphones.ts`
- `design/office-style/3d/src/props/kettle.ts`
- `design/office-style/3d/src/props/lounge-table.ts`
- `design/office-style/3d/src/props/microwave.ts`
- `design/office-style/3d/src/props/notebook.ts`
- `design/office-style/3d/src/props/paper-towels.ts`
- `design/office-style/3d/src/props/part-d.ts`
- `design/office-style/3d/src/props/pen-cup.ts`
- `design/office-style/3d/src/props/phone-stand.ts`
- `design/office-style/3d/src/props/printer-stand.ts`
- `design/office-style/3d/src/props/recipes.ts`
- `design/office-style/3d/src/props/recycle-bin.ts`
- `design/office-style/3d/src/props/rug-meeting.ts`
- `design/office-style/3d/src/props/shoe-rack.ts`
- `design/office-style/3d/src/props/snack-box.ts`
- `design/office-style/3d/src/props/sticky-notes.ts`
- `design/office-style/3d/src/props/storage-cube.ts`
- `design/office-style/3d/src/props/sun-patch-edge.ts`
- `design/office-style/3d/src/props/sun-patch.ts`
- `design/office-style/3d/src/props/tissue-box.ts`
- `design/office-style/3d/src/props/toaster.ts`
- `design/office-style/3d/src/props/wall-clock.ts`
- `design/office-style/3d/src/props/wall-shelf.ts`
- `design/office-style/3d/src/props/wall-tv.ts`
- `design/office-style/3d/src/props/wall-whiteboard.ts`
- `design/office-style/3d/src/props/water-dispenser.ts`
- `design/office-style/3d/src/report-d.ts`
- `design/office-style/3d/src/report.ts`
- `design/office-style/3d/src/validate-layout.ts`
- `design/office-style/3d/src/validate-map.ts`
- `design/office-style/3d/src/validate.ts`
- `design/office-style/3d/src/viewer.html`
- `design/office-style/C/map/export-map.py`
- `design/office-style/REQUESTS.md`
- `docs/office/CODEX-PROMPTS.md`

`FILES.md` is the complete inventory, including review images, source baselines and validation evidence. Changes elsewhere in the working tree are not part of this asset task.

## Final validation

```text
PASS characters/dev-hoodie.glb: 1884/3000 triangles
PASS characters/designer.glb: 1900/3000 triangles
PASS characters/lead.glb: 2488/3000 triangles
PASS characters/shiba.glb: 1772/3000 triangles
PASS characters/cat.glb: 1948/3000 triangles
PASS characters/penguin.glb: 1928/3000 triangles
PASS characters/alien.glb: 1892/3000 triangles
PASS characters/robot.glb: 1644/3000 triangles
PASS characters/mage.glb: 1668/3000 triangles
PASS characters/knight.glb: 2156/3000 triangles
PASS characters/ranger.glb: 1860/3000 triangles
PASS characters/healer.glb: 1868/3000 triangles
PASS characters/rogue.glb: 1900/3000 triangles
PASS characters/berserker.glb: 1684/3000 triangles
PASS characters/slime.glb: 652/3000 triangles
PASS characters/dragon.glb: 1988/3000 triangles
PASS props/desk.glb: 444/1500 triangles
PASS props/monitor-dual.glb: 292/1500 triangles
PASS props/monitor-arm.glb: 244/300 triangles
PASS props/keyboard.glb: 192/300 triangles
PASS props/office-chair.glb: 1256/1500 triangles
PASS props/pc-tower.glb: 348/1500 triangles
PASS props/desk-plant.glb: 300/300 triangles
PASS props/mug.glb: 184/300 triangles
PASS props/desk-long.glb: 444/1500 triangles
PASS props/cable-tray.glb: 48/300 triangles
PASS props/monitor-single.glb: 158/300 triangles
PASS props/mouse.glb: 100/300 triangles
PASS props/monitor-riser.glb: 144/300 triangles
PASS props/desk-shelf.glb: 144/300 triangles
PASS props/power-strip.glb: 192/300 triangles
PASS props/gaming-chair.glb: 1256/1500 triangles
PASS props/stool.glb: 204/1500 triangles
PASS props/photo-frame.glb: 98/300 triangles
PASS props/water-bottle.glb: 180/300 triangles
PASS props/figurine.glb: 208/300 triangles
PASS props/reception-desk.glb: 264/1500 triangles
PASS props/door-mat.glb: 48/1500 triangles
PASS props/cabinet.glb: 396/1500 triangles
PASS props/fridge.glb: 252/1500 triangles
PASS props/counter.glb: 312/1500 triangles
PASS props/sink.glb: 160/300 triangles
PASS props/coffee-machine.glb: 264/300 triangles
PASS props/jar.glb: 120/300 triangles
PASS props/round-table.glb: 180/1500 triangles
PASS props/bench.glb: 540/1500 triangles
PASS props/shelf.glb: 408/1500 triangles
PASS props/sofa.glb: 972/1500 triangles
PASS props/armchair.glb: 972/1500 triangles
PASS props/coffee-table.glb: 480/1500 triangles
PASS props/whiteboard.glb: 444/1500 triangles
PASS props/floor-lamp.glb: 130/1500 triangles
PASS props/bookshelf.glb: 1488/1500 triangles
PASS props/printer.glb: 252/1500 triangles
PASS props/plant-large.glb: 300/1500 triangles
PASS props/plant-small.glb: 300/1500 triangles
PASS props/rug-lavender.glb: 48/1500 triangles
PASS props/rug-mint.glb: 48/1500 triangles
PASS props/folding-table.glb: 240/1500 triangles
PASS props/folding-chair.glb: 528/1500 triangles
PASS props/card-mat.glb: 348/1500 triangles
PASS props/ludo-mat.glb: 1248/1500 triangles
PASS props/document-tray.glb: 240/300 triangles
PASS props/notebook.glb: 144/300 triangles
PASS props/book-stack.glb: 144/300 triangles
PASS props/pen-cup.glb: 204/300 triangles
PASS props/headphones.glb: 192/300 triangles
PASS props/desk-lamp.glb: 136/300 triangles
PASS props/phone-stand.glb: 98/300 triangles
PASS props/sticky-notes.glb: 96/300 triangles
PASS props/snack-box.glb: 204/300 triangles
PASS props/desk-cactus.glb: 220/300 triangles
PASS props/tissue-box.glb: 204/300 triangles
PASS props/microwave.glb: 252/300 triangles
PASS props/kettle.glb: 200/300 triangles
PASS props/toaster.glb: 224/300 triangles
PASS props/fruit-bowl.glb: 140/300 triangles
PASS props/cup-rack.glb: 276/300 triangles
PASS props/paper-towels.glb: 108/300 triangles
PASS props/filing-cabinet.glb: 396/1500 triangles
PASS props/storage-cube.glb: 300/1500 triangles
PASS props/archive-boxes.glb: 468/1500 triangles
PASS props/recycle-bin.glb: 204/1500 triangles
PASS props/water-dispenser.glb: 312/1500 triangles
PASS props/coat-rack.glb: 312/1500 triangles
PASS props/shoe-rack.glb: 416/1500 triangles
PASS props/bean-bag.glb: 128/1500 triangles
PASS props/floor-palm.glb: 428/1500 triangles
PASS props/printer-stand.glb: 600/1500 triangles
PASS props/counter-wide.glb: 312/1500 triangles
PASS props/counter-compact.glb: 312/1500 triangles
PASS props/desk-apron.glb: 300/1500 triangles
PASS props/desk-wing.glb: 300/1500 triangles
PASS props/desk-return.glb: 300/1500 triangles
PASS props/guest-chair.glb: 408/1500 triangles
PASS props/lounge-table.glb: 456/1500 triangles
PASS props/wall-clock.glb: 216/300 triangles
PASS props/wall-shelf.glb: 400/1500 triangles
PASS props/corkboard.glb: 336/1500 triangles
PASS props/framed-poster.glb: 192/300 triangles
PASS props/wall-tv.glb: 192/1500 triangles
PASS props/hanging-planter.glb: 336/1500 triangles
PASS props/company-sign.glb: 504/1500 triangles
PASS props/calendar.glb: 192/300 triangles
PASS props/wall-whiteboard.glb: 192/1500 triangles
PASS props/sun-patch.glb: 2/1500 triangles
PASS props/sun-patch-edge.glb: 3/1500 triangles
PASS props/cable-cover.glb: 12/1500 triangles
PASS props/rug-meeting.glb: 12/1500 triangles
PASS props/floor-sticker.glb: 8/1500 triangles
PASS kit/floor-tile.glb: 12/24 triangles
PASS kit/wall-straight.glb: 108/1500 triangles
PASS kit/wall-blind.glb: 300/1500 triangles
PASS kit/wall-column.glb: 108/1500 triangles
PASS kit/wall-corner.glb: 216/1500 triangles
PASS kit/wall-door.glb: 420/1500 triangles
PASS kit/glass-wall.glb: 196/1500 triangles
PASS kit/glass-post.glb: 108/1500 triangles
PASS kit/air-conditioner.glb: 144/1500 triangles
PASS kit/picture-frame.glb: 192/1500 triangles
PASS kit/window-wall.glb: 458/1500 triangles
PASS kit/wall-half.glb: 108/1500 triangles
PASS kit/door-glass-double.glb: 496/1500 triangles
PASS kit/door-glass.glb: 104/1500 triangles
PASS kit/floor-manager.glb: 12/24 triangles
PASS 125 models; all budgets, embedded palette, dimensions, 16 character rigs/clips and both 0.6s/85-degree door animations.
PASS layout: 2087 objects, 202 wall pieces; 20/20 seat chairs, including HR.
PASS blocked coverage: 0 uncovered; 0 explicitly allowed margins.
PASS wall decor: 63 supported mounts; projection <=0.12, deep-item bottom >=1.7; longest bare wall 3.24 tiles.
PASS desktop personality: 19 stations have 4–6 items at y=0.74; HR has its requested 3 items at y=0.88; keyboard reach zones clear.
PASS north solid walls, west clear windows, 10 sunlight patches, frosted manager room extended to row 34, exactly two nonblocking doors.
PASS shared map: exactly 34 authorized D12/HR collision edits; 20 seats and extras reachable; 32-color plate + binary foreground; unrelated pixels unchanged; collision@16x recipe exact.
PASS scene triangles: 208163 static + 37992 preview characters = 246155/500000.
PASS negative checks: chair, collision, coverage, mounts, doors and keyboard-zone violations are rejected.
```

## Review images

- `design/office-style/3d/previews/full-office-000.png`
- `design/office-style/3d/previews/full-office-090.png`
- `design/office-style/3d/previews/full-office-180.png`
- `design/office-style/3d/previews/full-office-270.png`
- `design/office-style/3d/previews/topdown.png`
- `design/office-style/3d/previews/topdown-overlay.png`
- `design/office-style/3d/previews/scene-pastel.png`
- `design/office-style/3d/previews/new-props-sheet.png`
- `design/office-style/3d/previews/entrance-door-closeup.png`
- `design/office-style/3d/previews/entrance-door-open.png`
- `design/office-style/3d/previews/manager-room-closeup.png`
- `design/office-style/3d/previews/hr-desk-closeup.png`
- `design/office-style/3d/previews/map-before-after-diff.png`
- `design/office-style/3d/previews/hr-before-after-diff.png`

## Requests and limits

- All blocked tiles are covered; no margin waiver is used.
- New-library models not currently instanced: recycle-bin. They are included on the new-props sheet for reuse.
- Extra lounge / meeting-table / plant-island / entrance-shoe-rack locations on currently walkable floor are requests only in REQUESTS-3D.md. No corresponding collision edits were applied. The earlier folding furniture remains unplaced.
- The only raised nonblocking exceptions are the 20 exact seat chairs and the two exact door openings. Wall-mounted decor is checked against matching structural wall faces and clearance rules.
- Thin trim uses a radius bounded by its thickness; D6 explicitly makes the floor a flat low-poly slab.
- Opening doors before crossing, evening fading of sunlight and app state / UI remain app-owner integration work. No dashboard or server source was edited by this task.

---

# Historical Parts A–C (superseded where Part D says otherwise)

# Office 3D — Parts A, B and C

Completed in order, each with build + validate + preview. All new previews use pastel. The shared manifest, dashboard source, map and 2D art were not edited.

## Part A

Files written or regenerated (checkpoint evidence files themselves are listed in FILES.md):

- `dashboard/public/office/3d/characters/lead.glb`
- `dashboard/public/office/3d/kit/floor-tile.glb`
- `dashboard/public/office/3d/kit/wall-blind.glb`
- `dashboard/public/office/3d/kit/wall-column.glb`
- `dashboard/public/office/3d/kit/wall-corner.glb`
- `dashboard/public/office/3d/kit/wall-straight.glb`
- `dashboard/public/office/3d/palette-office.png`
- `dashboard/public/office/3d/palette.png`
- `dashboard/public/office/3d/props/desk-plant.glb`
- `dashboard/public/office/3d/props/desk.glb`
- `dashboard/public/office/3d/props/keyboard.glb`
- `dashboard/public/office/3d/props/monitor-arm.glb`
- `dashboard/public/office/3d/props/monitor-dual.glb`
- `dashboard/public/office/3d/props/mug.glb`
- `dashboard/public/office/3d/props/office-chair.glb`
- `dashboard/public/office/3d/props/pc-tower.glb`
- `design/office-style/3d/FILES.md`
- `design/office-style/3d/README.md`
- `design/office-style/3d/previews/desk-plant-turntable.png`
- `design/office-style/3d/previews/desk-turntable.png`
- `design/office-style/3d/previews/floor-tile-turntable.png`
- `design/office-style/3d/previews/index.html`
- `design/office-style/3d/previews/keyboard-turntable.png`
- `design/office-style/3d/previews/lead-away-strip.png`
- `design/office-style/3d/previews/lead-idle-strip.png`
- `design/office-style/3d/previews/lead-sit-idle-strip.png`
- `design/office-style/3d/previews/lead-sit-strip.png`
- `design/office-style/3d/previews/lead-talk-strip.png`
- `design/office-style/3d/previews/lead-turntable.png`
- `design/office-style/3d/previews/lead-type-strip.png`
- `design/office-style/3d/previews/lead-walk-strip.png`
- `design/office-style/3d/previews/lead-wave-strip.png`
- `design/office-style/3d/previews/monitor-arm-turntable.png`
- `design/office-style/3d/previews/monitor-dual-turntable.png`
- `design/office-style/3d/previews/mug-turntable.png`
- `design/office-style/3d/previews/office-chair-turntable.png`
- `design/office-style/3d/previews/pc-tower-turntable.png`
- `design/office-style/3d/previews/reference-prototype.png`
- `design/office-style/3d/previews/scene-pastel.png`
- `design/office-style/3d/previews/tri-counts.json`
- `design/office-style/3d/previews/validate.txt`
- `design/office-style/3d/previews/wall-blind-turntable.png`
- `design/office-style/3d/previews/wall-column-turntable.png`
- `design/office-style/3d/previews/wall-corner-turntable.png`
- `design/office-style/3d/previews/wall-straight-turntable.png`
- `design/office-style/3d/src/build.ts`
- `design/office-style/3d/src/characters/lead.ts`
- `design/office-style/3d/src/config.ts`
- `design/office-style/3d/src/kit/floor-tile.ts`
- `design/office-style/3d/src/preview.ts`
- `design/office-style/3d/src/primitives.ts`
- `design/office-style/3d/src/report.ts`
- `design/office-style/3d/src/style-scene.json`
- `design/office-style/3d/src/validate.ts`
- `design/office-style/3d/src/viewer.html`

Removed obsolete outputs:

- `dashboard/public/office/3d/palette-pastel.png`
- `design/office-style/3d/previews/scene-office.png`

Triangle counts per model at this checkpoint:

| Model | Triangles |
|---|---:|
| characters/lead.glb | 2488 |
| props/desk.glb | 444 |
| props/monitor-dual.glb | 292 |
| props/monitor-arm.glb | 244 |
| props/keyboard.glb | 192 |
| props/office-chair.glb | 1256 |
| props/pc-tower.glb | 348 |
| props/desk-plant.glb | 300 |
| props/mug.glb | 184 |
| kit/floor-tile.glb | 480 |
| kit/wall-straight.glb | 108 |
| kit/wall-blind.glb | 300 |
| kit/wall-column.glb | 108 |
| kit/wall-corner.glb | 216 |

## Part B

Files written or regenerated (checkpoint evidence files themselves are listed in FILES.md):

- `dashboard/public/office/3d/characters/alien.glb`
- `dashboard/public/office/3d/characters/berserker.glb`
- `dashboard/public/office/3d/characters/cat.glb`
- `dashboard/public/office/3d/characters/designer.glb`
- `dashboard/public/office/3d/characters/dev-hoodie.glb`
- `dashboard/public/office/3d/characters/dragon.glb`
- `dashboard/public/office/3d/characters/healer.glb`
- `dashboard/public/office/3d/characters/knight.glb`
- `dashboard/public/office/3d/characters/lead.glb`
- `dashboard/public/office/3d/characters/mage.glb`
- `dashboard/public/office/3d/characters/penguin.glb`
- `dashboard/public/office/3d/characters/ranger.glb`
- `dashboard/public/office/3d/characters/robot.glb`
- `dashboard/public/office/3d/characters/rogue.glb`
- `dashboard/public/office/3d/characters/shiba.glb`
- `dashboard/public/office/3d/characters/slime.glb`
- `dashboard/public/office/3d/kit/floor-tile.glb`
- `dashboard/public/office/3d/kit/wall-blind.glb`
- `dashboard/public/office/3d/kit/wall-column.glb`
- `dashboard/public/office/3d/kit/wall-corner.glb`
- `dashboard/public/office/3d/kit/wall-straight.glb`
- `dashboard/public/office/3d/palette-office.png`
- `dashboard/public/office/3d/palette.png`
- `dashboard/public/office/3d/props/desk-plant.glb`
- `dashboard/public/office/3d/props/desk.glb`
- `dashboard/public/office/3d/props/keyboard.glb`
- `dashboard/public/office/3d/props/monitor-arm.glb`
- `dashboard/public/office/3d/props/monitor-dual.glb`
- `dashboard/public/office/3d/props/mug.glb`
- `dashboard/public/office/3d/props/office-chair.glb`
- `dashboard/public/office/3d/props/pc-tower.glb`
- `design/office-style/3d/FILES.md`
- `design/office-style/3d/manifest-models3d.json`
- `design/office-style/3d/palette.json`
- `design/office-style/3d/previews/alien-turntable.png`
- `design/office-style/3d/previews/berserker-turntable.png`
- `design/office-style/3d/previews/cat-turntable.png`
- `design/office-style/3d/previews/designer-turntable.png`
- `design/office-style/3d/previews/dev-hoodie-turntable.png`
- `design/office-style/3d/previews/dragon-turntable.png`
- `design/office-style/3d/previews/healer-turntable.png`
- `design/office-style/3d/previews/index.html`
- `design/office-style/3d/previews/knight-turntable.png`
- `design/office-style/3d/previews/lineup-16.png`
- `design/office-style/3d/previews/mage-turntable.png`
- `design/office-style/3d/previews/penguin-turntable.png`
- `design/office-style/3d/previews/ranger-turntable.png`
- `design/office-style/3d/previews/reference-prototype.png`
- `design/office-style/3d/previews/robot-away-strip.png`
- `design/office-style/3d/previews/robot-idle-strip.png`
- `design/office-style/3d/previews/robot-sit-idle-strip.png`
- `design/office-style/3d/previews/robot-sit-strip.png`
- `design/office-style/3d/previews/robot-talk-strip.png`
- `design/office-style/3d/previews/robot-turntable.png`
- `design/office-style/3d/previews/robot-type-strip.png`
- `design/office-style/3d/previews/robot-walk-strip.png`
- `design/office-style/3d/previews/robot-wave-strip.png`
- `design/office-style/3d/previews/rogue-turntable.png`
- `design/office-style/3d/previews/shiba-away-strip.png`
- `design/office-style/3d/previews/shiba-idle-strip.png`
- `design/office-style/3d/previews/shiba-sit-idle-strip.png`
- `design/office-style/3d/previews/shiba-sit-strip.png`
- `design/office-style/3d/previews/shiba-talk-strip.png`
- `design/office-style/3d/previews/shiba-turntable.png`
- `design/office-style/3d/previews/shiba-type-strip.png`
- `design/office-style/3d/previews/shiba-walk-strip.png`
- `design/office-style/3d/previews/shiba-wave-strip.png`
- `design/office-style/3d/previews/slime-turntable.png`
- `design/office-style/3d/previews/tri-counts.json`
- `design/office-style/3d/previews/validate.txt`
- `design/office-style/3d/src/build.ts`
- `design/office-style/3d/src/characters/alien.ts`
- `design/office-style/3d/src/characters/berserker.ts`
- `design/office-style/3d/src/characters/cat.ts`
- `design/office-style/3d/src/characters/designer.ts`
- `design/office-style/3d/src/characters/dev-hoodie.ts`
- `design/office-style/3d/src/characters/dragon.ts`
- `design/office-style/3d/src/characters/healer.ts`
- `design/office-style/3d/src/characters/knight.ts`
- `design/office-style/3d/src/characters/lead.ts`
- `design/office-style/3d/src/characters/mage.ts`
- `design/office-style/3d/src/characters/penguin.ts`
- `design/office-style/3d/src/characters/ranger.ts`
- `design/office-style/3d/src/characters/recipes.ts`
- `design/office-style/3d/src/characters/robot.ts`
- `design/office-style/3d/src/characters/rogue.ts`
- `design/office-style/3d/src/characters/shiba.ts`
- `design/office-style/3d/src/characters/skins.ts`
- `design/office-style/3d/src/characters/slime.ts`
- `design/office-style/3d/src/config.ts`
- `design/office-style/3d/src/preview.ts`
- `design/office-style/3d/src/primitives.ts`
- `design/office-style/3d/src/validate.ts`
- `design/office-style/3d/src/viewer.html`

Triangle counts per model at this checkpoint:

| Model | Triangles |
|---|---:|
| characters/dev-hoodie.glb | 1884 |
| characters/designer.glb | 1900 |
| characters/lead.glb | 2488 |
| characters/shiba.glb | 1772 |
| characters/cat.glb | 1948 |
| characters/penguin.glb | 1928 |
| characters/alien.glb | 1892 |
| characters/robot.glb | 1644 |
| characters/mage.glb | 1668 |
| characters/knight.glb | 2156 |
| characters/ranger.glb | 1860 |
| characters/healer.glb | 1868 |
| characters/rogue.glb | 1900 |
| characters/berserker.glb | 1684 |
| characters/slime.glb | 652 |
| characters/dragon.glb | 1988 |
| props/desk.glb | 444 |
| props/monitor-dual.glb | 292 |
| props/monitor-arm.glb | 244 |
| props/keyboard.glb | 192 |
| props/office-chair.glb | 1256 |
| props/pc-tower.glb | 348 |
| props/desk-plant.glb | 300 |
| props/mug.glb | 184 |
| kit/floor-tile.glb | 480 |
| kit/wall-straight.glb | 108 |
| kit/wall-blind.glb | 300 |
| kit/wall-column.glb | 108 |
| kit/wall-corner.glb | 216 |

## Part C

Files written or regenerated (checkpoint evidence files themselves are listed in FILES.md):

- `dashboard/public/office/3d/characters/alien.glb`
- `dashboard/public/office/3d/characters/berserker.glb`
- `dashboard/public/office/3d/characters/cat.glb`
- `dashboard/public/office/3d/characters/designer.glb`
- `dashboard/public/office/3d/characters/dev-hoodie.glb`
- `dashboard/public/office/3d/characters/dragon.glb`
- `dashboard/public/office/3d/characters/healer.glb`
- `dashboard/public/office/3d/characters/knight.glb`
- `dashboard/public/office/3d/characters/lead.glb`
- `dashboard/public/office/3d/characters/mage.glb`
- `dashboard/public/office/3d/characters/penguin.glb`
- `dashboard/public/office/3d/characters/ranger.glb`
- `dashboard/public/office/3d/characters/robot.glb`
- `dashboard/public/office/3d/characters/rogue.glb`
- `dashboard/public/office/3d/characters/shiba.glb`
- `dashboard/public/office/3d/characters/slime.glb`
- `dashboard/public/office/3d/kit/air-conditioner.glb`
- `dashboard/public/office/3d/kit/floor-tile.glb`
- `dashboard/public/office/3d/kit/glass-post.glb`
- `dashboard/public/office/3d/kit/glass-wall.glb`
- `dashboard/public/office/3d/kit/picture-frame.glb`
- `dashboard/public/office/3d/kit/wall-blind.glb`
- `dashboard/public/office/3d/kit/wall-column.glb`
- `dashboard/public/office/3d/kit/wall-corner.glb`
- `dashboard/public/office/3d/kit/wall-door.glb`
- `dashboard/public/office/3d/kit/wall-straight.glb`
- `dashboard/public/office/3d/layout3d.json`
- `dashboard/public/office/3d/palette-office.png`
- `dashboard/public/office/3d/palette.png`
- `dashboard/public/office/3d/props/armchair.glb`
- `dashboard/public/office/3d/props/bench.glb`
- `dashboard/public/office/3d/props/bookshelf.glb`
- `dashboard/public/office/3d/props/cabinet.glb`
- `dashboard/public/office/3d/props/cable-tray.glb`
- `dashboard/public/office/3d/props/card-mat.glb`
- `dashboard/public/office/3d/props/coffee-machine.glb`
- `dashboard/public/office/3d/props/coffee-table.glb`
- `dashboard/public/office/3d/props/counter.glb`
- `dashboard/public/office/3d/props/desk-long.glb`
- `dashboard/public/office/3d/props/desk-plant.glb`
- `dashboard/public/office/3d/props/desk-shelf.glb`
- `dashboard/public/office/3d/props/desk.glb`
- `dashboard/public/office/3d/props/door-mat.glb`
- `dashboard/public/office/3d/props/figurine.glb`
- `dashboard/public/office/3d/props/floor-lamp.glb`
- `dashboard/public/office/3d/props/folding-chair.glb`
- `dashboard/public/office/3d/props/folding-table.glb`
- `dashboard/public/office/3d/props/fridge.glb`
- `dashboard/public/office/3d/props/gaming-chair.glb`
- `dashboard/public/office/3d/props/jar.glb`
- `dashboard/public/office/3d/props/keyboard.glb`
- `dashboard/public/office/3d/props/ludo-mat.glb`
- `dashboard/public/office/3d/props/monitor-arm.glb`
- `dashboard/public/office/3d/props/monitor-dual.glb`
- `dashboard/public/office/3d/props/monitor-riser.glb`
- `dashboard/public/office/3d/props/monitor-single.glb`
- `dashboard/public/office/3d/props/mouse.glb`
- `dashboard/public/office/3d/props/mug.glb`
- `dashboard/public/office/3d/props/office-chair.glb`
- `dashboard/public/office/3d/props/pc-tower.glb`
- `dashboard/public/office/3d/props/photo-frame.glb`
- `dashboard/public/office/3d/props/plant-large.glb`
- `dashboard/public/office/3d/props/plant-small.glb`
- `dashboard/public/office/3d/props/power-strip.glb`
- `dashboard/public/office/3d/props/printer.glb`
- `dashboard/public/office/3d/props/reception-desk.glb`
- `dashboard/public/office/3d/props/round-table.glb`
- `dashboard/public/office/3d/props/rug-lavender.glb`
- `dashboard/public/office/3d/props/rug-mint.glb`
- `dashboard/public/office/3d/props/shelf.glb`
- `dashboard/public/office/3d/props/sink.glb`
- `dashboard/public/office/3d/props/sofa.glb`
- `dashboard/public/office/3d/props/stool.glb`
- `dashboard/public/office/3d/props/water-bottle.glb`
- `dashboard/public/office/3d/props/whiteboard.glb`
- `design/office-style/3d/FILES.md`
- `design/office-style/3d/README.md`
- `design/office-style/3d/REPORT.md`
- `design/office-style/3d/REQUESTS-3D.md`
- `design/office-style/3d/manifest-models3d.json`
- `design/office-style/3d/model-metadata.json`
- `design/office-style/3d/palette.json`
- `design/office-style/3d/previews/air-conditioner-turntable.png`
- `design/office-style/3d/previews/alien-turntable.png`
- `design/office-style/3d/previews/armchair-turntable.png`
- `design/office-style/3d/previews/bench-turntable.png`
- `design/office-style/3d/previews/berserker-turntable.png`
- `design/office-style/3d/previews/bookshelf-turntable.png`
- `design/office-style/3d/previews/cabinet-turntable.png`
- `design/office-style/3d/previews/cable-tray-turntable.png`
- `design/office-style/3d/previews/card-mat-turntable.png`
- `design/office-style/3d/previews/cat-turntable.png`
- `design/office-style/3d/previews/coffee-machine-turntable.png`
- `design/office-style/3d/previews/coffee-table-turntable.png`
- `design/office-style/3d/previews/counter-turntable.png`
- `design/office-style/3d/previews/designer-turntable.png`
- `design/office-style/3d/previews/desk-long-turntable.png`
- `design/office-style/3d/previews/desk-plant-turntable.png`
- `design/office-style/3d/previews/desk-shelf-turntable.png`
- `design/office-style/3d/previews/dev-hoodie-turntable.png`
- `design/office-style/3d/previews/door-mat-turntable.png`
- `design/office-style/3d/previews/dragon-turntable.png`
- `design/office-style/3d/previews/figurine-turntable.png`
- `design/office-style/3d/previews/floor-lamp-turntable.png`
- `design/office-style/3d/previews/floor-tile-turntable.png`
- `design/office-style/3d/previews/folding-chair-turntable.png`
- `design/office-style/3d/previews/folding-table-turntable.png`
- `design/office-style/3d/previews/fridge-turntable.png`
- `design/office-style/3d/previews/full-office-000.png`
- `design/office-style/3d/previews/full-office-090.png`
- `design/office-style/3d/previews/full-office-180.png`
- `design/office-style/3d/previews/full-office-270.png`
- `design/office-style/3d/previews/gaming-chair-turntable.png`
- `design/office-style/3d/previews/glass-post-turntable.png`
- `design/office-style/3d/previews/glass-wall-turntable.png`
- `design/office-style/3d/previews/healer-turntable.png`
- `design/office-style/3d/previews/index.html`
- `design/office-style/3d/previews/jar-turntable.png`
- `design/office-style/3d/previews/keyboard-turntable.png`
- `design/office-style/3d/previews/knight-turntable.png`
- `design/office-style/3d/previews/lead-idle-strip.png`
- `design/office-style/3d/previews/lead-sit-idle-strip.png`
- `design/office-style/3d/previews/lead-sit-strip.png`
- `design/office-style/3d/previews/lead-talk-strip.png`
- `design/office-style/3d/previews/lead-turntable.png`
- `design/office-style/3d/previews/lead-type-strip.png`
- `design/office-style/3d/previews/lead-walk-strip.png`
- `design/office-style/3d/previews/lineup-16.png`
- `design/office-style/3d/previews/ludo-mat-turntable.png`
- `design/office-style/3d/previews/mage-turntable.png`
- `design/office-style/3d/previews/monitor-arm-turntable.png`
- `design/office-style/3d/previews/monitor-dual-turntable.png`
- `design/office-style/3d/previews/monitor-riser-turntable.png`
- `design/office-style/3d/previews/monitor-single-turntable.png`
- `design/office-style/3d/previews/mouse-turntable.png`
- `design/office-style/3d/previews/mug-turntable.png`
- `design/office-style/3d/previews/office-chair-turntable.png`
- `design/office-style/3d/previews/pc-tower-turntable.png`
- `design/office-style/3d/previews/penguin-turntable.png`
- `design/office-style/3d/previews/photo-frame-turntable.png`
- `design/office-style/3d/previews/picture-frame-turntable.png`
- `design/office-style/3d/previews/plant-large-turntable.png`
- `design/office-style/3d/previews/plant-small-turntable.png`
- `design/office-style/3d/previews/power-strip-turntable.png`
- `design/office-style/3d/previews/printer-turntable.png`
- `design/office-style/3d/previews/ranger-turntable.png`
- `design/office-style/3d/previews/reception-desk-turntable.png`
- `design/office-style/3d/previews/reference-prototype.png`
- `design/office-style/3d/previews/robot-away-strip.png`
- `design/office-style/3d/previews/robot-idle-strip.png`
- `design/office-style/3d/previews/robot-sit-idle-strip.png`
- `design/office-style/3d/previews/robot-sit-strip.png`
- `design/office-style/3d/previews/robot-talk-strip.png`
- `design/office-style/3d/previews/robot-turntable.png`
- `design/office-style/3d/previews/robot-type-strip.png`
- `design/office-style/3d/previews/robot-walk-strip.png`
- `design/office-style/3d/previews/robot-wave-strip.png`
- `design/office-style/3d/previews/rogue-turntable.png`
- `design/office-style/3d/previews/round-table-turntable.png`
- `design/office-style/3d/previews/rug-lavender-turntable.png`
- `design/office-style/3d/previews/rug-mint-turntable.png`
- `design/office-style/3d/previews/scene-pastel.png`
- `design/office-style/3d/previews/shelf-turntable.png`
- `design/office-style/3d/previews/shiba-away-strip.png`
- `design/office-style/3d/previews/shiba-idle-strip.png`
- `design/office-style/3d/previews/shiba-sit-idle-strip.png`
- `design/office-style/3d/previews/shiba-sit-strip.png`
- `design/office-style/3d/previews/shiba-talk-strip.png`
- `design/office-style/3d/previews/shiba-turntable.png`
- `design/office-style/3d/previews/shiba-type-strip.png`
- `design/office-style/3d/previews/shiba-walk-strip.png`
- `design/office-style/3d/previews/shiba-wave-strip.png`
- `design/office-style/3d/previews/sink-turntable.png`
- `design/office-style/3d/previews/slime-turntable.png`
- `design/office-style/3d/previews/sofa-turntable.png`
- `design/office-style/3d/previews/stool-turntable.png`
- `design/office-style/3d/previews/topdown-overlay.png`
- `design/office-style/3d/previews/topdown.png`
- `design/office-style/3d/previews/tri-counts.json`
- `design/office-style/3d/previews/validate.txt`
- `design/office-style/3d/previews/wall-blind-turntable.png`
- `design/office-style/3d/previews/wall-column-turntable.png`
- `design/office-style/3d/previews/wall-door-turntable.png`
- `design/office-style/3d/previews/water-bottle-turntable.png`
- `design/office-style/3d/previews/whiteboard-turntable.png`
- `design/office-style/3d/src/build.ts`
- `design/office-style/3d/src/config.ts`
- `design/office-style/3d/src/final-report.ts`
- `design/office-style/3d/src/kit/air-conditioner.ts`
- `design/office-style/3d/src/kit/extended.ts`
- `design/office-style/3d/src/kit/floor-tile.ts`
- `design/office-style/3d/src/kit/glass-post.ts`
- `design/office-style/3d/src/kit/glass-wall.ts`
- `design/office-style/3d/src/kit/picture-frame.ts`
- `design/office-style/3d/src/kit/wall-door.ts`
- `design/office-style/3d/src/layout.ts`
- `design/office-style/3d/src/preview.ts`
- `design/office-style/3d/src/primitives.ts`
- `design/office-style/3d/src/props/armchair.ts`
- `design/office-style/3d/src/props/bench.ts`
- `design/office-style/3d/src/props/bookshelf.ts`
- `design/office-style/3d/src/props/cabinet.ts`
- `design/office-style/3d/src/props/cable-tray.ts`
- `design/office-style/3d/src/props/card-mat.ts`
- `design/office-style/3d/src/props/coffee-machine.ts`
- `design/office-style/3d/src/props/coffee-table.ts`
- `design/office-style/3d/src/props/counter.ts`
- `design/office-style/3d/src/props/desk-long.ts`
- `design/office-style/3d/src/props/desk-shelf.ts`
- `design/office-style/3d/src/props/door-mat.ts`
- `design/office-style/3d/src/props/extended.ts`
- `design/office-style/3d/src/props/figurine.ts`
- `design/office-style/3d/src/props/floor-lamp.ts`
- `design/office-style/3d/src/props/folding-chair.ts`
- `design/office-style/3d/src/props/folding-table.ts`
- `design/office-style/3d/src/props/fridge.ts`
- `design/office-style/3d/src/props/gaming-chair.ts`
- `design/office-style/3d/src/props/jar.ts`
- `design/office-style/3d/src/props/ludo-mat.ts`
- `design/office-style/3d/src/props/monitor-riser.ts`
- `design/office-style/3d/src/props/monitor-single.ts`
- `design/office-style/3d/src/props/mouse.ts`
- `design/office-style/3d/src/props/photo-frame.ts`
- `design/office-style/3d/src/props/plant-large.ts`
- `design/office-style/3d/src/props/plant-small.ts`
- `design/office-style/3d/src/props/power-strip.ts`
- `design/office-style/3d/src/props/printer.ts`
- `design/office-style/3d/src/props/reception-desk.ts`
- `design/office-style/3d/src/props/recipes.ts`
- `design/office-style/3d/src/props/round-table.ts`
- `design/office-style/3d/src/props/rug-lavender.ts`
- `design/office-style/3d/src/props/rug-mint.ts`
- `design/office-style/3d/src/props/shelf.ts`
- `design/office-style/3d/src/props/sink.ts`
- `design/office-style/3d/src/props/sofa.ts`
- `design/office-style/3d/src/props/stool.ts`
- `design/office-style/3d/src/props/water-bottle.ts`
- `design/office-style/3d/src/props/whiteboard.ts`
- `design/office-style/3d/src/validate-layout.ts`
- `design/office-style/3d/src/validate.ts`
- `design/office-style/3d/src/viewer.html`

Triangle counts per model at this checkpoint:

| Model | Triangles |
|---|---:|
| characters/dev-hoodie.glb | 1884 |
| characters/designer.glb | 1900 |
| characters/lead.glb | 2488 |
| characters/shiba.glb | 1772 |
| characters/cat.glb | 1948 |
| characters/penguin.glb | 1928 |
| characters/alien.glb | 1892 |
| characters/robot.glb | 1644 |
| characters/mage.glb | 1668 |
| characters/knight.glb | 2156 |
| characters/ranger.glb | 1860 |
| characters/healer.glb | 1868 |
| characters/rogue.glb | 1900 |
| characters/berserker.glb | 1684 |
| characters/slime.glb | 652 |
| characters/dragon.glb | 1988 |
| props/desk.glb | 444 |
| props/monitor-dual.glb | 292 |
| props/monitor-arm.glb | 244 |
| props/keyboard.glb | 192 |
| props/office-chair.glb | 1256 |
| props/pc-tower.glb | 348 |
| props/desk-plant.glb | 300 |
| props/mug.glb | 184 |
| props/desk-long.glb | 444 |
| props/cable-tray.glb | 48 |
| props/monitor-single.glb | 158 |
| props/mouse.glb | 100 |
| props/monitor-riser.glb | 144 |
| props/desk-shelf.glb | 144 |
| props/power-strip.glb | 192 |
| props/gaming-chair.glb | 1256 |
| props/stool.glb | 204 |
| props/photo-frame.glb | 98 |
| props/water-bottle.glb | 180 |
| props/figurine.glb | 208 |
| props/reception-desk.glb | 264 |
| props/door-mat.glb | 48 |
| props/cabinet.glb | 396 |
| props/fridge.glb | 252 |
| props/counter.glb | 312 |
| props/sink.glb | 160 |
| props/coffee-machine.glb | 264 |
| props/jar.glb | 120 |
| props/round-table.glb | 180 |
| props/bench.glb | 540 |
| props/shelf.glb | 408 |
| props/sofa.glb | 972 |
| props/armchair.glb | 972 |
| props/coffee-table.glb | 480 |
| props/whiteboard.glb | 444 |
| props/floor-lamp.glb | 130 |
| props/bookshelf.glb | 1488 |
| props/printer.glb | 252 |
| props/plant-large.glb | 300 |
| props/plant-small.glb | 300 |
| props/rug-lavender.glb | 48 |
| props/rug-mint.glb | 48 |
| props/folding-table.glb | 240 |
| props/folding-chair.glb | 528 |
| props/card-mat.glb | 348 |
| props/ludo-mat.glb | 1248 |
| kit/floor-tile.glb | 1080 |
| kit/wall-straight.glb | 108 |
| kit/wall-blind.glb | 300 |
| kit/wall-column.glb | 108 |
| kit/wall-corner.glb | 216 |
| kit/wall-door.glb | 420 |
| kit/glass-wall.glb | 360 |
| kit/glass-post.glb | 108 |
| kit/air-conditioner.glb | 204 |
| kit/picture-frame.glb | 192 |

## Final validation output

```text
dev-hoodie bounds: height 1.460, width 0.770; hierarchy + 8 loopable clips PASS
PASS characters/dev-hoodie.glb: 1884 / 3000 triangles
designer bounds: height 1.490, width 0.770; hierarchy + 8 loopable clips PASS
PASS characters/designer.glb: 1900 / 3000 triangles
lead bounds: height 1.500, width 0.770; hierarchy + 8 loopable clips PASS
PASS characters/lead.glb: 2488 / 3000 triangles
shiba bounds: height 1.490, width 0.770; hierarchy + 8 loopable clips PASS
PASS characters/shiba.glb: 1772 / 3000 triangles
cat bounds: height 1.490, width 0.770; hierarchy + 8 loopable clips PASS
PASS characters/cat.glb: 1948 / 3000 triangles
penguin bounds: height 1.450, width 0.770; hierarchy + 8 loopable clips PASS
PASS characters/penguin.glb: 1928 / 3000 triangles
alien bounds: height 1.454, width 0.770; hierarchy + 8 loopable clips PASS
PASS characters/alien.glb: 1892 / 3000 triangles
robot bounds: height 1.450, width 0.770; hierarchy + 8 loopable clips PASS
PASS characters/robot.glb: 1644 / 3000 triangles
mage bounds: height 1.490, width 0.770; hierarchy + 8 loopable clips PASS
PASS characters/mage.glb: 1668 / 3000 triangles
knight bounds: height 1.465, width 0.800; hierarchy + 8 loopable clips PASS
PASS characters/knight.glb: 2156 / 3000 triangles
ranger bounds: height 1.490, width 0.770; hierarchy + 8 loopable clips PASS
PASS characters/ranger.glb: 1860 / 3000 triangles
healer bounds: height 1.470, width 0.770; hierarchy + 8 loopable clips PASS
PASS characters/healer.glb: 1868 / 3000 triangles
rogue bounds: height 1.480, width 0.770; hierarchy + 8 loopable clips PASS
PASS characters/rogue.glb: 1900 / 3000 triangles
berserker bounds: height 1.428, width 0.770; hierarchy + 8 loopable clips PASS
PASS characters/berserker.glb: 1684 / 3000 triangles
slime bounds: height 1.490, width 0.723; hierarchy + 8 loopable clips PASS
PASS characters/slime.glb: 652 / 3000 triangles
dragon bounds: height 1.428, width 0.770; hierarchy + 8 loopable clips PASS
PASS characters/dragon.glb: 1988 / 3000 triangles
PASS props/desk.glb: 444 / 1500 triangles
PASS props/monitor-dual.glb: 292 / 1500 triangles
PASS props/monitor-arm.glb: 244 / 300 triangles
PASS props/keyboard.glb: 192 / 300 triangles
PASS props/office-chair.glb: 1256 / 1500 triangles
PASS props/pc-tower.glb: 348 / 1500 triangles
PASS props/desk-plant.glb: 300 / 300 triangles
PASS props/mug.glb: 184 / 300 triangles
PASS props/desk-long.glb: 444 / 1500 triangles
PASS props/cable-tray.glb: 48 / 300 triangles
PASS props/monitor-single.glb: 158 / 300 triangles
PASS props/mouse.glb: 100 / 300 triangles
PASS props/monitor-riser.glb: 144 / 300 triangles
PASS props/desk-shelf.glb: 144 / 300 triangles
PASS props/power-strip.glb: 192 / 300 triangles
PASS props/gaming-chair.glb: 1256 / 1500 triangles
PASS props/stool.glb: 204 / 1500 triangles
PASS props/photo-frame.glb: 98 / 300 triangles
PASS props/water-bottle.glb: 180 / 300 triangles
PASS props/figurine.glb: 208 / 300 triangles
PASS props/reception-desk.glb: 264 / 1500 triangles
PASS props/door-mat.glb: 48 / 1500 triangles
PASS props/cabinet.glb: 396 / 1500 triangles
PASS props/fridge.glb: 252 / 1500 triangles
PASS props/counter.glb: 312 / 1500 triangles
PASS props/sink.glb: 160 / 300 triangles
PASS props/coffee-machine.glb: 264 / 300 triangles
PASS props/jar.glb: 120 / 300 triangles
PASS props/round-table.glb: 180 / 1500 triangles
PASS props/bench.glb: 540 / 1500 triangles
PASS props/shelf.glb: 408 / 1500 triangles
PASS props/sofa.glb: 972 / 1500 triangles
PASS props/armchair.glb: 972 / 1500 triangles
PASS props/coffee-table.glb: 480 / 1500 triangles
PASS props/whiteboard.glb: 444 / 1500 triangles
PASS props/floor-lamp.glb: 130 / 1500 triangles
PASS props/bookshelf.glb: 1488 / 1500 triangles
PASS props/printer.glb: 252 / 1500 triangles
PASS props/plant-large.glb: 300 / 1500 triangles
PASS props/plant-small.glb: 300 / 1500 triangles
PASS props/rug-lavender.glb: 48 / 1500 triangles
PASS props/rug-mint.glb: 48 / 1500 triangles
PASS props/folding-table.glb: 240 / 1500 triangles
PASS props/folding-chair.glb: 528 / 1500 triangles
PASS props/card-mat.glb: 348 / 1500 triangles
PASS props/ludo-mat.glb: 1248 / 1500 triangles
PASS kit/floor-tile.glb: 1080 / 1500 triangles
PASS kit/wall-straight.glb: 108 / 1500 triangles
PASS kit/wall-blind.glb: 300 / 1500 triangles
PASS kit/wall-column.glb: 108 / 1500 triangles
PASS kit/wall-corner.glb: 216 / 1500 triangles
PASS kit/wall-door.glb: 420 / 1500 triangles
PASS kit/glass-wall.glb: 360 / 1500 triangles
PASS kit/glass-post.glb: 108 / 1500 triangles
PASS kit/air-conditioner.glb: 204 / 1500 triangles
PASS kit/picture-frame.glb: 192 / 1500 triangles
PASS all registered models; embedded textures, palette UVs, materials, axes/origins, dimensions, budgets, lead hierarchy and loop endpoints.
PASS style-scene: 4 chairs face their desks; monitor fronts oppose chair fronts.
PASS layout: 1823 objects, 212 walls, 19/19 seat chairs; all other non-walkable footprints strictly blocked.
PASS approved exception: seat chairs are nonblocking visual assets, restricted to seats.json centres + faces.
WARN 169 blocked interior tiles have no non-walkable object coverage (listed in reports/uncovered-blocked-tiles.json).
PASS negative checks: wrong chair front, off-seat chair, missing chair, unknown model and walkable overlap are rejected.
```

## Review outputs

- `design/office-style/3d/previews/full-office-000.png`
- `design/office-style/3d/previews/full-office-090.png`
- `design/office-style/3d/previews/full-office-180.png`
- `design/office-style/3d/previews/full-office-270.png`
- `design/office-style/3d/previews/topdown.png`
- `design/office-style/3d/previews/topdown-overlay.png`
- `design/office-style/3d/previews/lineup-16.png`
- `design/office-style/3d/previews/lead-idle-strip.png`
- `design/office-style/3d/previews/lead-walk-strip.png`
- `design/office-style/3d/previews/lead-sit-strip.png`
- `design/office-style/3d/previews/lead-type-strip.png`
- `design/office-style/3d/previews/lead-sit-idle-strip.png`
- `design/office-style/3d/previews/lead-talk-strip.png`
- `design/office-style/3d/previews/lead-wave-strip.png`
- `design/office-style/3d/previews/lead-away-strip.png`
- `design/office-style/3d/previews/shiba-idle-strip.png`
- `design/office-style/3d/previews/shiba-walk-strip.png`
- `design/office-style/3d/previews/shiba-sit-strip.png`
- `design/office-style/3d/previews/shiba-type-strip.png`
- `design/office-style/3d/previews/shiba-sit-idle-strip.png`
- `design/office-style/3d/previews/shiba-talk-strip.png`
- `design/office-style/3d/previews/shiba-wave-strip.png`
- `design/office-style/3d/previews/shiba-away-strip.png`
- `design/office-style/3d/previews/robot-idle-strip.png`
- `design/office-style/3d/previews/robot-walk-strip.png`
- `design/office-style/3d/previews/robot-sit-strip.png`
- `design/office-style/3d/previews/robot-type-strip.png`
- `design/office-style/3d/previews/robot-sit-idle-strip.png`
- `design/office-style/3d/previews/robot-talk-strip.png`
- `design/office-style/3d/previews/robot-wave-strip.png`
- `design/office-style/3d/previews/robot-away-strip.png`

## Contract decisions and limits

- User-approved exception: the 19 seat chairs are nonblocking visual assets on the exact seats.json centres and faces. All other non-walkable objects stay entirely on blocked tiles.
- Thin details use a radius no greater than half their thickness; 0.03 cannot fit a detail thinner than 0.06.
- Visibility uses a zero-scale held-items group because core glTF has no node visibility property. Code restores the documented scale to show held props.
- The one-tile blind has a conditional panel-gap node to produce a three-tile panel repeat.
- Collision-driven positions, especially the manager desk 3.05 tiles forward, are documented in REQUESTS-3D.md. No collision cells were changed.
- Folding furniture is built but unplaced; the proposed future 15-tile corner requires a coordinated map/2D change. Flat card and ludo mats are placed and walkable.
- Uncovered blocked tiles are reported as warnings and remain blocked in the shared map.
- The user’s decided pastel palette supersedes the older two-palette preview instruction. palette-office.png is reference only.

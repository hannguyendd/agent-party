# Historical requests before G2

Current integration is in REQUESTS-3D.md; these preserve earlier future map-change proposals.

## Part F integration update (current)

Use the updated `manifest-models3d.json` registrations for the fixed-size workstation and spine models, compact MGR display/keyboard, office-chair-lavender, and meeting furniture. Both office-chair variants are unchanged seat-centre visual exceptions and must participate in the same seat rendering logic. Part F no longer instances the Part E scaled bridge/chair placements. Standard x/z/rot transforms are sufficient for the current layout.

Collision, the collision overlay and seats are frozen. The manager meeting corner uses existing blocked tiles, so it needs no pathfinding or map metadata change. No app, server, shared manifest or docs source was edited.

## Part E integration note

The curated layout uses optional `scale: [x, 1, z]` on five bottom desk-long bridges, the central desk-long seam, and the lounge armchair. Consumers must apply this before computing/rendering footprints, as `src/viewer.html` and `src/layout.ts` do. This needs no collision, seat, or manifest change. No application source was edited.

# Part D integration — current contract

This section supersedes the historical A–C notes below. The delivery has **20 seats**, including HR, a manager room reaching row 34, solid north walls, clear west windows, and two animated glass-door openings. All 34 authorized collision changes are listed at the top of REPORT.md and in reports/map-d12.json. No other collision cells were edited.

- Merge manifest-models3d.json; it registers every old and new model and the current layout. The shared manifest is untouched.
- Perimeter height is 3.3; frosted manager glass height is 2.8. West windows remain full height in review views so they can be seen through from outside. Their rolled fabric is confined to the top 0.35. Show panel-gap only where layout panelGap is true (repeatEvery=3, phase=2).
- Wall-mounted props have mount="wall", matching facing, wallId and y. Their origin is at the room-side wall face and centre bottom. They protrude <=0.12; deep props start >=1.7. Use wallId to coordinate visibility with their wall. All wall runs have decorative breaks within about four tiles.
- Door exceptions are walkable:true, exception="door", restricted to door-glass-double at (19.5,4.5), rot 0 and door-glass at (40.5,16), rot 90. Both have leaf-l / leaf-r hinge nodes and open / close clips, 0.6s, 85° inward. Play LoopOnce, clamp at the final pose, and trigger open before an agent crosses. They add no collision obstacles.
- Seat-chair exceptions are restricted to the 20 exact seats.json centres/faces. HR is (13.5,4.5), front south, with a shortened reception-desk and north-facing monitor. HR's top is 0.88 and has three plate-like items; all other 19 stations have 4–6 deterministic items at y=0.74. The +/-0.35 keyboard reach zone is clear.
- The 12-triangle floor tile uses UVs across a patterned palette cell for seams and straight grain. Other models retain colour-cell-centre UVs. Mint floor-manager tiles extend throughout the larger manager room. Both floors top out at y=0.
- Sun patches are flat, walkable:true, decal="sunlight", y=0.012 and vertex alpha 0.6. Fade toward eveningOpacity=0 in evening mode. The first patch is clipped to the inside north boundary.
- The 2D export is reproduced through python3 design/office-style/C/map/export-map.py. Its scoped Part D adapter preserves the prior seat records, unrelated pixels, 32-colour palette and foreground stack. HR's original chair, monitor, left plant and window frame remain pixel-identical.
- Door animation, cut-away, evening fading, pathfinding, indicators and the 3D theme UI remain app-owned. No dashboard/src or node-server code was edited by this asset task.

## Requests only: extra pieces in currently walkable open areas

These are **not placed and not blocked** in the delivered map. Each needs a coordinated 2D-plate/collision change before adding a raised model:

| Proposal | Exact candidate tiles to block | Reason |
|---|---|---|
| Central lounge set | x=20..23, rows 18..20 (12 tiles) | A compact sofa + side table would give the open middle a gathering spot; retain a clear aisle around it. |
| Extra meeting table | x=28..32, rows 7..9 (15 tiles) | A small shared table above M1/M2 would bring life to the large empty upper-middle area. |
| Plant island | x=34..35, rows 18..19 (4 tiles) | A two-pot island would soften the wide approach to the manager room without constricting its doorway. |
| Shoe rack beside entrance | (20,5), (21,5) | These are walkable today; a rack beside the actual entrance needs an explicit new footprint rather than visual obstruction. |

The older folding-game-night request also remains unplaced. Only D12's lower manager lounge and the HR entry gap/seat were authorized shared-map changes in this run.

---

# Historical A–C integration notes

# 3D theme assets

Palette is decided: **pastel**. `office/3d/palette.png` is pastel, and every self-contained GLB embeds those exact bytes. `palette-office.png` is reference only. All new review images use pastel.

## Assets and integration

Use `manifest-models3d.json` as the merge-ready `models3d` section. It contains `palette`, all 16 `characters`, all furniture `props`, all room `kit` models, and `layout: office/3d/layout3d.json`. The shared dashboard manifest and app source have not been edited.

- Load models at 1 unit per 32px tile. Y is up; +Z corresponds to down in seats.json. All roots are at floor level. Floor-tile top is exactly y=0 and its body is below it. Do not add a floor-height offset.
- Layout x/z are world tile coordinates, rot is degrees around Y, and optional y is a mounting/desktop height. Each floor-tile placement covers one map tile; all grain runs along Z. Rotations remain cardinal for furniture and architecture.
- Front: chair +Z points where its sitter looks; desk +Z is its sitting side; monitor +Z is its screen face. A desk and monitor have matching rotations; their chair has the opposite rotation. Walls carry `facing` for cut-away. The standalone gaming-chair is a spare chair stored on a blocked tile, not an additional seat.
- **Approved seat exception:** the user explicitly authorized nonblocking visual office-chairs on the 19 white/walkable seats.json tiles. These layout records have `walkable:true`, `exception:"seat-chair"`, and `seatId`. They must not add obstacles to pathfinding. Validation allows this exception only for office-chair at the exact seat centre, exactly once per seat, facing the seat's face. Every other raised object/wall is wholly on blocked collision tiles.
- `walkable:true` floor/rug/mat objects also leave the collision map unchanged. All other placement footprints are checked conservatively against the actual GLB world bounds, not hand-entered footprint sizes. Do not infer collision from mesh triangles or add obstacles for decorative characters.
- `wall-blind/panel-gap` carries repeatEvery=3, phase=2. Layout `panelGap` gives the per-instance visibility; show only every third node. This produces three-tile blind panels from the required one-tile kit. Glass uses vertex alpha on the shared palette material (no additional material or texture). Its frames remain opaque.
- Glass walls define the manager room at x=40.5, z=14.5..28.5. The upper-left doorway remains open between z=15 and 17. The entrance model is at tile (19,4), centre (19.5,4.5).
- The actual collision map forces the MGR desk 3.05 tiles in front of its chair. It is the nearest wholly blocked footprint along that seat's face. This preserves the shared map without pretending the desk can sit in the intervening walkable area. Improving the reach/desk gap requires an agreed 2D/collision revision. Pantry round-table shifts one tile left to (45.5,10.5) to fit its blocked patch. The large plant uses a blocked work-row patch; its footprint cannot fit the isolated single-tile plant mark near the pantry. See reports/layout-adjustments.json.
- Some blocked interior tiles have no mesh covering them. Validation warns and lists every such coordinate in reports/uncovered-blocked-tiles.json. Those tiles remain blocked in the shared collision map; no new obstacles were introduced to fill holes.

## Character node and clip contract

All 16 ids match dashboard/src/office/skins.ts. Every character has root `<id>` -> body -> leg-l, leg-r, torso, arm-l, arm-r, head; arm-r contains hand-r-socket; head contains head-top. Non-humanoid unused nodes stay empty. No skinning/skeleton or root-motion tracks. Standing height is 1.3–1.5 tiles, width <=0.9; head-top is 0.1 above the visible head.

Clips: idle (2s), walk (0.6s), sit (2s static), type (2s), sit-idle (2s static), talk (2s), wave (2s), away (2s static). All first/last keys match. Seated body is at y=0.5, z=-0.12; legs point forward 90 degrees; typing arms reach the y=0.74 desktop. Runtime moves/turns the character root and chooses the appropriate clip.

Held props under `hand-r-socket/held-items` are **hidden by default** with scale [0,0,0]. Extras include hiddenByDefault and shownScale [1,1,1]. Show by restoring the held-items group scale; never overwrite mesh transforms. These scales are not animated. No visibility extension is required.

## Request: folding game-night corner

The folding-table and folding-chair GLBs are built for review, but deliberately unplaced. Proposed future table centre is (33.5,20.5), with chairs around it. Reserve columns **32,33,34** and rows **18,19,20,21,22** (the 15 tiles in that rectangle) only after the 2D plate and collision map are changed together. They are currently walkable and remain so in this delivery. The card-mat at (33.5,20.5) and ludo-mat at (21,20.5) are flat, walkable decorations already placed now.

## App-owned work

Camera (orthographic elevation 0.86 rad), cut-away based on wall facing, lighting/evening mode, name tags on head-top, bubbles, status/typing dots, selection and destination indicators, pathfinding and the theme setting remain app work. The preview implements only review rendering; it is not dashboard code.

Thin details below 0.06 thickness use a radius bounded by half thickness; 0.03 cannot fit physically. The main rounded forms retain the intended toy/chibi proportions. These thin-detail radii and the approved seat-chair rule are the only deliberate departures.

The `desk-long` model is a bench extension between approved workstations, not a new seat. Extensions stay on existing blocked bank tiles, share the y=0.74 top, and allow opposite monitors to sit back to back without a tall divider. Their layout records carry `bank`; the original per-seat `station` desk/monitor/chair links remain intact.

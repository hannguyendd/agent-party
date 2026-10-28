# Codex prompts for the 3D Office theme

The Office gets a second, optional theme: a 3D "toy diorama" of the real office, rendered with three.js. The 2D
Phaser theme stays as it is; each person picks a theme in Settings. Both themes read the **same** world data
(tiles, seats, presence), so the 3D art must fit the existing 56×36 grid exactly.

Style reference: the approved prototype, `design/office-style/3d/reference/prototype.html` (open it through any
static server; it loads three.js from jsDelivr). It shows the fixed orthographic
camera at ~49°, chunky chibi characters built from rounded primitives, rounded furniture, walls that drop low
when they face the camera.

Hand the steps over in order and approve each one before the next. Codex works on assets only; anything that
needs code goes to `design/office-style/REQUESTS.md`, as with the 2D art.

---

## How the models are made (applies to every step)

No Blender and no image generation for models. Codex writes **bun/TypeScript build scripts** that assemble each
model from primitives and write binary glTF:

- Geometry: `three` (BufferGeometry primitives, `RoundedBoxGeometry`, `CapsuleGeometry`; geometry only, no WebGL).
- Writing files: `@gltf-transform/core` (+ `@gltf-transform/functions` for `dedup`, `weld`, `prune`). Do not use
  three's `GLTFExporter` (it needs browser APIs).
- Previews: a small static page that loads the `.glb` files with three.js, screenshotted headlessly with Playwright.
- Everything lives in its own package `design/office-style/3d/` (own `package.json`, not the dashboard's).
  `bun install && bun run build && bun run validate && bun run preview` must regenerate every output.

### Shared contract

| Rule | Value |
|---|---|
| Format | `.glb` (binary glTF 2.0), no Draco, no external files |
| Axes | Y up, model front faces **+Z** (+Z is "down" in `seats.json`, i.e. toward the bottom of the 2D map) |
| Scale | **1 unit = 1 tile (32 px)** |
| Origin | floor level, centre of the footprint. The walkable floor surface is y=0: `floor-tile` sits *below* it (top face at y=0), so props and characters stand at y=0 with no offset |
| Front | seats and chairs: the direction the sitter faces (toward the desk, the `face` in `seats.json`). Monitors: the screen side (faces the sitter, so a monitor and its chair have opposite rotations). Desks: the side the sitter sits on |
| Held items | items in `hand-r-socket` (mug…) are hidden by default; code shows them |
| Tris | character ≤ 3,000; furniture ≤ 1,500; small desk items ≤ 300 |
| Materials | one shared material `palette` that samples `palette.png` (256×256, flat colour cells, UVs point at cell centres); one optional `emissive` material for screens and lamp shades. No other textures, no PBR maps |
| Shape | rounded edges everywhere (radius ≥ 0.03), chunky proportions (legs and frames thicker than real life) |
| Names | node and file names are lowercase kebab-case and match the ids below exactly |

### Output layout

```
design/office-style/3d/
  package.json, tsconfig.json
  palette.json                 # named colours -> palette cells (two variants, see Step 0)
  src/primitives.ts            # rounded box, capsule, etc. -> gltf-transform meshes
  src/characters/<id>.ts       # one recipe per skin
  src/props/<id>.ts            # one recipe per prop
  src/build.ts, src/validate.ts, src/preview.ts
  previews/                    # turntables + scene renders (review only, not shipped)
dashboard/public/office/3d/
  palette.png
  characters/<id>.glb
  props/<id>.glb
  kit/<id>.glb
  layout3d.json
```

and a new `models3d` section in `dashboard/public/office/manifest.json` (leave every existing section unchanged):

```json
"models3d": {
  "palette": "office/3d/palette.png",
  "characters": { "lead": "office/3d/characters/lead.glb" },
  "props": { "desk": "office/3d/props/desk.glb" },
  "kit": { "wall-straight": "office/3d/kit/wall-straight.glb" },
  "layout": "office/3d/layout3d.json"
}
```

### Look: the real office as a toy diorama

From the team's office photos (reference only; the photos are not shared or committed, everything Codex needs
is written below):

- **Floor**: large square wood-look tiles, **one floor tile = one grid tile**. Each tile has fine straight grain
  lines running the same direction on every tile (no parquet alternation), separated by thin slightly darker
  seams. Do it as a tiny texture cell in the palette or as faint geometry seams, not a photo texture.
- **Walls**: plain warm white, with a squared column where two wall runs meet. A white split air-conditioner unit
  high on one wall.
- **Windows**: the whole outer wall is **floor-to-ceiling roller blinds**: tall light-grey panels side by side,
  each about 2.5–3 tiles wide, with a thin dark vertical gap between panels. No visible glass or view outside.

Colours sampled from the photos (fluorescent light, so treat as starting points and lift slightly):

| Surface | Hex |
|---|---|
| Floor tile | `#dcc18f` (seam `#c6a874`) |
| Wall | `#ecebe4` (photo reads `#dfddd1`) |
| Roller blind | `#cfd0ca`, shaded side `#b2b3ad`, gap `#3a3a3c` |
| Desktop | light maple, about `#e6d3b3` |
| Desk frame | `#f2f2ee` |
| Chair mesh | `#34343a` (photo `#2a2928`; never pure black) |
| Monitor | `#2a2c33`, screen glow `#8fc7e8` |
- **Desks**: long rows of light maple desktops on **white metal frames** (slim square legs). Desks in a row face
  each other with monitors back to back; there is **no tall divider**, only a thin low cable tray.
- **On the desks**: black monitors, many on **dual setups and gas-spring monitor arms**, black keyboards and mice,
  small wooden monitor risers or desk shelves, small potted plants, photo frames, water bottles, mugs, the odd
  figurine or flower decoration.
- **Under the desks**: black PC towers, white power strips (cables are suggested, not modelled strand by strand).
- **Chairs**: black mesh office chairs with five-star bases; one white gaming chair for variety.
- **Team life**: a white folding table with white folding chairs (game nights), a green felt card mat with chips,
  and a big colourful ludo (cờ cá ngựa) floor mat.

Characters stay the pastel chibi cast; they must **not** be likenesses of real teammates.

---

## Step 0: Tooling + style test

```text
Read docs/office/CODEX-PROMPTS-3D.md (contract, look, output layout) and look at the 2D map in
dashboard/public/office/map/ (background.png, collision.png, seats.json) and the prototype linked at the top.

Set up design/office-style/3d/ as described (bun package, three + @gltf-transform/core + functions, Playwright
for previews). Then build a STYLE TEST only:

1. palette.json with two variants that share the same cell layout, so swapping palette.png re-skins everything:
   - "office": the real-office look (warm white walls, honey floor, maple desks, white frames, black chairs and
     monitors) with peach / mint / lavender only as accents (plants' pots, cushions, mats).
   - "pastel": the current pastel-c look from the 2D plate (peach floor, sage, lavender, orange wood).
   Write palette.png for "office" by default and palette-pastel.png next to it.
   DECIDED after Step 0: "pastel" is the palette. palette.png is now the pastel variant; keep the office variant
   only as palette-office.png for reference. Later steps design and preview in pastel.
2. characters/lead.glb: the tech-lead skin (short dark hair, rolled sleeves, mug), with the node hierarchy and
   all animation clips from Step 1's contract.
3. props: desk.glb, monitor-dual.glb, monitor-arm.glb, keyboard.glb, office-chair.glb, pc-tower.glb,
   desk-plant.glb, mug.glb.
4. kit: floor-tile.glb (1x1, grain + seam), wall-straight.glb (1 tile long, 2.7 high, 0.6 thick),
   wall-blind.glb (1 tile of floor-to-ceiling roller blind; panels repeat with a dark gap every 3 tiles),
   wall-column.glb, wall-corner.glb.
5. previews/: a 360° turntable strip (8 angles) per model, a 4-frame strip of each animation clip for lead.glb,
   and one scene render: 2x2 desks facing each other with chairs, monitors and towers, the lead sitting and
   typing at one desk, a wall with roller blinds and a column behind, rendered with the prototype camera (orthographic, ~49°
   elevation) in BOTH palettes.

Do not touch dashboard code. Report: files written, tri counts, and the two scene renders.
```

---

## Step 1: The 16 characters

Attach the approved `lead.glb` previews.

```text
Using the approved lead.glb as the reference (same proportions, same node names, same clip names and timings),
build the other 15 skins into dashboard/public/office/3d/characters/. Ids must match dashboard/src/office/skins.ts:

dev-hoodie (hoodie with hood up at the back, headphones round the neck), designer (hair bun, round glasses,
orange sweater), lead (done), shiba (upright shiba, curled tail), cat (tabby, scarf), penguin (bow tie),
alien (green, three eyes, lab coat), robot (round body, screen face), mage "Coffee Mage", knight "Keyboard
Knight", ranger "Paper Ranger", healer "Band-Aid Healer", rogue "Donut Rogue", berserker "Debug Viking",
slime "Crowned Slime", dragon "Cardigan Dragon". Keep each one recognisable next to its 2D sprite in
dashboard/public/office/characters48/.

Node contract (every skin, even non-humanoids; unused nodes stay as empty nodes):
- root node named after the id, origin at the feet, facing +Z, total height 1.3–1.5, width ≤ 0.9.
- body (pivot at the hips, y≈0.34)
  - leg-l, leg-r (pivot at the hip joints)
  - torso
  - arm-l, arm-r (pivot at the shoulders, y≈0.76)
    - hand-r-socket (empty, where a held item goes)
  - head (pivot at the neck, y≈0.86)
    - head-top (empty, at the top of the head plus 0.1: the name tag and bubble anchor)
- No skinning or skeleton: parts are rigid meshes, animated by node rotation and translation.

Animation clips (glTF animations on those nodes, loopable, no root motion; code moves the root):
- idle (2.0 s): gentle breathing on torso scale, small head sway.
- walk (0.6 s per cycle, tuned for 3.4 tiles/s): legs ±35°, arms opposite, small body bob.
- sit: static pose for a chair whose seat top is at y=0.5 and whose centre is the root: body raised so the hips
  sit on the seat, legs forward 90°, body shifted back 0.12.
- type: sit pose, forearms forward to a desk top at y=0.74, fast small alternating arm motion.
- sit-idle: sit pose, relaxed arms (sofa, meeting room).
- talk: standing, one-arm gestures.
- wave: standing, one arm waving.
- away: sit pose, head drooped forward ~20°.

Validate: node names, clip names, height, tri count, every clip loops without a jump. Preview: one turntable per
skin, one lineup render of all 16, and one 4-frame strip per clip for three different skins.
```

---

## Step 2: Room kit, furniture and layout

```text
Build the rest of the office into dashboard/public/office/3d/props/ and kit/, then place everything in
layout3d.json. Follow the look section of docs/office/CODEX-PROMPTS-3D.md (real office as a toy diorama).

Kit: floor-tile, wall-straight, wall-corner, wall-column, wall-blind (floor-to-ceiling roller blinds on the
outer wall where the 2D map has windows), wall-door, glass-wall, glass-post, air-conditioner, picture-frame.

Props (ids are file names):
- Work area: desk (the approved one; add desk-long if a 2-seat top reads better), cable-tray, monitor-dual,
  monitor-single, monitor-arm, keyboard, mouse, monitor-riser, desk-shelf, pc-tower, power-strip, office-chair,
  gaming-chair, stool, desk-plant, photo-frame, water-bottle, mug, figurine.
- Entrance / HR: reception-desk, door-mat, cabinet.
- Pantry: fridge, counter, sink, coffee-machine, jar, round-table, bench, shelf.
- Manager room: sofa, armchair, coffee-table, whiteboard, floor-lamp, bookshelf, printer.
- Life: plant-large, plant-small, rug-*, folding-table, folding-chair, card-mat, ludo-mat.

layout3d.json:
{
  "version": 1,
  "grid": { "cols": 56, "rows": 36 },
  "objects": [ { "model": "desk", "x": 10.5, "z": 9.5, "rot": 90, "walkable": false } ],
  "walls":   [ { "model": "wall-blind", "x": 12.5, "z": 3.7, "rot": 0, "facing": "south" } ]
}
- x/z are tile coordinates in units (tile (8,9) has its centre at x=8.5, z=9.5), rot is degrees around Y in
  steps of 90 (or 45 for loose decor).
- Use dashboard/public/office/map/collision.png as the single source of truth. Every non-walkable object must
  sit only on black (blocked) tiles; walkable tiles stay free except for flat items marked "walkable": true
  (rugs, mats). The 2D and 3D themes share this grid, so do NOT invent obstacles the 2D map does not have.
- Every seat in seats.json gets an office-chair whose centre is the seat tile centre, turned so the sitter faces
  the seat's "face" direction, with a desk and a monitor in front of it.
- The pantry, the manager room (one doorway in the upper part of its left wall, glass walls) and the entrance
  door at tile (19, 4) stay where the 2D map has them.
- Each wall piece records which way it faces so the app can lower walls that face the camera.

The folding table, card mat and ludo mat need open floor. Place only the flat mats now (walkable). If the folding
table corner is wanted, write a request in design/office-style/REQUESTS.md naming the tiles it would block; the
2D plate and collision.png must change in the same batch.

Validate (fail the run on any of these): an object overlapping a walkable tile, a chair not on its seat, a seat
without a chair, an unknown model id, tri budgets. Warn on blocked interior tiles that no object covers.
Preview: the whole office from the prototype camera at the four 90° rotations, in both palettes, plus a
top-down orthographic render overlaid at 50% on background.png to check alignment.

Finally append a "3D theme assets" section to design/office-style/REQUESTS.md for the app owner: what was added,
the models3d manifest keys, the node and clip contract, and anything the code must know.
```

---

## What stays in code (not for Codex)

Camera, wall cut-away, lighting and the evening mode, name tags, typing dots, status badges, selection ring,
destination marker, pathfinding, and the theme switch in Settings. These follow ADR 0001 and the existing Office
behaviour; they are tracked as app work, not art.

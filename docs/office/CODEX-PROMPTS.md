# Codex prompts for the Office art

Hand these over in order. Approve **Step 1 (style test)** before the next step, and attach the approved images as the
reference. Full size specs: `docs/office/ASSET-BRIEF.md`.

> What actually shipped: steps 0 and 1–2 (characters), then the **map batch** (background plate, collision grid,
> seats) and the **UI batch** (icons, logo, bubbles, markers) described in `ASSET-BRIEF.md`. Steps 3–4 (tileset and
> separate objects) were replaced by the map plate. Codex works on assets only; code requests go to
> `design/office-style/REQUESTS.md`.

---

## Step 0: Room layout and character samples (first)

Samples to judge the look only; no sprite-sheet layout or exact pixels yet. Pick one direction (or a mix, e.g. "B's
colours with A's characters"), then hand over Step 1 with the chosen images. Direction C (pastel) was approved.

```text
Create STYLE SAMPLES for "Office", an original top-down 2D pixel-art virtual office where AI agents appear as cute
characters sitting at desks and walking around to talk to each other. I will pick one direction; nothing here is
final. Focus on the look of the ROOM LAYOUT and the CHARACTERS. Exact sprite-sheet layout is NOT needed yet.

Common to all directions:
- Top-down 3/4 view (classic 2D RPG camera), crisp pixel art on a 32 px grid, no anti-aliasing or blur.
- Original designs only; do not copy or closely imitate Pokémon, Gather, Stardew Valley or any other game.
- No text, logos or watermarks inside the images (I will add desk labels later).

The office floor plan (follow it closely; it is our real office). L-shaped desk area on the left, rooms on the right:

      [HR] [door]
  D1 | D2                    +----------------+
  D3 | D4                    |     Pantry     |   (walled room)
  D5 | D6     M1 | M2        +----------------+
  D7 | D8                    |  Manager Room  |   (walled room, glass or solid walls)
        D9 | D10| D11| D12   |                |
        D13| D14| D15| D16   |                |

- "X | X" = two desks back to back across a low divider (people face each other).
- Left vertical block: desks D1-D8 (2 columns x 4 rows). HR is an open spot above it with a single computer,
  and the entrance door is right next to HR, on its right.
- Bottom horizontal block: desks D9-D16 (2 rows x 4), its right end touches the Manager Room's left wall.
- Two more desks M1 | M2 stand in the middle of the open floor.
- Pantry (top right) has walls; Manager Room is below the Pantry.
- Leave generous walkways (about 3 tiles wide) and room around each desk for 2-4 extra stools, because several
  agents can sit around one desk.
- Add life: a few plants, a printer, a coffee machine and fridge in the Pantry, a sofa and whiteboard in the
  Manager Room, a door mat at the entrance.

Make 3 directions. For EACH direction produce in design/office-style/<letter>/:
1. office.png: the WHOLE office from above following the floor plan. Roughly 56 x 36 tiles; any resolution is
   fine for this sample (e.g. 1536x1024), but keep the pixel-art look. Put 6-8 characters in it: most sitting at
   desks, two walking toward each other with a small "..." speech bubble, a group of three standing together.
2. cast.png: 8 characters side by side facing the camera on a plain light background, each about 32x48 px at 1x
   (also save cast@4x.png scaled with nearest-neighbour): human developer in a hoodie, human designer with a hair
   bun and round glasses, human tech lead holding a mug, shiba dog on two legs, tabby cat with a scarf, penguin
   with a bow tie, green three-eyed alien in a lab coat, round robot with a screen face.
3. palette.txt: the palette as hex codes, at most 32 colours.

Directions:
- A "Cozy warm": warm wood and beige, soft orange accents, rounded shapes, friendly and calm.
- B "Clean tech": cool grey-blue and white, one teal accent, tidy modern office, sharper shapes.
- C "Pastel playful": soft pastels, chunkier chibi characters, bouncy and cute.

In your report, list the files and one sentence per direction on what makes it distinct.
```

---

## Step 1: Style test

Start the prompt with one line naming the chosen direction, e.g. `Use direction C "Pastel playful" from
design/office-style/C/ as the visual reference, with its palette.` Attach that direction's `scene@3x.png` and `cast@3x.png`.

```text
You are producing original pixel-art game assets for "Office", a top-down 2D virtual office where AI agents
appear as characters. This is a STYLE TEST: a small set that fixes the look for everything that follows.

## Style (applies to every image)
- Original top-down 3/4 view pixel art (classic 2D RPG camera: you see the top and the front face of objects).
- Grid 32x32 px. Crisp pixels: no anti-aliasing, no blur, no gradients, no noisy dithering.
- One limited palette of at most 32 colors, warm and friendly modern office mood. Write the palette you used to
  palette.txt as hex codes, one per line; all later assets must reuse it.
- Light from the top-left. 1 px outline on characters and furniture, a darker shade of the fill, never pure black.
- PNG with transparent background. Draw at 1x (1 image pixel = 1 game pixel). Exact sizes below, no upscaling.
- Everything must be an original design. Do not copy or closely imitate Pokémon, Gather, Stardew Valley or any
  other game's characters, tiles or UI. No text, logos or watermarks inside images.

## Deliverables (write to dashboard/public/office/)

1. characters/char-dev-hoodie.png: character sprite sheet, 128x240 px = 4 columns x 5 rows, frame 32x48 px,
   no gaps between frames. A cute chibi developer (big head, short body) in a blue hoodie with headphones around
   the neck. Same face, colors and proportions in every frame. Feet touch the bottom edge of each frame.
   - Row 0: walking down toward camera: left step, stand, right step, stand.
   - Row 1: walking left, same 4-beat cycle. (Do NOT draw walking right; the game mirrors row 1.)
   - Row 2: walking up, back view, same cycle.
   - Row 3: sitting facing down, sitting facing left, sitting facing up, standing and waving one hand.
   - Row 4: sitting and typing facing down (2 frames), standing idle breathing facing down (2 frames).

2. tiles/tiles-office-test.png: 256x64 px = 8 x 2 tiles of 32x32, packed with no gaps.
   - Row 0: office carpet grey-blue (3 variants that tile seamlessly together), light wood floor (2 variants),
     light floor tile (1), door mat (1), empty.
   - Row 1: wall in 3/4 view, 2 tiles tall split into top-edge tile and front-face tile; outer corner left;
     outer corner right; wall front with window; low desk divider horizontal; low desk divider vertical; empty.
   Floor tiles must repeat in every direction with no visible seams.

3. objects/objects-desk-test.png: 128x64 px, transparent, each object in its own grid cell:
   - Office desk for one person who sits facing up (64x32), at cells (0,0)-(1,0).
   - Same desk for a person facing down (64x32), at cells (2,0)-(3,0).
   - Monitor on (32x32) at (0,1), monitor off (32x32) at (1,1), office chair facing down (32x32) at (2,1),
     small stool (32x32) at (3,1).

4. preview.png: 320x192 px mock scene at 1x using only the assets above: a few floor tiles, a wall row,
   two desks facing each other across a divider, the character sitting at one desk and walking next to the
   other. This is only for review.

## How to produce
If you can generate images, generate them, then check and fix the exact pixel dimensions and grid alignment.
If you cannot, draw the pixel art programmatically (e.g. a Python script with Pillow that sets pixels from the
palette) and commit that script too under tools/office-assets/, so the assets can be regenerated.

## Before you finish, verify and report
- Each file has exactly the stated pixel size and an alpha channel.
- Character frames are consistent (same face and colors) and aligned to the 32x48 grid.
- Floor tiles tile seamlessly (show a 4x4 repeat of each in your report or a scratch image).
- palette.txt exists and every pixel of every image uses a palette color (or full transparency).
```

---

## Step 2: The other 7 skins

Attach the approved `char-dev-hoodie.png` and `palette.txt`.

```text
Using the approved style test as the reference (same palette from palette.txt, same proportions, outline, light
direction and the exact same 128x240 sheet layout as characters/char-dev-hoodie.png), draw 7 more original
character sheets into dashboard/public/office/characters/:

- char-designer.png: human designer, hair bun, orange sweater, round glasses.
- char-lead.png: human tech lead, rolled-up shirt sleeves, short beard, holding a mug.
- char-shiba.png: shiba dog standing on two legs, polo shirt.
- char-cat.png: tabby cat standing on two legs, scarf.
- char-penguin.png: penguin with a bow tie.
- char-alien.png: green alien, big head, three eyes, lab coat.
- char-robot.png: round-bodied robot whose face is a screen with pixel eyes.

Same row layout for every sheet: row 0 walk down, row 1 walk left (no walk right), row 2 walk up, row 3 sit
down / sit left / sit up / wave, row 4 type x2 + idle x2. Frame 32x48, feet on the bottom edge, no gaps.
All 8 characters must look like one cast from the same game; silhouettes should be easy to tell apart.
Original designs only. Verify sizes, alpha, palette and frame consistency, then add a preview image of all 8
standing in a row (characters/preview-cast.png).
```

---

## Step 3: Tileset and desks (superseded by the map plate)

```text
Using the approved palette and style, produce:

1. dashboard/public/office/tiles/tiles-office.png: 32x32 tiles, sheet 256 px wide, packed with no gaps:
   office carpet grey-blue x3, light wood (pantry) x2, warm carpet (manager room) x2, light floor tile x2,
   door mat x1; walls in 3/4 view (top edge + front face), inner and outer corners (4), wall end caps,
   wall with window x2, glass wall for a manager room x3; door opening in a horizontal wall and in a vertical
   wall; low desk divider horizontal, vertical and end cap. Include the tiles from the style test unchanged.

2. dashboard/public/office/objects/objects-desks.png: desk facing up (64x32), desk facing down (64x32),
   monitor on / off (32x32 each), office chair in 4 directions (32x32 each), stool (32x32),
   6 desk props (coffee mug, small plant, paper stack, laptop, desk lamp, toy figure; 32x32 each),
   blank desk name plate (32x16).

Write a tiles-office.json listing each tile/object name with its pixel rect, so the game can reference them by name.
Verify seamless floors (4x4 repeat preview), sizes, alpha and palette.
```

---

## Step 4: Pantry, manager room, decor (superseded by the map plate)

```text
Using the approved palette and style, produce sheets in dashboard/public/office/objects/, each object in its
own grid-aligned cell, transparent background, plus an objects-*.json with name -> pixel rect:

- objects-pantry.png: kitchen counter 96x64, fridge 32x64, coffee machine 32x32, sink 32x32,
  water cooler 32x64, round table 64x64, bar stool in 2 directions 32x32, microwave 32x32.
- objects-manager.png: large executive desk 96x64, executive chair 32x32, two-seat sofa 64x32 in 2 directions,
  bookshelf 64x64, whiteboard 64x64, large plant 32x64, rug 96x64.
- objects-decor.png: 3 potted plants 32x64, printer 32x32, trash bin 32x32, wall clock 32x32,
  3 generic posters 32x32 (no real logos or text), HR station (small desk with a PC) 64x64,
  double entrance door open and closed 64x64 each.
```

---

## Step 5: UI and effects

```text
Using the approved palette, produce pixel-art UI pieces in dashboard/public/office/ui/ (transparent PNG, no text
inside images; the game renders all text):

- ui-ring.png: two 32x16 floor ellipses under a character's feet: plain WHITE (the game tints it with the
  owner's colour) and a thicker "selected" ring.
- ui-label.png: 24x12 nine-slice name-tag background, rounded, semi-transparent dark.
- ui-bubble.png: 24x24 nine-slice speech bubble, an 8x8 tail, and three 16x8 frames of animated "..." dots.
- ui-status.png: seven 16x16 status icons in a row: working (gear), needs approval (!), calling owner (bell),
  error (x), owner away (z), done (check), assignment waiting (clipboard).
- ui-host.png: 16x16 host badge (small crown).
- ui-party.png: 48x48 nine-slice dashed floor circle that surrounds a group.
- ui-target.png: three 32x32 frames of a pulsing floor target marker.
- ui-menu.png: 24x24 nine-slice context-menu panel plus seven 16x16 icons: inquiry (magnifier), assignment
  (wrench on clipboard), invite to party (person with plus), back to desk (house), open conversation (bubble),
  recap (notebook with check), hand off host (crown with arrow).
- ui-card.png: 32x32 nine-slice confirmation card plus two 48x16 buttons (accept: green, decline: neutral).
- app-icon.png: 128x128 app icon (a friendly character face in front of a tiny desk) and app-icon-64.png 64x64.

Write ui.json with name -> pixel rect (and nine-slice insets). Verify sizes and palette.
```

---

## Step 7: Eight more characters, a playful fantasy batch (48x72, same cast)

Attach `design/office-style/C/characters48/sheets-review.png`, `poses-review.png`, one existing sheet (for example
`dashboard/public/office/characters48/dev-hoodie.png`) and `design/office-style/C/palette.txt`. Assets only: no
application code. After delivery the code side adds the eight ids to `SKINS` (world.py, skins.ts).

```text
Add EIGHT more original characters to the Office cast. They must look like the same game as the existing eight in
dashboard/public/office/characters48/ (dev-hoodie, designer, lead, shiba, cat, penguin, alien, robot): same palette
(design/office-style/C/palette.txt), same chibi proportions (big head, short body), same 1 px outline in a darker
shade of the fill (never pure black), light from the top-left, crisp pixels with no anti-aliasing, no blur, no
gradients, no dithering and no partial alpha. Assets only: do not edit any application code.

## The eight characters (ids are file names; keep them exactly)
A playful "fantasy office" batch: classic fantasy and battle-arena ROLES (mage, tank, ranger, healer...) mixed
with office life. Each one is an ORIGINAL design built from the role, never a likeness of any existing
champion, hero or mascot. Keep them cute and funny, office-friendly.
- mage: tiny wizard with an oversized starry hat that keeps slipping over one eye, robe over a hoodie, a glowing
  coffee mug instead of an orb (two small floating sparkles around it).
- knight: chubby armoured knight with the visor up, a lanyard badge hanging on the breastplate, carrying a
  keyboard like a shield.
- ranger: hooded archer in a forest-green cape, a quiver full of rolled-up papers and pens instead of arrows.
- healer: cheerful cleric in white and gold, holding a big band-aid wand; a little heart floats up when waving.
- rogue: masked ninja-thief in dark purple, sneaking a donut; scarf tails flutter while walking.
- berserker: small horned-helmet viking with a huge beard, holding a rubber duck (the debugging duck) like a trophy.
- slime: round mint slime with a tiny crown, bouncing walk (squash on the stride frames), drips a little when typing.
- dragon: baby dragon standing on two legs, tiny wings, wearing an oversized office cardigan, a small puff of
  smoke when waving.

Every silhouette must be easy to tell apart from the others AND from the existing eight at a glance (colour,
shape, headwear, held object). Original designs only: do not copy or closely imitate characters from Pokémon,
Gather, Stardew Valley, Animal Crossing, League of Legends, Dota, Overwatch or any other game or franchise. No text, logos or watermarks in sprites.

## Deliverables
1. dashboard/public/office/characters48/<id>.png for each id: sprite sheet 192x360 px = 4 columns x 5 rows of
   48x72 frames, transparent, no gaps between frames. Same frame order as the existing sheets:
   - Row 0 (frames 0-3): walk down toward camera: stride, stand, opposite stride, stand.
   - Row 1 (4-7): walk left, same 4-beat cycle. Do NOT draw walking right; the game mirrors row 1.
   - Row 2 (8-11): walk up, back view.
   - Row 3 (12-15): sit facing down, sit facing left, sit facing up, standing and waving one hand.
   - Row 4 (16-19): sitting and typing facing down (2 frames), standing idle breathing facing down (2 frames).
   Feet (or the slime's base) touch logical y=70 in every frame; the last pixel row (y=71) stays transparent.
   One scale per character for all its poses; seated poses are naturally shorter. Same face, colours and
   proportions in every frame. Walk frames and the two typing frames must really differ (not duplicates).
2. dashboard/public/office/characters/<id>-portrait.png for each id: 32x48 px, transparent, the character standing
   and facing the camera, drawn natively at 32x48 (not a blurry downscale), like the existing *-portrait.png files.
3. Add the eight sheets to dashboard/public/office/manifest.json under "characters48" (same key = id, value =
   "office/characters48/<id>.png"), keeping every existing entry unchanged.
4. design/office-style/C/characters48-batch2/: the high-resolution sources, one prompt file per character, an
   export script (Pillow) that reproduces the sheets and portraits, validation.json, poses-review.png (front, left,
   back, sit, wave, type for each new character) and cast-review.png (all SIXTEEN characters standing in a row, at
   2x, on both a light and a dark background, so the new ones can be judged next to the old ones).
5. Append a short section to design/office-style/REQUESTS.md: the eight new ids and their display labels (for the
   skin picker), and anything the code must know.

## Verify and report before you finish
- Every sheet is exactly 192x360 with 20 frames of 48x72; every portrait is exactly 32x48; all have an alpha channel
  and only fully opaque or fully transparent pixels.
- Every opaque pixel uses a colour from palette.txt.
- Bottom contact at y=70 in every standing/walking frame; y=71 transparent.
- Existing files (the original eight sheets, portraits and the rest of manifest.json) are unchanged (compare
  hashes and say so in validation.json).
```

---

## Step 8: A desk seat in the Manager Room (not needed: done without new art)

The existing armchair became seat `MGR` directly (see design/office-style/REQUESTS.md). Kept only in case the armchair
is ever replaced by an office chair.

Attach `dashboard/public/office/map/background.png`, `collision@16x.png`, `seats.json` and
`design/office-style/C/palette.txt`. Assets and map metadata only: no application code. After delivery the code side
adds the desk id `MGR` (world.py `DESKS`, the dashboard's fallback desk list).

```text
Edit the existing office map plate in dashboard/public/office/map/ (background.png 1792x1152, 56x36 tiles of 32 px,
with foreground.png, collision.png and seats.json). Assets and map metadata only: do not edit application code.

Goal: the Manager Room (bottom right, the room with the whiteboard, sofa and the large desk with a monitor) gets a
real desk seat like the 18 desks in the open office, so the manager can claim it as their desk.

1. Behind the manager's large desk, replace the green armchair with the SAME office chair used at the open-office
   desks D1-D16 (same sprite style, size and colours; take it from the existing plate), facing the desk. Keep the two
   grey visitor chairs in front of the desk, the rug, the plant and everything else exactly as they are.
2. foreground.png: if the chair back should cover a seated character like at D1-D16, copy those pixels the same way
   the existing foreground was made (pixels copied from background.png). Background and foreground stacked without
   agents must stay pixel-identical to background.png alone.
3. collision.png (56x36): mark the chair tile red (seat), keep it reachable from the room's doorway, and change no
   other tile.
4. seats.json: append one entry, keeping all 18 existing entries unchanged:
   {"id": "MGR", "seat": {"x": <chair tile x>, "y": <chair tile y>}, "face": "<towards the desk>",
    "extras": [three walkable tiles next to the seat, like the other desks]}
5. Update design/office-style/C/map/ (export script, collision@16x.png review image) so the plate stays reproducible,
   and append a short section to design/office-style/REQUESTS.md: the new desk id MGR, its seat tile and facing.

Style: same palette (palette.txt), same top-left light, crisp pixels, no anti-aliasing, no blur, no gradients, no
partial alpha. No text or labels in the art (desk labels are drawn by the code).

Verify and report: image sizes unchanged; only the pixels of the chair area changed in background.png (say how many);
collision.png differs from the old one only at the new seat tile; the MGR seat is reachable by a path from the
entrance (blue tile) through the Manager Room doorway; seats.json is valid JSON with 19 entries.
```

# Office style samples

Exploratory visual directions generated with the built-in image_gen tool.

- A — Cozy warm: beige, warm wood, soft orange, rounded silhouettes.
- B — Clean tech: grey-blue, white, teal, sharp modern furniture.
- C — Pastel playful: peach, mint, lavender, chunky chibi silhouettes.

Each folder contains office.png (1792×1152), cast.png (336×64),
cast@4x.png (1344×256, exact nearest-neighbour enlargement), palette.txt
(32 shared hex colors), and prompts.txt. Cast characters fit within approximately
32×48 pixels each. The room canvas corresponds to 56×36 nominal 32-pixel tiles.

The images are style concepts, not final tilemaps or sprite sheets. Generated
room layouts retain some drift in desk counts and seated-character placement;
the chosen direction needs an exact layout pass before production. The request's
eight-character cap allows three seated plus two walking plus three standing,
so seated workers cannot be a majority simultaneously.

Prompts are preserved per direction; sources.json records local generated source
paths. export_samples.py reproduces pixel-size and shared-palette exports from
those sources. Palette matching uses no dithering; all enlargement uses nearest
neighbour. No application code was changed.

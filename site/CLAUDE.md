# site

The public intro page for Party Agent: the repo's About link, published to GitHub Pages
(`https://hannguyendd.github.io/agent-party/`). It is a marketing page with a playable demo, not part of the
product: nothing here talks to a node, the mesh or the world server, and every agent on it is made up.

## Files

- `index.html`: markup only; `style.css`: all styles; `app.js`: the page around the demo, in five parts with a
  comment each (`stars`, `pageLayout`, `welcome`, `mapControls`, `officeLife`). The page has two layers:
  - the **intro** (`#intro`): logo, the name "Party Agent" dropping in letter by letter, **Come in**, a parade of
    walking characters. Come in (click anywhere or any key) shrinks the name to the middle and turns it into the
    loader (`.intro.loading`); when the office is ready the letters fly off (`.intro.done`) and the intro hides.
    `#office` in the URL skips the welcome and goes straight to loading.
  - the **office**: header (brand, GitHub, Star with a live count from the GitHub API), a chip bar (live stats,
    key hints, 2D/3D), the map, a bottom bar (office gossip + the crew), and the side panel (slogan, Play now,
    What happens here, House rules).
- `office.js`: the demo simulation, exposed as `window.AgentParty.start()`. `officeSim` holds 12 made-up agents
  (nicknames like Segfault, Flexbox, Root, with a role each) seated at real seats from `seats.json`; they walk to
  each other with A* over `collision.png`, talk in typing dots, take coffee breaks, and go back. The visitor's
  character (`You`) spawns at the door on the first WASD key or floor click; `E` says hi to the agent in reach.
  `mapView` draws the map and sprites with DOM elements. `addView()` lets another renderer follow the same sim.
- `office3d.js`: the real 3D view (ES module, three.js r160 from jsDelivr through the import map in `index.html`),
  loaded on first use of the 3D switch. It reads `office/3d/layout3d.json` and `models.json`, instances every
  repeated model (floor tiles, walls, desk sets), lowers the walls on the camera's side, and gives each simulated
  agent its 3D character with the clips `walk / type / sit-idle / talk / idle / wave`; name tags and typing dots
  are DOM labels projected from the 3D positions. Clicking the floor walks you there. The camera orbits the office
  centre: wheel zooms toward the pointer, drag rotates, right-drag / Shift+drag pans when zoomed in, and the walls
  facing the camera drop low whichever way it turns. It is built hidden in the background
  1.5 s after the office shows, so the 3D switch is instant; a progress pill shows if it isn't ready yet.
- The 2D map zooms and pans too (CSS transform on `#office`, wheel / drag / the +, −, fit buttons). A drag never
  counts as a floor click.
- **Follow** (the target button, 2D and 3D): while zoomed in, the camera keeps the visitor's character centred.
  Spawning or walking with the keys turns it on; panning by hand turns it off.
- In 3D the keys turn with the camera (`sim.inputTurn`, snapped to 90 degrees): W always walks up the screen.

## Rules

- **No build step.** Plain HTML/CSS/JS (old-browser-safe in `app.js` and `office.js`; `office3d.js` is a modern
  ES module); fonts from Google Fonts. The only library is three.js, pinned in the import map, 3D only.
  `oxlint` does not cover this folder, so check the console in a browser.
- **Art paths are named directly** (the one exception to "code reads the manifest", see the root CLAUDE.md):
  `office/map/{background.png,collision.png,seats.json}`, `office/characters48/*.png` (48x72 sheets, 4 columns x 5
  rows), `office/characters/*-portrait.png`, and `office/ui/{logo@2x,typing,desk@2x,inquiry@2x,assignment@2x,
  party@2x,takeover@2x}.png`. `scripts/build-site.sh` copies `map`, `characters`, `characters48` and `ui` from
  `dashboard/public/office`; if the page needs another folder, add it there too.
- **Keys belong to the intro until the office shows**: `office.controls(view)` is attached on reveal, so WASD on
  the welcome screen enters instead of spawning the character.
- **Per-frame code writes the DOM only when a value changed** (the 2D actors, the 3D labels, the stats). Keep it
  that way; the canvas is resized only on resize, not every frame.
- **The map always fits between the chip bar and the bottom bar**: `pageLayout()` in `app.js` sizes the left
  column from the height (ResizeObserver on the main area and both bars); CSS (`.mapfit`, container units) does
  the rest. Don't size the map anywhere else.
- **3D needs the 3D office art.** `scripts/build-site.sh` copies `dashboard/public/office/3d` when it exists and
  writes `office/3d/models.json` (which folder each model is in). Without it, or if WebGL or a model fails, the
  3D switch falls back to tilting the 2D map (`setTilt`). So the page works before and after the 3D art lands; when
  it is merged into `develop`, Pages republishes with real 3D by itself. The asset contract (1 unit = 1 tile,
  front = +Z, clip names) is in `design/office-style/3d/README.md`; if it changes, update `office3d.js`.
- Models load 6 at a time with one retry (a burst of 100+ requests resets simple local servers).
- **Links**: Play now goes to the README's `#install`; GitHub and Star to the repo. If the repo moves, change
  `REPO` in `app.js` and the links in `index.html` (and the URL in `.github/workflows/pages.yml`, the README and here).
- English copy, playful but plain. Reduced motion: every animation has a static fallback; keep it that way.

## Preview and publish

```sh
make site                  # assembles dist/site like the workflow does and serves it at http://localhost:8090
OFFICE_3D_DIR=../internal-agent-fleet-3d/dashboard/public/office/3d make site   # with 3D art from another worktree
```

Check desktop and phone width: the intro, Come in, walking with WASD and saying hi with E, 2D/3D (with and
without the 3D art).

Publishing is automatic: a push to `develop` that touches `site/`, `dashboard/public/office/` or
`scripts/build-site.sh` runs `.github/workflows/pages.yml`. One-time repo setup (an admin): **Settings → Pages →
Source: GitHub Actions**, then put the Pages URL in the repo's About website. Re-run by hand with
`gh workflow run pages.yml --ref develop`.

## When the 3D art is final (to do)

The 3D view is built and tested against the work-in-progress art in the `internal-agent-fleet-3d` worktree
(commit `b886b9b`, with uncommitted model edits at the time). When that art is final and merged into `develop`:

1. Preview first: `OFFICE_3D_DIR=../internal-agent-fleet-3d/dashboard/public/office/3d make site`, or just
   `make site` once it is on `develop`.
2. Check the contract `office3d.js` relies on still holds (`design/office-style/3d/README.md`): 1 unit = 1 tile,
   front = +Z, origins on the floor; folders `props/`, `kit/`, `characters/`; `layout3d.json` with `objects`
   (`model, x, z, rot, y`) and `walls` (`facing` = north / south / east / west); clip names `idle, walk, sit, type,
   sit-idle, talk, wave`. If any of these change, update `FACE`, `FACING`, `clipFor()` or the loaders.
3. Every skin used in `office.js` (`AGENTS` and `PLAYER`, which is `alien`) needs a 3D character; a missing one
   falls back to the first that loaded.
4. Look at: seated agents sitting on their chairs (not floating or sunk), the walls dropping on the camera side at
   all four rotations, held mugs staying hidden, no 404s in the console, and the frame rate on a laptop.
5. Merge: Pages republishes on its own because `dashboard/public/office/` changed.

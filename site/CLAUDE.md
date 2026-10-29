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
  character (`You`) spawns at the door on the first WASD key or floor click; `E` next to an agent makes it say one
  of its `lines` (three per agent, in character) in a speech bubble, and `E` again gets the next one.
  `mapView` draws the map and sprites with DOM elements. `addView()` lets another renderer follow the same sim.
- `office3d.js`: the real 3D view (ES module, three.js r160 from jsDelivr through the import map in `index.html`),
  loaded on first use of the 3D switch. It reads `office/3d/models3d.json` and `layout3d.json`, instances every
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
- **3D uses the Office's 3D art** (`dashboard/public/office/3d`, copied by `scripts/build-site.sh`; ADR 0004).
  The camera (35 degrees, start turn -0.42) and the wall cut-away match the dashboard's 3D Office
  (`dashboard/src/office/three/`). If WebGL or the art fails, the 3D switch tilts the 2D map instead. The asset
  contract is in `design/office-style/3d/README.md` (1 unit = 1 tile across, heights x1.7, front = +Z, placements
  may carry `scale`, characters keep their own materials); if it changes, update `office3d.js`.
- **The 3D characters are heavy** (~1.4 MB each, ~18 MB for the 13 skins the page uses). The background build runs
  only on a computer (`pointer: fine`, wider than 900px) without Save-Data; phones load 3D on first use.
- Models load 6 at a time with one retry (a burst of 100+ requests resets simple local servers).
- **Links**: Play now goes to the README's `#install`; GitHub and Star to the repo. If the repo moves, change
  `REPO` in `app.js` and the links in `index.html` (and the URL in `.github/workflows/pages.yml`, the README and here).
- **The side panel scales with its own width** (container queries in `style.css`): on wide screens the text grows
  and the lists spread into rows instead of leaving the right half empty.
- English copy, playful but plain. Reduced motion: every animation has a static fallback; keep it that way.

## Preview and publish

```sh
make site                  # assembles dist/site like the workflow does and serves it at http://localhost:8090
OFFICE_3D_DIR=<other worktree>/dashboard/public/office/3d make site               # with 3D art from another worktree
```

Check desktop and phone width: the intro, Come in, walking with WASD and saying hi with E, 2D/3D (with and
without the 3D art).

Publishing is automatic: a push to `develop` that touches `site/`, `dashboard/public/office/` or
`scripts/build-site.sh` runs `.github/workflows/pages.yml`. One-time repo setup (an admin): **Settings → Pages →
Source: GitHub Actions**, then put the Pages URL in the repo's About website. Re-run by hand with
`gh workflow run pages.yml --ref develop`.

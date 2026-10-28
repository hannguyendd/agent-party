# Pastel Office 3D

Run `bun install`, `bun run build`, `bun run validate`, `bun run preview` inside this package. Playwright Chromium is installed with `bunx playwright install chromium`. Geometry uses Three primitives and glTF-Transform; previews use the actual GLBs in a read-only ephemeral static server.

The decided default is **pastel**: `palette.png` and every embedded model palette use pastel. `palette-office.png` is retained solely as reference, never used in new previews. Both variants use identical 256×256 cell layouts.

The walkable floor is y=0. `floor-tile` extends downwards; its highest vertex is y=0. All character and prop origins are at the floor, with no preview offsets. Desk top y=0.74; chair seat top y=0.5. Character front and chair front are +Z (the sitter looks toward the desk). Monitor screen and desk sitting side are +Z, opposite the chair rotation. `src/style-scene.json` drives both the style scene preview and orientation validation.

## Held-item visibility

`hand-r-socket` is an empty transform. Its `held-items` child has scale `[0,0,0]`, with extras `{hiddenByDefault:true, shownScale:[1,1,1]}`. Mug geometry lives below this child, so it is hidden in ordinary glTF viewers without requiring a visibility extension. Code shows it by setting `held-items.scale` to `[1,1,1]`, and hides it with zero scale. Animations never target this scale. Children keep their intended local transforms.

## Geometry and integration details

Thin grain, seams, screen faces, keyboard rows, facial details and other trim below 0.06 thickness use a radius bounded by half their thickness; the 0.03 radius requirement is physically impossible on those details. Main forms use rounded boxes and beveled circular primitives. `wall-blind/panel-gap` is shown only on the third instance of each three-tile panel (`extras.repeatEvery=3`, `phase=2`).

All clips have matching first/last keys, no root motion and rigid parts. Walk lasts 0.6 s; other clips last 2 s, including static seated poses. The preview gallery is `previews/index.html`. Source/file changes, validation logs and model triangle counts are captured separately for Parts A, B and C in `reports/`. Integration requests go only into `REQUESTS-3D.md`.

## Full office

`layout3d.json` contains the 56×36 shared-grid placements, including one floor-tile per office floor cell and one nonblocking visual chair per seat. `REQUESTS-3D.md` records the user-approved seat exception, collision-driven furniture adjustments, folding-table request and app integration details. Build + validate + preview completed in order for Parts A, B and C; checkpoint evidence is in `reports/part-{a,b,c}-*.json` and `reports/part-{a,b,c}-validate.txt`.

The final gallery includes four full-office camera rotations, the top-down 50% overlay on the original background, the labelled 16-skin lineup and eight clip strips each for lead, shiba and robot. The orthographic top-down camera maps exactly 56×36 units to the original 1792×1152 pixels.

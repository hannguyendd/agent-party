# Part H — character shape and colour pass

All 16 character GLBs rebuilt in the Part H worktree. No commits or branch switches. Shared furniture palette, build/validate entry points, layout, props, kit, manifests, README and REPORT were not changed.

## Reproduce

Run from design/office-style/3d:

```sh
bun install
bun src/chars-build.ts
bun src/chars-preview.ts
bun src/chars-validate.ts
bun src/chars-report.ts
```

The independent builder is authoritative for these new GLBs. The pre-existing general builder still uses its original recipes; rerunning it would overwrite these characters. Integration into that builder is outside Part H ownership.

## Measurement

Actual Three.js/GLTFLoader orthographic renders at 48×72; front +Z, side +X, Y up. Camera uses square pixels and one source-derived scale per skin (2.52 / opaque sprite height). Feet sit at the bottom row. No horizontal camera fitting compensates for width compression. Both masks use alpha >127. Front = frame18. Left frame selected deterministically from frames4–7 by the smallest summed foot-row spans at rows64–70; ties use the earliest frame. Back colour lookup uses frame10.

Part F baseline comes from this worktree's HEAD GLBs and is normalized to the same 2.52 standing height, with feet at zero, before using the identical camera. Baseline files are retained in previews/chars/baseline. This removes scale as a confounder, not silhouette differences.

Each comparison sheet is sprite | render | overlay, front above side. Overlay: green intersection, pink sprite-only, blue render-only. Raw measurements: [silhouettes.json](previews/chars/silhouettes.json).

## IoU and geometry

| Skin | Front F → H | Side F → H | Left frame | Triangles F → H |
|---|---:|---:|---:|---:|
| dev-hoodie | 0.716 → 0.974 | 0.650 → 0.890 | 7 | 1988 → 2456 |
| designer | 0.688 → 0.973 | 0.532 → 0.873 | 5 | 1716 → 2456 |
| lead | 0.736 → 0.978 | 0.586 → 0.885 | 7 | 1664 → 2408 |
| shiba | 0.638 → 0.975 | 0.499 → 0.875 | 7 | 1492 → 2448 |
| cat | 0.587 → 0.970 | 0.425 → 0.811 | 5 | 1572 → 2368 |
| penguin | 0.522 → 0.842 | 0.400 → 0.836 | 4 | 1560 → 1952 |
| alien | 0.603 → 0.924 | 0.543 → 0.871 | 7 | 1524 → 2088 |
| robot | 0.586 → 0.954 | 0.482 → 0.894 | 5 | 1392 → 1768 |
| mage | 0.630 → 0.950 | 0.456 → 0.861 | 5 | 1376 → 1848 |
| knight | 0.603 → 0.923 | 0.503 → 0.905 | 5 | 1832 → 2032 |
| ranger | 0.618 → 0.963 | 0.518 → 0.889 | 5 | 1952 → 2056 |
| healer | 0.634 → 0.936 | 0.501 → 0.862 | 5 | 1924 → 2248 |
| rogue | 0.668 → 0.969 | 0.539 → 0.894 | 7 | 1992 → 2008 |
| berserker | 0.628 → 0.950 | 0.404 → 0.875 | 7 | 1604 → 2288 |
| slime | 0.635 → 0.917 | 0.552 → 0.836 | 5 | 1272 → 1736 |
| dragon | 0.688 → 0.952 | 0.490 → 0.830 | 5 | 1556 → 2008 |

Every skin clears front ≥0.80 and side ≥0.70. The penguin has the lowest front match: its source is unusually wide relative to its opaque height. Keeping height ≥2.35 and width ≤1.7 requires narrowing the broad middle. Per-row envelope limits retain the narrower crown and feet instead of shrinking the whole silhouette.

## Changes

- Replaced shared box-oriented character geometry with smooth elliptical cross-section lofts measured independently against each sprite. Every main head has 24 circumferential segments and at least 18 latitude bands. Rounded, tapered torsos, short trousers, separate shoes, sleeves and mitten meshes remain independently articulated.
- Head boundaries vary by skin so fantasy hats/hoods, animal heads and the slime dome remain attached to the head rather than splitting their faces across torso geometry. Separate rounded ears/horns on shiba, cat and berserker retain the gap between the tips. Human napes use three overlapping rounded locks.
- Added raised dark oval eyes and small light highlights for 15 skins. Robot retains its distinctive curved smiling screen eyes from the source. The mage's obscured right eye remains hidden by the hat. Mouths, blush, glasses, strings, pockets, collars, belts, visor, crown, wings and other small markings preserve their exact source pixel layout through the dedicated palette lookup.
- palette-characters.png embeds front/back/side sprite-sampled colour panels plus unique RGB swatches. The JSON documents the panel layout and exact colours. Transparent margins are extended with nearest opaque row colours to prevent black seams. Each GLB embeds this PNG and has no external texture dependency. The shared palette is untouched.
- Rebuilt idle (2s), walk (0.6s), sit, type, sit-idle, talk, wave and away. All have exactly matching first/last keys and no channels targeting the root. Seated body/hip height is 0.9. Typing sockets sit at 1.335; actual mitten centres are checked as well. Right-hand props have scale zero and hiddenByDefault extras.

## Verification and previews

[contracts.json](previews/chars/contracts.json) contains per-skin world-space bounds, triangle counts, seated height and typing hand measurements. Validation passes with no contract errors or silhouette gaps. Standing height is 2.52, maximum width is ≤1.665, and triangle counts include hidden props. Feet are at Y=0.

- [16-character lineup](previews/chars/lineup-16.png), ordered dev-hoodie, designer, lead, shiba, cat, penguin, alien, robot; mage, knight, ranger, healer, rogue, berserker, slime, dragon.
- [Four seated at 1.33-high desk blocks](previews/chars/seated-4.png), with 0.9-high seat surfaces.
- [Four walking](previews/chars/walking-4.png).
- Sixteen individual <id>-vs-sprite.png sheets and individual front/side rendered masks.

## Remaining style limitations

The colour treatment deliberately preserves the source pixel artwork on rounded geometry. Fine clothing markings, glasses rims, visor markings, hood openings, several fringes and mouth/blush shapes are palette surface details rather than individually modelled volumes. Hair is not strand-sculpted; the broad head/hair/hat/hood envelopes are measured lofts, with separate nape locks and selected ear/horn volumes. Thus the requested fully multi-volume treatment for every hairstyle is only partially met. The silhouette and runtime contracts pass, but these assets still read as rounded 3D interpretations of pixel sprites rather than fully smooth, hand-sculpted cartoon characters. The two measured views do not guarantee every three-quarter contour; colour-view seams remain visible at some oblique angles. No subjective claim of complete style equivalence is made.

## H → H2: clean projected colour at office elevation

Local geometry, smooth normals, rig and animation data are unchanged from H. A uniform static root scale of 1.8/1.4 adapts world-space bounds to the revised room contract. The office camera sees clean dominant region colours on head tops, sides, shoulders, hat/ear tops and limbs. Full sprite detail is restricted to smooth-normal directions within 28° of front/back; it fades with smoothstep across 28–35° and is absent outside 35°. Side-frame colour projection is removed. The blend is baked into padded 16×16 triangle lookup tiles, with matching interpolated normals/positions along shared edges. No runtime shader or viewer changes are required.

Each region uses its dominant opaque source RGB (excluding dark outline pixels for light material regions), including hair/hat, face/skin/fur, outfit, trousers and shoes. Robot sides use its cream casing, not visor pixels; the visor remains front-only. Penguin sides use its dark body instead of its pale front belly. Hair/hat regions permit at most one lighter source-sampled band. The selected RGB values, blend angles and atlas dimensions are recorded in palette-characters.json. All GLBs embed the same updated PNG.

| Skin | Front H → H2 | Side H → H2 |
|---|---:|---:|
| dev-hoodie | 0.974 → 0.974 | 0.890 → 0.890 |
| designer | 0.973 → 0.973 | 0.873 → 0.873 |
| lead | 0.978 → 0.978 | 0.885 → 0.885 |
| shiba | 0.975 → 0.975 | 0.875 → 0.875 |
| cat | 0.970 → 0.970 | 0.811 → 0.811 |
| penguin | 0.842 → 0.842 | 0.836 → 0.836 |
| alien | 0.924 → 0.924 | 0.871 → 0.871 |
| robot | 0.954 → 0.954 | 0.894 → 0.894 |
| mage | 0.950 → 0.950 | 0.861 → 0.861 |
| knight | 0.923 → 0.923 | 0.905 → 0.905 |
| ranger | 0.963 → 0.963 | 0.889 → 0.889 |
| healer | 0.936 → 0.936 | 0.862 → 0.862 |
| rogue | 0.969 → 0.969 | 0.894 → 0.894 |
| berserker | 0.950 → 0.950 | 0.875 → 0.875 |
| slime | 0.917 → 0.917 | 0.836 → 0.836 |
| dragon | 0.952 → 0.952 | 0.830 → 0.830 |

All 32 silhouette targets pass; no contract failures. Triangle counts and all eight clips remain unchanged. H baseline assets and lineup are retained in previews/chars/h-baseline.

[Updated front lineup](previews/chars/lineup-16.png) · [Office-angle sheet](previews/chars/office-angle.png). The office sheet contains all 16 skins in rows; columns show standing at azimuth 0°, 90°, 180°, 270°, then seated typing at the same four azimuths. Every panel uses an orthographic camera with elevation exactly 0.86 radians.

The H limitation about projected colour streaking at oblique views is superseded by this H2 material pass. Fine front/back markings remain source pixels by design. Existing H geometry/style limitations are otherwise unchanged. The shared embedded atlas is 2048×5440; padded triangle tiles trade some texture size for a continuous baked blend without adding triangles or custom runtime materials.

## Revised room contract: original ×1.8

The character root is uniformly scaled by 1.8/1.4 = 9/7. Standing height is 2.52 (allowed 2.35–2.7), width remains ≤1.7, seated body/hip Y is 0.9, and typing sockets reach Y≈1.335 beside the 1.33 desk. Static root scaling also scales limb lengths, held prop/socket offsets, head-top anchors and all animated translations consistently. No animated root channel was added. Shape ratios and H2 texture regions/cones remain unchanged. Validator checks this root scale against H and separately hashes local geometry, normals, rig transforms and all animation keys to ensure they remain identical. Preview camera scale and seat/desk blocks use the revised dimensions.

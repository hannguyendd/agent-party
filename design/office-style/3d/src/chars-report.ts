import {readFile,writeFile} from 'node:fs/promises';import {NodeIO} from '@gltf-transform/core';import {ids} from './characters/sprite-shape';
const s=JSON.parse(await readFile('previews/chars/silhouettes.json','utf8')),c=JSON.parse(await readFile('previews/chars/contracts.json','utf8'));
let report=`# Part H — character shape and colour pass

All 16 character GLBs rebuilt in the Part H worktree. No commits or branch switches. Shared furniture palette, build/validate entry points, layout, props, kit, manifests, README and REPORT were not changed.

## Reproduce

Run from design/office-style/3d:

\`\`\`sh
bun install
bun src/chars-build.ts
bun src/chars-preview.ts
bun src/chars-validate.ts
bun src/chars-report.ts
\`\`\`

The independent builder is authoritative for these new GLBs. The pre-existing general builder still uses its original recipes; rerunning it would overwrite these characters. Integration into that builder is outside Part H ownership.

## Measurement

Actual Three.js/GLTFLoader orthographic renders at 48×72; front +Z, side +X, Y up. Camera uses square pixels and one source-derived scale per skin (2.52 / opaque sprite height). Feet sit at the bottom row. No horizontal camera fitting compensates for width compression. Both masks use alpha >127. Front = frame18. Left frame selected deterministically from frames4–7 by the smallest summed foot-row spans at rows64–70; ties use the earliest frame. Back colour lookup uses frame10.

Part F baseline comes from this worktree's HEAD GLBs and is normalized to the same 2.52 standing height, with feet at zero, before using the identical camera. Baseline files are retained in previews/chars/baseline. This removes scale as a confounder, not silhouette differences.

Each comparison sheet is sprite | render | overlay, front above side. Overlay: green intersection, pink sprite-only, blue render-only. Raw measurements: [silhouettes.json](previews/chars/silhouettes.json).

## IoU and geometry

| Skin | Front F → H | Side F → H | Left frame | Triangles F → H |
|---|---:|---:|---:|---:|
`;
for(const id of ids){const d=await new NodeIO().read('previews/chars/baseline/'+id+'.glb');let before=0;for(const mesh of d.getRoot().listMeshes())for(const p of mesh.listPrimitives())before+=(p.getIndices()?.getCount()??p.getAttribute('POSITION')!.getCount())/3;const a=s.skins[id];report+=`| ${id} | ${a.front.before.toFixed(3)} → ${a.front.after.toFixed(3)} | ${a.side.before.toFixed(3)} → ${a.side.after.toFixed(3)} | ${a.sideFrame} | ${before} → ${c.characters[id].triangles} |\n`;}
report+=`
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
`;
const h=JSON.parse(await readFile('previews/chars/h-baseline/silhouettes.json','utf8'));const palette=JSON.parse(await readFile('palette-characters.json','utf8'));
report+=`\n## H → H2: clean projected colour at office elevation\n\nLocal geometry, smooth normals, rig and animation data are unchanged from H. A uniform static root scale of 1.8/1.4 adapts world-space bounds to the revised room contract. The office camera sees clean dominant region colours on head tops, sides, shoulders, hat/ear tops and limbs. Full sprite detail is restricted to smooth-normal directions within 28° of front/back; it fades with smoothstep across 28–35° and is absent outside 35°. Side-frame colour projection is removed. The blend is baked into padded 16×16 triangle lookup tiles, with matching interpolated normals/positions along shared edges. No runtime shader or viewer changes are required.\n\nEach region uses its dominant opaque source RGB (excluding dark outline pixels for light material regions), including hair/hat, face/skin/fur, outfit, trousers and shoes. Robot sides use its cream casing, not visor pixels; the visor remains front-only. Penguin sides use its dark body instead of its pale front belly. Hair/hat regions permit at most one lighter source-sampled band. The selected RGB values, blend angles and atlas dimensions are recorded in palette-characters.json. All GLBs embed the same updated PNG.\n\n| Skin | Front H → H2 | Side H → H2 |\n|---|---:|---:|\n`;
for(const id of ids)report+=`| ${id} | ${h.skins[id].front.after.toFixed(3)} → ${s.skins[id].front.after.toFixed(3)} | ${h.skins[id].side.after.toFixed(3)} → ${s.skins[id].side.after.toFixed(3)} |\n`;
report+=`\nAll 32 silhouette targets pass; no contract failures. Triangle counts and all eight clips remain unchanged. H baseline assets and lineup are retained in previews/chars/h-baseline.\n\n[Updated front lineup](previews/chars/lineup-16.png) · [Office-angle sheet](previews/chars/office-angle.png). The office sheet contains all 16 skins in rows; columns show standing at azimuth 0°, 90°, 180°, 270°, then seated typing at the same four azimuths. Every panel uses an orthographic camera with elevation exactly 0.86 radians.\n\nThe H limitation about projected colour streaking at oblique views is superseded by this H2 material pass. Fine front/back markings remain source pixels by design. Existing H geometry/style limitations are otherwise unchanged. The shared embedded atlas is ${palette.width}×${palette.height}; padded triangle tiles trade some texture size for a continuous baked blend without adding triangles or custom runtime materials.\n`;
report+=`\n## Revised room contract: original ×1.8\n\nThe character root is uniformly scaled by 1.8/1.4 = 9/7. Standing height is 2.52 (allowed 2.35–2.7), width remains ≤1.7, seated body/hip Y is 0.9, and typing sockets reach Y≈1.335 beside the 1.33 desk. Static root scaling also scales limb lengths, held prop/socket offsets, head-top anchors and all animated translations consistently. No animated root channel was added. Shape ratios and H2 texture regions/cones remain unchanged. Validator checks this root scale against H and separately hashes local geometry, normals, rig transforms and all animation keys to ensure they remain identical. Preview camera scale and seat/desk blocks use the revised dimensions.\n`;
await writeFile('REPORT-H.md',report);console.log('REPORT-H.md written');

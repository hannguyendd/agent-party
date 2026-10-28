# Office 3D — Part G2 · Kenney ×1.7

The owner changed the requested factor from ×1.8 to **×1.7**. Kenney is now the sole default furniture set. No shared map, app/server source, shared manifest or docs were changed; no commit was made. Character source and GLBs remain read-only and owned by the separate character agent.

## Current status

Full validation passes, including the external character contract.

## Scale contract

| Field | G2 ×1.7 |
|---|---:|
| Seat top | 0.85 |
| Desktop / desktop items | 1.26 |
| Perimeter walls | 5.1 |
| Door openings | 3.7 (validated ≥3.6) |
| Frosted room | 4.35 |
| Deep wall decor bottom | ≥2.85 |
| Standard monitor distance | 2.1 (validated 1.9–2.3) |
| HR monitor distance | 1.4, owner-approved exception |
| Read-only character height / width | 2.2–2.55 / ≤1.6 |
| Seat-chair span | ≤1.5 |

Floor tiles, rugs, mats and sunlight retain their original size. Furniture uses original 1.0 recipes scaled once to ×1.7, then horizontal fitting only where frozen blocked tiles or a supporting desk require it. MGR’s one-tile approach and HR’s right entry still impose narrow equipment footprints; HR’s reception top remains left-biased.

## Facing desks touch

No spine, cabinet strip, return, apron or connector is instanced between the nine facing pairs. Each pair’s back edges meet at the bank midpoint. Bottom-pair depths are shrunk to 1.8 tiles to fit the four blocked rows.

| Pair | Back-edge gap |
|---|---:|
| D1 / D2 | 0.000000 |
| D3 / D4 | 0.000000 |
| D5 / D6 | 0.000000 |
| D7 / D8 | 0.000000 |
| D9 / D13 | 0.000000 |
| D10 / D14 | 0.000000 |
| D11 / D15 | 0.000000 |
| D12 / D16 | 0.000000 |
| M1 / M2 | 0.000000 |

All standard monitors remain on their sitter axis and own desktop, facing the sitter, at 2.1 tiles. HR stays at the explicitly approved 1.4 exception. Each station retains keyboard/mouse and at most three side items; towers are under the same desk.

## Cleaned assets

- Deleted dashboard/public/office/3d-variants/ entirely.
- Deleted vendor/kaykit/ and vendor-src/kaykit/ entirely.
- Pruned unreferenced shipped GLBs: **50 props + 3 kit pieces** from the Part G library. Only 57 props and 12 kit ids remain registered; all 16 character ids remain read-only.
- Pruned unused Kenney source models; vendor/kenney/ keeps only active source GLBs and its original bundled CC0 LICENSE. Raw Kenney ZIP is ignored; unpacked unused raw files are removed. Authoring recipes/history are retained, not shipped.
- 36 active ids use converted Kenney geometry; 21 unsupported/over-budget ids use our own models. models3d.json is synchronized with manifest-models3d.json.models3d and points directly at the default props.

## Validation

```text
PASS kenney: 85 GLBs, all triangle budgets; furniture/kit embedded shared palette and origin; 20/20 seat chairs at 0.85; 20 desktops at 1.26; monitors 1.9–2.3 tiles (HR approved 1.4 exception); <=3 desk items; 20 sparse nonrepeating wall decorations; 151893/500000 scene triangles.
PASS negative checks: moved chairs, distant/off-axis/reversed monitors, excess clutter, wrong desk support, walkable obstacles and low wall decor are rejected.
PASS characters: 16 read-only ids, node tree, 8 clips, height 2.2–2.55 / width <=1.6.
PASS rooms: perimeter 5.1, frosted room 4.35, original wall/window footprints, unchanged flat floor/rug/mat/sun-patch sizes.
PASS frozen shared map: background.png, foreground.png, collision.png, collision@16x.png and seats.json byte-identical to finished Part F.
PASS doors: both actual leaf heights >=3.6; original hinge nodes and 0.6s clips.
PASS Kenney default, raw models3d.json synchronized; no spine/connector; all nine facing pairs touch within 0.05.
PASS asset cleanup: only layout-referenced props/kit GLBs remain; no variants or KayKit directories.
```

Current scene triangles (with current read-only character inputs): 151893. Empty blocked padding tiles: 80. Checks reject changed seat centres, off-axis/distant/reversed monitors, too much clutter, wrong support, walkable overlaps, low decor, desktop gaps >0.05 and spine/connectors.

## Preview paths

- previews/g2/full-office-000.png
- previews/g2/full-office-090.png
- previews/g2/full-office-180.png
- previews/g2/full-office-270.png
- previews/g2/left-bank-closeup.png
- previews/g2/bottom-bench-closeup.png
- previews/g2/m1-m2-closeup.png
- previews/g2/pantry-closeup.png
- previews/g2/manager-room-closeup.png
- previews/g2/entrance-person-closeup.png

Entry points: bun run build / validate / preview inside this package. For independent furniture checks while character input is pending: bun src/g2/validate.ts --furniture-only. Full validate intentionally exits nonzero until character inputs meet the agreed contract. No character generation is invoked. Character GLB textures/materials are preserved as authored by the character agent; furniture palette/UV checks are not imposed on them.

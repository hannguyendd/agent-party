# Office 3D — Part G3 · Continuous desk rows

Kenney remains the default furniture set at the unchanged ×1.7 contract: seat 0.85, desktop/items 1.26, perimeter 5.1. Characters, all shared map files, HR and MGR station objects are unchanged. No commit made.

## Continuous banks

The left bank covers x=9..14 / rows 7..23; bottom bench x=16..35 / rows 26..29; M1/M2 x=24..30 / rows 12..15. All **210 blocked bank tiles** have a complete desktop above them. Facing back edges and neighbouring station surfaces touch without connectors or spines.

There are **38 visual modules**, 2.0–2.25 tiles wide, with faint inset seams. They are batched into 18 station-owned GLBs for independent equipment ownership; station batching boundaries add no visible seam. 66 unique corner legs are emitted once across each bank, including the facing shared edge. Desktop slabs and shared support geometry are purpose-built adaptations: unmodified native Kenney desks would retain doubled legs/pedestals at the joins. The rest of the Kenney furniture remains converted from the bundled CC0 sources.

Standard monitors remain 2.1 tiles from their seat axis, facing the sitter; HR retains its approved 1.4 exception. Each workstation keeps ≤3 personal items. Twelve inter-seat gaps receive exactly one shared cactus each; no new printers. Ground fillers inside desk banks are removed. Uncovered allowed-padding clusters are regenerated with bank tiles removed.

| Bank | Covered tiles | Module width | Maximum row gap | Longest empty desktop run |
|---|---:|---:|---:|---:|
| left | 102 | 2.125 | 0.000000 | 1.191 |
| bottom | 80 | 2.222 | 0.000000 | 1.191 |
| middle | 28 | 2.000 | 0.000000 | 1.191 |

## Models / triangles

The 18 station surface models replace the former paired workstation-desk instances. HR reception-desk and MGR compact desk remain unchanged.

- desk-row-d1: 108 triangles
- desk-row-d3: 72 triangles
- desk-row-d5: 48 triangles
- desk-row-d7: 108 triangles
- desk-row-d2: 72 triangles
- desk-row-d4: 48 triangles
- desk-row-d6: 36 triangles
- desk-row-d8: 72 triangles
- desk-row-d9: 108 triangles
- desk-row-d10: 84 triangles
- desk-row-d11: 84 triangles
- desk-row-d12: 108 triangles
- desk-row-d13: 72 triangles
- desk-row-d14: 60 triangles
- desk-row-d15: 60 triangles
- desk-row-d16: 72 triangles
- desk-row-m1: 96 triangles
- desk-row-m2: 60 triangles

Total scene: **150813 / 500,000 triangles**. Allowed-empty blocked padding: 67 tiles.

## Validation

New checks use actual mesh top bounds: adjacent row gaps ≤0.05, full tile-area coverage, no empty lateral desktop run >1.5, ≤1 shared item per gap. Negative row-gap and removed-shared-item mutations must fail. Existing blocked-footprint, facing-pair, monitor ownership, chair, palette and triangle checks remain enabled.

```text
PASS kenney: 101 GLBs, all triangle budgets; furniture/kit embedded shared palette and origin; 20/20 seat chairs at 0.85; 20 desktops at 1.26; monitors 1.9–2.3 tiles (HR approved 1.4 exception); <=3 desk items; 20 sparse nonrepeating wall decorations; 150813/500000 scene triangles.
PASS negative checks: moved chairs, distant/off-axis/reversed monitors, excess clutter, wrong desk support, walkable obstacles and low wall decor are rejected.
PASS characters: 16 read-only ids, node tree, 8 clips, height 2.2–2.55 / width <=1.6.
PASS rooms: perimeter 5.1, frosted room 4.35, original wall/window footprints, unchanged flat floor/rug/mat/sun-patch sizes.
PASS frozen shared map: background.png, foreground.png, collision.png, collision@16x.png and seats.json byte-identical to finished Part F.
PASS doors: both actual leaf heights >=3.6; original hinge nodes and 0.6s clips.
PASS Kenney default, raw models3d.json synchronized; no spine/connector; all nine facing pairs touch within 0.05.
PASS G3: adjacent row desks touch <=0.05; 210 blocked bank tiles fully covered; no empty desktop run >1.5; one shared item per gap. Row-gap and bare-run negative checks pass.
PASS asset cleanup: only layout-referenced props/kit GLBs remain; no variants or KayKit directories.
```

Independent chars-validate: see reports/part-g3-chars-validate.txt. SHA-256 checks prove character source/GLBs and map inputs unchanged during G3. No character generation is called.

## Previews

- previews/g3/full-office-000.png
- previews/g3/full-office-090.png
- previews/g3/full-office-180.png
- previews/g3/full-office-270.png
- previews/g3/left-bank-closeup.png
- previews/g3/bottom-bench-closeup.png
- previews/g3/m1-m2-closeup.png
- previews/g3/pantry-closeup.png
- previews/g3/manager-room-closeup.png
- previews/g3/entrance-person-closeup.png

## Contract exceptions

Only the existing owner-approved HR monitor distance (1.4) and seat-chair placement exceptions remain. No new collision exceptions. The desktop module geometry is a custom adaptation for shared supports, rather than an untouched Kenney desk.

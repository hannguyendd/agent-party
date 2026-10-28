# Part G2 · Kenney default · ×1.7

The owner reduced the factor from ×1.8 to ×1.7. Current heights: seat 0.85, desk 1.26, walls 5.1, glass room 4.35, door openings 3.7 and deep wall decor bottom 2.85. Floor tiles, rugs, mats and sunlight remain their original size.

Run `bun run build`, `bun run validate`, `bun run preview` here. Entry points use `src/g2/`. Character source and GLBs are **read-only external inputs** owned by the other agent. Full validation expects standing height 2.2–2.55 / width ≤1.6, ids/tree/eight clips. It exits nonzero while those inputs are pending; `bun src/g2/validate.ts --furniture-only` checks all furniture independently. Previews visibly label pending character input; they never pretend-rescale it.

Nine facing pairs meet at their actual desktop back edges, gap ≤0.05. There are no spine/connector placements. Bottom-bank desktop depth shrinks to 1.8 to stay in its four blocked rows. Monitors are 2.1 from sitters, except the owner-approved HR 1.4 exception. All equipment stays on its own desk and ≤3 side items remain per station. HR is left-biased to retain its right entry; MGR keeps a narrow frozen approach.

Kenney geometry is converted from the retained licensed sources in vendor/kenney/models/. Unsupported/over-budget ids use our own geometry. All files embed the shared pastel palette. `models3d.json` is the raw models3d object synchronized with manifest-models3d.json.models3d. There is no 3d-variants directory or KayKit vendor/raw pack anymore. Optional horizontal `scale: [x,1,z]` fits must be applied when consuming layout3d.json.

Build computes candidates in memory but ships/registers **only layout-referenced props and kit**. Unused public GLBs and unused retained Kenney source files are deleted on build. All 16 character references remain; character files are never pruned or rewritten. Authoring recipes/history remain non-shipping. A raw Kenney ZIP is retained ignored for provenance; unpacked unused files are removed.

All five shared map files are hash-frozen; no exporter is invoked. No app/server source, shared manifest, docs or other worktree is modified. No commit is made. REPORT.md, FILES.md and previews/index.html describe the current output.

Preserve character GLB materials and embedded textures as authored. Do not replace them with the furniture palette in a runtime loader; character UV/material style is owned by the character agent. Furniture/kit retain the strict shared-palette contract.

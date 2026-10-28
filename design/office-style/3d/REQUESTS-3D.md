# Current integration · G2 Kenney ×1.7

Read office/3d/models3d.json directly. Kenney is the sole default props set; unsupported ids use own geometry. Apply optional layout [x,1,z] scale. Required world heights: seat 0.85, desk 1.26, character standing 2.2–2.55. Keep exact 20 seat-chair exceptions (span ≤1.5) and two existing door exceptions. HR retains the owner-approved 1.4 monitor-distance exception; other monitors use 1.9–2.3.

The separate character agent owns src/characters and the character GLBs. Furniture build reads them without writing. Full validation intentionally waits for the external ×1.7 inputs. No shared-map or app/server/docs/manifest change is required for the furniture output.

Historical requests and integration notes are retained in report snapshots. Current layout contains no spine/connector and only active model registrations.

Earlier request-only future lounge / meeting / plant / game-night map proposals are preserved verbatim in reports/historical-requests-before-g2.md. They are not applied by G2.

Character rendering must preserve its authored GLB textures/materials; do not overwrite them with the furniture palette. Only furniture/kit use that palette override.

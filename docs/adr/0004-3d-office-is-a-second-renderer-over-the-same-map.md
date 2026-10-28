# The 3D Office is a second renderer over the same map, data and rules

Owners asked for an optional 3D look of the Office next to today's 2D pixel-art one, chosen per person in Settings.
We add a **three.js renderer** that draws the same Office from the same data. It is a second implementation of the
scene interface `OfficeView` already drives (`SceneData` in, `SceneCallbacks` out, plus the camera/selection/move
calls), not a second Office. The choice is stored per browser; 2D stays the default.

## The map stays shared and authoritative

- `collision.png`, `seats.json` and tile coordinates are the only geometry the rules know. The world server, the
  node and pathfinding keep working in tiles; they never learn which look someone uses. An agent standing on tile
  (12, 7) is on that tile for an owner on 2D and an owner on 3D at the same time.
- So the 3D scene **never adds obstacles**. Raised 3D objects stand only on tiles the collision grid already blocks;
  walkable tiles get flat decor, wall-mounted items or chairs on seat tiles. The art pipeline
  (`design/office-style/3d`, `bun run validate`) checks every placement in `layout3d.json` against `collision.png`.
- Changing the room (moving a wall, opening a seat) is one change to the plate, the collision grid, `seats.json`
  and `layout3d.json` together, released together (the Manager Room extension and the HR seat were done this way).

## Why

- Positions are shared state (ADR 0001). A per-theme grid would put the same agent in two different places for two
  owners, or let a 3D character walk through a sofa that only exists in 3D.
- One interface keeps the React side (side column, menus, conversation panel, onboarding) unaware of the renderer;
  movement rules, proximity and desk logic are shared code, not copied per look.

## Considered options

- **Pre-rendered 3D sprites in Phaser** (isometric bakes): cheapest, but no camera rotation and no wall cut-away,
  and every pose × direction × skin becomes an image to keep in sync.
- **A separate 3D layout with its own collision**: freer art, rejected for the reason above.
- **Babylon.js**: more built in, but a bigger bundle; three.js plus a few addons covers an orthographic camera,
  glTF characters with clip animation and instancing.

## Consequences

- three.js loads only when someone picks 3D (its own chunk, like Phaser today). Machines without WebGL, or where it
  fails to start, fall back to 2D.
- Names, status icons and bubbles are HTML overlays in 3D (crisp text, same privacy rule: other people's
  conversations show only typing dots).
- 3D art follows the 2D art workflow: Codex builds it from `docs/office/CODEX-PROMPTS-3D.md`; code reads it through
  the manifest's `models3d` section and never hard-codes models.

import Phaser from 'phaser'
import { COLS, ROWS, TILE, WALLS, DIVIDERS, FURNITURE, DESKS, DOOR, MANAGER_DOOR, type Rect, type FurnitureKind } from './layout'

const C = { outline: 0x62657e, wall: 0x8e91ae, wallTop: 0xb2b4ca, floor: 0xffe1c6, seam: 0xefc9ad, desk: 0xeebd8f, mint: 0xa9d9c3, lavender: 0xd6c7e1 }

/** Render art objects individually; the collision grid comes from these same footprints. */
export function renderRoom(scene: Phaser.Scene) {
  const floor = scene.add.graphics().setDepth(-100)
  floor.fillStyle(C.floor).fillRect(0, 0, COLS * TILE, ROWS * TILE)
  // Quiet staggered wood boards, deliberately snapped to whole pixels.
  for (let y = 2; y < ROWS - 1; y++) {
    floor.fillStyle(y % 3 === 0 ? 0xffe6cf : 0xffdfc2).fillRect(TILE, y * TILE, (COLS - 2) * TILE, TILE)
    floor.fillStyle(C.seam).fillRect(TILE, (y + 1) * TILE - 1, (COLS - 2) * TILE, 1)
    for (let x = 1 + (y % 2) * 2; x < COLS - 1; x += 4) floor.fillRect(x * TILE, y * TILE, 1, TILE)
  }
  function rug(r: Rect, color: number) {
    floor.fillStyle(C.outline, 0.14).fillRoundedRect(r.x * TILE + 3, r.y * TILE + 4, r.w * TILE, r.h * TILE, 10)
    floor.fillStyle(color).fillRoundedRect(r.x * TILE, r.y * TILE, r.w * TILE, r.h * TILE, 10)
    floor.lineStyle(2, 0xffffff, 0.35).strokeRoundedRect(r.x * TILE + 5, r.y * TILE + 5, r.w * TILE - 10, r.h * TILE - 10, 7)
  }
  rug({ x: 44, y: 8, w: 8, h: 5 }, C.lavender)
  rug({ x: 43, y: 18, w: 10, h: 7 }, C.mint)
  rug({ x: 47, y: 25, w: 7, h: 4 }, 0xf2c9c5)
  rug({ x: DOOR.x, y: 3, w: DOOR.w, h: 1 }, C.mint)

  const walls = scene.add.graphics().setDepth(2)
  for (const p of WALLS) {
    const x = p.x * TILE, y = p.y * TILE
    walls.fillStyle(C.outline).fillRect(x, y, TILE, TILE)
    walls.fillStyle(C.wall).fillRect(x + 2, y + 7, TILE - 4, TILE - 9)
    walls.fillStyle(C.wallTop).fillRect(x + 2, y + 2, TILE - 4, 7)
  }
  // Exterior windows: decorative, never doors or collision openings.
  for (const x of [8, 23, 29, 44, 49]) {
    walls.fillStyle(C.outline).fillRect(x * TILE, TILE / 2, 3 * TILE, 42)
    walls.fillStyle(0xfef4de).fillRect(x * TILE + 3, TILE / 2 + 3, 3 * TILE - 6, 36)
    walls.fillStyle(0xc6e9ef).fillRect(x * TILE + 7, TILE / 2 + 6, 3 * TILE - 14, 24)
    walls.fillStyle(0xe7f5f3).fillRect(x * TILE + 12, TILE / 2 + 8, 34, 6)
    walls.fillStyle(0xa9d2ac).fillRect(x * TILE + 7, TILE / 2 + 25, 3 * TILE - 14, 5)
  }
  // Entrance and the manager's only door. Its open leaf sits INSIDE, not across the passage.
  const doors = scene.add.graphics().setDepth(3)
  doors.fillStyle(C.outline).fillRect(DOOR.x * TILE, 6, DOOR.w * TILE, 8)
  doors.fillStyle(0xd69a76).fillRect(DOOR.x * TILE + 4, 14, 14, 65)
  doors.fillStyle(0xf9cf9f).fillRect(DOOR.x * TILE + 7, 16, 7, 58)
  const dx = (MANAGER_DOOR.x + 1) * TILE, dy = MANAGER_DOOR.y * TILE
  doors.fillStyle(C.outline).fillRect(dx, dy, 12, 2 * TILE)
  doors.fillStyle(0xd89d7c).fillRect(dx + 2, dy + 2, 8, 2 * TILE - 4)
  doors.fillStyle(0xffdfac).fillRect(dx + 4, dy + TILE, 3, 4)
  doors.fillStyle(0xe9c7ad).fillRect(MANAGER_DOOR.x * TILE, dy, TILE, 2)

  const dividers = scene.add.graphics().setDepth(3)
  for (const r of DIVIDERS) {
    dividers.fillStyle(C.outline).fillRect(r.x * TILE + 8, r.y * TILE, r.w * TILE - 16, r.h * TILE)
    dividers.fillStyle(C.lavender).fillRect(r.x * TILE + 10, r.y * TILE + 2, r.w * TILE - 20, r.h * TILE - 4)
  }

  function object(kind: FurnitureKind, r: Rect, flip = false) {
    const key = `object-${kind}`
    if (!scene.textures.exists(key)) return
    const image = scene.add.image((r.x + r.w / 2) * TILE, (r.y + r.h) * TILE, key).setOrigin(0.5, 1).setFlipX(flip)
    const scale = Math.min(r.w * TILE / image.width, (r.h * TILE + 18) / image.height)
    image.setScale(scale).setDepth(4)
  }
  for (const f of FURNITURE) object(f.kind, f)
  for (const d of DESKS) {
    const t = d.table
    if (d.seat.face === 'left' || d.seat.face === 'right') {
      object('desk-side', t, d.seat.face === 'right')
      object(d.seat.face === 'right' ? 'chair' : 'chair-back', { x: d.seat.x, y: d.seat.y, w: 1, h: 1 })
    } else {
      object('desk', t)
      object(d.seat.face === 'up' ? 'chair-back' : 'chair', { x: d.seat.x, y: d.seat.y, w: 1, h: 1 })
    }
  }
}

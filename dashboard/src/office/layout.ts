// Approved pastel Office v3, expressed as tiles so rendering and movement share geometry.
export const TILE = 32
export const COLS = 56
export const ROWS = 36
export type Facing = 'up' | 'down' | 'left' | 'right'
export interface Point { x: number; y: number }
export interface Rect extends Point { w: number; h: number }
export interface Desk {
  id: string
  table: Rect
  seat: Point & { face: Facing }
  extras: Point[]
}
export type Zone = 'office' | 'pantry' | 'manager' | 'entrance'
export const PANTRY: Rect = { x: 40, y: 2, w: 14, h: 12 }
export const MANAGER: Rect = { x: 40, y: 16, w: 14, h: 14 }
export const MANAGER_DOOR: Rect = { x: 39, y: 17, w: 1, h: 2 }
export const HR: Rect = { x: 10, y: 3, w: 4, h: 2 }
export const DOOR: Rect = { x: 18, y: 0, w: 3, h: 2 }
export const SPAWN: Point = { x: 19, y: 3 }

function sideDesk(id: string, x: number, y: number, face: 'left' | 'right'): Desk {
  const seatX = face === 'right' ? x - 1 : x + 2
  return { id, table: { x, y, w: 2, h: 2 }, seat: { x: seatX, y, face },
    extras: [{ x: seatX, y: y + 1 }, { x, y: y - 1 }, { x: x + 1, y: y + 2 }] }
}
function rowDesk(id: string, x: number, y: number, face: 'up' | 'down'): Desk {
  const seatY = face === 'down' ? y - 1 : y + 1
  return { id, table: { x, y, w: 4, h: 1 }, seat: { x: x + 1, y: seatY, face },
    extras: [{ x, y: seatY }, { x: x + 2, y: seatY }, { x: x + 3, y: seatY }] }
}
const left = [8, 12, 16, 20].flatMap((y, i) => [sideDesk(`D${i * 2 + 1}`, 8, y, 'right'), sideDesk(`D${i * 2 + 2}`, 11, y, 'left')])
const bottom = [17, 21, 25, 29].flatMap((x, i) => [rowDesk(`D${9 + i}`, x, 27, 'down'), rowDesk(`D${13 + i}`, x, 29, 'up')])
export const DESKS = [...left, ...bottom, sideDesk('M1', 24, 13, 'right'), sideDesk('M2', 27, 13, 'left')]
  .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
export const DESK_BY_ID: Record<string, Desk> = Object.fromEntries(DESKS.map(d => [d.id, d]))
export const DIVIDERS: Rect[] = [
  { x: 10, y: 8, w: 1, h: 14 }, { x: 26, y: 13, w: 1, h: 2 }, { x: 17, y: 28, w: 16, h: 1 },
]
export type FurnitureKind = 'plant' | 'fridge' | 'sink' | 'coffee' | 'chair' | 'chair-back' | 'stool' | 'printer' | 'sofa' | 'whiteboard' | 'table' | 'bookshelf' | 'desk' | 'desk-side' | 'mat' | 'door'
export const FURNITURE: (Rect & { kind: FurnitureKind; label: string })[] = [
  { ...HR, kind: 'desk', label: 'HR' },
  { x: 6, y: 3, w: 1, h: 2, kind: 'plant', label: 'plant' },
  { x: 31, y: 3, w: 2, h: 1, kind: 'sofa', label: 'bench' },
  { x: 34, y: 2, w: 2, h: 3, kind: 'bookshelf', label: 'bookshelf' },
  { x: 37, y: 3, w: 1, h: 2, kind: 'plant', label: 'plant' },
  { x: 40, y: 3, w: 2, h: 3, kind: 'fridge', label: 'fridge' },
  { x: 42, y: 4, w: 5, h: 2, kind: 'sink', label: 'sink' },
  { x: 47, y: 4, w: 5, h: 2, kind: 'coffee', label: 'coffee' },
  { x: 53, y: 4, w: 1, h: 2, kind: 'plant', label: 'plant' },
  { x: 46, y: 9, w: 4, h: 2, kind: 'table', label: 'pantry table' },
  { x: 45, y: 11, w: 1, h: 1, kind: 'stool', label: 'stool' },
  { x: 50, y: 10, w: 1, h: 1, kind: 'stool', label: 'stool' },
  { x: 47, y: 8, w: 1, h: 1, kind: 'stool', label: 'stool' },
  { x: 50, y: 16, w: 3, h: 2, kind: 'whiteboard', label: 'whiteboard' },
  { x: 45, y: 19, w: 4, h: 2, kind: 'sofa', label: 'sofa' },
  { x: 43, y: 19, w: 1, h: 2, kind: 'plant', label: 'plant' },
  { x: 45, y: 22, w: 3, h: 2, kind: 'table', label: 'coffee table' },
  { x: 40, y: 24, w: 2, h: 3, kind: 'bookshelf', label: 'bookshelf' },
  { x: 48, y: 26, w: 5, h: 2, kind: 'desk', label: 'manager desk' },
  { x: 50, y: 24, w: 1, h: 1, kind: 'chair-back', label: 'chair' },
  { x: 48, y: 28, w: 1, h: 1, kind: 'chair', label: 'chair' },
  { x: 52, y: 28, w: 1, h: 1, kind: 'chair', label: 'chair' },
  { x: 12, y: 23, w: 2, h: 2, kind: 'printer', label: 'printer' },
  { x: 15, y: 22, w: 1, h: 2, kind: 'plant', label: 'plant' },
]
const inside = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
export const WALLS: Point[] = []
for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
  const outer = x === 0 || x === COLS - 1 || y < 2 || y === ROWS - 1
  const manager = ((x === 39 || x === 55) && y >= 15 && y <= 30) || ((y === 15 || y === 30) && x >= 39)
  if ((outer && !inside(DOOR, x, y)) || (manager && !inside(MANAGER_DOOR, x, y))) WALLS.push({ x, y })
}
export const BLOCKED: boolean[][] = Array.from({ length: ROWS }, () => Array<boolean>(COLS).fill(false))
for (const p of WALLS) BLOCKED[p.y][p.x] = true
for (const r of [...DESKS.map(d => d.table), ...DIVIDERS, ...FURNITURE]) {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) BLOCKED[y][x] = true
}
export const walkable = (x: number, y: number) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < COLS && y < ROWS && !BLOCKED[y][x]

// Map data from the art (public/office/map, see design/office-style/REQUESTS.md). When present it replaces the
// procedural layout above: collision.png is the authoritative grid and seats.json lists the desks (19 with the Manager Room armchair, MGR).
export interface SeatRow {
  id: string
  seat: Point
  face: Facing
  extras: Point[]
}

export function applyMapData(blocked: boolean[][], seats: SeatRow[], spawn: Point | null) {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) BLOCKED[y][x] = blocked[y]?.[x] ?? true
  const step: Record<Facing, Point> = { right: { x: 1, y: 0 }, left: { x: -1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } }
  DESKS.length = 0
  for (const s of seats) {
    // The desk is the blocked tile the sitter faces.
    const d = step[s.face]
    DESKS.push({ id: s.id, table: { x: s.seat.x + d.x, y: s.seat.y + d.y, w: 1, h: 1 }, seat: { ...s.seat, face: s.face }, extras: s.extras })
  }
  DESKS.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
  for (const k of Object.keys(DESK_BY_ID)) delete DESK_BY_ID[k]
  for (const d of DESKS) DESK_BY_ID[d.id] = d
  if (spawn) Object.assign(SPAWN, spawn)
}

// Grid helpers for the Office. Paths come from PathFinding.js and are smoothed to straight segments, so
// agents walk in natural lines instead of tile-by-tile staircases. "Nearest free tile" is a small BFS.

import PF from 'pathfinding'
import { BLOCKED, COLS, ROWS, walkable, type Point } from './layout'

// 0 = walkable, 1 = blocked. Built once per map and cloned per search; call rebuildGrid() after the map changes.
let baseGrid = new PF.Grid(BLOCKED.map((row) => row.map((b) => (b ? 1 : 0))))
export function rebuildGrid() {
  baseGrid = new PF.Grid(BLOCKED.map((row) => row.map((b) => (b ? 1 : 0))))
}
const finder = new PF.AStarFinder({ diagonalMovement: PF.DiagonalMovement.OnlyWhenNoObstacles })

/** Waypoints (tiles) after `from` up to and including `to`, smoothed to line-of-sight segments.
 *  [] when unreachable or already there. */
export function findPath(from: Point, to: Point): Point[] {
  if ((from.x === to.x && from.y === to.y) || !walkable(to.x, to.y)) return []
  const grid = baseGrid.clone()
  // An agent may stand on a blocked tile (e.g. pushed onto a desk edge); let it walk off.
  grid.setWalkableAt(from.x, from.y, true)
  const raw = finder.findPath(from.x, from.y, to.x, to.y, grid).map(([x, y]) => ({ x, y }))
  if (raw.length < 2) return []
  return smooth(raw).slice(1)
}

// PF.Util.smoothenPath (0.4.18) throws in strict-mode modules (undeclared variable), so smooth here:
// keep a waypoint only when the straight line from the previous kept one would cross a blocked tile.
function smooth(path: Point[]): Point[] {
  const out = [path[0]]
  let anchor = path[0]
  for (let i = 2; i < path.length; i++) {
    if (!clearLine(anchor, path[i])) {
      anchor = path[i - 1]
      out.push(anchor)
    }
  }
  out.push(path[path.length - 1])
  return out
}

/** True when every tile the segment between two tile centres touches is walkable (supercover line). */
function clearLine(a: Point, b: Point): boolean {
  const dx = Math.abs(b.x - a.x)
  const dy = Math.abs(b.y - a.y)
  const sx = Math.sign(b.x - a.x)
  const sy = Math.sign(b.y - a.y)
  let x = a.x
  let y = a.y
  for (let ix = 0, iy = 0; ix < dx || iy < dy; ) {
    const step = (0.5 + ix) / dx - (0.5 + iy) / dy
    if (step === 0) {
      // Exactly through a corner: both neighbours must be free so the body doesn't clip it.
      if (!walkable(x + sx, y) || !walkable(x, y + sy)) return false
      x += sx
      y += sy
      ix++
      iy++
    } else if (step < 0 || dy === 0) {
      x += sx
      ix++
    } else {
      y += sy
      iy++
    }
    if (!walkable(x, y)) return false
  }
  return true
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

/** Closest walkable tile around `p` that `isFree` accepts (p itself first, unless skipCenter). */
export function nearestFree(p: Point, isFree: (x: number, y: number) => boolean, skipCenter = false): Point | null {
  const start = { x: Math.max(0, Math.min(COLS - 1, p.x)), y: Math.max(0, Math.min(ROWS - 1, p.y)) }
  const key = (x: number, y: number) => y * COLS + x
  const seen = new Set([key(start.x, start.y)])
  const queue: Point[] = [start]
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]
    const isCenter = cur.x === start.x && cur.y === start.y
    if (walkable(cur.x, cur.y) && isFree(cur.x, cur.y) && !(skipCenter && isCenter)) return cur
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx
      const ny = cur.y + dy
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || seen.has(key(nx, ny))) continue
      seen.add(key(nx, ny))
      queue.push({ x: nx, y: ny })
    }
  }
  return null
}

export const distance = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

/** Blocked tiles merged into horizontal runs, for building static collision bodies. */
export function blockedRuns(): { x: number; y: number; w: number }[] {
  const runs: { x: number; y: number; w: number }[] = []
  for (let y = 0; y < ROWS; y++) {
    let x = 0
    while (x < COLS) {
      if (!BLOCKED[y][x]) {
        x++
        continue
      }
      const start = x
      while (x < COLS && BLOCKED[y][x]) x++
      runs.push({ x: start, y, w: x - start })
    }
  }
  return runs
}

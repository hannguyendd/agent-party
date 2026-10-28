import { describe, expect, test } from 'bun:test'
import { BLOCKED, COLS, DESKS, MANAGER, MANAGER_DOOR, ROWS, SPAWN, WALLS, walkable } from '../src/office/layout'
import { findPath } from '../src/office/pathfind'

describe('approved Office layout', () => {
  test('all eighteen desks and their visitor stools are reachable from the entrance', () => {
    expect(new Set(DESKS.map(d => d.id)).size).toBe(18)
    for (const desk of DESKS) for (const p of [desk.seat, ...desk.extras]) {
      expect(walkable(p.x, p.y), `${desk.id}: ${p.x},${p.y}`).toBe(true)
      expect(findPath(SPAWN, p).length, desk.id).toBeGreaterThan(0)
    }
  })
  test('manager is enclosed except the single upper-left doorway', () => {
    const boundary = WALLS.filter(p => (p.x === 39 || p.x === 55) && p.y >= 15 && p.y <= 30)
    expect(boundary.length).toBe(30)
    const path = findPath(SPAWN, { x: MANAGER.x + 1, y: MANAGER.y + 4 })
    expect(path.some(p => p.x === MANAGER_DOOR.x && p.y >= MANAGER_DOOR.y && p.y < MANAGER_DOOR.y + MANAGER_DOOR.h)).toBe(true)
    for (let x = 39; x < 56; x++) expect(BLOCKED[30][x]).toBe(true)
  })
  test('wide corridors remain open at the L corner, beside manager and along bottom', () => {
    for (let x = 17; x < 33; x++) for (let y = 23; y <= 25; y++) expect(walkable(x, y)).toBe(true)
    for (let x = 34; x <= 38; x++) for (let y = 16; y <= 34; y++) expect(walkable(x, y)).toBe(true)
    for (let y = 32; y <= 34; y++) for (let x = 1; x < COLS - 1; x++) expect(walkable(x, y)).toBe(true)
  })
  test('pantry has no wall and blocked targets are not paths', () => {
    for (let y = 6; y <= 13; y++) expect(walkable(39, y)).toBe(true)
    expect(findPath(SPAWN, DESKS[0].table)).toEqual([])
    expect(walkable(-1, 5)).toBe(false)
    expect(walkable(5, ROWS)).toBe(false)
  })
})

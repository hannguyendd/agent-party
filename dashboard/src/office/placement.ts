// Where each agent should stand, from the world's symbolic targets (desk / tile / near another agent). Shared by the
// 2D and 3D looks so both put everyone on the same tiles (ADR 0004).

import type { OfficeTarget } from '../api'
import { DESK_BY_ID, SPAWN, type Point } from './layout'
import { nearestFree } from './pathfind'
import type { SceneData } from './renderer'

/** Turn each agent's target into a tile, without two agents claiming the same one. `standingOn` gives the tile an
 *  agent stands on now (used for "near" targets whose agent is not placed yet in this pass). */
export function resolveTargets(d: SceneData, standingOn: (agentId: string) => Point | null): Map<string, Point> {
  const taken = new Set<string>()
  const free = (x: number, y: number) => !taken.has(`${x},${y}`)
  const claim = (p: Point) => taken.add(`${p.x},${p.y}`)
  const result = new Map<string, Point>()
  const deskOf = (owner: string) => Object.entries(d.desks).find(([, o]) => o === owner)?.[0]
  const order = (t: OfficeTarget) => (t.kind === 'desk' ? 0 : t.kind === 'tile' ? 1 : 2)
  const agents = [...d.agents].sort((a, b) => order(a.at) - order(b.at) || a.agent_id.localeCompare(b.agent_id))
  const byOwner = new Map<string, string[]>()
  for (const a of [...d.agents].sort((x, y) => x.agent_id.localeCompare(y.agent_id))) {
    byOwner.set(a.owner, [...(byOwner.get(a.owner) ?? []), a.agent_id])
  }

  for (const a of agents) {
    let p: Point | null = null
    const at = a.at
    if (at.kind === 'desk') {
      const deskId = deskOf(a.owner)
      const i = byOwner.get(a.owner)!.indexOf(a.agent_id)
      // A desk the world knows but this map lacks (a newer office server, an older seats.json) counts as no desk.
      const desk = deskId ? DESK_BY_ID[deskId] : undefined
      if (desk) {
        const slot = [desk.seat, ...desk.extras][i]
        p = slot && free(slot.x, slot.y) ? slot : nearestFree(desk.seat, free)
      } else {
        p = nearestFree({ x: SPAWN.x + 1 + i, y: SPAWN.y + 1 }, free)
      }
    } else if (at.kind === 'tile') {
      p = nearestFree(at, free)
    } else {
      const target = result.get(at.agent_id) ?? standingOn(at.agent_id)
      p = target ? nearestFree(target, (x, y) => free(x, y) && !(x === target.x && y === target.y), true) : null
    }
    if (!p) continue
    claim(p)
    result.set(a.agent_id, p)
  }
  return result
}

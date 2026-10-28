// The map art both looks share (ADR 0004): collision.png and seats.json from the manifest become BLOCKED, DESKS
// and SPAWN in layout.ts, and the pathfinding grid is rebuilt from them.

import { COLS, ROWS, applyMapData, type Point, type SeatRow } from './layout'
import { rebuildGrid } from './pathfind'

export interface Manifest {
  objects?: Record<string, string>
  map?: Record<string, string>
  ui?: Record<string, string>
  /** The 3D art: inline, or the path of a models3d.json the art pipeline keeps up to date. */
  models3d?: Models3d | string
}

/** The manifest's 3D section (Codex, docs/office/CODEX-PROMPTS-3D.md). Paths are relative to the page. */
export interface Models3d {
  layout: string
  palette?: string
  characters: Record<string, string>
  props: Record<string, string>
  kit: Record<string, string>
}

/** The manifest's 3D art: inline, or fetched from the models3d.json path the art pipeline keeps up to date. */
export async function fetchModels3d(manifest: Manifest): Promise<Models3d | null> {
  const ref = manifest.models3d
  if (!ref) return null
  if (typeof ref !== 'string') return ref
  const res = await fetch(ref)
  if (!res.ok) throw new Error(`${ref}: ${res.status}`)
  return (await res.json()) as Models3d
}

export async function fetchManifest(): Promise<Manifest> {
  const res = await fetch('office/manifest.json')
  if (!res.ok) throw new Error(`office/manifest.json: ${res.status}`)
  return (await res.json()) as Manifest
}

/** collision.png: black blocks; white/red/blue walk; blue is where newcomers appear. */
export function applyCollisionImage(img: CanvasImageSource, seats: SeatRow[]) {
  const c = document.createElement('canvas')
  c.width = COLS
  c.height = ROWS
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const px = ctx.getImageData(0, 0, COLS, ROWS).data
  const blocked: boolean[][] = []
  let spawn: Point | null = null
  for (let y = 0; y < ROWS; y++) {
    blocked.push([])
    for (let x = 0; x < COLS; x++) {
      const i = (y * COLS + x) * 4
      const [r, g, b] = [px[i], px[i + 1], px[i + 2]]
      blocked[y].push(r < 64 && g < 64 && b < 64)
      if (b > 192 && r < 64 && g < 64) spawn = { x, y }
    }
  }
  applyMapData(blocked, seats, spawn)
  rebuildGrid()
}

/** Load the collision grid and seats named in the manifest (the 3D look; the 2D scene loads them through Phaser). */
export async function loadMapData(manifest: Manifest) {
  const map = manifest.map
  if (!map?.collision || !map.seats) throw new Error('the manifest has no collision map or seats')
  const [img, seats] = await Promise.all([
    new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error(`could not load ${map.collision}`))
      i.src = map.collision
    }),
    fetch(map.seats).then((r) => r.json() as Promise<SeatRow[]>),
  ])
  applyCollisionImage(img, seats)
}

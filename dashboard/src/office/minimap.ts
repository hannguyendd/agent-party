// Where each desk sits on the map, for the desk picker's mini-map: the map plate and seats.json named in the
// manifest (art workflow), loaded once per page.

import { useEffect, useState } from 'react'
import type { SeatRow } from './layout'

export interface MiniMap {
  background: string
  seats: Record<string, { x: number; y: number }>
}

let cached: Promise<MiniMap | null> | null = null

function load(): Promise<MiniMap | null> {
  cached ??= fetch('office/manifest.json')
    .then((r) => r.json())
    .then(async (m: { map?: { background?: string; seats?: string } }) => {
      if (!m.map?.background || !m.map.seats) return null
      const rows = (await (await fetch(m.map.seats)).json()) as SeatRow[]
      return { background: m.map.background, seats: Object.fromEntries(rows.map((r) => [r.id, r.seat])) }
    })
    .catch(() => null)
  return cached
}

export function useMiniMap(): MiniMap | null {
  const [map, setMap] = useState<MiniMap | null>(null)
  useEffect(() => {
    let live = true
    void load().then((m) => { if (live) setMap(m) })
    return () => { live = false }
  }, [])
  return map
}

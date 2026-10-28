// Play a sound for each notification that arrives while the page is open (not for history loaded at start).

import { useEffect, useRef, useState } from 'react'
import type { AppNotification } from './api'
import { playSfx, type Sfx } from './sound'

const SOUND: Record<AppNotification['kind'], Sfx> = {
  reply: 'done',
  recap: 'sparkle',
  approval: 'attention',
  assignment: 'attention',
  waiting: 'attention',
  inbound: 'pop',
  party: 'pop',
  error: 'error',
}

export function useNotificationSounds(rows: AppNotification[]) {
  const [opened] = useState(() => Date.now() - 2000)
  const seen = useRef(new Set<string>())
  useEffect(() => {
    // Most urgent first when several land together.
    const order: Sfx[] = ['attention', 'error', 'done', 'sparkle', 'pop']
    const fresh = rows.filter((n) => !seen.current.has(n.id) && !n.read && Date.parse(n.created_at) >= opened)
    for (const n of rows) seen.current.add(n.id)
    const kinds = new Set(fresh.map((n) => SOUND[n.kind] ?? 'pop'))
    const first = order.find((k) => kinds.has(k))
    if (first) playSfx(first)
  }, [rows, opened])
}

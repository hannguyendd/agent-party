// Which conversations I've looked at, per browser (a viewer convenience, so localStorage is enough).

import { useSyncExternalStore } from 'react'

const KEY = 'office.seen'
let seen: Record<string, string> = (() => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
})()
const listeners = new Set<() => void>()

/** Remember that I've seen a conversation up to `updatedAt`. */
export function markSeen(convId: string, updatedAt: string) {
  if ((seen[convId] ?? '') >= updatedAt) return
  seen = { ...seen, [convId]: updatedAt }
  try {
    localStorage.setItem(KEY, JSON.stringify(seen))
  } catch {
    /* private mode: keep it in memory */
  }
  listeners.forEach((l) => l())
}

export function useSeen(): Record<string, string> {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => seen,
  )
}

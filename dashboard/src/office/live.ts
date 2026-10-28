// Live bits shared by tiles, the dock and the Chats list: a ticking clock and what my agent is doing right now.

import { useEffect, useState } from 'react'
import type { Conversation } from '../api'
import type { Doing, LiveState } from '../useLiveState'

/** Re-renders every `ms` while `on`; returns the current time. */
export function useNow(on: boolean, ms = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [on, ms])
  return now
}

/** 0:42, 3:05, 1:02:09 */
export function elapsed(fromMs: number, now: number): string {
  const s = Math.max(0, Math.floor((now - fromMs) / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** The newest running conversation of one of my agents, with what it's doing. */
export function doingFor(state: LiveState, agentId: string): { conv: Conversation; doing: Doing } | null {
  let best: { conv: Conversation; doing: Doing } | null = null
  for (const [id, doing] of Object.entries(state.doing)) {
    const conv = state.conversations[id]
    if (conv?.agent_id === agentId && (!best || doing.since > best.doing.since)) best = { conv, doing }
  }
  return best
}

/** "$0.12 · 3 turns" for a conversation that has run (empty when nothing to show). */
export function costLine(c: Conversation): string {
  const parts = []
  if (c.cost_usd) parts.push(`$${c.cost_usd.toFixed(2)}`)
  if (c.turn_count) parts.push(`${c.turn_count} turn${c.turn_count === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

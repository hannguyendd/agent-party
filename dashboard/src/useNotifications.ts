// Browser notifications for things that need the owner (CONTEXT.md "Woken"): new Assignments and tool approvals.
// Best effort: needs the owner's permission and an open tab; the node falls back to an OS notification otherwise.

import { useEffect, useRef } from 'react'
import type { Approval } from './api'

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window

export async function enableNotifications(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied'
  const p = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
  if (p === 'granted') new Notification('Agent Mesh', { body: "Notifications are on. You'll be pinged when someone assigns you work." })
  return p
}

export function useApprovalNotifications(approvals: Record<string, Approval>, onOpen: (a: Approval) => void) {
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    const pending = Object.values(approvals).filter((a) => a.status === 'pending')
    if (seen.current === null) {
      // First snapshot: don't replay what was already waiting before the page loaded.
      seen.current = new Set(pending.map((a) => a.id))
      return
    }
    for (const a of pending) {
      if (seen.current.has(a.id)) continue
      seen.current.add(a.id)
      if (!notificationsSupported() || Notification.permission !== 'granted') continue
      if (!document.hidden && document.hasFocus()) continue // the page itself shows it
      const assignment = a.tool_name === 'Assignment'
      const n = new Notification(assignment ? `${a.tool_input.from ?? 'Someone'} wants to assign work` : `Approval needed: ${a.tool_name}`, {
        body: assignment ? String(a.tool_input.task ?? '').slice(0, 140) : 'One of your agents is waiting for your permission.',
        tag: a.id,
        requireInteraction: assignment,
      })
      n.onclick = () => {
        window.focus()
        onOpen(a)
        n.close()
      }
    }
  }, [approvals, onOpen])
}

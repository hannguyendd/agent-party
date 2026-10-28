// Browser notifications (CONTEXT.md "Woken"): every new notification (approvals, assignments, replies, questions
// from colleagues...) pops up while the tab is in the background. Best effort: needs the owner's permission and an
// open tab; the node falls back to an OS notification for Assignments otherwise.

import { useEffect, useRef, useState } from 'react'
import type { AppNotification } from './api'

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window

export async function enableNotifications(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied'
  const p = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
  if (p === 'granted') new Notification('Agent Mesh', { body: "Notifications are on. You'll be pinged when someone assigns you work." })
  return p
}

/** `format` turns a notification's title (agent IDs) into display text. */
export function useBrowserNotifications(rows: AppNotification[], format: (n: AppNotification) => string, onOpen: (n: AppNotification) => void) {
  const seen = useRef(new Set<string>())
  // Only what happens after the page opened pops up; the rest is history in the bell.
  const [opened] = useState(() => Date.now() - 2000)
  useEffect(() => {
    for (const n of rows) {
      if (seen.current.has(n.id)) continue
      seen.current.add(n.id)
      if (Date.parse(n.created_at) < opened) continue
      if (n.read || !notificationsSupported() || Notification.permission !== 'granted') continue
      if (!document.hidden && document.hasFocus()) continue // the page shows its own toast
      const urgent = n.kind === 'assignment' || n.kind === 'approval' || n.kind === 'waiting'
      const pop = new Notification(format(n), { body: n.body.slice(0, 140), tag: n.id, requireInteraction: n.kind === 'assignment' && urgent })
      pop.onclick = () => {
        window.focus()
        onOpen(n)
        pop.close()
      }
    }
  }, [rows, format, onOpen, opened])
}

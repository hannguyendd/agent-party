// The bell: every notification the node recorded (approvals, assignments, replies, questions, errors, recaps),
// newest first, plus a toast in the corner when one arrives live. Clicking one opens its conversation.

import { useEffect, useRef, useState } from 'react'
import { api, type AppNotification } from '../api'
import { timeAgo } from '../components/format'
import type { LiveState } from '../useLiveState'
import { Icon, type IconName } from './Icon'
import { useNotificationText } from './people'
import { plainPreview } from './render-md'

const KIND: Record<AppNotification['kind'], { icon: IconName; tone: string; label: string }> = {
  approval: { icon: 'approvals-pending', tone: 'warn', label: 'Approval' },
  assignment: { icon: 'assignment', tone: 'warn', label: 'Assignment' },
  waiting: { icon: 'question', tone: 'warn', label: 'Needs you' },
  inbound: { icon: 'inquiry', tone: 'info', label: 'New chat' },
  reply: { icon: 'check', tone: 'ok', label: 'Reply' },
  party: { icon: 'party', tone: 'info', label: 'Party' },
  recap: { icon: 'recap', tone: 'ok', label: 'Recap' },
  error: { icon: 'stop', tone: 'err', label: 'Error' },
}

type Filter = 'all' | 'unread' | 'needs'

export function NotificationBell({ state, onOpen, onApprovals }: { state: LiveState; onOpen: (n: AppNotification) => void; onApprovals: () => void }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const text = useNotificationText(state)
  const rows = state.notifications
  const unread = rows.filter((n) => !n.read).length
  const pending = Object.values(state.approvals).filter((a) => a.status === 'pending').length
  const shown = rows.filter((n) => (filter === 'unread' ? !n.read : filter === 'needs' ? KIND[n.kind]?.tone === 'warn' : true))
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])
  const pick = (n: AppNotification) => {
    if (!n.read) void api.readNotifications([n.id]).catch(() => {})
    setOpen(false)
    onOpen(n)
  }
  const badge = unread || pending
  return (
    <div className="office-bell-wrap" ref={wrap}>
      <button
        className={`office-bell ${open ? 'is-active' : ''} ${badge ? 'has-new' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={unread ? `${unread} new notification${unread === 1 ? '' : 's'}` : 'Notifications'}
        aria-label={`Notifications, ${unread} unread`}
      >
        <Icon name={badge ? 'approvals-pending' : 'approvals'} />
        {badge > 0 && <span className="o-count">{badge > 99 ? '99+' : badge}</span>}
      </button>
      {open && (
        <div className="o-frame office-notes" role="dialog" aria-label="Notifications">
          <header>
            <strong>Notifications</strong>
            {unread > 0 && <button className="office-notes-all" onClick={() => void api.readNotifications(null).catch(() => {})}>Mark all read</button>}
          </header>
          <div className="office-notes-filter" role="tablist">
            {(['all', 'unread', 'needs'] as Filter[]).map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'is-active' : ''} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f === 'unread' ? `Unread${unread ? ` · ${unread}` : ''}` : 'Needs you'}
              </button>
            ))}
          </div>
          {pending > 0 && (
            <button className="office-notes-pending" onClick={() => { setOpen(false); onApprovals() }}>
              <Icon name="approvals-pending" /> {pending} approval{pending === 1 ? '' : 's'} waiting for you
            </button>
          )}
          <ul>
            {shown.length === 0 && <li className="office-notes-empty">{filter === 'all' ? 'Nothing yet. Replies, questions and approvals show up here.' : 'Nothing here.'}</li>}
            {shown.map((n) => {
              const k = KIND[n.kind] ?? KIND.inbound
              return (
                <li key={n.id}>
                  <button className={`office-note tone-${k.tone} ${n.read ? '' : 'is-unread'}`} onClick={() => pick(n)}>
                    <i className="office-note-icon"><Icon name={k.icon} /></i>
                    <span>
                      <strong>{text(n)}</strong>
                      {n.body && <small>{plainPreview(n.body, () => null)}</small>}
                      <em>{k.label} · {timeAgo(n.created_at)}</em>
                    </span>
                    {!n.read && <b className="office-note-dot" aria-label="unread" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <NotificationToasts rows={rows} text={text} onOpen={pick} />
    </div>
  )
}

/** Live toasts: only notifications that arrive while the page is open (never the history loaded at start). */
function NotificationToasts({ rows, text, onOpen }: { rows: AppNotification[]; text: (n: AppNotification) => string; onOpen: (n: AppNotification) => void }) {
  // Anything created before the page opened is history, even when it arrives with the first fetch.
  const [opened] = useState(() => Date.now() - 2000)
  const seen = useRef(new Set<string>())
  const [toasts, setToasts] = useState<AppNotification[]>([])
  useEffect(() => {
    const fresh = rows.filter((n) => !seen.current.has(n.id) && !n.read && Date.parse(n.created_at) >= opened)
    for (const n of rows) seen.current.add(n.id)
    if (!fresh.length) return
    setToasts((t) => [...fresh.reverse(), ...t].slice(0, 3))
    for (const n of fresh) {
      const urgent = KIND[n.kind]?.tone === 'warn' || n.kind === 'error'
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), urgent ? 12000 : 6000)
    }
  }, [rows, opened])
  if (!toasts.length) return null
  return (
    <div className="note-toasts" aria-live="polite">
      {toasts.map((n) => {
        const k = KIND[n.kind] ?? KIND.inbound
        return (
          <div key={n.id} className={`o-frame note-toast tone-${k.tone}`}>
            <button className="note-toast-main" onClick={() => { setToasts((t) => t.filter((x) => x.id !== n.id)); onOpen(n) }}>
              <i className="office-note-icon"><Icon name={k.icon} /></i>
              <span>
                <strong>{text(n)}</strong>
                {n.body && <small>{plainPreview(n.body, () => null)}</small>}
              </span>
            </button>
            <button className="note-toast-x" aria-label="Dismiss" onClick={() => setToasts((t) => t.filter((x) => x.id !== n.id))}><Icon name="close" /></button>
          </div>
        )
      })}
    </div>
  )
}

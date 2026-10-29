// The dock under the map: office status and zoom on one bar, then "Happening now": every agent in the office that
// is talking right now (status only, never words). It takes whatever height the map leaves; on short screens only
// the bar shows.

import type { AppNotification, Conversation } from '../api'
import { timeAgo } from '../components/format'
import type { LiveState } from '../useLiveState'
import { Icon } from './Icon'
import { Avatar } from './OfficeChat'
import { useNotificationText, who } from './people'
import { ownerCss } from './skins'
import { ACTIVE_STATUSES, STATUS } from './status'
import { costLine, doingFor, elapsed } from './live'
import type { OfficeTheme } from './renderer'

interface Props {
  state: LiveState
  preview: boolean
  me: string
  ownDesk?: string
  presentOwners: string[]
  now: number
  activeChats: number
  waiting: number
  onChats: () => void
  onApprovals: () => void
  onOpenConv: (id: string) => void
  onFollow: (agentId: string) => void
  onNotification: (n: AppNotification) => void
  onZoom: (factor: number) => void
  onFit: () => void
  /** Present only when the look can turn its camera (3D). */
  onRotate?: (step: number) => void
  /** The 2D / 3D switch (ADR 0004); 3D is greyed out when this browser has no WebGL. */
  look: OfficeTheme
  can3d: boolean
  onLook: (look: OfficeTheme) => void
}

export function OfficeDock(p: Props) {
  const office = p.state.office
  const talking = (office?.agents ?? []).filter((a) => a.activity && ACTIVE_STATUSES.includes(a.activity.status))
  // Mine first; one entry per pair (both sides of a chat report activity).
  const seenPairs = new Set<string>()
  const rows = talking
    .sort((a, b) => Number(b.owner === p.me) - Number(a.owner === p.me))
    .filter((a) => {
      const key = [a.agent_id, a.activity?.peer ?? ''].sort().join('|')
      if (seenPairs.has(key)) return false
      seenPairs.add(key)
      return true
    })
  const noteText = useNotificationText(p.state)
  // Notifications and colleagues coming and going, one list, newest first.
  type Row = { id: string; at: number; text: string; unread: boolean; n?: AppNotification; owner?: string }
  const recent: Row[] = [
    ...p.state.notifications.slice(0, 8).map((n) => ({ id: n.id, at: Date.parse(n.created_at), text: noteText(n), unread: !n.read, n })),
    ...p.state.presenceLog.map((e) => ({ id: `${e.owner}-${e.at}`, at: e.at, text: `${e.owner} ${e.present ? 'came online' : 'went offline'}`, unread: false, owner: e.owner })),
  ].sort((a, b) => b.at - a.at).slice(0, 10)
  const myConv = (agentId: string): Conversation | undefined =>
    Object.values(p.state.conversations)
      .filter((c) => c.agent_id === agentId && ACTIVE_STATUSES.includes(c.status))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]

  return (
    <div className="office-dock">
      <div className="dock-bar">
        <span className={`dock-pill office-connection ${p.preview || office?.connected ? 'is-online' : ''}`}>
          {p.preview ? 'Design preview' : office?.connected ? 'Connected' : 'Reconnecting'}
        </span>
        {!p.preview && (
          <span className="dock-pill office-present" title={p.presentOwners.join(', ')}>
            {p.presentOwners.slice(0, 5).map((o) => <i key={o} style={{ background: ownerCss(o) }} />)}
            {p.presentOwners.length} here
          </span>
        )}
        {p.ownDesk && <span className="dock-pill dock-wide-only"><Icon name="desk" />{p.ownDesk}</span>}
        {!p.preview && (
          <button className="dock-pill" onClick={p.onChats}>{p.activeChats} active chat{p.activeChats === 1 ? '' : 's'}</button>
        )}
        {!p.preview && p.waiting > 0 && (
          <button className="dock-pill is-alert" onClick={p.onApprovals}>{p.waiting} waiting for you</button>
        )}
        <span className="dock-spacer" />
        <span className="dock-keys dock-wide-only"><kbd>WASD</kbd> walk <kbd>E</kbd> talk <kbd>H</kbd> desk <kbd>F</kbd> follow</span>
        <div className="dock-look" role="radiogroup" aria-label="Office look">
          {(['2d', '3d'] as const).map((l) => (
            <button key={l} role="radio" aria-checked={p.look === l} disabled={l === '3d' && !p.can3d}
              title={l === '3d' && !p.can3d ? 'This browser cannot draw 3D (WebGL is off)' : l === '2d' ? 'Pixel-art map' : '3D office'}
              onClick={() => p.onLook(l)}>{l.toUpperCase()}</button>
          ))}
        </div>
        <div className="dock-zoom" aria-label="Zoom">
          <button aria-label="Zoom out" title="Zoom out" onClick={() => p.onZoom(0.85)}>−</button>
          <button aria-label="Fit office" title="Fit the whole office" onClick={p.onFit}><Icon name="fit" /></button>
          <button aria-label="Zoom in" title="Zoom in" onClick={() => p.onZoom(1.15)}>+</button>
          {p.onRotate && <>
            <button aria-label="Turn left" title="Turn the view left ( [ )" onClick={() => p.onRotate?.(-1)}>⟲</button>
            <button aria-label="Turn right" title="Turn the view right ( ] )" onClick={() => p.onRotate?.(1)}>⟳</button>
          </>}
        </div>
      </div>

      <div className="dock-feed">
        <h3><i className={rows.length ? 'is-live' : ''} />Happening now</h3>
        {rows.length === 0 && <p className="dock-quiet">Quiet right now. Agent conversations show up here live.</p>}
        {rows.length > 0 && (
          <ul className="dock-talks">
            {rows.map((a) => {
              const mine = a.owner === p.me
              const peer = a.activity?.peer ? who(p.state, a.activity.peer) : null
              const st = STATUS[a.activity!.status]
              const work = mine ? doingFor(p.state, a.agent_id) : null
              const conv = work?.conv ?? (mine ? myConv(a.agent_id) : undefined)
              const arrow = a.activity?.direction === 'inbound' ? '←' : '→'
              return (
                <li key={a.agent_id}>
                  <button
                    className={`dock-talk is-${st.tone} ${mine ? 'is-mine' : ''}`}
                    onClick={() => (conv ? p.onOpenConv(conv.id) : p.onFollow(a.agent_id))}
                    title={conv ? 'Open this chat' : 'Follow on the map'}
                  >
                    <span className="dock-faces">
                      <Avatar w={who(p.state, a.agent_id)} size={22} />
                      {peer && <Avatar w={peer} size={22} />}
                    </span>
                    <span className="dock-talk-main">
                      <strong>{a.name}{peer ? ` ${arrow} ${peer.name}` : ' ↔ you'}</strong>
                      {work
                        ? <small className="is-live">{work.doing.step} · {elapsed(work.doing.since, p.now)}{costLine(work.conv) && ` · ${costLine(work.conv)}`}</small>
                        : <small>{st.label}{!mine && ` · ${a.owner}'s agent`}</small>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {recent.length > 0 && (
          <div className="dock-recent">
            <h4>Recently</h4>
            <ul>
              {recent.map((r) => (
                <li key={r.id}>
                  <button className={`${r.unread ? 'is-unread' : ''} ${r.owner ? 'is-presence' : ''}`} onClick={() => (r.n ? p.onNotification(r.n) : undefined)} disabled={!r.n}>
                    {r.owner && <i style={{ background: ownerCss(r.owner) }} />}
                    <span>{r.text}</span>
                    <time>{timeAgo(new Date(r.at).toISOString())}</time>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

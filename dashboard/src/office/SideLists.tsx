// Side-column tabs of the Office: every conversation (Chats) and every pending approval (Approvals).

import { useState } from 'react'
import type { Approval } from '../api'
import { ApprovalCard } from '../components/ApprovalCard'
import { timeAgo } from '../components/format'
import type { LiveState } from '../useLiveState'
import { Avatar } from './OfficeChat'
import { who } from './people'
import { useSeen } from './seen'
import { NEEDS_YOU, STATUS } from './status'
import { Icon } from './Icon'

const rank = (c: { status: string }) => (NEEDS_YOU.includes(c.status as never) ? 0 : c.status === 'running' ? 1 : 2)

type ChatTab = 'private' | 'outgoing' | 'incoming'
const CHAT_TABS: { id: ChatTab; icon: string; label: string; empty: string }[] = [
  { id: 'private', icon: '🔒', label: 'Private', empty: 'No private chats yet. Select one of your agents and press Message.' },
  { id: 'outgoing', icon: '↗', label: 'Outgoing', empty: "Nothing yet. Your agents' questions and tasks to other agents show up here." },
  { id: 'incoming', icon: '↘', label: 'Incoming', empty: "Nothing yet. When someone's agent asks one of yours, it shows up here." },
]
const tabOf = (c: { direction: string }): ChatTab =>
  c.direction === 'local' ? 'private' : c.direction === 'outbound' ? 'outgoing' : 'incoming'

export function ChatsList({ state, me, onOpen }: { state: LiveState; me: string; onOpen: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const seenMap = useSeen()
  const needle = q.trim().toLowerCase()
  const mineConvs = Object.values(state.conversations).filter((c) => c.agent_id.startsWith(`${me}/`))
  const isUnread = (c: (typeof mineConvs)[number]) => !!c.last_preview && (seenMap[c.id] ?? '') < c.updated_at
  // Open on the tab that needs attention, else Private; the owner can switch freely afterwards.
  const [tab, setTab] = useState<ChatTab>(() => tabOf(mineConvs.find((c) => NEEDS_YOU.includes(c.status)) ?? { direction: 'local' }))
  const counts = Object.fromEntries(
    CHAT_TABS.map((t) => {
      const inTab = mineConvs.filter((c) => tabOf(c) === t.id)
      return [t.id, { n: inTab.length, alert: inTab.some((c) => NEEDS_YOU.includes(c.status)), unread: inTab.some(isUnread) }]
    }),
  ) as Record<ChatTab, { n: number; alert: boolean; unread: boolean }>
  const rows = mineConvs
    .filter((c) => needle || tabOf(c) === tab) // a search looks through every tab
    .map((c) => ({ c, mine: who(state, c.agent_id), peer: c.peer_agent_id ? who(state, c.peer_agent_id) : null }))
    .filter(
      ({ c, mine, peer }) =>
        !needle || [c.title, c.last_preview, mine.name, peer?.name, peer?.id].some((t) => t?.toLowerCase().includes(needle)),
    )
    // Waiting on me first, then working, then by time.
    .sort((a, b) => rank(a.c) - rank(b.c) || b.c.updated_at.localeCompare(a.c.updated_at))
  const tabInfo = CHAT_TABS.find((t) => t.id === tab)!
  return (
    <div className="o-frame office-card office-list">
      {searching ? (
        <label className="o-search o-chat-bar">
          <Icon name="search" />
          <input
            className="input o-chat-search"
            placeholder="Search all chats…"
            value={q}
            autoFocus
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && (setQ(''), setSearching(false))}
          />
          <button type="button" className="o-icon-btn" aria-label="Close search" onClick={() => { setQ(''); setSearching(false) }}>
            <Icon name="close" />
          </button>
        </label>
      ) : (
      <div className="o-chat-bar">
      <div className="o-chat-tabs" role="tablist">
        {CHAT_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'is-active' : ''}
            onClick={() => setTab(t.id)}
          >
            <span aria-hidden>{t.icon}</span>
            {t.label}
            <span className="o-chat-tab-n">{counts[t.id].n}</span>
            {(counts[t.id].alert || counts[t.id].unread) && <i className={counts[t.id].alert ? 'is-alert' : ''} />}
          </button>
        ))}
      </div>
      <button className="o-icon-btn" aria-label="Search chats" title="Search chats" onClick={() => setSearching(true)}>
        <Icon name="search" />
      </button>
      </div>
      )}
      {!needle && counts[tab].n === 0 && <p className="office-empty">{tabInfo.empty}</p>}
      {needle && rows.length === 0 && <p className="office-empty">Nothing matches “{q}”.</p>}
      {rows.length > 0 && (
        <div className="o-chat-group">
          {rows.map(({ c, mine, peer }) => {
            const st = STATUS[c.status]
            const unread = isUnread(c)
            const sender = c.last_role === 'peer' ? peer?.name : c.last_role === 'owner' ? 'You' : mine.name
            // Only states worth attention get a chip; idle/done rows stay quiet.
            const loud = st.tone === 'run' || st.tone === 'wait' || st.tone === 'err'
            const kind =
              c.kind === 'assignment'
                ? { icon: '📋', label: 'Assignment' }
                : c.kind === 'inquiry'
                  ? { icon: '🔎', label: 'Question' }
                  : !peer
                    ? { icon: '🔒', label: 'Private chat with your agent' }
                    : { icon: '💬', label: 'Conversation' }
            return (
              <button key={c.id} className={`o-chat-row is-${st.tone} ${unread ? 'is-unread' : ''}`} onClick={() => onOpen(c.id)}>
                <span className={`o-chat-faces ${peer ? 'is-pair' : ''}`}>
                  <Avatar w={mine} size={30} />
                  {peer && <Avatar w={peer} size={30} />}
                </span>
                <span className="o-chat-main">
                  <span className="o-chat-top">
                    <span className="o-chat-kind" title={kind.label}>
                      {kind.icon}
                    </span>
                    <strong>
                      {mine.name}
                      {peer && (
                        <em>
                          {' '}
                          {c.direction === 'inbound' ? '←' : '→'} {peer.name}
                        </em>
                      )}
                    </strong>
                    {loud && <span className={`o-chip is-${st.tone}`}>{st.label}</span>}
                    <time>{timeAgo(c.updated_at)}</time>
                    {unread && <i className="o-unread" aria-label="new messages" />}
                  </span>
                  <span className="o-chat-preview">
                    {c.last_preview ? (
                      <>
                        <b>{sender}:</b> {c.last_preview}
                      </>
                    ) : (
                      c.title || 'No messages yet'
                    )}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ApprovalsList({ approvals, state, onOpen }: { approvals: Approval[]; state: LiveState; onOpen: (id: string) => void }) {
  const rows = [...approvals].sort((a, b) => a.created_at.localeCompare(b.created_at))
  return (
    <div className="office-list-stack">
      {rows.length === 0 && (
        <div className="o-frame office-card">
          <h2>Approvals</h2>
          <p className="office-empty">Nothing is waiting for you.</p>
        </div>
      )}
      {rows.map((a) => {
        const c = state.conversations[a.conversation_id]
        return (
          <ApprovalCard
            key={a.id}
            approval={a}
            context={
              c && (
                <button className="office-link" onClick={() => onOpen(c.id)}>
                  <span className="font-mono">{c.agent_id}</span>
                  {c.peer_agent_id && <span className="font-mono"> ↔ {c.peer_agent_id}</span>} · open chat →
                </button>
              )
            }
          />
        )
      })}
    </div>
  )
}

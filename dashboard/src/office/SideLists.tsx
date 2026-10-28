// Side-column tabs of the Office: every conversation (Chats) and every pending approval (Approvals).

import { useState } from 'react'
import type { Approval, Conversation } from '../api'
import { ApprovalCard } from '../components/ApprovalCard'
import { timeAgo } from '../components/format'
import type { LiveState } from '../useLiveState'
import { Avatar } from './OfficeChat'
import { agentNames, who, type Who } from './people'
import { plainPreview } from './render-md'
import { useSeen } from './seen'
import { NEEDS_YOU, STATUS } from './status'
import { Icon } from './Icon'

const rank = (c: { status: string }) => (NEEDS_YOU.includes(c.status as never) ? 0 : c.status === 'running' ? 1 : 2)

export type ChatTab = 'private' | 'outgoing' | 'incoming'
const CHAT_TABS: { id: ChatTab; icon: string; label: string; empty: string }[] = [
  { id: 'private', icon: '🔒', label: 'Private', empty: 'No private chats yet. Select one of your agents and press Message.' },
  { id: 'outgoing', icon: '↗', label: 'Outgoing', empty: "Nothing yet. Your agents' questions and tasks to other agents show up here." },
  { id: 'incoming', icon: '↘', label: 'Incoming', empty: "Nothing yet. When someone's agent asks one of yours, it shows up here." },
]
// A Party I host goes with Outgoing (my agent reaches out to members); a shared copy arrives, so Incoming.
const tabOf = (c: { direction: string; kind?: string }): ChatTab =>
  c.kind === 'party' ? 'outgoing' : c.kind === 'party_share' ? 'incoming' : c.direction === 'local' ? 'private' : c.direction === 'outbound' ? 'outgoing' : 'incoming'

/** `tab` lives in the parent so it survives opening a chat and coming back; null = pick the one that needs me. */
export function ChatsList({ state, me, onOpen, tab: chosen, onTab }: {
  state: LiveState; me: string; onOpen: (id: string) => void; tab: ChatTab | null; onTab: (t: ChatTab) => void
}) {
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const seenMap = useSeen()
  const needle = q.trim().toLowerCase()
  const mineConvs = Object.values(state.conversations).filter((c) => c.agent_id.startsWith(`${me}/`))
  const isUnread = (c: (typeof mineConvs)[number]) => !!c.last_preview && (seenMap[c.id] ?? '') < c.updated_at
  // First visit: open on the tab that needs attention, else Private. After that, the owner's choice sticks.
  const tab = chosen ?? tabOf(mineConvs.find((c) => NEEDS_YOU.includes(c.status)) ?? { direction: 'local' })
  const setTab = onTab
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
  // The Host's talks with each member fold into its Party row (counted there), unless one of them needs me.
  const partyRow = new Map(mineConvs.filter((c) => c.kind === 'party').map((c) => [c.party_id, c.id]))
  const talks: Record<string, number> = {}
  const shown = needle ? rows : rows.filter(({ c }) => {
    const host = c.kind !== 'party' && c.direction === 'outbound' && c.party_id ? partyRow.get(c.party_id) : undefined
    if (!host || rank(c) === 0) return true
    talks[host] = (talks[host] ?? 0) + 1
    return false
  })
  const now = shown.filter(({ c }) => rank(c) < 2)
  const earlier = shown.filter(({ c }) => rank(c) === 2)
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
      {rows.length > 0 && (needle ? (
        <div className="o-clist">{rows.map((r) => <ChatRow key={r.c.id} {...r} state={state} unread={isUnread(r.c)} talks={talks[r.c.id]} onOpen={onOpen} />)}</div>
      ) : (
        <>
          {now.length > 0 && (
            <>
              <h3 className="o-clist-h">Now</h3>
              <div className="o-clist">{now.map((r) => <ChatRow key={r.c.id} {...r} state={state} unread={isUnread(r.c)} talks={talks[r.c.id]} onOpen={onOpen} />)}</div>
            </>
          )}
          {earlier.length > 0 && (
            <>
              {now.length > 0 && <h3 className="o-clist-h">Earlier</h3>}
              <div className="o-clist">
                {earlier.slice(0, showAll ? undefined : EARLIER_SHOWN).map((r) => (
                  <ChatRow key={r.c.id} {...r} state={state} unread={isUnread(r.c)} talks={talks[r.c.id]} onOpen={onOpen} />
                ))}
              </div>
              {earlier.length > EARLIER_SHOWN && (
                <button className="o-clist-more" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Show fewer' : `Show ${earlier.length - EARLIER_SHOWN} more`}
                </button>
              )}
            </>
          )}
        </>
      ))}
    </div>
  )
}

const EARLIER_SHOWN = 6

type Row = { c: Conversation; mine: Who; peer: Who | null }

/** One line per conversation: who, what state needs my eyes, the latest line. Quiet unless something is going on. */
function ChatRow({ c, mine, peer, state, unread, talks, onOpen }: Row & { state: LiveState; unread: boolean; talks?: number; onOpen: (id: string) => void }) {
  const st = STATUS[c.status]
  const loud = st.tone === 'run' || st.tone === 'wait' || st.tone === 'err'
  const party = c.party_id ? (state.office?.parties ?? []).find((p) => p.party_id === c.party_id) : undefined
  const hosting = c.kind === 'party'
  const faces = hosting && party ? [party.host, ...party.members].slice(0, 3).map((id) => who(state, id)) : [mine, ...(peer ? [peer] : [])]
  const sender = c.last_role === 'peer' ? peer?.name : c.last_role === 'owner' ? 'You' : mine.name
  const nameOf = agentNames(state)
  const meta = [
    c.party_id && !hosting ? 'Party' : '',
    hosting ? (party ? `${party.members.length + 1} agents` : 'ended') : '',
    hosting && talks ? `${talks} talk${talks === 1 ? '' : 's'}` : '',
    c.kind === 'assignment' ? 'Task' : '',
  ].filter(Boolean)
  return (
    <button className={`o-crow ${loud ? `is-${st.tone}` : ''} ${unread ? 'is-unread' : ''}`} onClick={() => onOpen(c.id)}>
      <span className={`o-crow-faces n${faces.length}`}>
        {faces.map((f) => <Avatar key={f.id} w={f} size={faces.length > 2 ? 20 : 26} />)}
      </span>
      <span className="o-crow-main">
        <span className="o-crow-top">
          <strong>
            {hosting ? <>🎉 {plainPreview(c.title, nameOf) || 'Party'}</> : <>{mine.name}{peer && <em> {c.direction === 'inbound' ? '←' : '→'} {peer.name}</em>}</>}
          </strong>
          {loud && <span className={`o-crow-state is-${st.tone}`}>{st.label}</span>}
          <time>{timeAgo(c.updated_at)}</time>
          {unread && <i className="o-unread" aria-label="new messages" />}
        </span>
        <span className="o-crow-preview">
          {meta.length > 0 && <span className="o-crow-meta">{meta.join(' · ')}</span>}
          {c.last_preview ? <><b>{sender}:</b> {plainPreview(c.last_preview, nameOf)}</> : plainPreview(c.title, nameOf) || 'No messages yet'}
        </span>
      </span>
    </button>
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
            nameOf={(id) => who(state, id).name}
            context={
              c && (
                <button className="office-link" onClick={() => onOpen(c.id)}>
                  <strong>{who(state, c.agent_id).name}</strong>
                  {c.peer_agent_id && <span> ↔ {who(state, c.peer_agent_id).name}</span>} · open chat →
                </button>
              )
            }
          />
        )
      })}
    </div>
  )
}

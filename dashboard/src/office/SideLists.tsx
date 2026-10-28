// Side-column tabs of the Office: every conversation (Chats) and every pending approval (Approvals).

import { useState } from 'react'
import type { Approval } from '../api'
import { ApprovalCard } from '../components/ApprovalCard'
import { timeAgo } from '../components/format'
import type { LiveState } from '../useLiveState'
import { Avatar } from './OfficeChat'
import { who } from './people'
import { useSeen } from './seen'
import { ACTIVE_STATUSES, NEEDS_YOU, STATUS } from './status'


export function ChatsList({ state, me, onOpen }: { state: LiveState; me: string; onOpen: (id: string) => void }) {
  const [q, setQ] = useState('')
  const seenMap = useSeen()
  const needle = q.trim().toLowerCase()
  const mineConvs = Object.values(state.conversations).filter((c) => c.agent_id.startsWith(`${me}/`))
  const rows = mineConvs
    .map((c) => ({ c, mine: who(state, c.agent_id), peer: c.peer_agent_id ? who(state, c.peer_agent_id) : null }))
    .filter(({ c, mine, peer }) => !needle || [c.title, c.last_preview, mine.name, peer?.name, peer?.id].some((t) => t?.toLowerCase().includes(needle)))
    .sort((a, b) => b.c.updated_at.localeCompare(a.c.updated_at))
  const groups: [string, typeof rows][] = [
    ['Needs you', rows.filter(({ c }) => NEEDS_YOU.includes(c.status))],
    ['Active', rows.filter(({ c }) => c.status === 'running')],
    ['Earlier', rows.filter(({ c }) => !ACTIVE_STATUSES.includes(c.status))],
  ]
  return (
    <div className="o-frame office-card office-list">
      <h2>Chats <span>{mineConvs.length}</span></h2>
      {mineConvs.length > 3 && (
        <input className="input o-chat-search" placeholder="Search chats…" value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      {mineConvs.length === 0 && (
        <p className="office-empty">No chats yet. Select one of your agents and press <strong>Message</strong>, or walk up to a colleague's agent.</p>
      )}
      {mineConvs.length > 0 && rows.length === 0 && <p className="office-empty">Nothing matches “{q}”.</p>}
      {groups.map(([label, list]) =>
        list.length === 0 ? null : (
          <div key={label} className="o-chat-group">
            <div className={`o-chat-group-label ${label === 'Needs you' ? 'is-alert' : ''}`}>{label}</div>
            {list.map(({ c, mine, peer }) => {
              const st = STATUS[c.status]
              const unread = !!c.last_preview && (seenMap[c.id] ?? '') < c.updated_at
              const sender = c.last_role === 'peer' ? peer?.name : c.last_role === 'owner' ? 'You' : mine.name
              // Only states worth attention get a chip; idle/done rows stay quiet.
              const loud = st.tone === 'run' || st.tone === 'wait' || st.tone === 'err'
              const kind = c.kind === 'assignment' ? { icon: '📋', label: 'Assignment' } : c.kind === 'inquiry' ? { icon: '🔎', label: 'Question' } : !peer ? { icon: '🔒', label: 'Private chat with your agent' } : { icon: '💬', label: 'Conversation' }
              return (
                <button key={c.id} className={`o-chat-row is-${st.tone} ${unread ? 'is-unread' : ''}`} onClick={() => onOpen(c.id)}>
                  <span className={`o-chat-faces ${peer ? 'is-pair' : ''}`}>
                    <Avatar w={mine} size={30} />
                    {peer && <Avatar w={peer} size={30} />}
                  </span>
                  <span className="o-chat-main">
                    <span className="o-chat-top">
                      <span className="o-chat-kind" title={kind.label}>{kind.icon}</span>
                      <strong>
                        {mine.name}
                        {peer && <em> {c.direction === 'inbound' ? '←' : '→'} {peer.name}</em>}
                      </strong>
                      {loud && <span className={`o-chip is-${st.tone}`}>{st.label}</span>}
                      <time>{timeAgo(c.updated_at)}</time>
                      {unread && <i className="o-unread" aria-label="new messages" />}
                    </span>
                    <span className="o-chat-preview">
                      {c.last_preview ? <><b>{sender}:</b> {c.last_preview}</> : c.title || 'No messages yet'}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        ),
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

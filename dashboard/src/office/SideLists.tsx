// Side-column tabs of the Office: every conversation, every pending approval, and a quick way to
// message one of your own agents. Everything the old separate pages did now lives here.

import { useState } from 'react'
import { api, type Approval, type Conversation } from '../api'
import { ApprovalCard } from '../components/ApprovalCard'
import { StatusBadge, errMsg, timeAgo } from '../components/ui'
import type { LiveState } from '../useLiveState'
import { Icon } from './Icon'
import { AttachBar } from './AttachBar'
import { dropTarget, useAttachments, type Limits } from './attachments'
import { MentionInput } from './MentionInput'
import type { Who } from './people'

const ACTIVE = ['running', 'awaiting_approval', 'awaiting_owner']
const isActive = (c: Conversation) => ACTIVE.includes(c.status)

export function ChatsList({ state, me, onOpen }: { state: LiveState; me: string; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<'all' | 'active'>('all')
  const rows = Object.values(state.conversations)
    .filter((c) => c.agent_id.startsWith(`${me}/`) && (filter === 'all' || isActive(c)))
    .sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || b.updated_at.localeCompare(a.updated_at))
  return (
    <div className="o-frame office-card office-list">
      <h2>
        Chats
        <span className="office-seg">
          <button className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'active' ? 'is-active' : ''} onClick={() => setFilter('active')}>Active</button>
        </span>
      </h2>
      {rows.length === 0 && <p className="office-empty">No conversations yet. Select an agent and message it, or walk up to someone's agent.</p>}
      {rows.map((c) => (
        <button key={c.id} className="office-chat" onClick={() => onOpen(c.id)}>
          <Icon name={c.kind === 'assignment' ? 'assignment' : c.direction === 'local' ? 'inject' : 'inquiry'} />
          <span>
            <strong>
              {c.agent_id.split('/')[1]}
              {c.peer_agent_id && <em> {c.direction === 'inbound' ? '←' : '→'} {c.peer_agent_id}</em>}
            </strong>
            <small>{c.title || 'untitled'} · {timeAgo(c.updated_at)}</small>
          </span>
          <StatusBadge status={c.status} />
        </button>
      ))}
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

/** Start a private conversation with one of my agents (what the old "Start session" page did). */
export function MessageAgent({ agentId, name, candidates, limits, onStarted, onError }: {
  agentId: string; name?: string; candidates: Who[]; limits?: Limits; onStarted: (id: string) => void; onError: (msg: string) => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const att = useAttachments(limits)
  const ready = (!!text.trim() || att.files.length > 0) && !busy
  const start = async () => {
    if (!ready) return
    setBusy(true)
    try {
      onStarted((await api.startConversation(agentId, text.trim(), att.payload())).id)
      setText('')
      att.clear()
    } catch (e) {
      onError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="office-message-agent" {...dropTarget(att)}>
      <div className="o-compose-box">
        <MentionInput
          value={text}
          onChange={setText}
          onSubmit={() => void start()}
          onPasteFiles={(f) => void att.add(f)}
          candidates={candidates}
          placeholder={`Ask ${name ?? 'your agent'} anything · @ a colleague's agent · drop files`}
        />
        <AttachBar att={att} />
      </div>
      <button className="btn-primary" disabled={!ready} onClick={start} aria-label="Send to agent">
        <Icon name="send" />
      </button>
    </div>
  )
}

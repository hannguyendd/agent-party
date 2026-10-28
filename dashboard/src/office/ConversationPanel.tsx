// A conversation in the Office side column: the map stays visible while the owner reads and steers.
// Same actions as the full SessionView (inject / reply, stop, take over / hand back, fork, approvals),
// laid out for a narrow column.

import { useState } from 'react'
import { api, type Approval, type Conversation, type Message } from '../api'
import { ApprovalCard } from '../components/ApprovalCard'
import { MessageList } from '../components/MessageList'
import { StatusBadge, errMsg } from '../components/ui'
import { Icon } from './Icon'

interface Props {
  conv: Conversation
  messages: Message[] | undefined
  partial?: string
  approvals: Approval[]
  onBack: () => void
  onOpen: (id: string) => void
  onExpand: () => void
}

export function ConversationPanel({ conv, messages, partial, approvals, onBack, onOpen, onExpand }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = approvals.filter((a) => a.status === 'pending')
  const peer = conv.peer_agent_id ?? 'peer'
  const active = conv.status === 'running' || conv.status === 'awaiting_approval'
  const composer: { mode: 'reply' | 'inject' | 'off'; placeholder: string } = conv.awaiting_owner
    ? { mode: 'reply', placeholder: `Reply to ${peer} as yourself…` }
    : conv.mode === 'auto'
      ? { mode: 'inject', placeholder: active ? 'Add context to the running turn…' : 'Message your agent…' }
      : { mode: 'off', placeholder: `Waiting for ${peer}. Hand back to let the agent answer.` }

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }
  const send = () => {
    const t = text.trim()
    if (!t || composer.mode === 'off') return
    void run(async () => {
      await (composer.mode === 'reply' ? api.reply(conv.id, t) : api.inject(conv.id, t))
      setText('')
    })
  }

  return (
    <div className="o-frame office-conv">
      <header className="office-conv-head">
        <button className="o-icon-btn" onClick={onBack} aria-label="Back to agents" title="Back to agents">
          <Icon name="back" />
        </button>
        <div className="office-conv-who">
          <strong>{conv.agent_id.split('/')[1]}</strong>
          <span>
            {conv.direction === 'inbound' ? '←' : conv.direction === 'outbound' ? '→' : '·'} {conv.peer_agent_id ?? 'local session'}
            {conv.kind === 'assignment' && <em> · assignment{conv.accepted ? ' (accepted)' : ''}</em>}
          </span>
        </div>
        <StatusBadge status={conv.status} />
      </header>

      <div className="office-conv-tools">
        <button className="btn" disabled={busy || !active} onClick={() => run(() => api.interrupt(conv.id))} title="Stop the current turn">
          <Icon name="stop" />Stop
        </button>
        {conv.mode === 'auto' && !conv.awaiting_owner ? (
          <button
            className="btn"
            disabled={busy || conv.direction === 'local'}
            onClick={() => run(() => api.takeover(conv.id))}
            title={conv.direction === 'local' ? 'Local sessions have no peer to answer' : 'Answer the peer yourself'}
          >
            <Icon name="takeover" />Take over
          </button>
        ) : (
          <button className="btn" disabled={busy} onClick={() => run(() => api.handback(conv.id))} title="Let the agent answer again">
            <Icon name="handback" />Hand back
          </button>
        )}
        <button
          className="btn"
          disabled={busy || !conv.session_id || active}
          onClick={() => run(async () => onOpen((await api.fork(conv.id)).conversation_id))}
          title={conv.session_id ? 'Fork into a private session' : 'No Claude session to fork yet'}
        >
          <Icon name="fork" />Fork
        </button>
        <button className="o-icon-btn" onClick={onExpand} title="Open full screen" aria-label="Open full screen">
          <Icon name="fit" />
        </button>
      </div>

      {pending.length > 0 && (
        <div className="office-conv-approvals">
          {pending.map((a) => (
            <ApprovalCard key={a.id} approval={a} />
          ))}
        </div>
      )}

      <div className="office-conv-messages">
        <MessageList conv={conv} messages={messages} partial={partial} />
      </div>

      <footer className="office-conv-composer">
        {conv.awaiting_owner && <div className="office-conv-waiting">{peer} is waiting for your reply.</div>}
        {error && <div className="office-conv-error">{error}</div>}
        <div className="office-conv-input">
          <textarea
            className="input"
            rows={2}
            value={text}
            disabled={composer.mode === 'off'}
            placeholder={composer.placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send()
              }
            }}
          />
          <button className="btn-primary" disabled={busy || !text.trim() || composer.mode === 'off'} onClick={send} aria-label="Send">
            <Icon name="send" />
          </button>
        </div>
      </footer>
    </div>
  )
}

import { useState } from 'react'
import { api, type Approval, type Conversation, type Message } from '../api'
import { ApprovalCard } from './ApprovalCard'
import { MessageList } from './MessageList'
import { DirectionIcon, ErrorLine, Pill, StatusBadge, errMsg } from './ui'

interface Props {
  conv: Conversation
  messages: Message[] | undefined
  partial?: string
  approvals: Approval[]
  onOpen: (id: string) => void
}

export function SessionView({ conv, messages, partial, approvals, onOpen }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDecided, setShowDecided] = useState(false)

  const pending = approvals.filter((a) => a.status === 'pending')
  const decided = approvals.filter((a) => a.status !== 'pending')
  const peer = conv.peer_agent_id ?? 'peer'
  const active = conv.status === 'running' || conv.status === 'awaiting_approval'

  // A waiting peer (manual mode, or after Stop on an inbound turn) gets a manual reply;
  // otherwise auto mode injects owner context into the agent session.
  const composer: { mode: 'reply' | 'inject' | 'off'; placeholder: string } = conv.awaiting_owner
    ? { mode: 'reply', placeholder: `Reply to ${peer} as yourself…` }
    : conv.mode === 'auto'
      ? { mode: 'inject', placeholder: active ? 'Add context for the agent (pushed into the running turn)…' : 'Add context for the agent / continue the session…' }
      : { mode: 'off', placeholder: `Manual mode — waiting for ${peer}'s next message. Hand back to let the agent answer.` }

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
    <div className="flex h-full min-w-0 flex-col">
      {/* header */}
      <div className="border-b border-line bg-panel px-4 py-2">
        <div className="flex items-center gap-2">
          <DirectionIcon direction={conv.direction} />
          <span className="font-mono text-[13px] font-semibold">{conv.agent_id}</span>
          <span className="text-muted">{conv.direction === 'inbound' ? '←' : conv.direction === 'outbound' ? '→' : ''}</span>
          {conv.peer_agent_id && <span className="font-mono text-[13px]">{conv.peer_agent_id}</span>}
          <StatusBadge status={conv.status} />
          <span className="ml-auto flex items-center gap-1.5">
            <button className="btn" disabled={busy || !active} onClick={() => run(() => api.interrupt(conv.id))} title="Interrupt the current turn">
              ■ Stop
            </button>
            {conv.mode === 'auto' && !conv.awaiting_owner ? (
              <button
                className="btn"
                disabled={busy || conv.direction === 'local'}
                onClick={() => run(() => api.takeover(conv.id))}
                title={conv.direction === 'local' ? 'Local sessions have no peer to answer' : 'Interrupt the agent and answer the peer yourself'}
              >
                ✋ Take over
              </button>
            ) : (
              <button className="btn" disabled={busy} onClick={() => run(() => api.handback(conv.id))} title="Let the agent answer again">
                ↩ Hand back
              </button>
            )}
            <button
              className="btn"
              disabled={busy || !conv.session_id || active}
              onClick={() => run(async () => onOpen((await api.fork(conv.id)).conversation_id))}
              title={conv.session_id ? 'Fork into a private local session' : 'No Claude session to fork yet'}
            >
              ⑂ Fork
            </button>
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          {conv.title && <span className="mr-1 truncate text-fg">{conv.title}</span>}
          <Pill>{conv.direction}</Pill>
          <Pill className={conv.mode === 'manual' ? 'border-purple-500/50 text-purple-700 dark:text-purple-300' : ''}>mode: {conv.mode}</Pill>
          <Pill>turns: {conv.turn_count}</Pill>
          <Pill className="max-w-80 truncate" >ctx: {conv.context_id}</Pill>
        </div>
      </div>

      {/* pending approvals pinned above the transcript */}
      {(pending.length > 0 || decided.length > 0) && (
        <div className="max-h-[45%] space-y-2 overflow-y-auto border-b border-line bg-bg px-4 py-2">
          {pending.map((a) => (
            <ApprovalCard key={a.id} approval={a} />
          ))}
          {decided.length > 0 && (
            <button className="text-[11px] text-muted hover:text-fg" onClick={() => setShowDecided(!showDecided)}>
              {showDecided ? '▾' : '▸'} {decided.length} decided approval{decided.length > 1 ? 's' : ''}
            </button>
          )}
          {showDecided && decided.map((a) => <ApprovalCard key={a.id} approval={a} />)}
        </div>
      )}

      <MessageList conv={conv} messages={messages} partial={partial} />

      {/* composer */}
      <div className="border-t border-line bg-panel p-2">
        {conv.awaiting_owner && (
          <div className="mb-1.5 rounded bg-purple-500/10 px-2 py-1 text-[11.5px] text-purple-700 dark:text-purple-300">
            {peer} is waiting for your reply. Answer as yourself, or hand back to the agent.
          </div>
        )}
        <ErrorLine error={error} />
        <div className="mt-1 flex items-end gap-2">
          <textarea
            className="input min-h-[38px] flex-1 resize-y"
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
          <button className="btn-primary h-[38px] px-3" disabled={busy || !text.trim() || composer.mode === 'off'} onClick={send}>
            {composer.mode === 'reply' ? `Reply to ${peer}` : 'Send'}
          </button>
        </div>
        <div className="mt-1 text-[10.5px] text-muted">Enter to send · Shift+Enter for newline</div>
      </div>
    </div>
  )
}

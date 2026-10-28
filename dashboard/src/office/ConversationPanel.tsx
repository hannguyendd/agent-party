// A conversation in the Office side column: the map stays visible while the owner reads and steers.

import { useState } from 'react'
import { api, type Approval, type Conversation, type FileIn, type Message } from '../api'
import { ApprovalCard } from '../components/ApprovalCard'
import { errMsg } from '../components/format'
import type { LiveState } from '../useLiveState'
import { Icon } from './Icon'
import { STATUS } from './status'
import { Composer } from './Composer'
import { Avatar, OfficeChat } from './OfficeChat'
import { who } from './people'

interface Props {
  state: LiveState
  conv: Conversation
  messages: Message[] | undefined
  partial?: string
  approvals: Approval[]
  onBack: () => void
  onOpen: (id: string) => void
  onExpand: () => void
  /** The side column is widened for reading. */
  wide?: boolean
}

export function ConversationPanel({ state, conv, messages, partial, approvals, onBack, onOpen, onExpand, wide }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const pending = approvals.filter((a) => a.status === 'pending')
  const mine = who(state, conv.agent_id)
  const peer = conv.peer_agent_id ? who(state, conv.peer_agent_id) : null
  const active = conv.status === 'running' || conv.status === 'awaiting_approval'
  const status = STATUS[conv.status]
  const composer: { mode: 'reply' | 'inject' | 'off'; to: string; placeholder: string } = conv.awaiting_owner
    ? { mode: 'reply', to: `Reply to ${peer?.name ?? 'peer'} as you`, placeholder: `Write your answer to ${peer?.name ?? 'the peer'}…` }
    : conv.mode === 'auto'
      ? { mode: 'inject', to: `To ${mine.name} · only you see this`, placeholder: active ? `Add something while ${mine.name} works…` : `Message ${mine.name}…` }
      : { mode: 'off', to: 'You took over', placeholder: `Waiting for ${peer?.name ?? 'the peer'}. Hand back to let ${mine.name} answer.` }


  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    setMenu(false)
    try {
      await fn()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }
  // Files go to my own agent only; a hand-written reply to the peer is text.
  const send = async (t: string, files: FileIn[]) => {
    let ok = false
    await run(async () => {
      await (composer.mode === 'reply' ? api.reply(conv.id, t) : api.inject(conv.id, t, files))
      setText('')
      ok = true
    })
    return ok
  }
  // Taking over only makes sense when someone is waiting on my agent's answer.
  const canTakeOver = conv.direction === 'inbound'
  const candidates = (state.office?.agents ?? []).filter((a) => !a.agent_id.startsWith(conv.agent_id.split('/')[0] + '/')).map((a) => who(state, a.agent_id))

  return (
    <div className="o-frame office-conv">
      <header className="o-conv-head">
        <button className="o-icon-btn" onClick={onBack} aria-label="Back" title="Back">
          <Icon name="back" />
        </button>
        <div className="o-conv-faces">
          <Avatar w={mine} size={34} />
          {peer && <Avatar w={peer} size={34} />}
        </div>
        <div className="o-conv-title">
          <strong>
            {mine.name}
            {peer && <span> {conv.direction === 'inbound' ? '←' : '→'} {peer.name}</span>}
          </strong>
        </div>
        <span className="o-conv-sub">
          <span className={`o-chip is-${status.tone}`}>{status.label}</span>
          {conv.kind === 'assignment' && <span className="o-chip is-kind">Assignment{conv.accepted ? ' · accepted' : ''}</span>}
          {conv.kind === 'inquiry' && <span className="o-chip is-kind">Question</span>}
          {!peer && <span className="o-chip is-kind">Private</span>}
          {peer && <span className="o-conv-owner">{peer.owner}'s agent</span>}
        </span>
        <div className="o-conv-actions">
          {active && (
            <button className="o-icon-btn" disabled={busy} onClick={() => run(() => api.interrupt(conv.id))} title="Stop the current turn" aria-label="Stop">
              <Icon name="stop" />
            </button>
          )}
          {canTakeOver &&
            (conv.mode === 'auto' && !conv.awaiting_owner ? (
              <button className="o-icon-btn" disabled={busy} onClick={() => run(() => api.takeover(conv.id))} title={`Take over: answer ${peer?.name ?? 'the peer'} yourself`} aria-label="Take over">
                <Icon name="takeover" />
              </button>
            ) : (
              <button className="o-icon-btn is-on" disabled={busy} onClick={() => run(() => api.handback(conv.id))} title={`Hand back to ${mine.name}`} aria-label="Hand back">
                <Icon name="handback" />
              </button>
            ))}
          <div className="o-menu-wrap">
            <button className="o-icon-btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="More" title="More">
              ⋯
            </button>
            {menu && (
              <div className="o-menu" role="menu">
                <button role="menuitem" onClick={() => { setMenu(false); onExpand() }}>
                  <Icon name={wide ? 'zoom-out' : 'zoom-in'} />{wide ? 'Narrow panel' : 'Widen panel'}
                </button>
                <button
                  role="menuitem"
                  disabled={busy || !conv.session_id || active}
                  onClick={() => run(async () => onOpen((await api.fork(conv.id)).conversation_id))}
                  title={conv.session_id ? 'Copy into a private conversation' : 'Nothing to fork yet'}
                >
                  <Icon name="fork" />Fork privately
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {conv.mode === 'manual' && (
        <div className="o-conv-banner">
          You're answering {peer?.name ?? 'the peer'} yourself.{' '}
          <button className="office-link" onClick={() => run(() => api.handback(conv.id))}>Hand back to {mine.name}</button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="office-conv-approvals">
          {pending.map((a) => (
            <ApprovalCard key={a.id} approval={a} />
          ))}
        </div>
      )}

      <OfficeChat state={state} conv={conv} messages={messages} partial={partial} />

      <Composer
        value={text}
        onChange={setText}
        onSend={send}
        to={composer.to}
        placeholder={composer.placeholder}
        candidates={composer.mode === 'inject' ? candidates : []}
        limits={state.node?.files}
        allowFiles={composer.mode === 'inject'}
        disabled={composer.mode === 'off'}
        busy={busy}
        error={error}
      />
    </div>
  )
}

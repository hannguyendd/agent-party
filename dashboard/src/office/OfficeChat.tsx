// Chat transcript for the Office conversation panel: avatars and display names instead of IDs, my side on
// the right, tool calls folded into one line each.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Conversation, Message } from '../api'
import { Json, clockTime } from '../components/ui'
import type { LiveState } from '../useLiveState'
import { SKIN_BY_ID, ownerCss } from './skins'

export interface Who {
  id: string
  name: string
  owner: string
  skin?: string
}

/** Display name, owner and skin for an agent ID, from the Office and this node's agents. */
export function who(state: LiveState, agentId: string | null | undefined): Who {
  const id = agentId ?? 'unknown'
  const inOffice = state.office?.agents.find((a) => a.agent_id === id)
  const local = state.agents[id]
  const [owner, short] = id.includes('/') ? id.split('/') : ['', id]
  return { id, name: inOffice?.name || local?.name || short, owner: inOffice?.owner ?? owner, skin: inOffice?.skin }
}

export function Avatar({ w, size = 28 }: { w: Who | 'me'; size?: number }) {
  if (w === 'me') return <span className="o-avatar o-avatar-me" style={{ width: size, height: size }}>you</span>
  if (w.skin) {
    return (
      <span className="o-avatar" style={{ width: size, height: size, borderColor: ownerCss(w.owner) }}>
        <img src={`office/characters/${w.skin}-portrait.png`} alt="" />
      </span>
    )
  }
  return (
    <span className="o-avatar o-avatar-letter" style={{ width: size, height: size, background: ownerCss(w.owner || w.id) }}>
      {(SKIN_BY_ID[w.skin ?? '']?.emoji ?? w.name[0] ?? '?').toUpperCase()}
    </span>
  )
}

function ToolLine({ use, result }: { use: Message; result?: Message }) {
  const [open, setOpen] = useState(false)
  const input = use.data.input as Record<string, unknown> | undefined
  const summary = input ? String(input.command ?? input.file_path ?? input.path ?? input.pattern ?? input.query ?? Object.values(input)[0] ?? '') : ''
  const isError = result?.data.is_error === true
  return (
    <div className="o-tool">
      <button onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={`o-tool-state ${!result ? 'is-run' : isError ? 'is-err' : 'is-ok'}`}>{!result ? '…' : isError ? '✕' : '✓'}</span>
        <strong>{use.content.replace(/^mcp__mesh__/, 'mesh · ')}</strong>
        <span className="o-tool-sum">{summary}</span>
        <span className="o-tool-caret">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="o-tool-body">
          <Json value={input ?? {}} />
          {result && <Json value={result.content} />}
        </div>
      )}
    </div>
  )
}

export function OfficeChat({ state, conv, messages, partial }: { state: LiveState; conv: Conversation; messages: Message[] | undefined; partial?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const mine = who(state, conv.agent_id)
  const peer = conv.peer_agent_id ? who(state, conv.peer_agent_id) : null
  const results = useMemo(() => {
    const map = new Map<string, Message>()
    for (const m of messages ?? []) if (m.kind === 'tool_result' && typeof m.data.tool_use_id === 'string') map.set(m.data.tool_use_id, m)
    return map
  }, [messages])

  useEffect(() => {
    stick.current = true
  }, [conv.id])
  useLayoutEffect(() => {
    const el = ref.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [messages, partial])

  let lastSender = ''
  return (
    <div
      ref={ref}
      className="o-chat"
      onScroll={(e) => {
        const el = e.currentTarget
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
      }}
    >
      {messages === undefined && <div className="o-chat-empty">Loading…</div>}
      {messages?.length === 0 && !partial && <div className="o-chat-empty">No messages yet. Say something below.</div>}
      {messages?.map((m) => {
        if (m.kind === 'tool_result') return null
        if (m.kind === 'tool_use') return <ToolLine key={m.id} use={m} result={results.get(String(m.data.tool_use_id))} />
        if (m.role === 'system' || m.kind === 'status') {
          lastSender = ''
          return (
            <div key={m.id} className="o-chat-note">
              <span>{m.content}</span>
            </div>
          )
        }
        // My side: my agent and me. Their side: the peer.
        const fromPeer = m.role === 'peer'
        const fromMe = m.role === 'owner'
        const sender = fromPeer ? (peer ?? who(state, String(m.data.sender ?? ''))) : fromMe ? 'me' : mine
        const key = sender === 'me' ? 'me' : sender.id
        const first = key !== lastSender
        lastSender = key
        const state_ = typeof m.data.state === 'string' ? m.data.state : null
        return (
          <div key={m.id} className={`o-msg ${fromPeer ? 'is-theirs' : 'is-mine'} ${fromMe ? 'is-human' : ''} ${first ? 'is-first' : ''}`}>
            <div className="o-msg-avatar">{first && <Avatar w={sender} />}</div>
            <div className="o-msg-col">
              {first && (
                <div className="o-msg-meta">
                  <strong>{sender === 'me' ? (m.data.sent_to_peer ? `You → ${peer?.name ?? 'peer'}` : 'You → your agent') : sender.name}</strong>
                  {sender !== 'me' && sender.owner && <span>{sender.owner}</span>}
                  <time>{clockTime(m.created_at)}</time>
                </div>
              )}
              <div className="o-msg-bubble">{m.content}</div>
              {state_ && state_ !== 'completed' && <span className={`o-msg-state is-${state_}`}>{state_.replace('_', ' ')}</span>}
            </div>
          </div>
        )
      })}
      {(partial || conv.status === 'running') && (() => {
        // Outbound and nothing streaming locally: we're waiting on the peer, so show them working.
        const theirs = !partial && conv.direction === 'outbound' && !!peer
        const w = theirs ? peer! : mine
        return (
        <div className={`o-msg ${theirs ? 'is-theirs' : 'is-mine'} is-first`}>
          <div className="o-msg-avatar">
            <Avatar w={w} />
          </div>
          <div className="o-msg-col">
            <div className="o-msg-meta">
              <strong>{w.name}</strong>
              <span>{partial ? 'typing' : 'working'}</span>
            </div>
            <div className="o-msg-bubble">{partial || <span className="o-dots"><i /><i /><i /></span>}</div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}

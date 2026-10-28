// Chat transcript for the Office conversation panel: avatars and display names instead of IDs, my side on
// the right, tool calls folded into one line each.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { api, type Conversation, type FileRef, type Message } from '../api'
import { Json } from '../components/ui'
import { clockTime } from '../components/format'
import type { LiveState } from '../useLiveState'
import { who, type Who } from './people'
import { SKIN_BY_ID, ownerCss } from './skins'
import { Icon } from './Icon'

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

/** Files on a message: images as thumbnails, everything else as a download chip. Older rows stored plain paths. */
function Attachments({ files }: { files: unknown }) {
  if (!Array.isArray(files) || !files.length) return null
  const refs = files.map((f): Partial<FileRef> => (typeof f === 'string' ? { name: f.split('/').pop(), path: f } : (f as FileRef)))
  return (
    <div className="o-files">
      {refs.map((f, i) =>
        f.id && f.media_type?.startsWith('image/') ? (
          <a key={i} className="o-file-img" href={api.fileUrl(f.id)} target="_blank" rel="noreferrer" title={f.name}>
            <img src={api.fileUrl(f.id)} alt={f.name} loading="lazy" />
          </a>
        ) : f.id ? (
          <a key={i} className="o-file" href={api.fileUrl(f.id)} title={f.path}><Icon name="file" />{f.name}</a>
        ) : (
          <span key={i} className="o-file" title={f.path}><Icon name="file" />{f.name}</span>
        ),
      )}
    </div>
  )
}

/** Mesh tools read as what the agent did ("asked API agent"), not as raw tool calls. */
function MeshEvent({ state, use, result }: { state: LiveState; use: Message; result?: Message }) {
  const input = (use.data.input ?? {}) as Record<string, unknown>
  const tool = use.content.replace(/^mcp__mesh__/, '')
  let parsed: Record<string, unknown> | null = null
  try {
    parsed = result && !result.data.is_error ? (JSON.parse(result.content) as Record<string, unknown>) : null
  } catch {
    parsed = null
  }
  if (tool === 'list_agents') {
    const n = Array.isArray(parsed) ? parsed.length : null
    return <div className="o-event">🔎 {result ? `Looked through ${n ?? 'the'} agent${n === 1 ? '' : 's'} on the mesh` : 'Looking for the right person…'}</div>
  }
  if (tool === 'needs_input') return <div className="o-event">❓ Asked a follow-up question</div>
  if (tool === 'send_message' || tool === 'share_file') {
    const to = who(state, String(input.to ?? ''))
    const reply = parsed && typeof parsed.reply === 'string' ? parsed.reply : null
    const failed = result?.data.is_error === true
    return (
      <div className="o-exchange">
        <div className="o-exchange-head">
          <Avatar w={to} size={22} />
          <span>
            {tool === 'share_file' ? `Sent ${String(input.path ?? 'a file')} to` : 'Asked'} <strong>{to.name}</strong>
            {to.owner && <small> · {to.owner}</small>}
          </span>
        </div>
        {typeof input.text === 'string' && input.text && <div className="o-exchange-q">{input.text}</div>}
        {!result && <div className="o-exchange-wait"><span className="o-dots"><i /><i /><i /></span> waiting for {to.name}</div>}
        {failed && <div className="o-exchange-err">{result?.content}</div>}
        {reply && <div className="o-exchange-a"><strong>{to.name}:</strong> {reply}</div>}
      </div>
    )
  }
  return null
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

  // Long runs of consecutive status notes (take over / hand back…) collapse to the last two.
  const [showAllNotes, setShowAllNotes] = useState(false)
  const noteRuns = useMemo(() => {
    const out = new Map<string, 'hidden' | number>()
    if (showAllNotes || !messages) return out
    const isNote = (m: Message) => m.role === 'system' || m.kind === 'status'
    let run: Message[] = []
    const flush = () => {
      if (run.length > 2) {
        run.slice(0, -2).forEach((m) => out.set(m.id, 'hidden'))
        out.set(run[run.length - 2].id, run.length - 2)
      }
      run = []
    }
    for (const m of messages) {
      if (isNote(m)) run.push(m)
      else if (m.kind !== 'tool_result') flush()
    }
    flush()
    return out
  }, [messages, showAllNotes])

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
        if (m.kind === 'tool_use') {
          const result = results.get(String(m.data.tool_use_id))
          if (m.content.startsWith('mcp__mesh__')) return <MeshEvent key={m.id} state={state} use={m} result={result} />
          return <ToolLine key={m.id} use={m} result={result} />
        }
        if (m.role === 'system' || m.kind === 'status') {
          lastSender = ''
          const run = noteRuns.get(m.id)
          if (run === 'hidden') return null
          return (
            <div key={m.id} className="o-chat-note">
              {typeof run === 'number' && (
                <button className="o-chat-more" onClick={() => setShowAllNotes(true)}>
                  +{run} earlier update{run > 1 ? 's' : ''}
                </button>
              )}
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
              {(m.content || !Array.isArray(m.data.files)) && <div className="o-msg-bubble">{m.content}</div>}
              <Attachments files={m.data.files} />
              {Array.isArray(m.data.rejected_files) && m.data.rejected_files.length > 0 && (
                <span className="o-msg-state is-rejected">Not accepted: {(m.data.rejected_files as string[]).join('; ')}</span>
              )}
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

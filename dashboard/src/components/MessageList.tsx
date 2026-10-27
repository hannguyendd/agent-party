import clsx from 'clsx'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Conversation, Message } from '../api'
import { Json, clockTime } from './ui'

function Files({ files }: { files: unknown }) {
  if (!Array.isArray(files) || files.length === 0) return null
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {files.map((f) => (
        <span key={String(f)} className="rounded border border-line bg-panel px-1.5 py-px font-mono text-[11px]" title={String(f)}>
          📎 {String(f).split('/').pop()}
        </span>
      ))}
    </div>
  )
}

function ToolCard({ use, result }: { use: Message; result?: Message }) {
  const [open, setOpen] = useState(false)
  const input = use.data.input as Record<string, unknown> | undefined
  // One-line summary from the most telling input field.
  const summary = input
    ? String(input.command ?? input.file_path ?? input.path ?? input.pattern ?? input.url ?? input.query ?? Object.values(input)[0] ?? '')
    : ''
  const isError = result?.data.is_error === true
  return (
    <div className="flex justify-end">
      <div className={clsx('w-[min(46rem,85%)] rounded-md border bg-panel text-[12px]', isError ? 'border-red-500/40' : 'border-line')}>
        <button className="flex w-full items-center gap-2 px-2 py-1 text-left" onClick={() => setOpen(!open)}>
          <span className="text-[10px] text-muted">{open ? '▾' : '▸'}</span>
          <span className="font-mono font-semibold">{use.content}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-muted">{summary}</span>
          {result ? (
            <span className={clsx('text-[10px] font-medium', isError ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
              {isError ? 'error' : 'ok'}
            </span>
          ) : (
            <span className="text-[10px] text-muted">…</span>
          )}
        </button>
        {open && (
          <div className="space-y-1.5 border-t border-line p-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Input</div>
            <Json value={input ?? {}} />
            {result && (
              <>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Result</div>
                <Json value={result.content} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Bubble({ m, conv }: { m: Message; conv: Conversation }) {
  const peer = m.role === 'peer'
  const owner = m.role === 'owner'
  const label = peer
    ? String(m.data.sender ?? conv.peer_agent_id ?? 'peer')
    : owner
      ? m.data.sent_to_peer
        ? `you → ${conv.peer_agent_id ?? 'peer'}`
        : 'you → agent'
      : conv.agent_id
  const state = typeof m.data.state === 'string' ? m.data.state : null
  return (
    <div className={clsx('flex flex-col', peer ? 'items-start' : 'items-end')}>
      <div className="mb-0.5 flex items-center gap-1.5 px-1 text-[10.5px] text-muted">
        <span className="font-mono">{label}</span>
        {state && <span className="rounded bg-panel-2 px-1">{state}</span>}
        <span>{clockTime(m.created_at)}</span>
      </div>
      <div
        className={clsx(
          'max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words',
          peer && 'rounded-tl-sm border border-line bg-peer',
          m.role === 'agent' && 'rounded-tr-sm bg-agentbg',
          owner && 'rounded-tr-sm border border-amber-500/40 bg-ownerbg',
        )}
      >
        {m.content}
        <Files files={m.data.files} />
      </div>
    </div>
  )
}

export function MessageList({ conv, messages, partial }: { conv: Conversation; messages: Message[] | undefined; partial?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  const results = useMemo(() => {
    const map = new Map<string, Message>()
    for (const m of messages ?? []) if (m.kind === 'tool_result' && typeof m.data.tool_use_id === 'string') map.set(m.data.tool_use_id, m)
    return map
  }, [messages])
  const usedIds = useMemo(
    () => new Set((messages ?? []).filter((m) => m.kind === 'tool_use').map((m) => String(m.data.tool_use_id))),
    [messages],
  )

  useEffect(() => {
    stick.current = true
  }, [conv.id])
  useLayoutEffect(() => {
    const el = ref.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [messages, partial])

  return (
    <div
      ref={ref}
      className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3"
      onScroll={(e) => {
        const el = e.currentTarget
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
      }}
    >
      {messages === undefined && <div className="text-center text-xs text-muted">Loading…</div>}
      {messages?.length === 0 && !partial && <div className="text-center text-xs text-muted">No messages yet.</div>}
      {messages?.map((m) => {
        if (m.kind === 'tool_use') return <ToolCard key={m.id} use={m} result={results.get(String(m.data.tool_use_id))} />
        if (m.kind === 'tool_result') {
          if (usedIds.has(String(m.data.tool_use_id))) return null
          return (
            <div key={m.id} className="flex justify-end">
              <div className="w-[min(46rem,85%)]">
                <Json value={m.content} />
              </div>
            </div>
          )
        }
        if (m.role === 'system' || m.kind === 'status')
          return (
            <div key={m.id} className="flex items-center gap-2 text-[11px] text-muted">
              <div className="h-px flex-1 bg-line" />
              <span>{m.content}</span>
              <span className="opacity-60">{clockTime(m.created_at)}</span>
              <div className="h-px flex-1 bg-line" />
            </div>
          )
        return <Bubble key={m.id} m={m} conv={conv} />
      })}
      {partial && (
        <div className="flex flex-col items-end">
          <div className="mb-0.5 px-1 font-mono text-[10.5px] text-muted">{conv.agent_id} · typing</div>
          <div className="max-w-[85%] rounded-lg rounded-tr-sm bg-agentbg px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words">
            {partial}
            <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-current opacity-60" />
          </div>
        </div>
      )}
      {!partial && conv.status === 'running' && (
        <div className="flex justify-end">
          <div className="flex gap-1 rounded-lg bg-agentbg px-3 py-2.5">
            {[0, 150, 300].map((d) => (
              <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

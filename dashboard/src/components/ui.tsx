import clsx from 'clsx'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import type { ConversationStatus } from '../api'

const STATUS: Record<ConversationStatus, { label: string; cls: string }> = {
  running: { label: 'running', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  awaiting_approval: { label: 'approval', cls: 'bg-amber-500/20 text-amber-700 dark:text-amber-300' },
  awaiting_owner: { label: 'your turn', cls: 'bg-purple-500/20 text-purple-700 dark:text-purple-300' },
  idle: { label: 'idle', cls: 'bg-zinc-500/15 text-muted' },
  done: { label: 'done', cls: 'bg-zinc-500/15 text-muted' },
  interrupted: { label: 'stopped', cls: 'bg-orange-500/15 text-orange-700 dark:text-orange-300' },
  error: { label: 'error', cls: 'bg-red-500/15 text-red-700 dark:text-red-300' },
}

export function StatusBadge({ status }: { status: ConversationStatus }) {
  const s = STATUS[status] ?? STATUS.idle
  return (
    <span className={clsx('inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-px text-[10px] font-medium uppercase tracking-wide', s.cls)}>
      {status === 'running' && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {s.label}
    </span>
  )
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={clsx('rounded border border-line px-1.5 py-px font-mono text-[11px]', className)}>{children}</span>
}

export function Json({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto rounded bg-panel-2 p-2 font-mono text-[11.5px] leading-snug whitespace-pre-wrap break-all">
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </pre>
  )
}

/** Chips input: type and press Enter/comma to add; Backspace removes the last chip. */
export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('')
  const commit = (raw: string) => {
    const parts = raw.split(',').map((x) => x.trim()).filter(Boolean)
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.includes(p))])
    setDraft('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(draft)
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }
  return (
    <div className="flex min-h-[30px] flex-wrap items-center gap-1 rounded border border-line bg-panel px-1.5 py-1 focus-within:border-accent">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded bg-panel-2 px-1.5 py-px font-mono text-[11.5px]">
          {t}
          <button type="button" className="text-muted hover:text-fg" onClick={() => onChange(value.filter((x) => x !== t))}>
            ×
          </button>
        </span>
      ))}
      <input
        className="min-w-[8ch] flex-1 bg-transparent text-[13px] outline-none"
        value={draft}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => (e.target.value.includes(',') ? commit(e.target.value) : setDraft(e.target.value))}
        onKeyDown={onKey}
        onBlur={() => draft && commit(draft)}
      />
    </div>
  )
}

export function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null
  return <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-700 dark:text-red-300">{error}</div>
}


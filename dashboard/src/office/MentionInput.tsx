// A message box that offers agents when you type "@", so you can point your agent at a specific colleague's agent.

import { useEffect, useRef, useState } from 'react'
import { Avatar } from './OfficeChat'
import type { Who } from './people'

interface Props {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  candidates: Who[]
  placeholder?: string
  disabled?: boolean
  maxHeight?: number
  /** Files pasted into the box (e.g. a screenshot). */
  onPasteFiles?: (files: File[]) => void
}

/** The "@query" right before the caret, if any. */
function mentionAt(text: string, caret: number): { start: number; query: string } | null {
  const m = /(^|\s)@([\w/-]*)$/.exec(text.slice(0, caret))
  return m ? { start: caret - m[2].length - 1, query: m[2].toLowerCase() } : null
}

export function MentionInput({ value, onChange, onSubmit, candidates, placeholder, disabled, maxHeight = 160, onPasteFiles }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [caret, setCaret] = useState(0)
  const [pick, setPick] = useState(0)
  const [closed, setClosed] = useState(false)
  const at = mentionAt(value, caret)
  const options = at && !closed
    ? candidates
        .filter((c) => !at.query || c.id.toLowerCase().includes(at.query) || c.name.toLowerCase().includes(at.query))
        .slice(0, 6)
    : []
  const sel = Math.min(pick, Math.max(0, options.length - 1))

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(maxHeight, el.scrollHeight)}px`
  }, [value, maxHeight])

  const choose = (c: Who) => {
    if (!at) return
    const insert = `@${c.id} `
    const next = value.slice(0, at.start) + insert + value.slice(caret)
    onChange(next)
    const pos = at.start + insert.length
    requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.setSelectionRange(pos, pos)
      setCaret(pos)
    })
  }

  return (
    <div className="o-mention">
      {options.length > 0 && (
        <div className="o-mention-list" role="listbox" aria-label="Mention an agent">
          <div className="o-mention-hint">Ask this agent directly</div>
          {options.map((c, i) => (
            <button
              key={c.id}
              role="option"
              aria-selected={i === sel}
              className={i === sel ? 'is-active' : ''}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(c)
              }}
            >
              <Avatar w={c} size={24} />
              <span>
                <strong>{c.name}</strong>
                <small>{c.id}</small>
              </span>
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={ref}
        className="input"
        rows={1}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          setCaret(e.target.selectionStart)
          setClosed(false)
          setPick(0)
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files)
          if (files.length && onPasteFiles) {
            e.preventDefault()
            onPasteFiles(files)
          }
        }}
        onKeyDown={(e) => {
          if (options.length) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              setPick((sel + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length)
              return
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault()
              choose(options[sel])
              return
            }
            if (e.key === 'Escape') {
              setClosed(true)
              return
            }
          }
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            onSubmit()
          }
        }}
      />
    </div>
  )
}

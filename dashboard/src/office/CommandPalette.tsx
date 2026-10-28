// ⌘K / Ctrl+K: type to jump anywhere (an agent, a chat, History, Settings) or run an action. Also lists the
// keyboard shortcuts (`?`). Other screens hear its commands through `officeCommand` events.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { View } from '../App'
import type { LiveState } from '../useLiveState'
import { setSoundSettings, soundSettings } from '../sound'
import { Icon, type IconName } from './Icon'
import { agentNames, who } from './people'
import { plainPreview } from './render-md'
import { STATUS } from './status'
import { officeCommand } from './commands'

interface Item {
  id: string
  group: string
  label: string
  hint?: string
  icon: IconName
  keys?: string
  run: () => void
}

const SHORTCUTS: [string, string][] = [
  ['⌘K / Ctrl K', 'Search and commands'],
  ['N', 'Notifications'],
  ['M', 'Message the selected agent'],
  ['G then O', 'Office'],
  ['G then H', 'History'],
  ['G then S', 'Settings'],
  ['?', 'Show shortcuts'],
]

export function CommandPalette({ state, go, onClose, initial = '' }: { state: LiveState; go: (v: View) => void; onClose: () => void; initial?: string }) {
  const [q, setQ] = useState(initial)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])
  const nameOf = useMemo(() => agentNames(state), [state])

  const items = useMemo<Item[]>(() => {
    const done = (fn: () => void) => () => { onClose(); fn() }
    const me = state.node?.owner ?? ''
    const actions: Item[] = [
      { id: 'office', group: 'Go to', label: 'Office', icon: 'office', keys: 'G O', run: done(() => go({ kind: 'office' })) },
      { id: 'history', group: 'Go to', label: 'History', icon: 'clock', keys: 'G H', run: done(() => go({ kind: 'history' })) },
      { id: 'settings', group: 'Go to', label: 'Settings', icon: 'settings', keys: 'G S', run: done(() => go({ kind: 'settings' })) },
      { id: 'approvals', group: 'Go to', label: 'Approvals', icon: 'approvals', run: done(() => go({ kind: 'office', side: 'approvals' })) },
      { id: 'bell', group: 'Actions', label: 'Open notifications', icon: 'approvals-pending', keys: 'N', run: done(() => officeCommand({ type: 'bell' })) },
      { id: 'new-agent', group: 'Actions', label: 'New agent', icon: 'agents', run: done(() => { go({ kind: 'office' }); officeCommand({ type: 'new-agent' }) }) },
      { id: 'music', group: 'Actions', label: soundSettings().music ? 'Stop background music' : 'Play background music', icon: 'notifications-on', run: done(() => setSoundSettings({ music: !soundSettings().music })) },
    ]
    const agents: Item[] = Object.values(state.agents)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a) => ({
        id: `agent-${a.id}`, group: 'Your agents', label: `Message ${a.name}`, hint: a.id, icon: 'new-chat' as IconName,
        run: done(() => { go({ kind: 'office' }); officeCommand({ type: 'message', agentId: a.id }) }),
      }))
    const colleagues: Item[] = (state.office?.agents ?? [])
      .filter((a) => a.owner !== me)
      .map((a) => ({
        id: `peer-${a.agent_id}`, group: 'In the office', label: a.name, hint: `${a.owner}'s agent`, icon: 'people' as IconName,
        run: done(() => { go({ kind: 'office' }); officeCommand({ type: 'find', agentId: a.agent_id }) }),
      }))
    const chats: Item[] = Object.values(state.conversations)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 40)
      .map((c) => ({
        id: `conv-${c.id}`, group: 'Chats',
        label: c.topic || plainPreview(c.title, nameOf) || 'Untitled',
        hint: `${who(state, c.agent_id).name}${c.peer_agent_id ? ` ↔ ${who(state, c.peer_agent_id).name}` : ''} · ${STATUS[c.status].label}`,
        icon: 'inquiry' as IconName,
        run: done(() => go({ kind: 'office', side: 'chats', conv: c.id })),
      }))
    return [...actions, ...agents, ...colleagues, ...chats]
  }, [state, go, onClose, nameOf])

  const term = q.trim().toLowerCase()
  const shown = useMemo(() => {
    const words = term.split(/\s+/).filter(Boolean)
    const hit = items.filter((i) => words.every((w) => `${i.label} ${i.hint ?? ''} ${i.group}`.toLowerCase().includes(w)))
    const list = term ? hit.slice(0, 30) : hit.filter((i) => i.group !== 'Chats').concat(hit.filter((i) => i.group === 'Chats').slice(0, 6))
    if (term.length >= 2) {
      list.push({ id: 'search', group: 'History', label: `Search all chats for “${q.trim()}”`, icon: 'search', run: () => { onClose(); go({ kind: 'history', q: q.trim() }) } })
    }
    return list
  }, [items, term, q, go, onClose])
  const current = Math.min(active, Math.max(0, shown.length - 1))

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((current + 1) % Math.max(1, shown.length)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((current - 1 + shown.length) % Math.max(1, shown.length)) }
    else if (e.key === 'Enter') { e.preventDefault(); shown[current]?.run() }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  let lastGroup = ''
  return (
    <div className="office-view cmdk-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="o-frame cmdk" role="dialog" aria-label="Search and commands">
        <label className="cmdk-input">
          <Icon name="search" />
          <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setActive(0) }} onKeyDown={onKey}
            placeholder="Search agents, chats, actions…" aria-label="Search" />
          <kbd>Esc</kbd>
        </label>
        <ul className="cmdk-list" role="listbox">
          {q === '?' ? (
            SHORTCUTS.map(([k, label]) => <li key={k} className="cmdk-shortcut"><span>{label}</span><kbd>{k}</kbd></li>)
          ) : shown.length === 0 ? (
            <li className="cmdk-empty">Nothing found. Type ? for keyboard shortcuts.</li>
          ) : (
            shown.map((i, n) => {
              const head = i.group !== lastGroup ? <li className="cmdk-group" key={`g-${i.group}`}>{i.group}</li> : null
              lastGroup = i.group
              return [
                head,
                <li key={i.id} role="option" aria-selected={n === current}>
                  <button className={n === current ? 'is-active' : ''} onMouseEnter={() => setActive(n)} onClick={i.run}>
                    <Icon name={i.icon} />
                    <span>{i.label}</span>
                    {i.hint && <small>{i.hint}</small>}
                    {i.keys && <kbd>{i.keys}</kbd>}
                  </button>
                </li>,
              ]
            })
          )}
        </ul>
        <footer className="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>?</kbd> shortcuts</span></footer>
      </div>
    </div>
  )
}

import clsx from 'clsx'
import { useState } from 'react'
import type { Agent, Conversation } from '../api'
import type { View } from '../App'
import { DirectionIcon, StatusBadge, timeAgo } from './ui'

interface Props {
  agents: Agent[]
  conversations: Conversation[]
  view: View
  go: (v: View) => void
}

export function Sidebar({ agents, conversations, view, go }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const byAgent = new Map<string, Conversation[]>()
  for (const c of conversations) byAgent.set(c.agent_id, [...(byAgent.get(c.agent_id) ?? []), c])
  for (const list of byAgent.values()) list.sort((a, b) => b.updated_at.localeCompare(a.updated_at))

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Agents</span>
        <button className="btn" onClick={() => go({ kind: 'agent-edit' })}>
          + New agent
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {agents.length === 0 && <div className="px-3 py-4 text-xs text-muted">No agents yet. Create one to publish it on the mesh.</div>}
        {agents.map((a) => {
          const convs = byAgent.get(a.id) ?? []
          const isCollapsed = collapsed[a.id]
          const editing = view.kind === 'agent-edit' && view.id === a.id
          return (
            <div key={a.id} className="mb-1">
              <div className={clsx('group flex items-center gap-1 px-2 py-1', editing && 'bg-panel-2')}>
                <button
                  className="w-4 text-[10px] text-muted"
                  onClick={() => setCollapsed({ ...collapsed, [a.id]: !isCollapsed })}
                  title={isCollapsed ? 'Expand' : 'Collapse'}
                >
                  {isCollapsed ? '▸' : '▾'}
                </button>
                <button className="min-w-0 flex-1 text-left" onClick={() => go({ kind: 'agent-edit', id: a.id })} title="Edit agent">
                  <div className="truncate text-[13px] font-medium">{a.name}</div>
                  <div className="truncate font-mono text-[11px] text-muted">{a.id}</div>
                </button>
                <button
                  className="btn px-1.5 py-0.5 text-[11px] opacity-0 group-hover:opacity-100 focus:opacity-100"
                  onClick={() => go({ kind: 'start', agentId: a.id })}
                  title="Start a local session with this agent"
                >
                  ▶ Start
                </button>
              </div>
              {!isCollapsed &&
                convs.map((c) => {
                  const active = view.kind === 'conversation' && view.id === c.id
                  return (
                    <button
                      key={c.id}
                      onClick={() => go({ kind: 'conversation', id: c.id })}
                      className={clsx(
                        'flex w-full items-center gap-1.5 py-1 pr-2 pl-7 text-left hover:bg-panel-2',
                        active && 'bg-panel-2 shadow-[inset_2px_0_0_var(--accent)]',
                      )}
                    >
                      <DirectionIcon direction={c.direction} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-[11.5px]">{c.peer_agent_id ?? (c.direction === 'local' ? 'you' : '—')}</div>
                        <div className="truncate text-[11.5px] text-muted">{c.title || 'untitled'}</div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <StatusBadge status={c.status} />
                        <span className="text-[10px] text-muted">{timeAgo(c.updated_at)}</span>
                      </div>
                    </button>
                  )
                })}
              {!isCollapsed && convs.length === 0 && <div className="py-0.5 pl-8 text-[11px] text-muted">no sessions</div>}
            </div>
          )
        })}
      </div>
    </aside>
  )
}

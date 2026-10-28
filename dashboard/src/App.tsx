import { Suspense, lazy, useCallback, useMemo, useState } from 'react'
import { AgentForm } from './components/AgentForm'
import { ApprovalCard } from './components/ApprovalCard'
import { Directory } from './components/Directory'
import { Header } from './components/Header'
import { SessionView } from './components/SessionView'
import { Sidebar } from './components/Sidebar'
import { StartSession } from './components/StartSession'
import { StatusBadge } from './components/ui'
import { useLiveState } from './useLiveState'
import { useApprovalNotifications } from './useNotifications'

// Phaser is large; load it only when the Office opens.
const OfficeView = lazy(() => import('./office/OfficeView'))

export type View =
  | { kind: 'home' }
  | { kind: 'office' }
  | { kind: 'conversation'; id: string }
  | { kind: 'agent-edit'; id?: string }
  | { kind: 'start'; agentId: string }
  | { kind: 'directory' }
  | { kind: 'approvals' }

export default function App() {
  const [view, setView] = useState<View>({ kind: 'office' })
  // The Office side column can show one conversation too; load its history the same way.
  const [officeConv, setOfficeConv] = useState<string | null>(null)
  const openId = view.kind === 'conversation' ? view.id : view.kind === 'office' ? officeConv : null
  const { state, setNode, clearOfficeError } = useLiveState(openId)

  const agents = useMemo(() => Object.values(state.agents).sort((a, b) => a.id.localeCompare(b.id)), [state.agents])
  const conversations = useMemo(() => Object.values(state.conversations), [state.conversations])
  const approvals = useMemo(
    () => Object.values(state.approvals).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [state.approvals],
  )
  const pending = approvals.filter((a) => a.status === 'pending')
  const openApproval = useCallback((a: { conversation_id: string }) => setView({ kind: 'conversation', id: a.conversation_id }), [])
  useApprovalNotifications(state.approvals, openApproval)
  const owner = state.node?.owner ?? ''

  let main: React.ReactNode
  switch (view.kind) {
    case 'office':
      main = <Suspense fallback={<Empty>Opening office…</Empty>}><OfficeView state={state} go={setView} clearError={clearOfficeError} openConv={officeConv} setOpenConv={setOfficeConv} /></Suspense>
      break
    case 'conversation': {
      const conv = state.conversations[view.id]
      main = conv ? (
        <SessionView
          key={conv.id}
          conv={conv}
          messages={state.messages[conv.id]}
          partial={state.partial[conv.id]}
          approvals={approvals.filter((a) => a.conversation_id === conv.id)}
          onOpen={(id) => setView({ kind: 'conversation', id })}
        />
      ) : (
        <Empty>Loading conversation…</Empty>
      )
      break
    }
    case 'agent-edit': {
      const agent = view.id ? state.agents[view.id] : undefined
      main =
        view.id && !agent ? (
          <Empty>Agent not found.</Empty>
        ) : !state.node ? (
          <Empty>Connecting to node…</Empty>
        ) : (
          <AgentForm
            key={view.id ?? 'new'}
            owner={owner}
            agent={agent}
            onSaved={(a) => setView({ kind: 'agent-edit', id: a.id })}
            onDeleted={() => setView({ kind: 'home' })}
            onStart={(id) => setView({ kind: 'start', agentId: id })}
          />
        )
      break
    }
    case 'start': {
      const agent = state.agents[view.agentId]
      main = agent ? <StartSession agent={agent} onStarted={(id) => setView({ kind: 'conversation', id })} /> : <Empty>Agent not found.</Empty>
      break
    }
    case 'directory':
      main = <Directory />
      break
    case 'approvals':
      main = (
        <div className="mx-auto max-w-3xl space-y-2 p-5">
          <h1 className="text-base font-semibold">Pending approvals</h1>
          {pending.length === 0 && <div className="text-xs text-muted">Nothing waiting for you.</div>}
          {pending.map((a) => {
            const c = state.conversations[a.conversation_id]
            return (
              <ApprovalCard
                key={a.id}
                approval={a}
                context={
                  <button className="hover:underline" onClick={() => setView({ kind: 'conversation', id: a.conversation_id })}>
                    <span className="font-mono">{c?.agent_id ?? a.conversation_id}</span>
                    {c?.peer_agent_id && <span className="font-mono"> ↔ {c.peer_agent_id}</span>}
                    {c?.title && <span> · {c.title}</span>} →
                  </button>
                }
              />
            )
          })}
        </div>
      )
      break
    default:
      main = <Home conversations={conversations} go={setView} hasAgents={agents.length > 0} />
  }

  if (view.kind === 'office') return <div className="h-full">{main}</div>

  return (
    <div className="flex h-full flex-col">
      <Header node={state.node} connected={state.connected} pendingApprovals={pending.length} view={view} go={setView} setNode={setNode} />
      <div className="flex min-h-0 flex-1">
        <Sidebar agents={agents} conversations={conversations} view={view} go={setView} />
        <main className="min-w-0 flex-1 overflow-y-auto">{main}</main>
      </div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full place-items-center text-xs text-muted">{children}</div>
}

function Home({ conversations, go, hasAgents }: { conversations: import('./api').Conversation[]; go: (v: View) => void; hasAgents: boolean }) {
  const attention = conversations.filter((c) => c.status === 'awaiting_approval' || c.status === 'awaiting_owner' || c.status === 'running')
  if (!hasAgents)
    return (
      <Empty>
        <div className="text-center">
          <div className="mb-2">No agents on this node yet.</div>
          <button className="btn-primary" onClick={() => go({ kind: 'agent-edit' })}>
            + Create your first agent
          </button>
        </div>
      </Empty>
    )
  return (
    <div className="mx-auto max-w-3xl p-5">
      <h1 className="mb-2 text-base font-semibold">Active now</h1>
      {attention.length === 0 && <div className="text-xs text-muted">No sessions are running. Pick a session in the sidebar or start one.</div>}
      <div className="space-y-1">
        {attention.map((c) => (
          <button
            key={c.id}
            className="flex w-full items-center gap-2 rounded border border-line bg-panel px-3 py-2 text-left hover:bg-panel-2"
            onClick={() => go({ kind: 'conversation', id: c.id })}
          >
            <span className="font-mono text-xs">{c.agent_id}</span>
            {c.peer_agent_id && <span className="font-mono text-xs text-muted">↔ {c.peer_agent_id}</span>}
            <span className="min-w-0 flex-1 truncate text-xs text-muted">{c.title}</span>
            <StatusBadge status={c.status} />
          </button>
        ))}
      </div>
    </div>
  )
}

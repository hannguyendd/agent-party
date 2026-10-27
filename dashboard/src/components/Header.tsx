import clsx from 'clsx'
import { useState } from 'react'
import { api, type NodeInfo } from '../api'
import type { View } from '../App'
import { errMsg } from './ui'

interface Props {
  node: NodeInfo | null
  connected: boolean
  pendingApprovals: number
  view: View
  go: (v: View) => void
  setNode: (n: NodeInfo) => void
}

export function Header({ node, connected, pendingApprovals, view, go, setNode }: Props) {
  const mesh = node?.mesh
  return (
    <>
      <header className="flex h-10 shrink-0 items-center gap-3 border-b border-line bg-panel px-3">
        <button className="flex items-center gap-2 font-semibold" onClick={() => go({ kind: 'home' })}>
          <span className="grid size-5 place-items-center rounded bg-accent text-[11px] text-white">◆</span>
          Agent Mesh
        </button>
        {node && <span className="font-mono text-xs text-muted">{node.owner}@{node.base_url}</span>}
        <nav className="ml-4 flex gap-1">
          <button className={clsx('btn border-transparent', view.kind === 'directory' && 'bg-panel-2')} onClick={() => go({ kind: 'directory' })}>
            Mesh directory
          </button>
          <button className={clsx('btn border-transparent', view.kind === 'approvals' && 'bg-panel-2')} onClick={() => go({ kind: 'approvals' })}>
            Approvals
            {pendingApprovals > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{pendingApprovals}</span>
            )}
          </button>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-[11px] text-muted">
          {mesh && (
            <span className="flex items-center gap-1" title={`agentmesh-node at ${mesh.node_url}`}>
              <span className={clsx('size-1.5 rounded-full', mesh.node_healthy ? 'bg-emerald-500' : 'bg-red-500')} />
              mesh {mesh.node_healthy ? 'up' : 'down'}
            </span>
          )}
          <span className="flex items-center gap-1" title="Live event stream">
            <span className={clsx('size-1.5 rounded-full', connected ? 'bg-emerald-500' : 'animate-pulse bg-amber-500')} />
            {connected ? 'live' : 'reconnecting…'}
          </span>
        </div>
      </header>
      {mesh?.config_dirty && <MeshBanner configPath={mesh.config_path} node={node!} setNode={setNode} />}
    </>
  )
}

function MeshBanner({ configPath, node, setNode }: { configPath: string; node: NodeInfo; setNode: (n: NodeInfo) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirm = async () => {
    setBusy(true)
    try {
      setNode({ ...node, mesh: await api.meshRestarted() })
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-200">
      <span>⚠</span>
      <span>
        <span className="font-mono" title={configPath}>
          agentmesh-node.yaml
        </span>{' '}
        changed — restart <span className="font-mono">agentmesh-node</span> to publish
      </span>
      {error && <span className="text-red-600 dark:text-red-400">{error}</span>}
      <button className="btn ml-auto" disabled={busy} onClick={confirm}>
        I restarted it
      </button>
    </div>
  )
}

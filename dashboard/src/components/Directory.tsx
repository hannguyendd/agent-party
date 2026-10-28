import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { api, type DirectoryEntry } from '../api'
import { ErrorLine } from './ui'
import { errMsg } from './format'

const LOC: Record<DirectoryEntry['location'], string> = {
  local: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  mesh: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  static: 'bg-zinc-500/15 text-muted',
}

export function Directory() {
  const [rows, setRows] = useState<DirectoryEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  // Bumping `tick` refetches; state is only set from the promise callbacks.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    api
      .directory()
      .then((r) => live && setRows(r))
      .catch((e) => live && setError(errMsg(e)))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [tick])
  const load = () => {
    setLoading(true)
    setError(null)
    setTick((t) => t + 1)
  }

  const needle = q.toLowerCase()
  const shown = (rows ?? []).filter((r) => !needle || `${r.agent_id} ${r.name} ${r.description}`.toLowerCase().includes(needle))

  return (
    <div className="mx-auto max-w-4xl p-5">
      <div className="mb-3 flex items-center gap-2">
        <h1 className="text-base font-semibold whitespace-nowrap">Mesh directory</h1>
        <span className="text-xs whitespace-nowrap text-muted">{rows ? `${rows.length} agents` : ''}</span>
        <input className="input ml-auto w-64" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      <ErrorLine error={error} />
      <div className="overflow-hidden rounded-md border border-line bg-panel">
        <table className="w-full text-left text-[12.5px]">
          <thead className="border-b border-line bg-panel-2 text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-1.5 font-medium">Agent</th>
              <th className="px-3 py-1.5 font-medium">Description</th>
              <th className="px-3 py-1.5 font-medium">Where</th>
              <th className="px-3 py-1.5 font-medium">Peer</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.agent_id} className="border-b border-line last:border-0 align-top">
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={clsx('size-1.5 rounded-full', r.online ? 'bg-emerald-500' : 'bg-zinc-400')} title={r.online ? 'online' : 'offline'} />
                    <span className="font-mono">{r.agent_id}</span>
                  </div>
                  {r.name !== r.agent_id && <div className="pl-3 text-[11.5px] text-muted">{r.name}</div>}
                </td>
                <td className="px-3 py-1.5 text-muted">{r.description || '—'}</td>
                <td className="px-3 py-1.5">
                  <span className={clsx('rounded px-1.5 py-px text-[10.5px] font-medium', LOC[r.location])}>{r.location}</span>
                </td>
                <td className="max-w-40 truncate px-3 py-1.5 font-mono text-[11px] text-muted" title={r.peer_id}>
                  {r.peer_id ?? ''}
                </td>
              </tr>
            ))}
            {rows && shown.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-xs text-muted">
                  No agents found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import clsx from 'clsx'
import { useState } from 'react'
import { api, type Approval } from '../api'
import { ErrorLine, Json, errMsg, timeAgo } from './ui'

export function ApprovalCard({ approval, context }: { approval: Approval; context?: React.ReactNode }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = approval.status === 'pending'

  const decide = async (allow: boolean) => {
    setBusy(true)
    setError(null)
    try {
      await api.decide(approval.id, allow, reason)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={clsx(
        'rounded-md border p-2.5',
        pending ? 'border-amber-500/50 bg-amber-500/5' : 'border-line bg-panel opacity-75',
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          {pending ? 'Approval needed' : approval.status.replace('_', ' ')}
        </span>
        <span className="font-mono text-[12.5px] font-semibold">{approval.tool_name}</span>
        <span className="ml-auto text-[11px] text-muted">{timeAgo(approval.created_at)}</span>
      </div>
      {context && <div className="mb-1.5 text-xs text-muted">{context}</div>}
      <Json value={approval.tool_input} />
      {!pending && approval.reason && <div className="mt-1 text-xs text-muted">Reason: {approval.reason}</div>}
      {pending && (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            className="input flex-1"
            placeholder="Reason (optional, sent to the agent)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button className="btn-primary" disabled={busy} onClick={() => decide(true)}>
            Allow
          </button>
          <button className="btn-danger" disabled={busy} onClick={() => decide(false)}>
            Deny
          </button>
        </div>
      )}
      <div className="mt-1.5">
        <ErrorLine error={error} />
      </div>
    </div>
  )
}

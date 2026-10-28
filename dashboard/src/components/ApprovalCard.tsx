import clsx from 'clsx'
import { useState } from 'react'
import { api, type Approval } from '../api'
import { ErrorLine, Json } from './ui'
import { errMsg, timeAgo } from './format'

export function ApprovalCard({ approval, context }: { approval: Approval; context?: React.ReactNode }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = approval.status === 'pending'
  // An Assignment from a peer (CONTEXT.md): accept = the agent starts and may edit files in this conversation.
  const assignment = approval.tool_name === 'Assignment'
  const from = String(approval.tool_input.from ?? 'unknown')
  const task = String(approval.tool_input.task ?? '')
  // "Ask me first" contact approvals: my agent wants to message someone.
  const contact = approval.tool_name === 'mcp__mesh__send_message' || approval.tool_name === 'mcp__mesh__share_file'
  const contactTo = String(approval.tool_input.to ?? 'another agent')
  const contactText = String(approval.tool_input.text ?? approval.tool_input.path ?? '')

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
          {assignment ? (pending ? 'Assignment' : approval.status === 'allowed' ? 'Accepted' : approval.status === 'timed_out' ? 'Expired' : 'Declined') : pending ? 'Approval needed' : approval.status.replace('_', ' ')}
        </span>
        <span className="font-mono text-[12.5px] font-semibold">{assignment ? `from ${from}` : contact ? `wants to message ${contactTo}` : approval.tool_name}</span>
        <span className="ml-auto text-[11px] text-muted">{timeAgo(approval.created_at)}</span>
      </div>
      {context && <div className="mb-1.5 text-xs text-muted">{context}</div>}
      {assignment || contact ? (
        <div className="whitespace-pre-wrap rounded bg-panel-2 p-2 text-[12.5px]">{assignment ? task : contactText}</div>
      ) : (
        <Json value={approval.tool_input} />
      )}
      {assignment && pending && (
        <div className="mt-1 text-[11px] text-muted">Accept: your agent starts and may edit files for this task (other shell commands still ask).</div>
      )}
      {!pending && approval.reason && <div className="mt-1 text-xs text-muted">Reason: {approval.reason}</div>}
      {pending && (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            className="input flex-1"
            placeholder={assignment ? 'Reason (optional, sent back)' : 'Reason (optional, sent to the agent)'}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button className="btn-primary" disabled={busy} onClick={() => decide(true)}>
            {assignment ? 'Accept' : 'Allow'}
          </button>
          <button className="btn-danger" disabled={busy} onClick={() => decide(false)}>
            {assignment ? 'Decline' : 'Deny'}
          </button>
        </div>
      )}
      <div className="mt-1.5">
        <ErrorLine error={error} />
      </div>
    </div>
  )
}

import clsx from 'clsx'
import { useState } from 'react'
import { api, type Approval } from '../api'
import { ErrorLine, Json } from './ui'
import { errMsg, timeAgo } from './format'

/** `nameOf` turns agent IDs into display names (the Office passes it; IDs are shown without it). */
export function ApprovalCard({ approval, context, nameOf = (id) => id }: { approval: Approval; context?: React.ReactNode; nameOf?: (id: string) => string }) {
  const [reason, setReason] = useState('')
  const [withReason, setWithReason] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = approval.status === 'pending'
  // An Assignment from a peer (CONTEXT.md): accept = the agent starts and may edit files in this conversation.
  const assignment = approval.tool_name === 'Assignment'
  const fromId = String(approval.tool_input.from ?? 'unknown')
  const from = nameOf(fromId)
  const task = String(approval.tool_input.task ?? '')
  // "Ask me first" contact approvals: my agent wants to message someone.
  const contact = approval.tool_name === 'mcp__mesh__send_message' || approval.tool_name === 'mcp__mesh__share_file'
  const contactTo = approval.tool_input.to ? nameOf(String(approval.tool_input.to)) : 'another agent'
  const contactText = String(approval.tool_input.text ?? approval.tool_input.path ?? '')
  const body = assignment ? task : contactText
  const long = body.length > 140 || body.includes('\n')

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
        'rounded-md border px-2.5 py-2',
        pending ? 'border-amber-500/50 bg-amber-500/5' : 'border-line bg-panel opacity-75',
      )}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          {assignment ? (pending ? 'Assignment' : approval.status === 'allowed' ? 'Accepted' : approval.status === 'timed_out' ? 'Expired' : 'Declined') : pending ? 'Approval needed' : approval.status.replace('_', ' ')}
        </span>
        <span className="min-w-0 truncate text-[12.5px] font-semibold" title={assignment ? fromId : undefined}>{assignment ? `from ${from}` : contact ? `wants to message ${contactTo}` : approval.tool_name}</span>
        <span className="ml-auto text-[11px] text-muted">{timeAgo(approval.created_at)}</span>
      </div>
      {context && <div className="mb-1.5 text-xs text-muted">{context}</div>}
      {assignment || contact ? (
        <div className="rounded bg-panel-2 px-2 py-1.5 text-[12.5px]">
          {/* Long messages fold to two lines; the full text is one click away. */}
          <div className={clsx('whitespace-pre-wrap', long && !expanded && 'line-clamp-2')}>{body}</div>
          {long && (
            <button className="mt-0.5 text-[11px] font-bold text-muted hover:underline" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'less' : 'more'}
            </button>
          )}
        </div>
      ) : (
        <Json value={approval.tool_input} />
      )}
      {assignment && pending && (
        <div className="mt-1 text-[11px] text-muted">Accept: your agent starts and may edit files for this task.</div>
      )}
      {!pending && approval.reason && <div className="mt-1 text-xs text-muted">Reason: {approval.reason}</div>}
      {pending && (
        <div className="mt-1.5 flex items-center gap-1.5">
          {withReason ? (
            <input
              className="input min-w-0 flex-1"
              autoFocus
              placeholder={assignment ? 'Reason, sent back' : 'Reason, sent to the agent'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          ) : (
            <button className="mr-auto text-[11px] font-bold text-muted hover:underline" onClick={() => setWithReason(true)}>
              add a reason
            </button>
          )}
          <button className="btn-primary" disabled={busy} onClick={() => decide(true)}>
            {assignment ? 'Accept' : 'Allow'}
          </button>
          <button className="btn-danger" disabled={busy} onClick={() => decide(false)}>
            {assignment ? 'Decline' : 'Deny'}
          </button>
        </div>
      )}
      {error && (
        <div className="mt-1.5">
          <ErrorLine error={error} />
        </div>
      )}
    </div>
  )
}

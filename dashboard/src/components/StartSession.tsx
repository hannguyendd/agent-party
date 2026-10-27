import { useState } from 'react'
import { api, type Agent } from '../api'
import { ErrorLine, errMsg } from './ui'

export function StartSession({ agent, onStarted }: { agent: Agent; onStarted: (convId: string) => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    if (!text.trim()) return
    setBusy(true)
    setError(null)
    try {
      onStarted((await api.startConversation(agent.id, text.trim())).id)
    } catch (e) {
      setError(errMsg(e))
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-5">
      <h1 className="text-base font-semibold">Start a session</h1>
      <div className="mb-3 text-xs text-muted">
        Local session with <span className="font-mono text-fg">{agent.id}</span> in <span className="font-mono">{agent.working_dir}</span>. Only you see it;
        the agent can still reach other agents over the mesh.
      </div>
      <textarea
        autoFocus
        className="input min-h-32"
        placeholder="What should the agent do? e.g. “Ask bob/qa-agent whether the login tests pass on main.”"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void start()
        }}
      />
      <div className="mt-2 flex items-center gap-2">
        <button className="btn-primary px-3 py-1.5" disabled={busy || !text.trim()} onClick={start}>
          Start session
        </button>
        <span className="text-[11px] text-muted">⌘/Ctrl+Enter</span>
      </div>
      <div className="mt-2">
        <ErrorLine error={error} />
      </div>
    </div>
  )
}

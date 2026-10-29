// Is Claude Code ready on this machine? Agents run on it. When it isn't logged in, or its login expired (a turn
// failed on it), "Log in to Claude" runs `claude auth login` on this computer: Claude's sign-in page opens in the
// browser and usually finishes by itself; if it shows a code instead, it's pasted here. The terminal stays a fallback.

import { useEffect, useState } from 'react'
import { api, type ClaudeStatus } from '../api'
import { errMsg } from '../components/format'

const INSTALL_URL = 'https://docs.claude.com/claude-code'

export function ClaudeCheck({ initial }: { initial: ClaudeStatus | undefined }) {
  const [claude, setClaude] = useState(initial)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const login = claude?.login?.state ?? 'idle'
  const ready = !!claude?.installed && claude.logged_in && !claude.expired && login !== 'waiting'
  // Check now, then keep checking while something is missing (fast while a login is running).
  useEffect(() => {
    if (ready) return
    const check = () => void api.claude(true).then(setClaude).catch(() => {})
    check()
    const t = setInterval(check, login === 'waiting' ? 2000 : 6000)
    return () => clearInterval(t)
  }, [ready, login])
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setErr('')
    try {
      await fn()
      setClaude(await api.claude(true))
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }
  if (!claude) return <p className="settings-note">Checking Claude Code…</p>
  if (!claude.installed) {
    return (
      <div className="o-claude-check is-todo" role="status">
        <strong>Claude Code is not installed yet</strong>
        <p>Your agents run on Claude Code. Install it (<a href={INSTALL_URL} target="_blank" rel="noreferrer">how</a>), then log in here.</p>
        <button className="btn" onClick={() => void run(async () => {})}>Check again</button>
      </div>
    )
  }
  const start = () => run(() => api.claudeLogin())
  if (ready) {
    return (
      <div className="o-claude-check is-ok" role="status">
        <strong>✓ Claude Code is ready</strong>
        {claude.email && <small>Signed in as {claude.email}</small>}
        <button className="btn" disabled={busy} onClick={() => void start()}>Log in again</button>
      </div>
    )
  }
  if (login === 'waiting') {
    const url = claude.login?.url
    return (
      <div className="o-claude-check is-todo" role="status">
        <strong>Finish signing in to Claude in your browser</strong>
        <p>
          A Claude sign-in page opened in a new browser tab. Sign in there and this turns green by itself.
          {url && <> Nothing opened? <a href={url} target="_blank" rel="noreferrer">Open the sign-in page</a>.</>}
        </p>
        <form className="o-claude-code" onSubmit={(e) => { e.preventDefault(); if (code.trim()) void run(async () => { await api.claudeLoginCode(code); setCode('') }) }}>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="If the page shows a code, paste it here" aria-label="Code from the sign-in page" />
          <button className="btn-primary" disabled={busy || !code.trim()}>Send code</button>
        </form>
        <button className="btn" disabled={busy} onClick={() => void run(() => api.claudeLoginCancel())}>Cancel</button>
        {err && <small className="is-err">{err}</small>}
      </div>
    )
  }
  return (
    <div className="o-claude-check is-todo" role="status">
      <strong>{claude.expired ? "Claude Code's login expired" : 'Log in to Claude Code'}</strong>
      <p>
        {claude.expired
          ? 'Your agents stopped because Claude Code could not renew its login on this computer. Log in again to continue.'
          : 'Your agents run on Claude Code, and it needs a login on this computer.'}
      </p>
      {login === 'failed' && claude.login?.error && <small className="is-err">Last try: {claude.login.error}</small>}
      <button className="btn-primary" disabled={busy} onClick={() => void start()}>{busy ? 'Starting…' : 'Log in to Claude'}</button>
      <small>Or in Terminal (Windows: PowerShell) run <code>claude auth login</code>. This page notices by itself once it's done.</small>
      {err && <small className="is-err">{err}</small>}
    </div>
  )
}

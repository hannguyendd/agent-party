// Is Claude Code ready on this machine? Agents run on it, and its login happens in a terminal, so this says exactly
// what to type and checks again on request (and every few seconds while something is missing).

import { useEffect, useState } from 'react'
import { api, type SetupState } from '../api'

const INSTALL_URL = 'https://docs.claude.com/claude-code'

export function ClaudeCheck({ initial }: { initial: SetupState['claude'] }) {
  const [claude, setClaude] = useState(initial)
  const [copied, setCopied] = useState(false)
  const ready = !!claude?.installed && claude.logged_in
  // Ask now, then every few seconds until it's ready (the login happens in another window).
  useEffect(() => {
    if (ready) return
    const check = () => void api.setup().then((s) => setClaude(s.claude)).catch(() => {})
    check()
    const t = setInterval(check, 5000)
    return () => clearInterval(t)
  }, [ready])
  if (!claude) return <p className="settings-note">Checking Claude Code…</p>
  const copy = (text: string) => void navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  return (
    <div className={`o-claude-check ${ready ? 'is-ok' : 'is-todo'}`} role="status">
      <strong>{ready ? '✓ Claude Code is ready' : !claude.installed ? 'Claude Code is not installed yet' : 'Log in to Claude Code once'}</strong>
      {!ready && (
        <>
          <p>
            {!claude.installed
              ? <>Your agents run on Claude Code. Install it (<a href={INSTALL_URL} target="_blank" rel="noreferrer">how</a>), then log in.</>
              : <>Your agents run on Claude Code, and it needs a login on this computer. Open <b>Terminal</b> (Windows: <b>PowerShell</b>), run this and follow the steps:</>}
          </p>
          {claude.installed && (
            <div className="o-claude-cmd">
              <code>claude</code>
              <button className="btn" onClick={() => copy('claude')}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
          )}
          <small>This page notices by itself once it's done. You can continue meanwhile; agents start working after the login.</small>
          <button className="btn" onClick={() => void api.setup().then((s) => setClaude(s.claude)).catch(() => {})}>Check again</button>
        </>
      )}
    </div>
  )
}

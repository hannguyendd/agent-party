// Joining the team: your name, the office server and the join token from your admin. Used by the first-run screen
// and by Settings → Mesh & office.

import { useState } from 'react'
import { api, type SetupState } from '../api'
import { errMsg } from '../components/format'
import { Icon } from './Icon'

export function SetupForm({ initial, onSaved }: { initial: SetupState | null; onSaved: (s: SetupState) => void }) {
  const [owner, setOwner] = useState(initial && initial.owner !== 'me' ? initial.owner : '')
  // The staff installer opens this page with ?server=<the office server it was downloaded from>.
  const hinted = new URLSearchParams(location.search).get('server') ?? ''
  const [server, setServer] = useState(initial?.hub_url?.replace(/^https?:\/\//, '').replace(/:7400$/, '') || hinted)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ownerLocked = !!initial && initial.agents > 0
  const ownerOk = /^[A-Za-z0-9_-]{1,40}$/.test(owner)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      onSaved(await api.saveSetup(owner, server.trim(), token))
      setToken('')
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="o-setup-form"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <label>
        <span>Your name</span>
        <input className="input" value={owner} disabled={ownerLocked} placeholder="e.g. kien" onChange={(e) => setOwner(e.target.value.trim())} />
        <small>{ownerLocked ? "Fixed: your agents already use it." : `Your agents will be called ${owner || 'name'}/something. Letters, digits, - and _.`}</small>
      </label>
      <label>
        <span>Office server</span>
        <input className="input" value={server} placeholder="e.g. 192.168.1.10" onChange={(e) => setServer(e.target.value)} />
        <small>The always-on machine your admin set up (IP or hostname).</small>
      </label>
      <label>
        <span>Join token {initial?.enrolled && <em>(already joined, not needed)</em>}</span>
        <input className="input" value={token} placeholder={initial?.has_token ? 'saved — paste a new one to replace it' : 'paste the token your admin sent you'} onChange={(e) => setToken(e.target.value)} />
        <small>Single-use; it only matters the first time this machine joins.</small>
      </label>
      {error && <p className="o-setup-error">{error}</p>}
      <button className="btn-primary" disabled={busy || !ownerOk || !server.trim()}>
        <Icon name="office" />{busy ? 'Connecting…' : initial?.configured ? 'Save and reconnect' : 'Connect'}
      </button>
    </form>
  )
}

/** What happened after connecting: office link, mesh node, enrollment. */
export function SetupStatus({ setup, officeConnected }: { setup: SetupState; officeConnected: boolean }) {
  const m = setup.mesh_node
  const rows: [boolean, string, string][] = [
    [officeConnected, 'Office', officeConnected ? 'connected' : 'connecting… (is the office server running?)'],
    [m.running, 'Mesh connection', m.running ? 'running' : m.error ?? 'not started'],
    [setup.enrolled, 'Joined the team', setup.enrolled ? 'yes' : setup.has_token ? 'waiting for the mesh connection' : 'needs a join token'],
  ]
  return (
    <ul className="o-setup-status">
      {rows.map(([ok, label, text]) => (
        <li key={label} className={ok ? 'is-ok' : 'is-wait'}>
          <i />
          <strong>{label}</strong>
          <span>{text}</span>
        </li>
      ))}
      {!m.installed && (
        <li className="o-setup-hint">
          Install <code>agentmesh-node</code> on this machine (ask your admin), then press Save and reconnect. The office works meanwhile; agents
          just can't reach other machines yet.
        </li>
      )}
    </ul>
  )
}

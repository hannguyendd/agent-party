// Settings: the one other screen. Configuration only (agents, mesh, notifications); daily work stays in the Office.

import { useState } from 'react'
import { api, type NodeInfo } from '../api'
import type { SettingsSection, View } from '../App'
import { AgentForm } from '../components/AgentForm'
import { Directory } from '../components/Directory'
import { errMsg } from '../components/format'
import type { LiveState } from '../useLiveState'
import { enableNotifications, notificationsSupported } from '../useNotifications'
import { AppBar } from './AppBar'
import { Icon, type IconName } from './Icon'
import { SKIN_BY_ID } from './skins'
import './office.css'

const SECTIONS: { id: SettingsSection; label: string; icon: IconName; hint: string }[] = [
  { id: 'agents', label: 'Agents', icon: 'agents', hint: 'Create and configure the agents on this machine' },
  { id: 'mesh', label: 'Mesh & office', icon: 'directory', hint: 'Connection to the team and who is online' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications-on', hint: 'How you get pinged' },
]

interface Props {
  state: LiveState
  view: Extract<View, { kind: 'settings' }>
  go: (v: View) => void
  setNode: (n: NodeInfo) => void
}

export default function SettingsView({ state, view, go, setNode }: Props) {
  const section = view.section ?? 'agents'
  const at = (s: SettingsSection, agentId?: string) => go({ kind: 'settings', section: s, agentId })
  return (
    <section className="office-view office-settings">
      <AppBar state={state} view={view} go={go} />
      <div className="settings-body">
        <nav className="settings-nav o-frame" aria-label="Settings sections">
          <h1>Settings</h1>
          {SECTIONS.map((s) => (
            <button key={s.id} className={section === s.id ? 'is-active' : ''} onClick={() => at(s.id)}>
              <Icon name={s.icon} />
              <span>
                <strong>{s.label}</strong>
                <small>{s.hint}</small>
              </span>
            </button>
          ))}
          <button className="btn settings-back" onClick={() => go({ kind: 'office' })}>
            <Icon name="back" />Back to the office
          </button>
        </nav>
        <main className="settings-main">
          {section === 'agents' && <AgentsSection state={state} agentId={view.agentId} at={at} go={go} />}
          {section === 'mesh' && <MeshSection state={state} setNode={setNode} />}
          {section === 'notifications' && <NotificationsSection />}
        </main>
      </div>
    </section>
  )
}

function AgentsSection({ state, agentId, at, go }: { state: LiveState; agentId?: string; at: (s: SettingsSection, id?: string) => void; go: (v: View) => void }) {
  const owner = state.node?.owner ?? ''
  const agents = Object.values(state.agents).sort((a, b) => a.id.localeCompare(b.id))
  const skinOf = (id: string) => state.office?.agents.find((a) => a.agent_id === id)?.skin
  const editing = agentId === 'new' ? null : agentId ? state.agents[agentId] : undefined
  return (
    <div className="settings-split">
      <div className="o-frame settings-card settings-list">
        <div className="settings-card-head">
          <h2>Your agents</h2>
          <button className="btn-primary" onClick={() => at('agents', 'new')}>+ New agent</button>
        </div>
        {agents.length === 0 && <p className="office-empty">No agents yet. Create one to put it in the office.</p>}
        {agents.map((a) => {
          const skin = skinOf(a.id)
          return (
            <button key={a.id} className={`settings-row ${agentId === a.id ? 'is-active' : ''}`} onClick={() => at('agents', a.id)}>
              {skin ? <img src={`office/characters/${skin}-portrait.png`} width="24" height="36" alt="" /> : <span className="settings-avatar">{SKIN_BY_ID['dev-hoodie'].emoji}</span>}
              <span>
                <strong>{a.name || a.id}</strong>
                <small className="font-mono">{a.id}</small>
              </span>
            </button>
          )
        })}
      </div>
      <div className="o-frame settings-card settings-form">
        {editing === undefined && agentId !== 'new' ? (
          <p className="office-empty">Pick an agent to edit, or create a new one.</p>
        ) : !owner ? (
          <p className="office-empty">Connecting to this node…</p>
        ) : (
          <AgentForm
            key={agentId}
            owner={owner}
            agent={editing ?? undefined}
            onSaved={(a) => at('agents', a.id)}
            onDeleted={() => at('agents')}
            onStart={() => go({ kind: 'office' })}
          />
        )}
      </div>
    </div>
  )
}

function MeshSection({ state, setNode }: { state: LiveState; setNode: (n: NodeInfo) => void }) {
  const node = state.node
  const mesh = node?.mesh
  const office = state.office
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const restarted = async () => {
    if (!node) return
    setBusy(true)
    setError(null)
    try {
      setNode({ ...node, mesh: await api.meshRestarted() })
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="settings-stack">
      <div className="o-frame settings-card">
        <h2>This machine</h2>
        <dl className="settings-facts">
          <dt>Owner</dt><dd>{node?.owner ?? '…'}</dd>
          <dt>Node server</dt><dd className="font-mono">{node?.base_url ?? '…'}</dd>
          <dt>agentmesh-node</dt>
          <dd><span className={`settings-dot ${mesh?.node_healthy ? 'is-on' : ''}`} />{mesh ? `${mesh.node_healthy ? 'running' : 'not reachable'} · ${mesh.node_url}` : '…'}</dd>
          <dt>World server</dt>
          <dd><span className={`settings-dot ${office?.connected ? 'is-on' : ''}`} />{!office ? '…' : !office.enabled ? 'not configured' : office.connected ? 'connected' : 'reconnecting'}</dd>
        </dl>
        {office && !office.enabled && (
          <p className="settings-note">
            Add <code>AGENTFLEET_WORLD_URL=ws://&lt;server ip&gt;:7500/world/ws</code> to <code>node-server/.env</code> and restart the node server to join the shared office.
          </p>
        )}
        {mesh?.config_dirty && (
          <div className="settings-warn">
            <span>Your agents changed. Restart <code>agentmesh-node</code> so the mesh publishes them, then confirm.</span>
            <button className="btn" disabled={busy} onClick={restarted}>I restarted it</button>
          </div>
        )}
        {error && <p className="settings-error">{error}</p>}
      </div>
      <div className="o-frame settings-card settings-directory">
        <h2>Agents on the mesh</h2>
        <Directory />
      </div>
    </div>
  )
}

function NotificationsSection() {
  const [perm, setPerm] = useState(() => (notificationsSupported() ? Notification.permission : 'denied'))
  const [osResult, setOsResult] = useState<string | null>(null)
  const testOs = async () => {
    try {
      setOsResult((await api.notifyTest()).shown ? 'Sent. If nothing appeared, check System Settings → Notifications for Script Editor / your terminal, and Focus mode.' : 'This machine has no way to show system notifications.')
    } catch (e) {
      setOsResult(errMsg(e))
    }
  }
  return (
    <div className="settings-stack">
      <div className="o-frame settings-card">
        <h2>Browser notifications</h2>
        <p className="settings-note">
          When someone assigns work to one of your agents, or an agent needs approval, you get a notification while this tab is in the
          background. With no tab open, the node server shows a system notification instead.
        </p>
        <dl className="settings-facts">
          <dt>Status</dt>
          <dd><span className={`settings-dot ${perm === 'granted' ? 'is-on' : ''}`} />{!notificationsSupported() ? 'not supported in this browser' : perm === 'granted' ? 'on' : perm === 'denied' ? 'blocked in browser settings' : 'off'}</dd>
        </dl>
        <div className="settings-actions">
          <button className="btn-primary" disabled={!notificationsSupported() || perm === 'denied'} onClick={() => void enableNotifications().then(setPerm)}>
            <Icon name="notifications-on" />{perm === 'granted' ? 'Send a test notification' : 'Turn on notifications'}
          </button>
        </div>
        <p className="settings-note">macOS Focus / Do Not Disturb can still hide them; also allow notifications for your browser in System Settings.</p>
      </div>
      <div className="o-frame settings-card">
        <h2>System notifications</h2>
        <p className="settings-note">Used when no Agent Mesh tab is open: the node server on this machine pops a system notification.</p>
        <div className="settings-actions">
          <button className="btn" onClick={() => void testOs()}><Icon name="notifications-on" />Send a test system notification</button>
        </div>
        {osResult && <p className="settings-note">{osResult}</p>}
      </div>
    </div>
  )
}

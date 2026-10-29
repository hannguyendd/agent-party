// Settings: the one other screen. Configuration only (agents, mesh, notifications); daily work stays in the Office.

import { useEffect, useState } from 'react'
import { api, type NodeInfo, type SetupState, type UpdateInfo } from '../api'
import type { SettingsSection, View } from '../App'
import { AgentForm } from '../components/AgentForm'
import { Directory } from '../components/Directory'
import { errMsg } from '../components/format'
import type { LiveState } from '../useLiveState'
import { enableNotifications, notificationsSupported } from '../useNotifications'
import { AppBar } from './AppBar'
import { SetupForm, SetupStatus } from './SetupForm'
import { ClaudeCheck } from './ClaudeCheck'
import { officeCommand } from './commands'
import { Icon, type IconName } from './Icon'
import { SKIN_BY_ID } from './skins'
import { setOfficeTheme, useOfficeTheme, webglAvailable } from './theme'
import type { OfficeTheme } from './renderer'
import './office.css'

const SECTIONS: { id: SettingsSection; label: string; icon: IconName; hint: string }[] = [
  { id: 'agents', label: 'Agents', icon: 'agents', hint: 'Create and configure the agents on this machine' },
  { id: 'mesh', label: 'Mesh & office', icon: 'directory', hint: 'Connection to the team and who is online' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications-on', hint: 'How you get pinged' },
  { id: 'look', label: 'Office look', icon: 'office', hint: 'Pixel-art 2D or the 3D office, on this browser' },
  { id: 'computer', label: 'This computer', icon: 'settings', hint: 'Version, updates, start at sign-in, uninstall' },
]

interface Props {
  state: LiveState
  view: Extract<View, { kind: 'settings' }>
  go: (v: View) => void
  setNode: (n: NodeInfo) => void
  setup: SetupState | null
  onSetupSaved: (s: SetupState) => void
}

export default function SettingsView({ state, view, go, setNode, setup, onSetupSaved }: Props) {
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
          {section === 'mesh' && <MeshSection state={state} setNode={setNode} setup={setup} onSetupSaved={onSetupSaved} />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'look' && <LookSection />}
          {section === 'computer' && <ComputerSection setup={setup} />}
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

function MeshSection({ state, setNode, setup, onSetupSaved }: { state: LiveState; setNode: (n: NodeInfo) => void; setup: SetupState | null; onSetupSaved: (s: SetupState) => void }) {
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
  const restartMesh = async () => {
    setBusy(true)
    setError(null)
    try {
      const status = await api.meshRestart()
      if (node) setNode({ ...node, mesh: status })
      onSetupSaved(await api.setup())
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="settings-stack">
      <div className="o-frame settings-card">
        <h2>Joining the team</h2>
        <SetupForm initial={setup} onSaved={onSetupSaved} />
        {setup?.configured && <SetupStatus setup={setup} officeConnected={!!office?.connected} />}
        {setup?.mesh_node.installed && setup.hub_url && (
          <div className="settings-actions">
            <button className="btn" disabled={busy} onClick={() => void restartMesh()}>Restart mesh connection</button>
          </div>
        )}
      </div>
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
        <p className="settings-note">Used when no Party Agent tab is open: the node server on this machine pops a system notification.</p>
        <div className="settings-actions">
          <button className="btn" onClick={() => void testOs()}><Icon name="notifications-on" />Send a test system notification</button>
        </div>
        {osResult && <p className="settings-note">{osResult}</p>}
      </div>
    </div>
  )
}

const LOOKS: { id: OfficeTheme; label: string; note: string }[] = [
  { id: '2d', label: '2D pixel art', note: 'The classic map. Light on any computer.' },
  { id: '3d', label: '3D (preview)', note: 'The same office, desks and people in 3D. Drag to pan, scroll to zoom, [ and ] to turn. Needs WebGL.' },
]

/** Which look draws the Office on this browser (ADR 0004). Others see you the same either way. */
function LookSection() {
  const theme = useOfficeTheme()
  const gl = webglAvailable()
  return (
    <div className="settings-stack">
      <div className="o-frame settings-card">
        <h2>Office look</h2>
        <p className="settings-note">
          Only changes how the Office looks on this browser. Positions, desks and skins are shared, so teammates see you in the same place
          whichever look they use.
        </p>
        <div className="settings-looks" role="radiogroup" aria-label="Office look">
          {LOOKS.map((l) => {
            const off = l.id === '3d' && !gl
            return (
              <button key={l.id} role="radio" aria-checked={theme === l.id} className={theme === l.id ? 'is-active' : ''} disabled={off} onClick={() => setOfficeTheme(l.id)}>
                <strong>{l.label}</strong>
                <small>{off ? 'This browser cannot draw 3D (WebGL is off or unsupported).' : l.note}</small>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** The installed Office on this machine: what runs, updates, start at sign-in, Claude Code, and removing it. */
function ComputerSection({ setup }: { setup: SetupState | null }) {
  const [svc, setSvc] = useState<{ installed: boolean; autostart: boolean } | null>(null)
  const [upd, setUpd] = useState<UpdateInfo | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [keep, setKeep] = useState(true)
  const [phase, setPhase] = useState<'idle' | 'busy' | 'gone' | 'updating'>('idle')
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    api.service().then(setSvc).catch(() => setSvc(null))
    api.updateInfo().then(setUpd).catch(() => setUpd(null))
  }, [])
  const run = async (fn: () => Promise<unknown>) => {
    setErr(null)
    try { await fn() } catch (e) { setErr(errMsg(e)) }
  }
  const uninstall = () => run(async () => {
    setPhase('busy')
    await api.uninstall(keep)
    setPhase('gone')
  })
  if (phase === 'gone') {
    return (
      <div className="o-frame settings-card">
        <h2>The Office was removed from this computer</h2>
        <p className="settings-note">{keep ? 'Your agents and chats are kept in ~/.agentfleet, in case you install it again.' : 'Your agents and chats were deleted too.'} You can close this tab.</p>
      </div>
    )
  }
  return (
    <div className="settings-stack">
      <div className="o-frame settings-card">
        <h2>This computer</h2>
        <dl className="settings-facts">
          <dt>Version</dt>
          <dd>
            {upd ? <>{upd.version ? `v${upd.version}` : ''}{upd.installed ? ` · build ${upd.build}` : ' · developer checkout (updated with git pull)'}</> : '…'}
            {' '}<button className="settings-link" onClick={() => officeCommand({ type: 'whats-new' })}>What's new</button>
          </dd>
          {upd?.installed && <><dt>Office server has</dt><dd>{upd.latest_version ? `v${upd.latest_version} · ` : ''}{upd.latest ?? 'not reachable'}{upd.available ? ' (newer)' : ''}</dd></>}
          {svc?.installed && <><dt>Start when I sign in</dt><dd><span className={`settings-dot ${svc.autostart ? 'is-on' : ''}`} />{svc.autostart ? 'on' : 'off'}</dd></>}
        </dl>
        <div className="settings-actions">
          {upd?.available && (
            <button className="btn-primary" disabled={phase === 'updating'} onClick={() => run(async () => { setPhase('updating'); await api.startUpdate() })}>
              {phase === 'updating' ? 'Updating… the page reloads when done' : `Update now${upd.latest_version ? ` to v${upd.latest_version}` : ''}`}
            </button>
          )}
          {svc?.installed && (
            <button className="btn" onClick={() => run(async () => setSvc({ ...svc, autostart: (await api.serviceAutostart(!svc.autostart)).autostart }))}>
              {svc.autostart ? "Don't start when I sign in" : 'Start when I sign in'}
            </button>
          )}
        </div>
      </div>
      <div className="o-frame settings-card">
        <h2>Claude Code</h2>
        <ClaudeCheck initial={setup?.claude} />
      </div>
      {svc?.installed && (
        <div className="o-frame settings-card is-danger">
          <h2>Uninstall</h2>
          <p className="settings-note">Removes the Office from this computer: the background service, start at sign-in, the shortcut and the program. Your colleagues are not affected.</p>
          {!confirm ? (
            <div className="settings-actions"><button className="btn-danger" onClick={() => setConfirm(true)}>Uninstall the Office…</button></div>
          ) : (
            <div className="settings-confirm">
              <label><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Keep my agents and chats (to install again later)</label>
              <div className="settings-actions">
                <button className="btn-danger" disabled={phase === 'busy'} onClick={() => void uninstall()}>{phase === 'busy' ? 'Removing…' : keep ? 'Yes, uninstall' : 'Yes, uninstall and delete everything'}</button>
                <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
      {err && <p className="settings-note is-err">{err}</p>}
    </div>
  )
}

// The one app bar: Office (the only working screen) and Settings (configuration).

import { useEffect, useState } from 'react'
import { api } from '../api'
import { errMsg } from '../components/format'
import { goOffline } from '../offline'
import type { View } from '../App'
import type { LiveState } from '../useLiveState'
import { Icon } from './Icon'
import { NotificationBell } from './NotificationBell'
import { SoundMenu } from './SoundMenu'
import { notificationTarget } from './nav'
import { ownerCss } from './skins'

/** "Taggle Office" when the admin named the organization on the server, else the product name. */
const brand = (org?: string) => (org ? `${org} Office` : 'Agent Mesh')

/** When the office server has a newer build: one click updates this machine, then the page reloads on it. */
function UpdateButton() {
  const [info, setInfo] = useState<{ available: boolean; build: string; latest: string | null } | null>(null)
  const [phase, setPhase] = useState<'idle' | 'updating' | 'failed'>('idle')
  useEffect(() => {
    const check = () => api.updateInfo().then(setInfo).catch(() => {})
    check()
    const t = setInterval(check, 30 * 60 * 1000)
    return () => clearInterval(t)
  }, [])
  if (!info?.available && phase === 'idle') return null
  const update = async () => {
    setPhase('updating')
    try {
      await api.startUpdate()
    } catch {
      setPhase('failed')
      return
    }
    // The installer restarts the node: wait for it to come back on the new build, then reload.
    const before = info?.build
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      const now = await api.updateInfo().catch(() => null)
      if (now && now.build !== before) return location.reload()
    }
    setPhase('failed')
  }
  return (
    <button className={`office-update ${phase}`} disabled={phase === 'updating'} onClick={() => void update()} title={info?.latest ? `New build ${info.latest}` : undefined}>
      {phase === 'updating' ? 'Updating…' : phase === 'failed' ? 'Update failed: try again' : 'Update available'}
    </button>
  )
}

/** The account chip: settings, start at sign-in, and going offline (the node stops; agents leave the office). */
function AccountMenu({ owner, active, onSettings }: { owner: string; active: boolean; onSettings: () => void }) {
  const [open, setOpen] = useState(false)
  const [svc, setSvc] = useState<{ installed: boolean; autostart: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [confirmOut, setConfirmOut] = useState(false)
  useEffect(() => {
    if (open) api.service().then(setSvc).catch(() => setSvc(null))
  }, [open])
  const toggleAuto = async () => {
    if (!svc) return
    setBusy(true)
    setNote(null)
    try {
      setSvc({ ...svc, autostart: (await api.serviceAutostart(!svc.autostart)).autostart })
    } catch (e) {
      setNote(errMsg(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="office-me-wrap">
      <button className={`office-me ${active ? 'is-active' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} title="Account">
        <b style={{ background: owner ? ownerCss(owner) : undefined }}>{(owner[0] ?? '?').toUpperCase()}</b>
        <span>{owner || '…'}</span>
        <Icon name="settings" />
      </button>
      {open && (
        <div className="o-frame office-me-menu" role="menu" onMouseLeave={() => { setOpen(false); setConfirmOut(false) }}>
          <button role="menuitem" onClick={() => { setOpen(false); onSettings() }}><Icon name="settings" />Settings</button>
          {svc?.installed && (
            <>
              <label className="office-me-toggle">
                <span>Start when I sign in<small>to this computer</small></span>
                <span className={`o-switch ${svc.autostart ? 'is-on' : ''}`}>
                  <input type="checkbox" checked={svc.autostart} disabled={busy} onChange={() => void toggleAuto()} />
                  <i />
                </span>
              </label>
            </>
          )}
          {!confirmOut ? (
            <button role="menuitem" className="is-danger" onClick={() => setConfirmOut(true)}>🚪 Log out (go offline)</button>
          ) : (
            <div className="office-me-confirm">
              <span>Go offline? Your agents leave the office.</span>
              <div>
                <button className="btn-primary" onClick={() => void goOffline().catch((e) => setNote(errMsg(e)))}>Yes</button>
                <button className="btn" onClick={() => setConfirmOut(false)}>No</button>
              </div>
            </div>
          )}
          {note && <p className="office-me-note is-err">{note}</p>}
        </div>
      )}
    </div>
  )
}

export function AppBar({ state, view, go, onApprovals }: { state: LiveState; view: View; go: (v: View) => void; onApprovals?: () => void }) {
  const mesh = state.node?.mesh
  const owner = state.node?.owner ?? ''
  const office = state.office
  // One health light for everything this page depends on; the tooltip says which part is off.
  const details = [
    `Dashboard: ${state.connected ? 'live' : 'reconnecting'}`,
    `Office: ${!office ? '…' : !office.enabled ? 'not configured' : office.connected ? 'connected' : 'reconnecting'}`,
    `Mesh node: ${mesh ? (mesh.node_healthy ? 'running' : 'not reachable') : '…'}`,
    ...(mesh?.config_dirty ? ['Agents changed: restart agentmesh-node'] : []),
  ]
  // The office itself works without the mesh node (it only carries agent-to-agent messages), so say which part is off.
  const core = state.connected && !!office?.connected
  const meshOk = !!mesh?.node_healthy && !mesh.config_dirty
  const healthy = core && meshOk
  return (
    <nav className="office-appbar" aria-label="Navigation">
      <button className="office-logo" onClick={() => go({ kind: 'office' })}>
        <img src="office/ui/logo.png" srcSet="office/ui/logo.png 1x, office/ui/logo@2x.png 2x" width="28" height="28" alt="" />
        {brand(office?.org)}
      </button>
      <div className="office-nav">
        <button className={view.kind === 'office' ? 'is-active' : ''} aria-current={view.kind === 'office' ? 'page' : undefined} onClick={() => go({ kind: 'office' })}>
          <Icon name="office" />Office
        </button>
        <button className={view.kind === 'history' ? 'is-active' : ''} aria-current={view.kind === 'history' ? 'page' : undefined} onClick={() => go({ kind: 'history' })}>
          <Icon name="clock" />History
        </button>
      </div>
      <div className="office-right">
        <UpdateButton />
        <button
          className={`office-health ${healthy ? 'is-ok' : 'is-warn'}`}
          onClick={() => go({ kind: 'settings', section: 'mesh' })}
          title={details.join('\n')}
        >
          <i />
          {healthy ? 'Online' : !core ? (state.connected ? 'Office offline' : 'Reconnecting') : mesh?.config_dirty ? 'Restart mesh' : 'Mesh offline'}
        </button>
        <SoundMenu />
        <NotificationBell state={state} onOpen={(n) => go(notificationTarget(n))} onApprovals={onApprovals ?? (() => go({ kind: 'office', side: 'approvals' }))} />
        <AccountMenu owner={owner} active={view.kind === 'settings'} onSettings={() => go({ kind: 'settings' })} />
      </div>
    </nav>
  )
}

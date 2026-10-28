// The one app bar: Office (the only working screen) and Settings (configuration).

import type { View } from '../App'
import type { LiveState } from '../useLiveState'
import { Icon } from './Icon'
import { ownerCss } from './skins'

/** "Taggle Office" when the admin named the organization on the server, else the product name. */
const brand = (org?: string) => (org ? `${org} Office` : 'Agent Mesh')

export function AppBar({ state, view, go, onApprovals }: { state: LiveState; view: View; go: (v: View) => void; onApprovals?: () => void }) {
  const pending = Object.values(state.approvals).filter((a) => a.status === 'pending').length
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
      </div>
      <div className="office-right">
        <button
          className={`office-health ${healthy ? 'is-ok' : 'is-warn'}`}
          onClick={() => go({ kind: 'settings', section: 'mesh' })}
          title={details.join('\n')}
        >
          <i />
          {healthy ? 'Online' : !core ? (state.connected ? 'Office offline' : 'Reconnecting') : mesh?.config_dirty ? 'Restart mesh' : 'Mesh offline'}
        </button>
        <button className="office-bell" onClick={onApprovals ?? (() => go({ kind: 'office', side: 'approvals' }))} title={pending ? `${pending} waiting for you` : 'Nothing waiting'} aria-label={`Approvals, ${pending} waiting`}>
          <Icon name={pending ? 'approvals-pending' : 'approvals'} />
          {pending > 0 && <span className="o-count">{pending}</span>}
        </button>
        <button className={`office-me ${view.kind === 'settings' ? 'is-active' : ''}`} onClick={() => go({ kind: 'settings' })} title="Settings">
          <b style={{ background: owner ? ownerCss(owner) : undefined }}>{(owner[0] ?? '?').toUpperCase()}</b>
          <span>{owner || '…'}</span>
          <Icon name="settings" />
        </button>
      </div>
    </nav>
  )
}

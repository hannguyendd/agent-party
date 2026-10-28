// The one app bar: Office (the only working screen) and Settings (configuration).

import type { View } from '../App'
import type { LiveState } from '../useLiveState'
import { Icon } from './Icon'

export function AppBar({ state, view, go, onApprovals }: { state: LiveState; view: View; go: (v: View) => void; onApprovals?: () => void }) {
  const pending = Object.values(state.approvals).filter((a) => a.status === 'pending').length
  const mesh = state.node?.mesh
  return (
    <nav className="office-appbar" aria-label="Navigation">
      <button className="office-logo" onClick={() => go({ kind: 'office' })}>
        <img src="office/ui/logo.png" srcSet="office/ui/logo.png 1x, office/ui/logo@2x.png 2x" width="28" height="28" alt="" />
        Agent Mesh
      </button>
      <div className="office-nav">
        <button className={view.kind === 'office' ? 'is-active' : ''} aria-current={view.kind === 'office' ? 'page' : undefined} onClick={() => go({ kind: 'office' })}>
          <Icon name="office" />Office
        </button>
      </div>
      <div className="office-status">
        {mesh && (
          <span title={`agentmesh-node ${mesh.node_url}`}>
            <i className={mesh.node_healthy ? 'is-on' : ''} />mesh
          </span>
        )}
        {mesh?.config_dirty && (
          <button title="agentmesh-node.yaml changed: restart agentmesh-node to publish new agents" onClick={() => go({ kind: 'settings', section: 'mesh' })}>
            ⚠ restart mesh
          </button>
        )}
        <span>
          <i className={state.connected ? 'is-on' : ''} />
          {state.connected ? 'live' : 'reconnecting'}
        </span>
        {state.node && <span className="office-owner">{state.node.owner}</span>}
      </div>
      <button className="office-bell" onClick={onApprovals ?? (() => go({ kind: 'office', side: 'approvals' }))} title="Approvals" aria-label={`Approvals, ${pending} waiting`}>
        <Icon name={pending ? 'approvals-pending' : 'approvals'} />
        {pending > 0 && <span className="o-count">{pending}</span>}
      </button>
      <button
        className={`office-bell ${view.kind === 'settings' ? 'is-active' : ''}`}
        onClick={() => go({ kind: 'settings' })}
        title="Settings"
        aria-label="Settings"
      >
        <Icon name="settings" />
      </button>
    </nav>
  )
}

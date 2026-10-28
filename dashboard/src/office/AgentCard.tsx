// The card for the agent I have selected. One primary action (message it), then small controls.

import type { Conversation, OfficeAgent, PlanUsage } from '../api'
import { Icon } from './Icon'
import { ACTIVE_STATUSES } from './status'
import { LEVELS, type PermissionLevel } from './permissions'
import { UsageMeters } from './Usage'
import { plainPreview } from './render-md'

interface Props {
  agent: OfficeAgent
  desk?: string
  lastChat?: Conversation
  peerName?: (id: string) => string
  canAct: boolean
  preview: boolean
  onOpenChat: (id: string) => void
  /** Open a new private chat with this agent. */
  onMessage: () => void
  /** Gather a Party hosted by this agent. Undefined when it is already in one. */
  onParty?: () => void
  onGo: (where: 'desk' | 'pantry' | 'manager') => void
  /** "auto": goes ahead and messages others; "ask": asks me first. Undefined in preview. */
  contactPolicy?: 'auto' | 'ask'
  onContactPolicy?: (p: 'auto' | 'ask') => void
  /** Quick permission level (undefined in preview); 'custom' when Settings set its own tool lists. */
  permission?: PermissionLevel
  onPermission?: (level: Exclude<PermissionLevel, 'custom'>) => void
  /** This machine's Claude plan usage (shared by all my agents). */
  usage?: PlanUsage | null
}

export function AgentCard(p: Props) {
  const a = p.agent
  const talking = !!a.activity && ACTIVE_STATUSES.includes(a.activity.status)
  const where = talking
    ? `Talking with ${a.activity?.peer ? p.peerName?.(a.activity.peer) ?? a.activity.peer : 'you'}`
    : a.at.kind === 'desk'
      ? p.desk ? `At desk ${p.desk}` : 'By the door'
      : 'Walking around'
  const last = p.lastChat
  const asking = p.contactPolicy === 'ask'

  return (
    <div className="o-frame office-card ag-card">
      <div className="ag-head">
        <img src={`office/characters/${a.skin}-portrait.png`} width="32" height="48" alt="" />
        <div className="ag-id">
          <strong>{a.name}</strong>
          <span className={`o-chip ${talking ? 'is-run' : 'is-idle'}`}>{where}</span>
        </div>
      </div>

      <div className="ag-actions">
        {!p.preview && (
          <button className="btn-primary" onClick={p.onMessage} title={`Start a private chat with ${a.name}`}>
            <Icon name="new-chat" />Message
          </button>
        )}
        {!p.preview && p.onParty && (
          <button className="btn" onClick={p.onParty} title="Gather three or more agents around this one to work on a topic">
            <Icon name="party" />Party
          </button>
        )}
        <span className="ag-go" role="group" aria-label="Go to">
          <button disabled={!p.canAct} onClick={() => p.onGo('desk')} title="Go to its desk" aria-label="Go to desk"><Icon name="desk" /></button>
          <button disabled={!p.canAct} onClick={() => p.onGo('pantry')} title="Go to the pantry" aria-label="Go to pantry"><Icon name="pantry" /></button>
          <button disabled={!p.canAct} onClick={() => p.onGo('manager')} title="Go to the manager's room" aria-label="Go to manager"><Icon name="host" /></button>
        </span>
      </div>

      {!p.preview && last && (
        <button className="ag-continue" onClick={() => p.onOpenChat(last.id)} title="Open the latest chat">
          <Icon name="back" className="o-flip" />
          <span>{last.peer_agent_id ? `With ${p.peerName?.(last.peer_agent_id) ?? last.peer_agent_id}: ` : 'Last: '}</span>
          <b>{plainPreview(last.title, (id) => p.peerName?.(id) ?? null) || 'untitled'}</b>
        </button>
      )}

      {(p.permission || p.contactPolicy || p.usage !== undefined) && (
        <dl className="ag-props">
          {p.permission && (
            <div>
              <dt>Permissions</dt>
              <dd>
                <select
                  className="ag-select"
                  value={p.permission}
                  title={LEVELS.find((l) => l.id === p.permission)?.hint ?? 'Its own tool lists, set in agent settings.'}
                  onChange={(e) => e.target.value !== 'custom' && p.onPermission?.(e.target.value as Exclude<PermissionLevel, 'custom'>)}
                >
                  {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  {p.permission === 'custom' && <option value="custom" disabled>Custom (set in Settings)</option>}
                </select>
              </dd>
            </div>
          )}
          {p.contactPolicy && (
            <div>
              <dt title="When on, each message it wants to send to another agent waits for your OK">Ask before contacting others</dt>
              <dd>
                <label className={`o-switch ${asking ? 'is-on' : ''}`}>
                  <input type="checkbox" checked={asking} onChange={(e) => p.onContactPolicy?.(e.target.checked ? 'ask' : 'auto')} aria-label="Ask me before it contacts others" />
                  <i />
                </label>
              </dd>
            </div>
          )}
          {p.usage !== undefined && (
            <div className="ag-usage">
              <dt>Claude plan</dt>
              <dd><UsageMeters usage={p.usage} compact /></dd>
            </div>
          )}
        </dl>
      )}
    </div>
  )
}

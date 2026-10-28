// The card for the agent I have selected. One primary action (message it), then small controls.

import { useState } from 'react'
import type { Conversation, OfficeAgent } from '../api'
import { Icon } from './Icon'
import { SKINS } from './skins'
import { ACTIVE_STATUSES } from './status'

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
  onGo: (where: 'desk' | 'pantry' | 'manager') => void
  onSkin: (skin: string) => void
  onSettings: () => void
  /** "auto": goes ahead and messages others; "ask": asks me first. Undefined in preview. */
  contactPolicy?: 'auto' | 'ask'
  onContactPolicy?: (p: 'auto' | 'ask') => void
}

export function AgentCard(p: Props) {
  const [looks, setLooks] = useState(false)
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
    <div className="o-frame office-card o-agent-card">
      <div className="o-agent-head">
        <img src={`office/characters/${a.skin}-portrait.png`} width="36" height="54" alt="" />
        <div className="o-agent-id">
          <strong>{a.name}</strong>
          <span className={`o-chip ${talking ? 'is-run' : 'is-idle'}`}>{where}</span>
        </div>
        <div className="o-agent-tools">
          <button className={`o-icon-btn ${looks ? 'is-on' : ''}`} onClick={() => setLooks((v) => !v)} title="Change look" aria-label="Change look" aria-expanded={looks}>
            👕
          </button>
          {!p.preview && (
            <button className="o-icon-btn" onClick={p.onSettings} title="Agent settings" aria-label="Agent settings">
              <Icon name="settings" />
            </button>
          )}
        </div>
      </div>

      {looks && (
        <div className="o-skins" role="listbox" aria-label="Look">
          {SKINS.map((s) => (
            <button key={s.id} role="option" aria-selected={a.skin === s.id} className={a.skin === s.id ? 'is-active' : ''} disabled={!p.canAct} title={s.label} onClick={() => p.onSkin(s.id)}>
              <img src={`office/characters/${s.id}-portrait.png`} width="32" height="48" alt={s.label} />
            </button>
          ))}
        </div>
      )}

      {!p.preview && (
        <div className="o-agent-primary">
          <button className="btn-primary o-message-btn" onClick={p.onMessage}>
            <Icon name="new-chat" />Message {a.name}
          </button>
          {last && (
            <button className="o-continue" onClick={() => p.onOpenChat(last.id)} title="Open the latest chat">
              <span>Continue{last.peer_agent_id ? ` with ${p.peerName?.(last.peer_agent_id) ?? last.peer_agent_id}` : ''}:</span>
              <b>{last.title || 'untitled'}</b>
              <span aria-hidden>→</span>
            </button>
          )}
        </div>
      )}

      <div className="o-agent-row">
        <span className="o-agent-label">Go to</span>
        <div className="o-go">
          <button disabled={!p.canAct} onClick={() => p.onGo('desk')}><Icon name="desk" />Desk</button>
          <button disabled={!p.canAct} onClick={() => p.onGo('pantry')}><Icon name="pantry" />Pantry</button>
          <button disabled={!p.canAct} onClick={() => p.onGo('manager')}><Icon name="host" />Manager</button>
        </div>
      </div>

      {p.contactPolicy && (
        <label className="o-agent-row o-switch-row" title="When on, each message it wants to send to another agent waits for your OK">
          <span className="o-agent-label">Ask me before it contacts others</span>
          <span className={`o-switch ${asking ? 'is-on' : ''}`}>
            <input type="checkbox" checked={asking} onChange={(e) => p.onContactPolicy?.(e.target.checked ? 'ask' : 'auto')} />
            <i />
          </span>
        </label>
      )}
    </div>
  )
}

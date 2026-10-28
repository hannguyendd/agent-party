// The card for the agent I have selected: talk to it first, then the small stuff (where it goes, how it looks).

import { useState } from 'react'
import type { Conversation, OfficeAgent } from '../api'
import { Icon } from './Icon'
import { MessageAgent } from './SideLists'
import { SKINS } from './skins'

interface Props {
  agent: OfficeAgent
  desk?: string
  lastChat?: Conversation
  peerName?: (id: string) => string
  canAct: boolean
  preview: boolean
  onOpenChat: (id: string) => void
  onStarted: (id: string) => void
  onError: (msg: string) => void
  onGo: (where: 'desk' | 'pantry' | 'meeting') => void
  onSkin: (skin: string) => void
  onSettings: () => void
}

const ACTIVE = ['running', 'awaiting_approval', 'awaiting_owner']

export function AgentCard(p: Props) {
  const [looks, setLooks] = useState(false)
  const a = p.agent
  const talking = a.activity && ACTIVE.includes(a.activity.status)
  const where = talking
    ? `Talking with ${a.activity?.peer ? p.peerName?.(a.activity.peer) ?? a.activity.peer : 'you'}`
    : a.at.kind === 'desk'
      ? p.desk ? `At desk ${p.desk}` : 'Waiting by the door'
      : 'Walking around'
  const last = p.lastChat
  return (
    <div className="o-frame office-card o-agent-card">
      <div className="o-agent-head">
        <img src={`office/characters/${a.skin}-portrait.png`} width="40" height="60" alt="" />
        <div>
          <strong>{a.name}</strong>
          <span className={`o-chip ${talking ? 'is-run' : 'is-idle'}`}>{where}</span>
        </div>
      </div>

      {!p.preview && <MessageAgent agentId={a.agent_id} name={a.name} onStarted={p.onStarted} onError={p.onError} />}

      {last && (
        <button className="o-last-chat" onClick={() => p.onOpenChat(last.id)}>
          <Icon name="inject" />
          <span>
            <small>Latest chat{last.peer_agent_id ? ` with ${p.peerName?.(last.peer_agent_id) ?? last.peer_agent_id}` : ''}</small>
            <strong>{last.title || 'untitled'}</strong>
          </span>
          <span className="o-last-open">Open →</span>
        </button>
      )}

      <div className="o-go">
        <span>Go to</span>
        <button disabled={!p.canAct} onClick={() => p.onGo('desk')}><Icon name="desk" />Desk</button>
        <button disabled={!p.canAct} onClick={() => p.onGo('pantry')}>☕ Pantry</button>
        <button disabled={!p.canAct} onClick={() => p.onGo('meeting')}><Icon name="party" />Meeting</button>
      </div>

      <div className="o-agent-foot">
        <button className="office-link" onClick={() => setLooks((v) => !v)} aria-expanded={looks}>{looks ? 'Done' : 'Change look'}</button>
        {!p.preview && <button className="office-link" onClick={p.onSettings}><Icon name="settings" />Settings</button>}
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
    </div>
  )
}

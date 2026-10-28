// Menu shown when the owner clicks someone else's agent in the Office (CONTEXT.md: Inquiry, Assignment).

import { useState } from 'react'
import { api, type Conversation, type OfficeAgent } from '../api'
import { errMsg } from '../components/ui'
import type { PeerClick } from './OfficeScene'
import { Icon } from './Icon'
import { ownerCss } from './skins'

export function PeerMenu(props: {
  click: PeerClick
  peer: OfficeAgent
  present: boolean
  selectedMine: string[]
  conversations: Conversation[]
  onClose: () => void
  onWalk: () => void
  onOpen: (id: string) => void
  /** After Ask / Assign; convId is the conversation to open so the owner can follow it. */
  onSent: (msg: string, convId?: string) => void
  onError: (msg: string) => void
  /** Design preview: nothing is sent. */
  preview?: boolean
}) {
  const { click, peer } = props
  const [mode, setMode] = useState<'menu' | 'inquiry' | 'assignment'>('menu')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  // Who acts: a selected agent of mine within reach, else any of mine within reach.
  const asker = click.reachableBy.find((id) => props.selectedMine.includes(id)) ?? click.reachableBy[0]
  const latest = [...props.conversations].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]

  const send = async () => {
    if (!asker || !text.trim()) return
    setBusy(true)
    try {
      if (props.preview) {
        props.onSent(mode === 'inquiry' ? `(Preview) ${asker} would ask ${peer.agent_id}` : `(Preview) ${asker} would assign work to ${peer.agent_id}`)
      } else if (mode === 'inquiry') {
        // Inquiry: our agent asks the peer over the mesh; the reply comes back into a local conversation.
        const prompt =
          `Use mcp__mesh__send_message to ask ${peer.agent_id} the question below, then tell me what they answered.\n\n` +
          `Question: ${text.trim()}`
        const conv = await api.startConversation(asker, prompt)
        props.onSent(`${asker} is asking ${peer.agent_id}…`, conv.id)
      } else {
        // Assignment: sent as written; the peer's owner must accept before their agent starts (ADR 0002).
        const res = await api.assign(asker, peer.agent_id, text.trim())
        props.onSent(
          props.present
            ? `Assigned to ${peer.agent_id}. Waiting for ${peer.owner} to accept…`
            : `Assigned. ${peer.owner} is away: they've been notified and have up to 15 minutes to accept.`,
          res.conversation_id || undefined,
        )
      }
    } catch (e) {
      props.onError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="office-peer-menu space-y-2"
      // Above the peer's head so it never covers the two agents; flip below when too close to the top.
      style={{
        left: Math.max(136, click.screen.x),
        top: click.screen.y < 230 ? click.screen.y + 70 : click.screen.y - 10,
        transform: click.screen.y < 230 ? 'translateX(-50%)' : 'translate(-50%, -100%)',
      }}
    >
      <div className="flex items-start gap-2">
        <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: ownerCss(peer.owner) }} />
        <div className="min-w-0 flex-1">
          <div className="o-peer-name truncate">{peer.name}</div>
          <div className="o-peer-sub truncate font-mono">{peer.agent_id}</div>
          <div className="o-peer-sub">
            {peer.owner}'s agent · {props.present ? 'owner here' : 'owner away'}
          </div>
        </div>
        <button className="o-peer-sub" aria-label="Close" onClick={props.onClose}><Icon name="close" /></button>
      </div>

      {mode !== 'menu' ? (
        <div className="space-y-1">
          <div className="o-peer-sub">
            <span className="font-mono">{asker}</span> {mode === 'inquiry' ? 'will ask:' : 'will assign:'}
          </div>
          <textarea
            className="input h-20 resize-none"
            autoFocus
            placeholder={mode === 'inquiry' ? 'e.g. What does the users table look like now?' : 'e.g. Fix the login test that fails on CI'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {mode === 'assignment' && (
            <div className="o-peer-sub">
              {props.present
                ? `${peer.owner} gets an Accept / Decline card. Once accepted, their agent may edit files for this task.`
                : `${peer.owner} is away: they'll get a notification and have 15 minutes before it's declined.`}
            </div>
          )}
          <div className="flex gap-1">
            <button className="btn-primary" disabled={busy || !text.trim()} onClick={send}><Icon name="send" /> Send</button>
            <button className="btn" onClick={() => setMode('menu')}>
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {asker ? (
            <>
              <button className="btn justify-start" onClick={() => setMode('inquiry')}>
                <Icon name="inquiry" /> Ask
              </button>
              <button className="btn justify-start" onClick={() => setMode('assignment')}>
                <Icon name="assignment" /> Assign work {!props.present && <span className="o-peer-sub">(owner away)</span>}
              </button>
            </>
          ) : (
            <>
              <button className="btn justify-start" disabled title="Walk one of your agents over first">
                <Icon name="inquiry" /> Ask / Assign <span className="o-peer-sub">(walk closer)</span>
              </button>
              <button className="btn justify-start" disabled={!props.selectedMine.length} onClick={props.onWalk}>
                <Icon name="back" className="o-flip" /> Walk over {props.selectedMine.length ? `(${props.selectedMine.length} selected)` : '(select your agent first)'}
              </button>
            </>
          )}
          {latest && (
            <button className="btn justify-start" onClick={() => props.onOpen(latest.id)}>
              <Icon name="inject" /> Open conversation
            </button>
          )}
        </div>
      )}
    </div>
  )
}

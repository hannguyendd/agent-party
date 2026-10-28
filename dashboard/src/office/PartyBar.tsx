// Party controls inside a conversation: who is in it and what I may do, by role (CONTEXT.md "Party").
// Host's owner: invite, share, hand off, end. A member's owner: invite, take my agent out. Ended: offer a Recap.

import { useState } from 'react'
import { api, type Conversation, type Party } from '../api'
import { errMsg } from '../components/format'
import type { LiveState } from '../useLiveState'
import { Icon } from './Icon'
import { Avatar } from './OfficeChat'
import { who } from './people'

interface Props {
  state: LiveState
  conv: Conversation
  onRecap: () => void
}

export function PartyBar({ state, conv, onRecap }: Props) {
  const [picker, setPicker] = useState<'invite' | 'handoff' | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const party: Party | undefined = state.office?.parties?.find((p) => p.party_id === conv.party_id)
  const me = conv.agent_id.split('/')[0]
  const myAgent = conv.agent_id

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true)
    setNote(null)
    try {
      const msg = await fn()
      if (msg) setNote(msg)
      setPicker(null)
    } catch (e) {
      setNote(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  if (!party) {
    // Ended (or this copy outlived it): the natural moment for a Recap; nothing is generated without a click.
    return (
      <div className="o-party-bar is-ended">
        <span><Icon name="party" />This Party has ended.</span>
        {conv.kind !== 'party_share' && <button className="o-mini-btn is-primary" onClick={onRecap}><Icon name="recap" />Make a recap</button>}
      </div>
    )
  }

  const amHost = party.host.startsWith(`${me}/`) && conv.kind === 'party'
  const everyone = [party.host, ...party.members]
  const inviteable = (state.office?.agents ?? []).filter(
    (a) => !everyone.includes(a.agent_id) && !(state.office?.parties ?? []).some((p) => p.host === a.agent_id || p.members.includes(a.agent_id)),
  )

  return (
    <div className="o-party-bar">
      <div className="o-party-people">
        <span className="o-party-label"><Icon name="party" />{party.kind === 'assignment' ? 'Work party' : 'Party'}</span>
        {everyone.map((id) => (
          <span key={id} className={`o-party-person ${id === party.host ? 'is-host' : ''}`} title={`${who(state, id).name}${id === party.host ? ' (Host)' : ''}`}>
            <Avatar w={who(state, id)} size={24} />
          </span>
        ))}
      </div>
      <div className="o-party-actions">
        <button className="o-mini-btn" disabled={busy || !inviteable.length} onClick={() => setPicker(picker === 'invite' ? null : 'invite')}>+ Invite</button>
        {amHost && (
          <>
            <button
              className="o-mini-btn"
              disabled={busy}
              title="Send every member's owner a read-only copy of this Party, including what was said before they joined"
              onClick={() => run(async () => {
                const r = await api.partyShare(party.party_id)
                return r.failed.length ? `Shared with ${r.sent.length}; couldn't reach ${r.failed.join(', ')}` : `Shared with ${r.sent.length} owner${r.sent.length === 1 ? '' : 's'}`
              })}
            >
              {conv.party_shared ? 'Share again' : 'Share'}
            </button>
            <button className="o-mini-btn" disabled={busy || !party.members.length} onClick={() => setPicker(picker === 'handoff' ? null : 'handoff')}>Hand off</button>
            <button className="o-mini-btn" disabled={busy} onClick={() => run(() => api.partyClose(party.party_id).then(() => undefined))}>End</button>
          </>
        )}
        {!amHost && party.members.includes(myAgent) && conv.kind !== 'party_share' && (
          <button className="o-mini-btn" disabled={busy} onClick={() => run(() => api.partyLeave(party.party_id, myAgent).then(() => undefined))}>Leave</button>
        )}
      </div>
      {picker && (
        <div className="o-party-picker">
          <span>{picker === 'invite' ? 'Invite' : 'Hand the Host role to'}</span>
          <select
            className="input"
            defaultValue=""
            disabled={busy}
            onChange={(e) => {
              const id = e.target.value
              if (!id) return
              void run(() => (picker === 'invite' ? api.partyInvite(party.party_id, id) : api.partyHandoff(party.party_id, id)).then(() => undefined))
            }}
          >
            <option value="" disabled>Choose an agent…</option>
            {(picker === 'invite' ? inviteable.map((a) => a.agent_id) : party.members).map((id) => (
              <option key={id} value={id}>{who(state, id).name} ({id})</option>
            ))}
          </select>
        </div>
      )}
      {note && <p className="o-party-note">{note}</p>}
    </div>
  )
}

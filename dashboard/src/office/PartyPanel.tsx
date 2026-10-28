// Gathering a Party (CONTEXT.md): one of my agents hosts, two or more agents join (mine count too). The Host talks
// with each member; on the map they gather around it.

import { useState } from 'react'
import { api, type Party } from '../api'
import { errMsg } from '../components/format'
import type { LiveState } from '../useLiveState'
import { Icon } from './Icon'
import { Avatar } from './OfficeChat'
import { who } from './people'

interface Props {
  state: LiveState
  hostId: string
  onBack: () => void
  onCreated: (convId: string) => void
}

export function PartyPanel({ state, hostId, onBack, onCreated }: Props) {
  const [topic, setTopic] = useState('')
  const [kind, setKind] = useState<Party['kind']>('inquiry')
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const host = who(state, hostId)
  const busyIds = new Set((state.office?.parties ?? []).flatMap((p) => [p.host, ...p.members]))
  const candidates = (state.office?.agents ?? []).filter((a) => a.agent_id !== hostId)
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const ready = topic.trim() && picked.length >= 2 && !busy

  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      const conv = await api.openParty(hostId, picked, topic.trim(), kind)
      onCreated(conv.id)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="o-frame office-conv">
      <header className="o-conv-head">
        <button className="o-icon-btn" onClick={onBack} aria-label="Back" title="Back">
          <Icon name="back" />
        </button>
        <div className="o-conv-faces">
          <Avatar w={host} size={34} />
        </div>
        <div className="o-conv-title">
          <strong>New Party hosted by {host.name}</strong>
        </div>
        <span className="o-conv-sub">
          <span className="o-chip is-kind">Party</span>
          <span className="o-conv-owner">{host.name} talks with each member</span>
        </span>
      </header>
      <form
        className="o-party-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (ready) void start()
        }}
      >
        <label>
          <span>Topic</span>
          <textarea className="input" rows={3} value={topic} autoFocus placeholder="e.g. Agree on the payments API change for the March release" onChange={(e) => setTopic(e.target.value)} />
          <small>Only the Host and you see it; colleagues see the Party on the map, not its topic.</small>
        </label>
        <div className="o-party-kind" role="radiogroup" aria-label="Kind">
          <button type="button" role="radio" aria-checked={kind === 'inquiry'} className={kind === 'inquiry' ? 'is-active' : ''} onClick={() => setKind('inquiry')}>
            <Icon name="inquiry" />Discuss
            <small>Members answer; no confirmation</small>
          </button>
          <button type="button" role="radio" aria-checked={kind === 'assignment'} className={kind === 'assignment' ? 'is-active' : ''} onClick={() => setKind('assignment')}>
            <Icon name="assignment" />Assign work
            <small>Each member's owner accepts first</small>
          </button>
        </div>
        <fieldset>
          <legend>
            Members <span>{picked.length} picked · at least 2</span>
          </legend>
          {candidates.length === 0 && <p className="office-empty">No other agents are in the office right now.</p>}
          <div className="o-party-pick">
            {candidates.map((a) => {
              const w = who(state, a.agent_id)
              const taken = busyIds.has(a.agent_id)
              return (
                <label key={a.agent_id} className={`o-party-cand ${picked.includes(a.agent_id) ? 'is-on' : ''} ${taken ? 'is-taken' : ''}`} title={taken ? 'Already in a Party' : a.agent_id}>
                  <input type="checkbox" checked={picked.includes(a.agent_id)} disabled={taken} onChange={() => toggle(a.agent_id)} />
                  <Avatar w={w} size={28} />
                  <span>
                    <strong>{w.name}</strong>
                    <small>{w.owner === host.owner ? 'yours' : `${w.owner}'s`}{taken ? ' · in a Party' : ''}</small>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
        {error && <p className="o-setup-error">{error}</p>}
        <button className="btn-primary" disabled={!ready}>
          <Icon name="party" />
          {busy ? 'Gathering…' : 'Start the Party'}
        </button>
      </form>
    </div>
  )
}

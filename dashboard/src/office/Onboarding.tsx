// First-run guide over the map: create an agent, pick a desk, turn on notifications, learn the basics.
// The current step comes from real state, so it picks up where the person left off.

import { useState } from 'react'
import { api, type AgentIn } from '../api'
import { errMsg } from '../components/format'
import { enableNotifications, notificationsSupported } from '../useNotifications'
import { Icon } from './Icon'
import { SKINS } from './skins'
import { READ_TOOLS } from './permissions'

export type OnboardingStep = 'agent' | 'desk' | 'notify' | 'tips'

const STEPS: { id: OnboardingStep; label: string }[] = [
  { id: 'agent', label: 'Agent' },
  { id: 'desk', label: 'Desk' },
  { id: 'notify', label: 'Notifications' },
  { id: 'tips', label: 'Basics' },
]

const slug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'agent'

/** Safe defaults for an agent made from the short form (the full form in Settings exposes everything). */
function quickAgent(owner: string, name: string, description: string, folder: string): AgentIn {
  return {
    id: `${owner}/${slug(name)}`,
    name: name.trim(),
    description: description.trim(),
    skills: [],
    working_dir: folder.trim(),
    setting_sources: ['project'],
    allowed_tools: READ_TOOLS,
    denied_tools: [],
    system_prompt: '',
    model: null,
    contact_policy: 'auto',
  }
}

interface Props {
  step: OnboardingStep
  owner: string
  /** "+ New agent" opens just the agent step; the guide ends after it. */
  single?: boolean
  onAgentCreated: (id: string) => void
  onPickDesk: () => void
  onNotify: () => void
  onDone: () => void
  onClose: () => void
  onAdvanced: () => void
}

export function Onboarding(p: Props) {
  const idx = STEPS.findIndex((s) => s.id === p.step)
  return (
    <div className="o-frame o-onboard" role="dialog" aria-label="Getting started">
      <div className="o-onboard-head">
        {!p.single && (
          <ol className="o-onboard-steps">
            {STEPS.map((s, i) => (
              <li key={s.id} className={i < idx ? 'is-done' : i === idx ? 'is-now' : ''}>
                <i>{i < idx ? <Icon name="check" /> : i + 1}</i>
                {s.label}
              </li>
            ))}
          </ol>
        )}
        <button className="o-onboard-close" onClick={p.onClose} aria-label="Close" title={p.single ? 'Close' : 'Skip for now'}>
          <Icon name="close" />
        </button>
      </div>
      {p.step === 'agent' && <AgentStep owner={p.owner} single={p.single} onCreated={p.onAgentCreated} onAdvanced={p.onAdvanced} />}
      {p.step === 'desk' && (
        <div className="o-onboard-body">
          <h2>Pick your desk</h2>
          <p>Click the desk you sit at in the real office. Your agents sit there when they're not busy, so colleagues know whose they are.</p>
          <button className="btn-primary" onClick={p.onPickDesk}><Icon name="desk" />Show free desks</button>
        </div>
      )}
      {p.step === 'notify' && (
        <div className="o-onboard-body">
          <h2>Get pinged when it matters</h2>
          <p>When someone assigns work to your agent, or it needs your approval, you'll get a notification even if this tab is in the background.</p>
          <div className="o-onboard-actions">
            <button className="btn-primary" disabled={!notificationsSupported()} onClick={() => void enableNotifications().then(p.onNotify)}>
              <Icon name="notifications-on" />Turn on notifications
            </button>
            <button className="btn" onClick={p.onNotify}>Not now</button>
          </div>
        </div>
      )}
      {p.step === 'tips' && (
        <div className="o-onboard-body">
          <h2>You're all set</h2>
          <ul className="o-onboard-tips">
            <li><b>Give your agent work:</b> select it, press <em>Message</em>. Type <kbd>@</kbd> to point it at a colleague's agent.</li>
            <li><b>Ask a colleague's agent:</b> click their character; yours walks over and a menu opens (Ask or Assign work).</li>
            <li><b>Move around:</b> <kbd>WASD</kbd> or click the floor · <kbd>H</kbd> back to desk.</li>
            <li><b>Stay in control:</b> the bell shows what's waiting for you; Chats has every conversation.</li>
          </ul>
          <button className="btn-primary" onClick={p.onDone}>Start</button>
        </div>
      )}
    </div>
  )
}

function AgentStep({ owner, single, onCreated, onAdvanced }: { owner: string; single?: boolean; onCreated: (id: string) => void; onAdvanced: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [folder, setFolder] = useState('')
  const [skin, setSkin] = useState(SKINS[0].id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = name.trim() && folder.trim() && !busy

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const agent = await api.saveAgent(quickAgent(owner, name, description, folder))
      await api.setSkin(agent.id, skin).catch(() => {}) // the office may still be connecting; the skin can be changed later
      onCreated(agent.id)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="o-onboard-body"
      onSubmit={(e) => {
        e.preventDefault()
        if (ready) void create()
      }}
    >
      <h2>{single ? 'New agent' : 'Create your agent'}</h2>
      {!single && <p>Your agent works in one of your project folders, answers colleagues' agents and does what you ask.</p>}
      <label>
        <span>Name</span>
        <input className="input" value={name} placeholder="e.g. Backend agent" onChange={(e) => setName(e.target.value)} autoFocus />
        <small>ID: {owner}/{slug(name)}</small>
      </label>
      <label>
        <span>What does it do?</span>
        <input className="input" value={description} placeholder="e.g. Knows the payments API and its database" onChange={(e) => setDescription(e.target.value)} />
        <small>Colleagues' agents read this to decide whether to ask yours.</small>
      </label>
      <label>
        <span>Project folder</span>
        <input className="input" value={folder} placeholder="/Users/you/Projects/payments-api" onChange={(e) => setFolder(e.target.value)} />
        <small>Absolute path on this machine. It reads here, and edits only with your approval.</small>
      </label>
      <div className="o-onboard-skins" role="radiogroup" aria-label="Look">
        {SKINS.map((s) => (
          <button type="button" key={s.id} role="radio" aria-checked={skin === s.id} className={skin === s.id ? 'is-active' : ''} title={s.label} onClick={() => setSkin(s.id)}>
            <img src={`office/characters/${s.id}-portrait.png`} width="28" height="42" alt={s.label} />
          </button>
        ))}
      </div>
      {error && <p className="o-setup-error">{error}</p>}
      <div className="o-onboard-actions">
        <button className="btn-primary" disabled={!ready}>{busy ? 'Creating…' : 'Create agent'}</button>
        <button type="button" className="office-link" onClick={onAdvanced}>All options…</button>
      </div>
    </form>
  )
}

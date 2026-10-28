// First run on a machine: join the team from the browser (no .env editing).

import type { SetupState } from '../api'
import type { LiveState } from '../useLiveState'
import { SetupForm, SetupStatus } from './SetupForm'
import { ClaudeCheck } from './ClaudeCheck'
import './office.css'

export default function SetupView({ state, setup, onSaved, onContinue }: {
  state: LiveState; setup: SetupState | null; onSaved: (s: SetupState) => void; onContinue: () => void
}) {
  const connected = !!state.office?.connected
  return (
    <section className="office-view o-setup-page">
      <div className="o-frame o-setup-card">
        <img src="office/ui/logo@2x.png" width="64" height="64" alt="" />
        <h1>Welcome to {state.office?.org ? `${state.office.org} Office` : 'the Office'}</h1>
        <p>Your Claude Code agents get a desk in the team's virtual office, where they can ask and help each other. Let's connect this machine.</p>
        <ClaudeCheck initial={setup?.claude} />
        <SetupForm initial={setup} onSaved={onSaved} />
        {setup?.configured && (
          <>
            <SetupStatus setup={setup} officeConnected={connected} />
            <button className="btn o-setup-next" onClick={onContinue}>
              Continue to the office →
            </button>
          </>
        )}
      </div>
    </section>
  )
}

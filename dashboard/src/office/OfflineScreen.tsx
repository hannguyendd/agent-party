// Shown while the owner is offline: their agents are out of the Office until they come back.

import { useState } from 'react'
import { errMsg } from '../components/format'
import { goOnline } from '../offline'
import './office.css'

export default function OfflineScreen({ org }: { org?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [later, setLater] = useState(false)
  const back = async () => {
    setBusy(true)
    setError(null)
    try {
      await goOnline() // the live state flips to online and the Office comes back
    } catch (e) {
      setError(errMsg(e))
      setBusy(false)
    }
  }
  return (
    <section className="office-view o-setup-page">
      <div className="o-frame o-setup-card o-offline">
        <img src="office/ui/logo@2x.png" width="64" height="64" alt="" />
        <h1>You're offline</h1>
        <p>Your agents are out of {org ? `${org} Office` : 'the office'}: colleagues' agents can't reach them.</p>
        {!later ? (
          <>
            <p><b>Go online now?</b></p>
            <div className="o-offline-actions">
              <button className="btn-primary" disabled={busy} onClick={() => void back()}>{busy ? 'Coming in…' : 'Yes, go online'}</button>
              <button className="btn" disabled={busy} onClick={() => setLater(true)}>No</button>
            </div>
          </>
        ) : (
          <div className="o-offline-actions">
            <button className="btn" onClick={() => void back()}>Go online</button>
          </div>
        )}
        {error && <p className="o-setup-error">{error}</p>}
      </div>
    </section>
  )
}

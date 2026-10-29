// The "What's new" dialog: the releases from CHANGELOG.md, newest first.

import { useEffect } from 'react'
import { Icon } from './Icon'
import type { Release } from './changelog'

export function WhatsNew({ releases, current, onClose }: { releases: Release[]; current: string; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div className="office-view cmdk-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="o-frame cmdk whatsnew" role="dialog" aria-modal="true" aria-labelledby="whatsnew-title">
        <header className="whatsnew-head">
          <h2 id="whatsnew-title">What's new</h2>
          {current && <span className="whatsnew-ver">You're on v{current}</span>}
          <button className="whatsnew-x" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </header>
        <div className="whatsnew-body">
          {releases.length === 0 && <p className="whatsnew-empty">Nothing listed for this version yet.</p>}
          {releases.map((r) => (
            <section key={r.version || 'next'}>
              <h3>{r.version ? `v${r.version}` : 'Coming next'}{r.date && <small>{r.date}</small>}</h3>
              {r.groups.map((g) => (
                <div key={g.title} className="whatsnew-group">
                  <h4>{g.title}</h4>
                  <ul>{g.items.map((it) => <li key={it}>{it}</li>)}</ul>
                </div>
              ))}
            </section>
          ))}
        </div>
        <footer className="cmdk-foot"><button className="btn-primary" onClick={onClose}>Got it</button></footer>
      </div>
    </div>
  )
}

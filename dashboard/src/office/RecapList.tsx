// Recaps of the open conversation (CONTEXT.md "Recap"): written in the background, kept on this machine as
// Markdown, shareable with the Party when the conversation belongs to one.

import { useEffect, useState } from 'react'
import { api, type Recap } from '../api'
import { errMsg, timeAgo } from '../components/format'
import type { LiveState } from '../useLiveState'
import { Icon } from './Icon'
import { Markdown } from './Markdown'

export function RecapList({ state, convId, onRetry }: { state: LiveState; convId: string; onRetry: () => void }) {
  const [loaded, setLoaded] = useState<Recap[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => {
    api.recaps(convId).then(setLoaded).catch(() => {})
  }, [convId])
  // Live events win over the first fetch (a recap goes working -> done while the panel is open).
  const rows = Object.values({ ...Object.fromEntries(loaded.map((r) => [r.id, r])), ...state.recaps })
    .filter((r) => r.conversation_id === convId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  if (!rows.length) return null

  return (
    <div className="o-recaps">
      {rows.map((r) => {
        const expanded = open === r.id || (open === null && r === rows[0] && r.status === 'done')
        return (
          <div key={r.id} className={`o-recap is-${r.status}`}>
            <button className="o-recap-head" onClick={() => setOpen(expanded ? '' : r.id)} aria-expanded={expanded}>
              <Icon name="recap" />
              <strong>Recap</strong>
              <span>{r.status === 'working' ? 'writing…' : r.status === 'error' ? 'failed' : timeAgo(r.created_at)}</span>
              {r.shared && <span className="o-chip is-kind">shared</span>}
            </button>
            {r.status === 'error' && r === rows[0] && (
              <button className="o-recap-retry" onClick={onRetry}>Try again</button>
            )}
            {expanded && r.status !== 'working' && (
              <div className="o-recap-body">
                <Markdown text={r.body} state={state} />
                {r.status === 'done' && (
                  <div className="o-recap-actions">
                    <a className="o-mini-btn" href={api.recapFileUrl(r.id)} download>Download .md</a>
                    {r.party_id && (
                      <button
                        className="o-mini-btn"
                        onClick={() => {
                          setNote(null)
                          api.shareRecap(r.id).then((res) => setNote(`Shared with ${res.sent.length} owner${res.sent.length === 1 ? '' : 's'}`)).catch((e) => setNote(errMsg(e)))
                        }}
                      >
                        {r.shared ? 'Share again' : 'Share with the Party'}
                      </button>
                    )}
                  </div>
                )}
                {note && <p className="o-party-note">{note}</p>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// History: every conversation on this machine in one place, to look things up after the fact.
// Left: search (titles, names and the words themselves), filters, grouped by day. Right: the full transcript,
// what it cost, its recaps, and an export. Everything updates live from the WebSocket like the Office.

import { useEffect, useMemo, useState } from 'react'
import { api, type Conversation, type Message, type SearchHit } from '../api'
import { clockTime, timeAgo } from '../components/format'
import type { View } from '../App'
import type { LiveState } from '../useLiveState'
import { AppBar } from './AppBar'
import { Icon } from './Icon'
import { Avatar, OfficeChat } from './OfficeChat'
import { agentNames, who } from './people'
import { RecapList } from './RecapList'
import { plainPreview } from './render-md'
import { STATUS } from './status'
import { conversationMarkdown, dayLabel } from './history'

type Kind = 'all' | 'private' | 'inquiry' | 'assignment' | 'party'
type Range = 'all' | '7' | '30'

const KINDS: { id: Kind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'private', label: 'With me' },
  { id: 'inquiry', label: 'Questions' },
  { id: 'assignment', label: 'Tasks' },
  { id: 'party', label: 'Parties' },
]

const kindOf = (c: Conversation): Kind =>
  c.party_id || c.kind === 'party' || c.kind === 'party_share' ? 'party' : c.kind === 'assignment' ? 'assignment' : c.peer_agent_id ? 'inquiry' : 'private'

export default function HistoryView({ state, view, go, openConv, setOpenConv }: {
  state: LiveState; view: View; go: (v: View) => void; openConv: string | null; setOpenConv: (id: string | null) => void
}) {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<Kind>('all')
  const [agent, setAgent] = useState('')
  const [range, setRange] = useState<Range>('all')
  const [found, setFound] = useState<{ term: string; hits: Record<string, SearchHit> }>({ term: '', hits: {} })
  const [now] = useState(() => Date.now())
  const [searching, setSearching] = useState(false)
  const nameOf = useMemo(() => agentNames(state), [state])

  // Words inside messages: asked from this node's database, debounced while typing.
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return
    const t = setTimeout(() => {
      setSearching(true)
      api.searchConversations(term)
        .then((rows) => setFound({ term, hits: Object.fromEntries(rows.map((h) => [h.conversation_id, h])) }))
        .catch(() => setFound({ term, hits: {} }))
        .finally(() => setSearching(false))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const hits = useMemo(() => (q.trim().length >= 2 && found.term === q.trim() ? found.hits : {}), [q, found])
  const myAgents = Object.values(state.agents).sort((a, b) => a.name.localeCompare(b.name))
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    const since = range === 'all' ? 0 : now - Number(range) * 86400_000
    return Object.values(state.conversations)
      .filter((c) => kind === 'all' || kindOf(c) === kind)
      .filter((c) => !agent || c.agent_id === agent)
      .filter((c) => !since || new Date(c.updated_at).getTime() >= since)
      .filter((c) => {
        if (!term) return true
        if (hits[c.id]) return true
        const hay = [c.topic, c.title, c.last_preview, who(state, c.agent_id).name, c.peer_agent_id ? who(state, c.peer_agent_id).name : '', c.peer_agent_id ?? '']
          .join(' ').toLowerCase()
        return hay.includes(term)
      })
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }, [state, q, kind, agent, range, hits, now])

  const groups = useMemo(() => {
    const out: { label: string; rows: Conversation[] }[] = []
    for (const c of rows) {
      const label = dayLabel(c.updated_at)
      const last = out[out.length - 1]
      if (last?.label === label) last.rows.push(c)
      else out.push({ label, rows: [c] })
    }
    return out
  }, [rows])

  const conv = openConv ? state.conversations[openConv] : undefined
  const live = Object.values(state.conversations).filter((c) => c.status === 'running').length

  return (
    <section className="office-view office-history">
      <AppBar state={state} view={view} go={go} />
      <div className="history-body">
        <aside className="o-frame history-list">
          <div className="history-head">
            <h1>History</h1>
            <span className="o-count-pill">{rows.length}</span>
            {live > 0 && <span className="history-live"><i />{live} live</span>}
          </div>
          <label className="history-search">
            <Icon name="search" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search words, topics, agents…" autoFocus />
            {searching && <span className="history-spin" aria-label="searching" />}
            {q && <button aria-label="Clear" onClick={() => setQ('')}><Icon name="close" /></button>}
          </label>
          <div className="history-kinds" role="tablist">
            {KINDS.map((k) => (
              <button key={k.id} role="tab" aria-selected={kind === k.id} className={kind === k.id ? 'is-active' : ''} onClick={() => setKind(k.id)}>{k.label}</button>
            ))}
          </div>
          <div className="history-selects">
            <select value={agent} onChange={(e) => setAgent(e.target.value)} aria-label="Agent">
              <option value="">All my agents</option>
              {myAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select value={range} onChange={(e) => setRange(e.target.value as Range)} aria-label="When">
              <option value="all">Any time</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </div>
          <div className="history-scroll">
            {groups.length === 0 && <p className="office-empty">{q ? `Nothing matches “${q}”.` : 'No conversations yet.'}</p>}
            {groups.map((g) => (
              <div key={g.label} className="history-group">
                <h3>{g.label}</h3>
                {g.rows.map((c) => (
                  <HistoryRow key={c.id} c={c} state={state} nameOf={nameOf} hit={hits[c.id]} term={q} active={c.id === openConv} onOpen={() => setOpenConv(c.id)} />
                ))}
              </div>
            ))}
          </div>
        </aside>
        <main className="o-frame history-main">
          {conv ? (
            <Transcript state={state} conv={conv} messages={state.messages[conv.id]} partial={state.partial[conv.id]} go={go} onOpen={setOpenConv} />
          ) : (
            <div className="history-empty">
              <Icon name="clock" size={32} />
              <strong>Pick a conversation</strong>
              <p>Every chat your agents had: private ones, questions to colleagues, tasks and Parties. Search finds words inside messages too.</p>
            </div>
          )}
        </main>
      </div>
    </section>
  )
}

function HistoryRow({ c, state, nameOf, hit, term, active, onOpen }: {
  c: Conversation; state: LiveState; nameOf: (id: string) => string | null; hit?: SearchHit; term: string; active: boolean; onOpen: () => void
}) {
  const mine = who(state, c.agent_id)
  const peer = c.peer_agent_id ? who(state, c.peer_agent_id) : null
  const st = STATUS[c.status]
  const topic = c.topic || plainPreview(c.title, nameOf) || 'Untitled'
  const k = kindOf(c)
  return (
    <button className={`history-row ${active ? 'is-active' : ''} is-${st.tone}`} onClick={onOpen}>
      <span className="history-faces">
        <Avatar w={mine} size={24} />
        {peer && <Avatar w={peer} size={24} />}
      </span>
      <span className="history-row-main">
        <span className="history-row-top">
          <strong>{topic}</strong>
          <time>{clockTime(c.updated_at)}</time>
        </span>
        <span className="history-row-who">
          {mine.name}{peer ? ` ${c.direction === 'inbound' ? '←' : '→'} ${peer.name}` : ''}
          {k !== 'private' && <em className={`history-kind is-${k}`}>{KINDS.find((x) => x.id === k)?.label}</em>}
          {st.tone !== 'idle' && st.tone !== 'done' && <em className={`history-state is-${st.tone}`}>{st.label}</em>}
        </span>
        {hit ? (
          <span className="history-snippet"><Highlight text={hit.snippet} term={term} /></span>
        ) : (
          c.last_preview && <span className="history-snippet">{plainPreview(c.last_preview, nameOf)}</span>
        )}
      </span>
    </button>
  )
}

/** The snippet with the searched words marked. */
function Highlight({ text, term }: { text: string; term: string }) {
  const t = term.trim()
  if (!t) return <>{text}</>
  const parts = text.split(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>
}

function Transcript({ state, conv, messages, partial, go, onOpen }: {
  state: LiveState; conv: Conversation; messages: Message[] | undefined; partial?: string; go: (v: View) => void; onOpen: (id: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const mine = who(state, conv.agent_id)
  const peer = conv.peer_agent_id ? who(state, conv.peer_agent_id) : null
  const st = STATUS[conv.status]
  const nameOf = agentNames(state)
  const md = () => conversationMarkdown(conv, messages ?? [], (id) => who(state, id).name, nameOf)
  const download = () => {
    const blob = new Blob([md()], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(conv.topic || conv.title || 'conversation').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'conversation'}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const copy = () => void navigator.clipboard.writeText(md()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  const textCount = (messages ?? []).filter((m) => m.kind === 'text').length
  return (
    <div className="history-transcript">
      <header className="history-t-head">
        <span className="history-faces">
          <Avatar w={mine} size={32} />
          {peer && <Avatar w={peer} size={32} />}
        </span>
        <div className="history-t-title">
          <h2>{conv.topic || plainPreview(conv.title, nameOf) || 'Untitled'}</h2>
          <p>
            {mine.name}{peer ? ` ${conv.direction === 'inbound' ? '←' : '→'} ${peer.name}` : ''} · started {new Date(conv.created_at).toLocaleString()} · {timeAgo(conv.updated_at)}
          </p>
        </div>
        <span className={`o-crow-state is-${st.tone}`}>{st.label}</span>
      </header>
      <div className="history-stats">
        <span><b>{textCount}</b> messages</span>
        <span><b>{conv.turn_count}</b> turns</span>
        {conv.cost_usd !== undefined && conv.cost_usd > 0 && <span><b>${conv.cost_usd.toFixed(2)}</b> Claude cost</span>}
        <span className="history-actions">
          <button className="btn" onClick={copy}><Icon name="check" />{copied ? 'Copied' : 'Copy'}</button>
          <button className="btn" onClick={download}><Icon name="file" />Export .md</button>
          <button className="btn-primary" onClick={() => go({ kind: 'office', side: 'chats', conv: conv.id })}><Icon name="office" />Open in Office</button>
        </span>
      </div>
      <RecapList state={state} convId={conv.id} onRetry={() => void api.makeRecap(conv.id).catch(() => {})} />
      <div className="history-chat">
        <OfficeChat state={state} conv={conv} messages={messages} partial={partial} onOpen={onOpen} />
      </div>
    </div>
  )
}

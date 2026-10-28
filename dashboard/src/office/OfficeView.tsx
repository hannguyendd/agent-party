import { useEffect, useMemo, useRef, useState } from 'react'
import type Phaser from 'phaser'
import { api, type OfficeAgent, type OfficeTarget } from '../api'
import type { LiveState } from '../useLiveState'
import type { SideTab, View } from '../App'
import { errMsg } from '../components/ui'
import { SKINS, ownerCss } from './skins'
import type { OfficeScene, PeerClick, SceneCallbacks, SceneData } from './OfficeScene'
import { Icon } from './Icon'
import { AppBar } from './AppBar'
import { ConversationPanel } from './ConversationPanel'
import { ApprovalsList, ChatsList, MessageAgent } from './SideLists'
import { PeerMenu } from './PeerMenu'
import { ApprovalCard } from '../components/ApprovalCard'
import { enableNotifications, notificationsSupported } from '../useNotifications'
import './office.css'

const EMPTY_AGENTS: OfficeAgent[] = []
const EMPTY_DESKS: Record<string, string> = {}

const sampleAgents: OfficeAgent[] = [
  ['dev', 'Developer', 'dev-hoodie', { kind: 'desk' }],
  ['design', 'Designer', 'designer', { kind: 'desk' }],
  ['lead', 'Tech lead', 'lead', { kind: 'tile', x: 28, y: 24 }],
  ['shiba', 'Shiba', 'shiba', { kind: 'tile', x: 26, y: 24 }],
  ['cat', 'Tabby', 'cat', { kind: 'desk' }],
  ['penguin', 'Penguin', 'penguin', { kind: 'tile', x: 25, y: 8 }],
  ['alien', 'Researcher', 'alien', { kind: 'tile', x: 30, y: 8 }],
  ['robot', 'Robot', 'robot', { kind: 'tile', x: 30, y: 24 }],
].map(([id, name, skin, at]) => ({ agent_id: `preview/${id}`, owner: 'preview', name, skin, at, steered: false, activity: null }) as OfficeAgent)

function OfficeCanvas({ data, callbacks, sceneRef, onReady, onError }: {
  data: SceneData; callbacks: SceneCallbacks; sceneRef: React.RefObject<OfficeScene | null>
  onReady: () => void; onError: (message: string) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const latest = useRef({ data, callbacks, onReady, onError })
  useEffect(() => { latest.current = { data, callbacks, onReady, onError } })
  useEffect(() => {
    let disposed = false
    let game: Phaser.Game | undefined
    let observer: ResizeObserver | undefined
    void Promise.all([import('phaser'), import('./OfficeScene')]).then(([{ default: Phaser }, { OfficeScene }]) => {
      if (disposed || !host.current) return
      const scene = new OfficeScene()
      sceneRef.current = scene
      scene.setSceneData(latest.current.data)
      scene.callbacks = latest.current.callbacks
      scene.onReady = () => latest.current.onReady()
      game = new Phaser.Game({
        type: Phaser.AUTO, parent: host.current, width: host.current.clientWidth, height: host.current.clientHeight,
        backgroundColor: '#e6ddd8', pixelArt: true, roundPixels: true, antialias: false,
        scene: [scene], render: { pixelArt: true, antialias: false, roundPixels: true },
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
        input: { keyboard: { target: host.current } },
        audio: { noAudio: true },
      })
      observer = new ResizeObserver(() => {
        if (host.current?.clientWidth && host.current?.clientHeight) game?.scale.resize(host.current.clientWidth, host.current.clientHeight)
      })
      observer.observe(host.current)
    }).catch(e => latest.current.onError(errMsg(e)))
    return () => { disposed = true; observer?.disconnect(); if (sceneRef.current) sceneRef.current.callbacks = null; sceneRef.current = null; game?.destroy(true) }
  }, [sceneRef])
  useEffect(() => { sceneRef.current?.setSceneData(data) }, [data, sceneRef])
  useEffect(() => { if (sceneRef.current) sceneRef.current.callbacks = callbacks }, [callbacks, sceneRef])
  return <div ref={host} className="office-canvas" tabIndex={0} role="region" aria-label="Office. Select your agent, then use WASD or arrow keys, or click the floor to walk. H returns to desk, F follows, Escape deselects." />
}

export default function OfficeView({ state, view, go, clearError, openConv, setOpenConv }: {
  state: LiveState; view: Extract<View, { kind: 'office' }>; go: (v: View) => void; clearError: () => void
  openConv: string | null; setOpenConv: (id: string | null) => void
}) {
  const office = state.office
  const [preview, setPreview] = useState(false)
  const isPreview = preview || !office?.enabled
  const [demo, setDemo] = useState(sampleAgents)
  const [demoDesks, setDemoDesks] = useState<Record<string, string>>({ D2: 'preview' })
  const [selected, setSelected] = useState<string[]>([])
  const [pickingDesk, setPickingDesk] = useState(false)
  const [peer, setPeer] = useState<PeerClick | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [side, setSide] = useState<SideTab>(view.side ?? 'agents')
  const [wide, setWide] = useState(false)
  useEffect(() => { if (view.side) setSide(view.side) }, [view.side])
  const [notifyPerm, setNotifyPerm] = useState(() => (notificationsSupported() ? Notification.permission : 'denied'))
  const incoming = Object.values(state.approvals).filter(a => a.status === 'pending' && a.tool_name === 'Assignment')
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])
  const [ready, setReady] = useState(false)
  const sceneRef = useRef<OfficeScene | null>(null)
  const agents = isPreview ? demo : office?.agents ?? EMPTY_AGENTS
  const me = isPreview ? 'preview' : office?.owner ?? state.node?.owner ?? ''
  const desks = isPreview ? demoDesks : office?.desks ?? EMPTY_DESKS
  const canAct = isPreview || !!office?.connected
  const mine = agents.filter(a => a.owner === me)
  const picked = agents.find(a => a.agent_id === selected[0])
  // Newest conversation per agent of mine (active ones first), for "open chat".
  const latestConv = (agentId: string) => {
    const rows = Object.values(state.conversations).filter(c => c.agent_id === agentId)
    const live = (c: { status: string }) => ['running', 'awaiting_approval', 'awaiting_owner'].includes(c.status)
    return rows.sort((a, b) => Number(live(b)) - Number(live(a)) || b.updated_at.localeCompare(a.updated_at))[0]
  }
  const conv = openConv ? state.conversations[openConv] : undefined
  const ownDesk = Object.entries(desks).find(([, owner]) => owner === me)?.[0]
  const sceneData: SceneData = useMemo(() => ({
    me, agents, desks, owners: isPreview ? { preview: { connected: true, present: true } } : office?.owners ?? {},
    bubbles: Object.fromEntries(agents.filter(a => a.activity && ['running', 'awaiting_approval', 'awaiting_owner'].includes(a.activity.status)).map(a => {
      // Only my own conversations show words (CONTEXT.md privacy rule); everyone else sees typing dots.
      const c = a.owner === me && !isPreview ? latestConv(a.agent_id) : undefined
      const live = c ? (state.partial[c.id] ?? '').slice(-60).trim() : ''
      return [a.agent_id, live ? '…' + live : '…']
    })),
    icons: Object.fromEntries(agents.filter(a => a.activity?.status === 'awaiting_approval').map(a => [a.agent_id, '!'])), pickingDesk,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [me, agents, desks, isPreview, office?.owners, pickingDesk, state.partial, state.conversations])

  const perform = async (action: () => Promise<unknown>) => {
    if (!canAct) return
    clearError(); setError(null); setBusy(true)
    try { await action() } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }
  const move = (agentId: string, at: OfficeTarget) => {
    if (isPreview) setDemo(rows => rows.map(a => a.agent_id === agentId ? { ...a, at, steered: at.kind !== 'desk' } : a))
    else void perform(() => api.move(agentId, at))
  }
  const callbacks: SceneCallbacks = {
    onSelect: ids => setSelected(prev => prev.join() === ids.join() ? prev : ids),
    onMove: move, onPeerClick: setPeer,
    // Gather-style: stopping next to someone opens their menu; walking away closes a menu that opened this way.
    onNearby: click => setPeer(prev => click ?? (prev?.auto ? null : prev)),
    onDeskPick: id => {
      if (isPreview) { setDemoDesks({ [id]: 'preview' }); setPickingDesk(false) }
      else void perform(async () => { await api.claimDesk(id); setPickingDesk(false) })
    },
    onDeskTaken: (id, owner) => setNotice(`${id} is ${owner}'s desk. Pick one outlined in green.`),
    onOpenAgent: id => { const c = isPreview ? undefined : latestConv(id); if (c) setOpenConv(c.id) },
  }
  useEffect(() => {
    if (!isPreview) return
    let otherSide = false
    const timer = setInterval(() => {
      otherSide = !otherSide
      setDemo(rows => rows.map(a => a.agent_id === 'preview/penguin' ? { ...a, at: { kind: 'tile', x: otherSide ? 28 : 25, y: 8 } } : a.agent_id === 'preview/alien' ? { ...a, at: { kind: 'tile', x: otherSide ? 29 : 32, y: 8 } } : a))
    }, 6500)
    return () => clearInterval(timer)
  }, [isPreview])


  const presentCount = Object.values(office?.owners ?? {}).filter(o => o.present).length
  const statusText = (a: OfficeAgent) =>
    a.activity && ['running', 'awaiting_approval', 'awaiting_owner'].includes(a.activity.status) ? 'In a conversation' : a.at.kind === 'desk' ? 'At desk' : 'Wandering'

  const pendingApprovals = Object.values(state.approvals).filter(a => a.status === 'pending')
  const openChat = (id: string) => { setPeer(null); setOpenConv(id) }

  return <section className="office-view">
    <AppBar state={state} view={view} go={go} onApprovals={() => { setOpenConv(null); setSide('approvals') }} />

    <div className="office-toolbar">
      <div className="office-title">
        <div>
          <h1>Office <span className={`office-mode ${isPreview ? '' : 'is-live'}`}>{isPreview ? 'preview' : 'live'}</span></h1>
          <p>{isPreview ? 'Sample agents. Nothing here leaves your browser.' : `${agents.length} agents · ${presentCount} ${presentCount === 1 ? 'owner' : 'owners'} in the office`}</p>
        </div>
      </div>
      <div className="office-tools">
        {office?.enabled && <button className="btn" onClick={() => setPreview(!preview)}>{preview ? '← Back to live' : 'Preview'}</button>}
        <button className="btn" disabled={!canAct || busy} aria-pressed={pickingDesk} onClick={() => setPickingDesk(!pickingDesk)}><Icon name="desk" />{pickingDesk ? 'Cancel' : ownDesk ? `Desk ${ownDesk} · Change` : 'Choose a desk'}</button>
        {notifyPerm !== 'granted' && notificationsSupported() && <button className="btn" title="Get pinged when someone assigns you work while this tab is in the background" onClick={() => void enableNotifications().then(setNotifyPerm)}><Icon name="notifications-on" />Notifications</button>}
        <button className="btn" disabled={!ready} onClick={() => sceneRef.current?.fitCamera()}><Icon name="fit" />Fit office</button>
      </div>
    </div>

    {!isPreview && !office?.connected && <div className="office-notice" role="status">Reconnecting to the office. You can look around; moving resumes once it's back.</div>}
    {!isPreview && office && !office.enabled && <div className="office-notice" role="status">This node isn't connected to a world server. <button className="btn" onClick={() => go({ kind: 'settings', section: 'mesh' })}>Set it up</button></div>}
    {(error || state.officeError) && <div className="office-notice office-error" role="alert">{error || state.officeError}<button onClick={() => { setError(null); clearError() }} aria-label="Dismiss"><Icon name="close" /></button></div>}
    {notice && <div className="office-notice" role="status">{notice}</div>}
    {pickingDesk && <div className="office-notice" role="status">Click a desk outlined in green, or pick one from the list on the right.</div>}

    <div className={`office-workspace ${wide && conv ? 'is-wide' : ''}`}>
      <div className="office-stage-wrap">
      <div className="office-stage">
        <OfficeCanvas data={sceneData} callbacks={callbacks} sceneRef={sceneRef} onReady={() => setReady(true)} onError={setError} />
        {!ready && <div className="office-loading" role="status">Opening the office…</div>}
        {!isPreview && incoming.length > 0 && (
          <div className="office-incoming">
            {incoming.map(a => {
              const c = state.conversations[a.conversation_id]
              return <ApprovalCard key={a.id} approval={a} context={c ? <>for <span className="font-mono">{c.agent_id}</span></> : undefined} />
            })}
          </div>
        )}
        <div className="office-zoom" aria-label="Zoom">
          <button className="o-btn" aria-label="Zoom out" onClick={() => sceneRef.current?.zoomBy(0.85)}>−</button>
          <button className="o-btn" aria-label="Fit office" onClick={() => sceneRef.current?.fitCamera()}><Icon name="fit" size={32} /></button>
          <button className="o-btn" aria-label="Zoom in" onClick={() => sceneRef.current?.zoomBy(1.15)}>+</button>
        </div>
        {peer && agents.some(a => a.agent_id === peer.agentId) && (
          <PeerMenu
            click={peer}
            peer={agents.find(a => a.agent_id === peer.agentId)!}
            present={isPreview || !!office?.owners[agents.find(a => a.agent_id === peer.agentId)!.owner]?.present}
            selectedMine={selected}
            conversations={isPreview ? [] : Object.values(state.conversations).filter(c => c.peer_agent_id === peer.agentId)}
            onClose={() => { if (peer.auto) sceneRef.current?.dismissNearby(); setPeer(null) }}
            onWalk={() => { sceneRef.current?.walkSelectedTo(peer.agentId); setPeer(null) }}
            onOpen={openChat}
            onSent={msg => { setPeer(null); setError(null); setNotice(msg) }}
            onError={setError}
            preview={isPreview}
          />
        )}
      </div>
      </div>

      <aside className="office-roster">
        {conv ? (
          <ConversationPanel
            key={conv.id}
            conv={conv}
            messages={state.messages[conv.id]}
            partial={state.partial[conv.id]}
            approvals={Object.values(state.approvals).filter(a => a.conversation_id === conv.id)}
            onBack={() => { setOpenConv(null); setWide(false) }}
            onOpen={setOpenConv}
            wide={wide}
            onExpand={() => setWide(w => !w)}
          />
        ) : <>
        <div className="office-tabs" role="tablist">
          {([['agents', 'agents', 'Agents', mine.length], ['chats', 'inject', 'Chats', 0], ['approvals', pendingApprovals.length ? 'approvals-pending' : 'approvals', 'Approvals', pendingApprovals.length]] as const).map(([id, icon, label, n]) => (
            <button key={id} role="tab" aria-selected={side === id} className={side === id ? 'is-active' : ''} onClick={() => setSide(id)}>
              <Icon name={icon} />{label}{n > 0 && <span className={id === 'approvals' ? 'o-count' : 'o-num'}>{n}</span>}
            </button>
          ))}
        </div>

        {side === 'agents' && <>
        <div className="o-frame office-card">
          <h2>Your agents <span>{mine.length}</span></h2>
          {!mine.length && <p className="office-empty">Your online agents show up here. <button className="btn" onClick={() => go({ kind: 'settings', section: 'agents' })}>+ New agent</button></p>}
          <div className="office-agent-list">{mine.map(a => <button key={a.agent_id} className={`office-agent ${selected.includes(a.agent_id) ? 'is-selected' : ''}`} aria-pressed={selected.includes(a.agent_id)} onClick={() => sceneRef.current?.selectOnly([a.agent_id])}>
            <img src={`office/characters/${a.skin}-portrait.png`} alt="" width="32" height="48" />
            <span><strong>{a.name}</strong><small>{statusText(a)}</small></span>
            <i style={{ backgroundColor: ownerCss(a.owner) }} />
          </button>)}</div>
        </div>

        {picked && <div className="o-frame office-card office-agent-actions"><h3>{picked.name}</h3>
          {!isPreview && <MessageAgent agentId={picked.agent_id} onStarted={openChat} onError={setError} />}
          <label htmlFor="office-skin">Skin</label><select id="office-skin" className="input" value={picked.skin} disabled={!canAct || busy} onChange={e => {
            if (isPreview) setDemo(rows => rows.map(a => a.agent_id === picked.agent_id ? { ...a, skin: e.target.value } : a))
            else void perform(() => api.setSkin(picked.agent_id, e.target.value))
          }}>{SKINS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          <div className="office-actions-row">
            <button className="btn" disabled={!canAct} onClick={() => sceneRef.current?.sendSelectedHome()}><Icon name="desk" />Back to desk</button>
            <button className="btn" disabled={!canAct} onClick={() => sceneRef.current?.moveSelectedTo({ x: 43, y: 10 })}>Pantry</button>
            <button className="btn" disabled={!canAct} onClick={() => sceneRef.current?.moveSelectedTo({ x: 41, y: 20 })}>Meeting room</button>
          </div>
          {!isPreview && <button className="btn" onClick={() => go({ kind: 'settings', section: 'agents', agentId: picked.agent_id })}><Icon name="settings" />Agent settings</button>}
        </div>}

        {pickingDesk && <label className="o-frame office-card office-desk-list">Choose a desk<select className="input" defaultValue="" disabled={busy} onChange={e => callbacks.onDeskPick(e.target.value)}><option value="" disabled>Select…</option>{['D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13','D14','D15','D16','M1','M2'].filter(id => !desks[id]).map(id => <option key={id}>{id}</option>)}</select></label>}

        <details className="o-frame office-card office-help"><summary>How to play</summary>
          <p>Select an agent, then <kbd>WASD</kbd> / arrows to walk, or click the floor.</p>
          <p>Click someone's agent to walk over. Stop next to them and their menu opens · <kbd>E</kbd> reopens it.</p>
          <p><kbd>Shift</kbd> multi-select · <kbd>H</kbd> back to desk · <kbd>F</kbd> follow · <kbd>Esc</kbd> deselect</p>
          <p>Scroll to zoom · right-drag to pan</p>
        </details>
        </>}

        {side === 'chats' && <ChatsList state={state} me={me} onOpen={openChat} />}
        {side === 'approvals' && <ApprovalsList approvals={pendingApprovals} state={state} onOpen={openChat} />}
        </>}
      </aside>
    </div>
    <footer className="office-footer"><span className={`office-connection ${isPreview || office?.connected ? 'is-online' : ''}`}>{isPreview ? 'Local preview' : office?.connected ? 'Office connected' : 'Reconnecting'}</span><span>18 desks · pantry · meeting room</span></footer>
  </section>
}

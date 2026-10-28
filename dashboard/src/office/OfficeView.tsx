import { useEffect, useMemo, useRef, useState } from 'react'
import type Phaser from 'phaser'
import { api, type OfficeAgent, type OfficeTarget } from '../api'
import type { LiveState } from '../useLiveState'
import type { View } from '../App'
import { errMsg } from '../components/ui'
import { SKINS, ownerCss } from './skins'
import type { OfficeScene, PeerClick, SceneCallbacks, SceneData } from './OfficeScene'
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

export default function OfficeView({ state, go, clearError }: { state: LiveState; go: (v: View) => void; clearError: () => void }) {
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
  const ownDesk = Object.entries(desks).find(([, owner]) => owner === me)?.[0]
  const sceneData: SceneData = useMemo(() => ({
    me, agents, desks, owners: isPreview ? { preview: { connected: true, present: true } } : office?.owners ?? {},
    bubbles: Object.fromEntries(agents.filter(a => a.activity && ['running', 'awaiting_approval', 'awaiting_owner'].includes(a.activity.status)).map(a => [a.agent_id, '…'])),
    icons: Object.fromEntries(agents.filter(a => a.activity?.status === 'awaiting_approval').map(a => [a.agent_id, '!'])), pickingDesk,
  }), [me, agents, desks, isPreview, office?.owners, pickingDesk])

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
    onOpenAgent: id => { if (!isPreview) go({ kind: 'agent-edit', id }) },
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


  return <section className="office-view">
    <div className="office-toolbar">
      <div><h1>Office <span className="office-mode">{isPreview ? 'Design preview' : 'Shared office'}</span></h1>
        <p>{isPreview ? 'Explore the pastel office. Changes here stay in this preview.' : `${agents.length} agents · ${Object.values(office?.owners ?? {}).filter(o => o.present).length} owners present`}</p>
      </div>
      <div className="office-tools">
        {office?.enabled && <button className="btn" onClick={() => setPreview(!preview)}>{preview ? 'Back to live' : 'Preview'}</button>}
        <button className="btn" disabled={!canAct || busy} aria-pressed={pickingDesk} onClick={() => setPickingDesk(!pickingDesk)}>{pickingDesk ? 'Cancel desk selection' : ownDesk ? `Desk ${ownDesk} · Change` : 'Choose a desk'}</button>
        {notifyPerm !== 'granted' && notificationsSupported() && <button className="btn" title="Được gọi khi có người giao việc lúc bạn không xem tab này" onClick={() => void enableNotifications().then(setNotifyPerm)}>🔔 Bật thông báo</button>}
        <button className="btn" disabled={!ready} onClick={() => sceneRef.current?.fitCamera()}>Fit office</button>
      </div>
    </div>
    {!isPreview && !office?.connected && <div className="office-notice" role="status">Office is reconnecting. You can look around; steering resumes when the connection returns.</div>}
    {(error || state.officeError) && <div className="office-notice office-error" role="alert">{error || state.officeError}<button onClick={() => { setError(null); clearError() }} aria-label="Dismiss error">×</button></div>}
    {notice && <div className="office-notice" role="status">{notice}</div>}
    {pickingDesk && <div className="office-notice" role="status">Click an unclaimed desk, or choose one from the desk list below.</div>}
    <div className="office-workspace">
      <div className="office-stage">
        <OfficeCanvas data={sceneData} callbacks={callbacks} sceneRef={sceneRef} onReady={() => setReady(true)} onError={setError} />
        {!ready && <div className="office-loading" role="status">Opening the office…</div>}
        {!isPreview && incoming.length > 0 && (
          <div className="office-incoming">
            {incoming.map(a => {
              const conv = state.conversations[a.conversation_id]
              return <ApprovalCard key={a.id} approval={a} context={conv ? <>cho <span className="font-mono">{conv.agent_id}</span></> : undefined} />
            })}
          </div>
        )}
        <div className="office-zoom" aria-label="Office zoom">
          <button aria-label="Zoom out" onClick={() => sceneRef.current?.zoomBy(0.85)}>−</button>
          <button aria-label="Fit whole office" onClick={() => sceneRef.current?.fitCamera()}>⌂</button>
          <button aria-label="Zoom in" onClick={() => sceneRef.current?.zoomBy(1.15)}>+</button>
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
            onOpen={id => go({ kind: 'conversation', id })}
            onSent={msg => { setPeer(null); setError(null); setNotice(msg) }}
            onError={setError}
            preview={isPreview}
          />
        )}
      </div>
      <aside className="office-roster">
        <div className="office-roster-heading"><h2>Your agents</h2><span>{mine.length}</span></div>
        {!mine.length && <p className="office-empty">Your online agents will appear here.</p>}
        <div className="office-agent-list">{mine.map(a => <button key={a.agent_id} className={`office-agent ${selected.includes(a.agent_id) ? 'is-selected' : ''}`} aria-pressed={selected.includes(a.agent_id)} onClick={() => sceneRef.current?.selectOnly([a.agent_id])}>
          <img src={`office/characters/${a.skin}-portrait.png`} alt="" width="32" height="48" />
          <span><strong>{a.name}</strong><small>{a.at.kind === 'desk' ? 'At desk' : a.activity?.status === 'running' ? 'In conversation' : 'Exploring'}</small></span>
          <i style={{ backgroundColor: ownerCss(a.owner) }} />
        </button>)}</div>
        {picked && <div className="office-agent-actions"><h3>{picked.name}</h3>
          <label htmlFor="office-skin">Skin</label><select id="office-skin" className="input" value={picked.skin} disabled={!canAct || busy} onChange={e => {
            if (isPreview) setDemo(rows => rows.map(a => a.agent_id === picked.agent_id ? { ...a, skin: e.target.value } : a))
            else void perform(() => api.setSkin(picked.agent_id, e.target.value))
          }}>{SKINS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          <button className="btn" disabled={!canAct} onClick={() => sceneRef.current?.sendSelectedHome()}>Return to desk</button>
          <button className="btn" disabled={!canAct} onClick={() => sceneRef.current?.moveSelectedTo({ x: 43, y: 10 })}>Walk to pantry</button>
          <button className="btn" disabled={!canAct} onClick={() => sceneRef.current?.moveSelectedTo({ x: 41, y: 20 })}>Enter manager room</button>
          {!isPreview && <button className="btn" onClick={() => go({ kind: 'agent-edit', id: picked.agent_id })}>Open agent</button>}
        </div>}
        {pickingDesk && <label className="office-desk-list">Choose a desk<select className="input" defaultValue="" disabled={busy} onChange={e => callbacks.onDeskPick(e.target.value)}><option value="" disabled>Select…</option>{['D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13','D14','D15','D16','M1','M2'].filter(id => !desks[id]).map(id => <option key={id}>{id}</option>)}</select></label>}
        <div className="office-help"><h3>Make yourself at home</h3><p>Chọn agent của bạn, rồi <kbd>WASD</kbd>/mũi tên để đi, hoặc click sàn.</p><p>Dừng cạnh agent người khác: menu tự hiện · <kbd>E</kbd> mở lại menu</p><p><kbd>Shift</kbd> chọn nhiều · <kbd>H</kbd> về bàn · <kbd>F</kbd> camera bám theo · <kbd>Esc</kbd> bỏ chọn</p><p>Click agent người khác để mở menu. Lăn chuột: zoom · Chuột phải kéo: xem chỗ khác.</p></div>
      </aside>
    </div>
    <footer className="office-footer"><span className={`office-connection ${isPreview || office?.connected ? 'is-online' : ''}`}>{isPreview ? 'Local preview' : office?.connected ? 'Office connected' : 'Reconnecting'}</span><span>Pastel office · 18 desks · Open pantry</span></footer>
  </section>
}

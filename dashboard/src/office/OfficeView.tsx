import { useEffect, useMemo, useRef, useState } from 'react'
import type Phaser from 'phaser'
import { api, type OfficeAgent, type OfficeTarget } from '../api'
import type { LiveState } from '../useLiveState'
import type { SideTab, View } from '../App'
import { errMsg } from '../components/format'
import { ownerCss } from './skins'
import type { OfficeScene, PeerClick, SceneCallbacks, SceneData } from './OfficeScene'
import { Icon } from './Icon'
import { AppBar } from './AppBar'
import { AgentCard } from './AgentCard'
import { ConversationPanel } from './ConversationPanel'
import { NewChatPanel } from './NewChatPanel'
import { PartyPanel } from './PartyPanel'
import { markSeen } from './seen'
import { ACTIVE_STATUSES } from './status'
import { who } from './people'
import { ApprovalsList, ChatsList, type ChatTab } from './SideLists'
import { PeerMenu } from './PeerMenu'
import { Onboarding, type OnboardingStep } from './Onboarding'
import { ApprovalCard } from '../components/ApprovalCard'
import { notificationsSupported } from '../useNotifications'
import './office.css'

const EMPTY_AGENTS: OfficeAgent[] = []
const EMPTY_DESKS: Record<string, string> = {}
const ONBOARDED_KEY = 'office.onboarded'
const readFlag = () => { try { return localStorage.getItem(ONBOARDED_KEY) === '1' } catch { return false } }
const writeFlag = () => { try { localStorage.setItem(ONBOARDED_KEY, '1') } catch { /* private window: the guide shows again next time */ } }

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
        // We size the canvas ourselves from the host (ResizeObserver below); RESIZE mode kept the old size when
        // only the host changed (e.g. widening the side column).
        scale: { mode: Phaser.Scale.NONE },
        input: { keyboard: { target: host.current } },
        audio: { noAudio: true },
      })
      observer = new ResizeObserver(() => {
        const w = host.current?.clientWidth, h = host.current?.clientHeight
        if (w && h && game && (game.scale.width !== w || game.scale.height !== h)) game.scale.resize(w, h)
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
  // Sample agents for design work only: add ?preview to the URL. Staff never see it.
  const isPreview = new URLSearchParams(location.search).has('preview')
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
  // A private chat with one of my agents that has no messages yet (opened from the agent card).
  const [newChat, setNewChat] = useState<string | null>(null)
  // A Party being gathered around one of my agents (its Host), before it starts.
  const [newParty, setNewParty] = useState<string | null>(null)
  const [chatTab, setChatTab] = useState<ChatTab | null>(null)
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
  // Streaming text arrives per token; the map's bubbles only need a few updates a second.
  const partial = useThrottled(state.partial, 250)
  // Reading a conversation marks it seen (Chats shows a dot for new messages elsewhere).
  useEffect(() => { if (conv) markSeen(conv.id, conv.updated_at) }, [conv])
  const ownDesk = Object.entries(desks).find(([, owner]) => owner === me)?.[0]
  // First-run guide. Its step follows real state, so it resumes where the person left off.
  const [onboarded, setOnboarded] = useState(readFlag)
  const [quickAgent, setQuickAgent] = useState(false)
  const [notifySkipped, setNotifySkipped] = useState(false)
  const finishOnboarding = () => { writeFlag(); setOnboarded(true) }
  const hasAgents = Object.keys(state.agents).length > 0
  const onboardStep: OnboardingStep | null = isPreview || !state.node ? null
    : !hasAgents ? 'agent'
    : office?.enabled && !ownDesk ? 'desk'
    : notifyPerm === 'default' && notificationsSupported() && !notifySkipped ? 'notify'
    : 'tips'
  const showGuide = quickAgent || (!onboarded && !!onboardStep && !pickingDesk)
  const sceneData: SceneData = useMemo(() => ({
    me, agents, desks, owners: isPreview ? { preview: { connected: true, present: true } } : office?.owners ?? {},
    bubbles: Object.fromEntries(agents.filter(a => a.activity && ['running', 'awaiting_approval', 'awaiting_owner'].includes(a.activity.status)).map(a => {
      // Only my own conversations show words (CONTEXT.md privacy rule); everyone else sees typing dots.
      const c = a.owner === me && !isPreview ? latestConv(a.agent_id) : undefined
      const live = c ? (partial[c.id] ?? '').slice(-60).trim() : ''
      return [a.agent_id, live ? '…' + live : '…']
    })),
    // '!' (waiting for an approval) wins over the Party Host's 🎉.
    icons: {
      ...Object.fromEntries((office?.parties ?? []).map(p => [p.host, '🎉'])),
      ...Object.fromEntries(agents.filter(a => a.activity?.status === 'awaiting_approval').map(a => [a.agent_id, '!'])),
    },
    pickingDesk,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [me, agents, desks, isPreview, office?.owners, office?.parties, pickingDesk, partial, state.conversations])

  // The contact-policy switch flips at once and saves in the background. It doesn't go through perform(), whose
  // busy flag disabled every button on the card for the round trip (the card seemed to re-render).
  const [policyDraft, setPolicyDraft] = useState<Record<string, 'auto' | 'ask'>>({})
  const setContactPolicy = (agentId: string, policy: 'auto' | 'ask') => {
    const full = state.agents[agentId]
    if (!full) return
    setPolicyDraft(d => ({ ...d, [agentId]: policy }))
    api.saveAgent({ ...full, contact_policy: policy }).catch(e => {
      setError(errMsg(e))
      setPolicyDraft(d => { const next = { ...d }; delete next[agentId]; return next })
    })
  }
  // Drop a draft once the saved agent comes back over the live stream.
  useEffect(() => {
    const done = Object.keys(policyDraft).filter(id => state.agents[id]?.contact_policy === policyDraft[id])
    if (done.length) setPolicyDraft(d => Object.fromEntries(Object.entries(d).filter(([id]) => !done.includes(id))))
  }, [policyDraft, state.agents])
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
    // Party members stand around their Host on purpose: don't pop the menu between agents of the same Party.
    onNearby: click => {
      const together = click && (office?.parties ?? []).some(p => [p.host, ...p.members].includes(click.agentId) && selected.some(id => [p.host, ...p.members].includes(id)))
      if (!together) setPeer(prev => click ?? (prev?.auto ? null : prev))
    },
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


  const presentOwners = Object.entries(office?.owners ?? {}).filter(([, o]) => o.present).map(([name]) => name).sort()
  const activeChats = Object.values(state.conversations).filter(c => c.agent_id.startsWith(`${me}/`) && ACTIVE_STATUSES.includes(c.status)).length
  const statusText = (a: OfficeAgent) =>
    a.activity && ['running', 'awaiting_approval', 'awaiting_owner'].includes(a.activity.status) ? 'In a conversation' : a.at.kind === 'desk' ? 'At desk' : 'Wandering'

  const pendingApprovals = Object.values(state.approvals).filter(a => a.status === 'pending')
  const openChat = (id: string) => { setPeer(null); setOpenConv(id) }

  return <section className="office-view">
    <AppBar state={state} view={view} go={go} onApprovals={() => { setOpenConv(null); setSide('approvals') }} />

    <div className={`office-workspace ${wide && conv ? 'is-wide' : ''}`}>
      <div className="office-stage-wrap">
      <div className="office-stage">
        <OfficeCanvas data={sceneData} callbacks={callbacks} sceneRef={sceneRef} onReady={() => setReady(true)} onError={setError} />
        {!ready && <div className="office-loading" role="status">Opening the office…</div>}
        <div className="office-toasts">
          {!isPreview && office?.enabled && !office.connected && <div className="office-toast" role="status">Reconnecting to the office… you can look around meanwhile.</div>}
          {!isPreview && office && !office.enabled && <div className="office-toast" role="status">This node isn't connected to a world server. <button className="btn" onClick={() => go({ kind: 'settings', section: 'mesh' })}>Set it up</button></div>}
          {(error || state.officeError) && <div className="office-toast is-error" role="alert"><span>{error || state.officeError}</span><button onClick={() => { setError(null); clearError() }} aria-label="Dismiss"><Icon name="close" /></button></div>}
          {notice && <div className="office-toast" role="status">{notice}</div>}
          {pickingDesk && <div className="office-toast is-pick" role="status"><span>Click a free desk (outlined in green) to make it yours.</span><button className="btn" onClick={() => setPickingDesk(false)}>Cancel</button></div>}
        </div>

        {!isPreview && incoming.length > 0 && (
          <div className="office-incoming">
            {incoming.map(a => {
              const c = state.conversations[a.conversation_id]
              return <ApprovalCard key={a.id} approval={a} nameOf={id => who(state, id).name} context={c ? <>for <strong>{who(state, c.agent_id).name}</strong></> : undefined} />
            })}
          </div>
        )}
        {showGuide && (
          <Onboarding
            step={quickAgent ? 'agent' : onboardStep ?? 'tips'}
            owner={me}
            single={quickAgent}
            onAgentCreated={id => { setQuickAgent(false); setNotice(`${id} is ready. It appears on the map in a moment.`) }}
            onPickDesk={() => setPickingDesk(true)}
            onNotify={() => { setNotifySkipped(true); setNotifyPerm(notificationsSupported() ? Notification.permission : 'denied') }}
            onDone={finishOnboarding}
            onClose={() => (quickAgent ? setQuickAgent(false) : finishOnboarding())}
            onAdvanced={() => { setQuickAgent(false); go({ kind: 'settings', section: 'agents', agentId: 'new' }) }}
          />
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
            onSent={(msg, convId) => { setPeer(null); setError(null); setNotice(msg); if (convId) { setOpenConv(convId); setSide('chats') } }}
            onError={setError}
            preview={isPreview}
          />
        )}
      </div>
      </div>

      <aside className="office-roster">
        {newParty && !conv ? (
          <PartyPanel
            key={newParty}
            state={state}
            hostId={newParty}
            onBack={() => setNewParty(null)}
            onCreated={id => { setNewParty(null); setOpenConv(id) }}
          />
        ) : newChat && !conv ? (
          <NewChatPanel
            key={newChat}
            state={state}
            agentId={newChat}
            onBack={() => setNewChat(null)}
            onCreated={id => { setNewChat(null); setOpenConv(id) }}
          />
        ) : conv ? (
          <ConversationPanel
            key={conv.id}
            state={state}
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
          <h2><span className="o-h2-title">Your agents</span>{!isPreview && <button className="o-mini-btn is-primary" onClick={() => setQuickAgent(true)}>+ New agent</button>}</h2>
          {/* Always here (not only once a desk is claimed): it's the one place to pick a desk after the first-run guide. */}
          {(isPreview || office?.enabled) && <div className="office-desk-row"><Icon name="desk" />
            <span>{ownDesk ? <>Your desk <strong>{ownDesk}</strong></> : 'No desk yet'}</span>
            <button className={`o-mini-btn ${ownDesk || pickingDesk ? '' : 'is-primary'}`} disabled={!canAct} onClick={() => setPickingDesk(p => !p)}>
              {pickingDesk ? 'Cancel' : ownDesk ? 'Change desk' : 'Pick a desk'}
            </button></div>}
          {!mine.length && <p className="office-empty">{hasAgents ? 'Your agents appear here once the office connects.' : 'No agents yet. Press + New to create one.'}</p>}
          <div className="office-agent-list">{mine.map(a => <button key={a.agent_id} className={`office-agent ${selected.includes(a.agent_id) ? 'is-selected' : ''}`} aria-pressed={selected.includes(a.agent_id)} onClick={() => sceneRef.current?.selectOnly([a.agent_id])}>
            <img src={`office/characters/${a.skin}-portrait.png`} alt="" width="32" height="48" />
            <span><strong>{a.name}</strong><small>{statusText(a)}</small></span>
            <i style={{ backgroundColor: ownerCss(a.owner) }} />
          </button>)}</div>
        </div>

        {picked && <AgentCard
          agent={picked}
          desk={ownDesk}
          lastChat={isPreview ? undefined : latestConv(picked.agent_id)}
          peerName={id => who(state, id).name}
          canAct={canAct && !busy}
          preview={isPreview}
          onOpenChat={openChat}
          onMessage={() => { setPeer(null); setOpenConv(null); setNewParty(null); setNewChat(picked.agent_id) }}
          onParty={isPreview || (office?.parties ?? []).some(p => p.host === picked.agent_id || p.members.includes(picked.agent_id)) ? undefined
            : () => { setPeer(null); setOpenConv(null); setNewChat(null); setNewParty(picked.agent_id) }}
          // Spots inside each room on the map art; the scene snaps to the nearest tile it can reach.
          onGo={where => where === 'desk' ? sceneRef.current?.sendSelectedHome() : sceneRef.current?.goToPlace(where === 'pantry' ? { x: 46, y: 8 } : { x: 47, y: 21 })}
          onSkin={skin => isPreview ? setDemo(rows => rows.map(a => a.agent_id === picked.agent_id ? { ...a, skin } : a)) : void perform(() => api.setSkin(picked.agent_id, skin))}
          onSettings={() => go({ kind: 'settings', section: 'agents', agentId: picked.agent_id })}
          contactPolicy={isPreview ? undefined : (policyDraft[picked.agent_id] ?? state.agents[picked.agent_id]?.contact_policy ?? 'auto')}
          onContactPolicy={policy => setContactPolicy(picked.agent_id, policy)}
        />}

        {pickingDesk && <label className="o-frame office-card office-desk-list">Choose a desk<select className="input" defaultValue="" disabled={busy} onChange={e => callbacks.onDeskPick(e.target.value)}><option value="" disabled>Select…</option>{(office?.desk_ids?.length ? office.desk_ids : ['D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13','D14','D15','D16','M1','M2']).filter(id => !desks[id]).map(id => <option key={id}>{id}</option>)}</select></label>}

        </>}

        {side === 'chats' && <ChatsList state={state} me={me} onOpen={openChat} tab={chatTab} onTab={setChatTab} />}
        {side === 'approvals' && <ApprovalsList approvals={pendingApprovals} state={state} onOpen={openChat} />}
        </>}
      </aside>
    </div>
    <footer className="office-footer">
      <span className={`office-connection ${isPreview || office?.connected ? 'is-online' : ''}`}>{isPreview ? 'Design preview' : office?.connected ? 'Office connected' : 'Reconnecting'}</span>
      {!isPreview && <span className="office-present" title={presentOwners.join(', ')}>
        {presentOwners.slice(0, 6).map(o => <i key={o} style={{ background: ownerCss(o) }} title={o} />)}
        <Icon name="people" />{presentOwners.length} in the office
      </span>}
      {ownDesk && <span>Desk {ownDesk}</span>}
      {!isPreview && <button className="office-foot-link" onClick={() => { setOpenConv(null); setSide('chats') }}>{activeChats} active chat{activeChats === 1 ? '' : 's'}</button>}
      {!isPreview && pendingApprovals.length > 0 && <button className="office-foot-link is-alert" onClick={() => { setOpenConv(null); setSide('approvals') }}>{pendingApprovals.length} waiting for you</button>}
      <span className="office-keys"><Icon name="keyboard" /><kbd>WASD</kbd> walk · <kbd>E</kbd> talk · <kbd>H</kbd> desk · <kbd>F</kbd> follow · scroll to zoom</span>
    </footer>
  </section>
}

/** Hold a fast-changing value and release it at most every `ms` milliseconds. */
function useThrottled<T>(value: T, ms: number): T {
  const [held, setHeld] = useState(value)
  const last = useRef(0)
  useEffect(() => {
    const t = setTimeout(() => {
      last.current = Date.now()
      setHeld(value)
    }, Math.max(0, last.current + ms - Date.now()))
    return () => clearTimeout(t)
  }, [value, ms])
  return held
}

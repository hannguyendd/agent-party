// Live dashboard state: REST snapshot + /api/ws event stream folded through one reducer.

import { useCallback, useEffect, useReducer, useRef } from 'react'
import { api, wsUrl, type Agent, type Approval, type Conversation, type LiveEvent, type Message, type NodeInfo, type OfficeState, type Recap, type WorldEvent } from './api'

export interface LiveState {
  connected: boolean
  node: NodeInfo | null
  agents: Record<string, Agent>
  conversations: Record<string, Conversation>
  /** Only populated for conversations that have been opened (loaded via detail fetch). */
  messages: Record<string, Message[]>
  /** Streaming partial assistant text per conversation. */
  partial: Record<string, string>
  approvals: Record<string, Approval>
  /** Office view state relayed from the world server; null until fetched. */
  office: OfficeState | null
  /** Last error the world server sent back for one of our actions. */
  officeError: string | null
  /** Recaps made or updated since this tab opened (`recap` events); panels fetch older ones themselves. */
  recaps: Record<string, Recap>
}

type Action =
  | { type: 'connected'; value: boolean }
  | { type: 'node'; node: NodeInfo }
  | { type: 'snapshot'; agents: Agent[]; conversations: Conversation[]; approvals: Approval[] }
  | { type: 'detail'; conversation: Conversation; messages: Message[]; approvals: Approval[] }
  | { type: 'event'; event: LiveEvent }
  | { type: 'office'; office: OfficeState }

const initial: LiveState = {
  connected: false,
  node: null,
  agents: {},
  conversations: {},
  messages: {},
  partial: {},
  approvals: {},
  office: null,
  officeError: null,
  recaps: {},
}

const byId = <T extends { id: string }>(rows: T[]) => Object.fromEntries(rows.map((r) => [r.id, r]))

function mergeMessages(a: Message[], b: Message[]): Message[] {
  const seen = new Map<string, Message>()
  for (const m of [...a, ...b]) seen.set(m.id, m)
  return [...seen.values()].sort((x, y) => x.created_at.localeCompare(y.created_at))
}

function omit<T>(rec: Record<string, T>, key: string): Record<string, T> {
  if (!(key in rec)) return rec
  const next = { ...rec }
  delete next[key]
  return next
}

function reducer(s: LiveState, a: Action): LiveState {
  switch (a.type) {
    case 'connected':
      return { ...s, connected: a.value }
    case 'node':
      return { ...s, node: a.node }
    case 'snapshot': {
      // Keep decided approvals we already know about (from detail fetches); refresh pending ones.
      const kept = Object.fromEntries(Object.entries(s.approvals).filter(([, ap]) => ap.status !== 'pending'))
      return {
        ...s,
        agents: byId(a.agents),
        conversations: byId(a.conversations),
        approvals: { ...kept, ...byId(a.approvals) },
      }
    }
    case 'detail':
      return {
        ...s,
        conversations: { ...s.conversations, [a.conversation.id]: a.conversation },
        messages: { ...s.messages, [a.conversation.id]: mergeMessages(s.messages[a.conversation.id] ?? [], a.messages) },
        approvals: { ...s.approvals, ...byId(a.approvals) },
      }
    case 'event':
      return applyEvent(s, a.event)
    case 'office':
      return { ...s, office: a.office }
  }
}

function applyEvent(s: LiveState, e: LiveEvent): LiveState {
  switch (e.type) {
    case 'hello':
    case 'mesh': // handled by refetching /api/node
      return s
    case 'agent':
      return e.agent.enabled
        ? { ...s, agents: { ...s.agents, [e.agent.id]: e.agent } }
        : { ...s, agents: omit(s.agents, e.agent.id) }
    case 'agent_removed':
      return { ...s, agents: omit(s.agents, e.agent_id) }
    case 'conversation': {
      const c = e.conversation
      // WS rows don't carry awaiting_owner; the owner gate is open exactly while status is awaiting_owner.
      const conv: Conversation = { ...c, awaiting_owner: c.awaiting_owner ?? c.status === 'awaiting_owner' }
      const partial = conv.status === 'running' ? s.partial : omit(s.partial, conv.id)
      return { ...s, conversations: { ...s.conversations, [conv.id]: conv }, partial }
    }
    case 'message': {
      const id = e.conversation_id
      const list = s.messages[id]
      const messages = list ? { ...s.messages, [id]: mergeMessages(list, [e.message]) } : s.messages
      const partial = e.message.role === 'agent' ? omit(s.partial, id) : s.partial
      return { ...s, messages, partial }
    }
    case 'delta':
      return { ...s, partial: { ...s.partial, [e.conversation_id]: (s.partial[e.conversation_id] ?? '') + e.text } }
    case 'approval':
      return { ...s, approvals: { ...s.approvals, [e.approval.id]: e.approval } }
    case 'office':
      return applyWorld(s, e.event)
    case 'recap':
      return { ...s, recaps: { ...s.recaps, [e.recap.id]: e.recap } }
  }
}

function applyWorld(s: LiveState, e: WorldEvent): LiveState {
  const o = s.office
  if (e.type === 'error') return { ...s, officeError: e.message || null }
  if (!o) return s // a snapshot fetch follows every reconnect
  // Any world event means the link is up, even if a REST snapshot fetched just before the link opened said otherwise.
  if (e.type !== 'link' && !o.connected) return applyWorld({ ...s, office: { ...o, enabled: true, connected: true } }, e)
  switch (e.type) {
    case 'snapshot':
      return { ...s, office: { ...o, enabled: true, connected: true, org: e.org ?? o.org, desks: e.desks, owners: e.owners, agents: e.agents, parties: e.parties ?? [], desk_ids: e.desk_ids, skins: e.skins } }
    case 'party':
      return { ...s, office: { ...o, parties: [...(o.parties ?? []).filter((p) => p.party_id !== e.party.party_id), e.party] } }
    case 'party_ended':
      return { ...s, office: { ...o, parties: (o.parties ?? []).filter((p) => p.party_id !== e.party_id) } }
    case 'desks':
      return { ...s, office: { ...o, desks: e.desks } }
    case 'owners':
      return { ...s, office: { ...o, owners: e.owners } }
    case 'agent':
      return { ...s, office: { ...o, agents: [...o.agents.filter((a) => a.agent_id !== e.agent.agent_id), e.agent] } }
    case 'agent_left':
      return { ...s, office: { ...o, agents: o.agents.filter((a) => a.agent_id !== e.agent_id) } }
    case 'link':
      return { ...s, office: { ...o, connected: e.connected } }
  }
}

export function useLiveState(openConversationId: string | null) {
  const [state, dispatch] = useReducer(reducer, initial)
  const openRef = useRef(openConversationId)
  useEffect(() => {
    openRef.current = openConversationId
  }, [openConversationId])

  const refreshNode = useCallback(async () => {
    try {
      dispatch({ type: 'node', node: await api.node() })
    } catch {
      /* server down; ws reconnect will retry */
    }
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    const d = await api.conversation(id)
    dispatch({ type: 'detail', conversation: d.conversation, messages: d.messages, approvals: d.approvals })
  }, [])

  const refetchAll = useCallback(async () => {
    const [agents, conversations, approvals] = await Promise.all([api.agents(), api.conversations(), api.approvals()])
    dispatch({ type: 'snapshot', agents, conversations, approvals })
    void refreshNode()
    api.office().then((office) => dispatch({ type: 'office', office })).catch(() => {})
    if (openRef.current) await loadConversation(openRef.current).catch(() => {})
  }, [loadConversation, refreshNode])

  // WebSocket with exponential backoff; refetch the full snapshot on every (re)connect.
  useEffect(() => {
    let ws: WebSocket | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempt = 0
    let closed = false
    let nodeTimer: ReturnType<typeof setTimeout> | undefined

    const connect = () => {
      ws = new WebSocket(wsUrl())
      ws.onopen = () => {
        attempt = 0
        dispatch({ type: 'connected', value: true })
        refetchAll().catch(() => {})
      }
      ws.onmessage = (msg) => {
        let event: LiveEvent
        try {
          event = JSON.parse(msg.data)
        } catch {
          return
        }
        dispatch({ type: 'event', event })
        // The world link came back: take a fresh Office snapshot.
        if (event.type === 'office' && event.event.type === 'link' && event.event.connected) {
          api.office().then((office) => dispatch({ type: 'office', office })).catch(() => {})
        }
        // Agent changes rewrite agentmesh-node.yaml; refresh config_dirty (debounced).
        if (event.type === 'agent' || event.type === 'agent_removed' || event.type === 'mesh') {
          clearTimeout(nodeTimer)
          nodeTimer = setTimeout(refreshNode, 300)
        }
      }
      ws.onclose = () => {
        dispatch({ type: 'connected', value: false })
        if (closed) return
        const delay = Math.min(15000, 500 * 2 ** attempt++) + Math.random() * 250
        timer = setTimeout(connect, delay)
      }
      ws.onerror = () => ws?.close()
    }
    connect()
    return () => {
      closed = true
      clearTimeout(timer)
      clearTimeout(nodeTimer)
      ws?.close()
    }
  }, [refetchAll, refreshNode])

  // Load full history whenever a conversation is opened.
  useEffect(() => {
    if (openConversationId) loadConversation(openConversationId).catch(() => {})
  }, [openConversationId, loadConversation])

  const setNode = useCallback((node: NodeInfo) => dispatch({ type: 'node', node }), [])
  const clearOfficeError = useCallback(() => dispatch({ type: 'event', event: { type: 'office', event: { type: 'error', message: '' } } }), [])

  return { state, loadConversation, refreshNode, setNode, refetchAll, clearOfficeError }
}

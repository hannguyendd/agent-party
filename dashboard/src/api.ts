// Typed client for the node server's dashboard API (agentfleet_node/api.py).

export interface Skill {
  name: string
  description: string
  examples: string[]
  tags: string[]
}

export interface AgentIn {
  id: string
  name: string
  description: string
  skills: Skill[]
  working_dir: string
  setting_sources: string[]
  allowed_tools: string[]
  denied_tools: string[]
  system_prompt: string
  model: string | null
  /** Before messaging another agent on its own: go ahead, or ask the owner first. */
  contact_policy?: 'auto' | 'ask'
}

export interface Agent extends AgentIn {
  enabled: boolean
  created_at: string
}

export interface MeshStatus {
  /** The agentmesh-node this server runs for the owner (when an office server is set up). */
  process?: MeshProcess
  node_url: string
  node_healthy: boolean
  config_path: string
  config_dirty: boolean
  static_peers: Record<string, string>
}

export interface NodeInfo {
  owner: string
  base_url: string
  mesh: MeshStatus
  /** Limits for attachments (same as files from peers). */
  files?: { max_bytes: number; suffixes: string[] }
}

/** First-run setup state (GET/POST /api/setup). */
export interface MeshProcess {
  installed: boolean
  managed: boolean
  running: boolean
  pid: number | null
  error: string | null
  log: string
}
export interface SetupState {
  configured: boolean
  owner: string
  hub_url: string | null
  world_url: string | null
  has_token: boolean
  enrolled: boolean
  agents: number
  mesh_node: MeshProcess
  /** Claude Code on this machine (agents run on it); logged_in is read from where it keeps its login. */
  claude?: { installed: boolean; path: string; logged_in: boolean }
}

/** A file the owner attaches to a message, base64-encoded. */
export interface FileIn {
  name: string
  media_type: string
  data: string
}

/** How a stored file appears in a message's `data.files`. */
export interface FileRef {
  id: string
  name: string
  media_type: string
  size: number
  path: string
}

export interface DirectoryEntry {
  agent_id: string
  name: string
  description: string
  location: 'local' | 'mesh' | 'static'
  peer_id?: string
  online: boolean
}

export type Direction = 'inbound' | 'outbound' | 'local'
export type ConversationStatus =
  | 'idle'
  | 'running'
  | 'awaiting_approval'
  | 'awaiting_owner'
  | 'interrupted'
  | 'done'
  | 'error'

export interface Conversation {
  id: string
  agent_id: string
  context_id: string
  peer_agent_id: string | null
  direction: Direction
  session_id: string | null
  status: ConversationStatus
  mode: 'auto' | 'manual'
  turn_count: number
  title: string
  /** Short topic written from the first message ('' until then). */
  topic?: string
  /** Latest chat line and who said it (peer | agent | owner), for the Chats list. */
  last_preview: string
  last_role: string
  /** '' | 'inquiry' | 'assignment' | 'party' (the Host's side) | 'party_share' (read-only copy) (CONTEXT.md) */
  kind: '' | 'inquiry' | 'assignment' | 'party' | 'party_share'
  /** Party this conversation belongs to ('' when none). */
  party_id: string
  /** Host side: the owner shared this Party with the members' owners. */
  party_shared: boolean
  /** Claude cost of this conversation's session and agent turns run (local only). */
  cost_usd?: number
  agent_turns?: number
  /** Assignment accepted by this node's owner: file edits run without asking. */
  accepted: boolean
  created_at: string
  updated_at: string
  awaiting_owner: boolean
}

export interface Message {
  id: string
  conversation_id: string
  role: 'peer' | 'agent' | 'owner' | 'tool' | 'system'
  kind: 'text' | 'tool_use' | 'tool_result' | 'status' | 'file'
  content: string
  data: Record<string, unknown>
  created_at: string
}

export interface Approval {
  id: string
  conversation_id: string
  tool_name: string
  tool_input: Record<string, unknown>
  status: 'pending' | 'allowed' | 'denied' | 'timed_out'
  reason: string
  created_at: string
  decided_at: string | null
}

/** A conversation whose chat text matched a History search (this node only). */
export interface SearchHit {
  conversation_id: string
  message_id: string
  role: string
  snippet: string
  created_at: string
  hits: number
}

export interface ConversationDetail {
  conversation: Conversation
  messages: Message[]
  approvals: Approval[]
}

// Office (relayed from the team world server by the node; see node-server office.py / world.py)

export type OfficeTarget =
  | { kind: 'desk' }
  | { kind: 'tile'; x: number; y: number }
  | { kind: 'near'; agent_id: string }

export interface OfficeAgent {
  agent_id: string
  owner: string
  name: string
  skin: string
  at: OfficeTarget
  steered: boolean
  /** Status only, never content. */
  activity: { peer: string | null; status: ConversationStatus; direction: Direction } | null
}

export interface OfficeOwner {
  connected: boolean
  present: boolean
}

export interface OfficeState {
  enabled: boolean
  connected: boolean
  owner: string
  /** Organization name set on the world server ('' when none): shown as "<org> Office". */
  org?: string
  desks: Record<string, string>
  owners: Record<string, OfficeOwner>
  agents: OfficeAgent[]
  parties: Party[]
  /** Owner -> their machine's Claude plan usage (numbers only). */
  usage?: Record<string, PlanUsage>
  desk_ids: string[]
  skins: string[]
}

/** One machine's Claude plan usage per window (five_hour, seven_day, ...), as its CLI last reported it. */
export type PlanUsage = Record<string, { utilization: number | null; resets_at: number | null; status: string; at: number }>

/** CONTEXT.md "Party": one Host; members talk only with the Host. The world server knows no topic. */
export interface Party {
  party_id: string
  host: string
  members: string[]
  kind: 'inquiry' | 'assignment'
}

/** Something that pinged the owner (the bell keeps the history). Titles carry agent IDs; show names. */
export interface AppNotification {
  id: string
  kind: 'approval' | 'assignment' | 'inbound' | 'reply' | 'waiting' | 'error' | 'party' | 'recap'
  title: string
  body: string
  conversation_id: string | null
  agent_id: string | null
  read: boolean
  created_at: string
}

/** CONTEXT.md "Recap": written in the background; `body` is Markdown. */
export interface Recap {
  id: string
  conversation_id: string
  agent_id: string
  party_id: string
  title: string
  status: 'working' | 'done' | 'error'
  body: string
  path: string
  shared: boolean
  created_at: string
}

export type WorldEvent =
  | { type: 'snapshot'; org?: string; usage?: Record<string, PlanUsage>; desks: Record<string, string>; owners: Record<string, OfficeOwner>; agents: OfficeAgent[]; parties?: Party[]; desk_ids: string[]; skins: string[] }
  | { type: 'usage'; owner: string; usage: PlanUsage }
  | { type: 'org'; org: string }
  | { type: 'party'; party: Party; joined?: string; left?: string; handed_off_from?: string }
  | { type: 'party_ended'; party_id: string; host: string; members: string[]; reason: 'closed' | 'host_offline' }
  | { type: 'desks'; desks: Record<string, string> }
  | { type: 'owners'; owners: Record<string, OfficeOwner> }
  | { type: 'agent'; agent: OfficeAgent; entered?: boolean }
  | { type: 'agent_left'; agent_id: string }
  | { type: 'link'; connected: boolean }
  | { type: 'error'; op?: string; message: string }

export type LiveEvent =
  | { type: 'hello'; owner: string }
  | { type: 'agent'; agent: Agent }
  | { type: 'agent_removed'; agent_id: string }
  | { type: 'conversation'; conversation: Omit<Conversation, 'awaiting_owner'> & { awaiting_owner?: boolean } }
  | { type: 'message'; conversation_id: string; message: Message }
  | { type: 'delta'; conversation_id: string; text: string }
  | { type: 'approval'; approval: Approval }
  | { type: 'mesh'; config_dirty: boolean }
  | { type: 'office'; event: WorldEvent }
  | { type: 'recap'; recap: Recap }
  | { type: 'usage'; usage: PlanUsage }
  | { type: 'presence'; online: boolean }
  | { type: 'notification'; notification: AppNotification }
  | { type: 'notifications_read'; ids: string[] | null }

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function detailText(detail: unknown): string {
  if (typeof detail === 'string') return detail
  // FastAPI validation errors: [{loc, msg, ...}]
  if (Array.isArray(detail))
    return detail
      .map((d) => {
        const loc = Array.isArray(d?.loc) ? d.loc.filter((x: unknown) => x !== 'body').join('.') : ''
        return loc ? `${loc}: ${d?.msg}` : String(d?.msg ?? JSON.stringify(d))
      })
      .join('; ')
  return JSON.stringify(detail)
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      const j = await res.json()
      if (j?.detail !== undefined) msg = detailText(j.detail)
    } catch {
      /* non-JSON body */
    }
    throw new ApiError(res.status, msg)
  }
  return (await res.json()) as T
}

const enc = encodeURIComponent

export const api = {
  node: () => req<NodeInfo>('GET', '/api/node'),
  meshSync: () => req<MeshStatus>('POST', '/api/mesh/sync'),
  meshRestarted: () => req<MeshStatus>('POST', '/api/mesh/restarted'),

  agents: () => req<Agent[]>('GET', '/api/agents'),
  saveAgent: (a: AgentIn) => req<Agent>('POST', '/api/agents', a),
  // agent IDs contain a slash; the backend uses a :path param, so keep it raw.
  deleteAgent: (id: string) => req<{ status: string }>('DELETE', `/api/agents/${id.split('/').map(enc).join('/')}`),

  directory: () => req<DirectoryEntry[]>('GET', '/api/directory'),

  conversations: (agentId?: string) =>
    req<Conversation[]>('GET', `/api/conversations${agentId ? `?agent_id=${enc(agentId)}` : ''}`),
  startConversation: (agent_id: string, text: string, files: FileIn[] = [], title = '') =>
    req<Conversation>('POST', '/api/conversations', { agent_id, text, files, title }),
  conversation: (id: string) => req<ConversationDetail>('GET', `/api/conversations/${enc(id)}`),
  searchConversations: (q: string) => req<SearchHit[]>('GET', `/api/conversations/search?q=${enc(q)}`),
  inject: (id: string, text: string, files: FileIn[] = []) =>
    req<{ status: string }>('POST', `/api/conversations/${enc(id)}/inject`, { text, files }),
  fileUrl: (id: string) => `/api/files/${enc(id)}`,
  interrupt: (id: string) => req<{ status: string }>('POST', `/api/conversations/${enc(id)}/interrupt`),
  takeover: (id: string) => req<{ status: string }>('POST', `/api/conversations/${enc(id)}/takeover`),
  handback: (id: string) => req<{ status: string }>('POST', `/api/conversations/${enc(id)}/handback`),
  reply: (id: string, text: string) => req<{ status: string }>('POST', `/api/conversations/${enc(id)}/reply`, { text }),
  fork: (id: string) => req<{ conversation_id: string }>('POST', `/api/conversations/${enc(id)}/fork`),

  office: () => req<OfficeState>('GET', '/api/office'),
  claimDesk: (desk: string) => req<{ status: string }>('POST', '/api/office/desk', { desk }),
  setSkin: (agent_id: string, skin: string) => req<{ status: string }>('POST', '/api/office/skin', { agent_id, skin }),
  move: (agent_id: string, at: OfficeTarget) => req<{ status: string }>('POST', '/api/office/move', { agent_id, at }),
  assign: (from_agent: string, to_agent: string, text: string) =>
    req<{ status: string; conversation_id: string }>('POST', '/api/office/assign', { from_agent, to_agent, text }),
  notifyTest: () => req<{ shown: boolean }>('POST', '/api/notify/test'),
  setup: () => req<SetupState>('GET', '/api/setup'),
  saveSetup: (owner: string, server: string, token: string) => req<SetupState>('POST', '/api/setup', { owner, server, token }),
  meshRestart: () => req<MeshStatus & { process: MeshProcess }>('POST', '/api/mesh/restart'),

  openParty: (host: string, members: string[], topic: string, kind: Party['kind']) =>
    req<Conversation>('POST', '/api/parties', { host, members, topic, kind }),
  partyInvite: (party: string, agent_id: string) => req<{ status: string }>('POST', `/api/parties/${enc(party)}/invite`, { agent_id }),
  partyLeave: (party: string, agent_id: string) => req<{ status: string }>('POST', `/api/parties/${enc(party)}/leave`, { agent_id }),
  partyHandoff: (party: string, new_host: string) => req<{ status: string }>('POST', `/api/parties/${enc(party)}/handoff`, { new_host }),
  partyClose: (party: string) => req<{ status: string }>('POST', `/api/parties/${enc(party)}/close`),
  partyShare: (party: string) => req<{ sent: string[]; failed: string[] }>('POST', `/api/parties/${enc(party)}/share`),
  makeRecap: (conv: string) => req<Recap>('POST', `/api/conversations/${enc(conv)}/recap`),
  recaps: (conv: string) => req<Recap[]>('GET', `/api/recaps?conversation_id=${enc(conv)}`),
  recapFileUrl: (id: string) => `/api/recaps/${enc(id)}/file`,
  shareRecap: (id: string) => req<{ sent: string[]; failed: string[] }>('POST', `/api/recaps/${enc(id)}/share`),

  usage: () => req<{ usage: PlanUsage }>('GET', '/api/usage'),
  service: () => req<{ installed: boolean; autostart: boolean }>('GET', '/api/service'),
  uninstall: (keepData: boolean) => req<{ status: string }>('POST', '/api/service/uninstall', { keep_data: keepData }),
  serviceAutostart: (on: boolean) => req<{ autostart: boolean }>('POST', '/api/service/autostart', { on }),
  notifications: () => req<AppNotification[]>('GET', '/api/notifications?limit=150'),
  readNotifications: (ids: string[] | null) => req<{ ok: boolean }>('POST', '/api/notifications/read', { ids }),
  presence: () => req<{ online: boolean }>('GET', '/api/presence'),
  setPresence: (online: boolean) => req<{ online: boolean }>('POST', '/api/presence', { online }),
  updateInfo: () => req<{ installed: boolean; build: string; latest: string | null; available: boolean }>('GET', '/api/update'),
  startUpdate: () => req<{ status: string }>('POST', '/api/update'),

  approvals: () => req<Approval[]>('GET', '/api/approvals'),
  decide: (id: string, allow: boolean, reason = '') =>
    req<{ status: string }>('POST', `/api/approvals/${enc(id)}`, { allow, reason }),
}

export function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/api/ws`
}

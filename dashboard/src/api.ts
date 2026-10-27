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
}

export interface Agent extends AgentIn {
  enabled: boolean
  created_at: string
}

export interface MeshStatus {
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

export interface ConversationDetail {
  conversation: Conversation
  messages: Message[]
  approvals: Approval[]
}

export type LiveEvent =
  | { type: 'hello'; owner: string }
  | { type: 'agent'; agent: Agent }
  | { type: 'agent_removed'; agent_id: string }
  | { type: 'conversation'; conversation: Omit<Conversation, 'awaiting_owner'> & { awaiting_owner?: boolean } }
  | { type: 'message'; conversation_id: string; message: Message }
  | { type: 'delta'; conversation_id: string; text: string }
  | { type: 'approval'; approval: Approval }
  | { type: 'mesh'; config_dirty: boolean }

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
  startConversation: (agent_id: string, text: string) =>
    req<Conversation>('POST', '/api/conversations', { agent_id, text }),
  conversation: (id: string) => req<ConversationDetail>('GET', `/api/conversations/${enc(id)}`),
  inject: (id: string, text: string) => req<{ status: string }>('POST', `/api/conversations/${enc(id)}/inject`, { text }),
  interrupt: (id: string) => req<{ status: string }>('POST', `/api/conversations/${enc(id)}/interrupt`),
  takeover: (id: string) => req<{ status: string }>('POST', `/api/conversations/${enc(id)}/takeover`),
  handback: (id: string) => req<{ status: string }>('POST', `/api/conversations/${enc(id)}/handback`),
  reply: (id: string, text: string) => req<{ status: string }>('POST', `/api/conversations/${enc(id)}/reply`, { text }),
  fork: (id: string) => req<{ conversation_id: string }>('POST', `/api/conversations/${enc(id)}/fork`),

  approvals: () => req<Approval[]>('GET', '/api/approvals'),
  decide: (id: string, allow: boolean, reason = '') =>
    req<{ status: string }>('POST', `/api/approvals/${enc(id)}`, { allow, reason }),
}

export function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/api/ws`
}

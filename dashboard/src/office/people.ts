// Who an agent ID is, for display: name, owner and skin from the Office and this node's agents.

import type { LiveState } from '../useLiveState'

export interface Who {
  id: string
  name: string
  owner: string
  skin?: string
}

export function who(state: LiveState, agentId: string | null | undefined): Who {
  const id = agentId ?? 'unknown'
  const inOffice = state.office?.agents.find((a) => a.agent_id === id)
  const local = state.agents[id]
  const [owner, short] = id.includes('/') ? id.split('/') : ['', id]
  return { id, name: inOffice?.name || local?.name || short, owner: inOffice?.owner ?? owner, skin: inOffice?.skin }
}


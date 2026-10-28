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


/** Lower-cased agent ID -> display name, for turning IDs in text into names. */
export function agentNames(state: LiveState): (id: string) => string | null {
  const names = new Map<string, string>()
  for (const a of state.office?.agents ?? []) names.set(a.agent_id.toLowerCase(), a.name)
  for (const a of Object.values(state.agents)) names.set(a.id.toLowerCase(), a.name)
  return (id) => names.get(id.toLowerCase()) ?? null
}

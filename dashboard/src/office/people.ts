// Who an agent ID is, for display: name, owner and skin from the Office and this node's agents.

import { useMemo } from 'react'
import type { AppNotification } from '../api'
import type { LiveState } from '../useLiveState'
import { plainPreview } from './render-md'

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

/** "@Backend Agent" (as the @-picker shows it) back to "@han/be" for the agent. Longest names first, so
 *  "@API agent v2" isn't read as "@API agent". Names shared by two agents are never inserted by name. */
export function withMentionIds(text: string, candidates: Who[]): string {
  const byName = new Map<string, Who[]>()
  for (const c of candidates) byName.set(c.name.toLowerCase(), [...(byName.get(c.name.toLowerCase()) ?? []), c])
  const unique = [...byName.values()].filter((list) => list.length === 1).map((list) => list[0])
  let out = text
  for (const c of unique.sort((a, b) => b.name.length - a.name.length)) {
    const escaped = c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`(^|\\s)@${escaped}(?=$|[\\s.,:;!?)])`, 'gi'), `$1@${c.id}`)
  }
  return out
}

/** A notification's title with agent IDs shown as names. */
export function useNotificationText(state: LiveState): (n: AppNotification) => string {
  const { office, agents } = state
  return useMemo(() => {
    const nameOf = agentNames({ office, agents } as LiveState)
    return (n: AppNotification) => plainPreview(n.title, nameOf)
  }, [office, agents])
}

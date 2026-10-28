// The contract between OfficeView and whatever draws the Office (ADR 0004): the 2D Phaser scene today, the 3D
// three.js scene as an option. React pushes data in with setSceneData() and gets clicks back through callbacks;
// a renderer never calls the API.

import type { OfficeAgent, OfficeOwner, OfficeTarget } from '../api'
import type { Point } from './layout'

export interface SceneData {
  me: string
  agents: OfficeAgent[]
  desks: Record<string, string>
  owners: Record<string, OfficeOwner>
  /** Short text above an agent (own conversations: live text; others: "…"). */
  bubbles: Record<string, string>
  /** Status emoji above an agent. */
  icons: Record<string, string>
  pickingDesk: boolean
}

export interface PeerClick {
  agentId: string
  screen: Point
  /** My agents standing within reach of the clicked agent. */
  reachableBy: string[]
  /** Opened by proximity rather than a click; closes when the agents part. */
  auto?: boolean
}

export interface SceneCallbacks {
  onSelect: (ids: string[]) => void
  onMove: (agentId: string, at: OfficeTarget) => void
  onPeerClick: (click: PeerClick) => void
  onDeskPick: (deskId: string) => void
  /** Clicked a desk someone already claimed while picking. */
  onDeskTaken: (deskId: string, owner: string) => void
  onOpenAgent: (agentId: string) => void
  /** My agent stopped next to someone else's (or walked away: null). Gather-style proximity menu. */
  onNearby: (click: PeerClick | null) => void
  /** The owner walked their agent to the entrance door and stopped there: offer to go home (offline). */
  onDoor?: (agentId: string) => void
}

export const REACH = 2 // tiles; CONTEXT.md "Within reach"

/** What OfficeView may ask of the Office, whichever look draws it. */
export interface OfficeRenderer {
  callbacks: SceneCallbacks | null
  setSceneData(d: SceneData): void
  selectOnly(ids: string[]): void
  follow(agentId: string | null): void
  zoomBy(factor: number, anchor?: Point): void
  fitCamera(): void
  dismissNearby(): void
  walkSelectedTo(agentId: string): void
  sendSelectedHome(): void
  goToPlace(spot: Point): void
}

/** A renderer attached to a host element; `destroy` releases its canvas, listeners and GPU resources. */
export interface MountedRenderer {
  renderer: OfficeRenderer
  destroy(): void
}

export interface MountOptions {
  host: HTMLElement
  data: SceneData
  callbacks: SceneCallbacks
  onReady: () => void
}

export type OfficeTheme = '2d' | '3d'

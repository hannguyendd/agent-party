// Names, status icons, bubbles and desk tags of the 3D Office, as HTML over the WebGL canvas (crisp text; same
// privacy rule as 2D: React only passes words of my own conversations, others get "…" shown as typing dots).

import * as THREE from 'three'

export interface AgentTag {
  el: HTMLDivElement
  name: HTMLSpanElement
  icon: HTMLSpanElement
  bubble: HTMLDivElement
}

export class TagLayer {
  private overlay: HTMLDivElement
  private desks = new Map<string, { el: HTMLDivElement; at: THREE.Vector3 }>()
  private v = new THREE.Vector3()

  constructor(host: HTMLElement) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'o3d-overlay'
    host.appendChild(this.overlay)
  }

  addDesk(id: string, at: THREE.Vector3) {
    const el = document.createElement('div')
    el.className = 'o3d-desk'
    this.overlay.prepend(el) // under the agents' tags
    this.desks.set(id, { el, at })
  }

  /** Desk tag text and look: faint id, "D2 · owner" when taken, a chip for my desk and for free desks while picking. */
  setDesk(id: string, text: string, look: 'free' | 'taken' | 'mine' | 'pick') {
    const d = this.desks.get(id)
    if (!d) return
    d.el.textContent = text
    d.el.dataset.look = look
  }

  agent(): AgentTag {
    const el = document.createElement('div')
    el.className = 'o3d-tag'
    const bubble = document.createElement('div')
    bubble.className = 'o3d-bubble'
    const line = document.createElement('div')
    line.className = 'o3d-name'
    const icon = document.createElement('span')
    const name = document.createElement('span')
    line.append(icon, name)
    el.append(bubble, line)
    this.overlay.appendChild(el)
    return { el, name, icon, bubble }
  }

  static setBubble(tag: AgentTag, text: string | undefined) {
    tag.bubble.hidden = !text
    if (!text) return
    const typing = text === '…'
    tag.bubble.classList.toggle('is-typing', typing)
    tag.bubble.textContent = typing ? '' : text
  }

  /** Per frame: desk tags on the floor; agent tags above each head, nearest the camera first, a tag that would
   *  cover one already placed lifting above it (twice at most) so people standing together stay readable. */
  place(camera: THREE.Camera, w: number, h: number, agents: Iterable<{ tag: AgentTag; anchor: THREE.Object3D }>) {
    const v = this.v
    const toScreen = () => ({ x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h })
    for (const d of this.desks.values()) {
      v.copy(d.at).project(camera)
      const p = toScreen()
      d.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%)`
    }
    const spots: { tag: AgentTag; x: number; y: number; w: number; h: number }[] = []
    for (const a of agents) {
      a.anchor.getWorldPosition(v)
      v.y += 0.12
      v.project(camera)
      const p = toScreen()
      const off = p.x < -80 || p.y < -40 || p.x > w + 80 || p.y > h + 40
      a.tag.el.hidden = off
      if (!off) spots.push({ tag: a.tag, ...p, w: a.tag.el.offsetWidth, h: a.tag.el.offsetHeight })
    }
    spots.sort((a, b) => b.y - a.y)
    const placed: { x: number; top: number; bottom: number; w: number }[] = []
    for (const s of spots) {
      let bottom = s.y
      for (let lifts = 0; lifts < 2; lifts++) {
        const hit = placed.find((q) => Math.abs(q.x - s.x) < (q.w + s.w) / 2 + 3 && bottom > q.top - 1 && bottom - s.h < q.bottom + 1)
        if (!hit) break
        bottom = hit.top - 3
      }
      placed.push({ x: s.x, top: bottom - s.h, bottom, w: s.w })
      s.tag.el.style.transform = `translate(${s.x.toFixed(1)}px, ${bottom.toFixed(1)}px) translate(-50%, -100%)`
    }
  }

  destroy() {
    this.overlay.remove()
  }
}

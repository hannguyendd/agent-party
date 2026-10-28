// The 3D Office (ADR 0004): the same map, seats and agents as the 2D scene, drawn with three.js from Codex's glTF
// models (manifest `models3d`). Tiles stay the unit of everything that matters: placement, paths and moves are the
// shared helpers in layout / pathfind / placement; this file only draws them and turns pointer input into the same
// callbacks the 2D scene sends. It never calls the API.

import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { OfficeAgent } from '../../api'
import { COLS, DESKS, ROWS, SPAWN, walkable, type Facing, type Point } from '../layout'
import { fetchManifest, loadMapData, type Models3d } from '../mapData'
import { distance, findPath, nearestFree } from '../pathfind'
import { resolveTargets } from '../placement'
import { REACH, type OfficeRenderer, type PeerClick, type SceneCallbacks, type SceneData } from '../renderer'
import { ownerHue } from '../skins'

// Camera: orthographic, looking down ~49°, turned in quarter steps.
const ELEVATION = 0.86
const AZIMUTH = -0.42
const WALK_SPEED = 4.7 // tiles per second, as in 2D (150 px/s at 32 px tiles)
const NEARBY_STILL_S = 0.3
const CUT_AWAY = 0.6 // lower a wall whose outside faces the camera this much (dot of its outward normal)
const FACE_ANGLE: Record<Facing, number> = { down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2 }
const WALL_OUT: Record<string, [number, number]> = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] }

interface Placement {
  model: string
  x: number
  z: number
  rot?: number
  y?: number
  facing?: string
  panelGap?: boolean
}
interface Layout3d {
  objects: Placement[]
  walls: Placement[]
}

interface Agent3D {
  id: string
  owner: string
  skin: string
  root: THREE.Object3D
  mixer: THREE.AnimationMixer
  action: THREE.AnimationAction | null
  clip: string
  ring: THREE.Mesh
  /** Position in tile units (tile centre = x + 0.5). */
  pos: THREE.Vector2
  heading: number
  path: Point[]
  dest: Point | null
  leaving: boolean
  placed: boolean
  sent: { tile: Point; until: number } | null
  tag: HTMLDivElement
  name: HTMLSpanElement
  icon: HTMLSpanElement
  bubble: HTMLDivElement
  top: THREE.Object3D | null
}

const toWorld = (x: number, y: number) => new THREE.Vector3(x - COLS / 2, 0, y - ROWS / 2)
const tileKey = (p: Point) => `${p.x},${p.y}`
const now = () => performance.now()

export class Office3D implements OfficeRenderer {
  callbacks: SceneCallbacks | null = null
  onReady: (() => void) | null = null
  onError: ((message: string) => void) | null = null

  private data: SceneData = { me: '', agents: [], desks: {}, owners: {}, bubbles: {}, icons: {}, pickingDesk: false }
  private ready = false
  private disposed = false
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400)
  private clock = new THREE.Clock()
  private overlay: HTMLDivElement
  private observer: ResizeObserver
  private models = new Map<string, GLTF>()
  private urls: Record<string, string> = {}
  private walls: { group: THREE.Group; out: THREE.Vector2 }[] = []
  private agents = new Map<string, Agent3D>()
  private selected = new Set<string>()
  private deskMarks = new THREE.Group()
  private hover: THREE.Mesh
  private az = AZIMUTH
  private azTarget = AZIMUTH
  private zoom = 1
  private zoomTarget = 1
  private target = new THREE.Vector3(0, 0, 1)
  private following: string | null = null
  private nearby: { mine: string; peer: string; dismissed: boolean } | null = null
  private stillS = 0
  private doorIntent: string | null = null
  private awayFromDoor = new Set<string>()
  private doorStillS = 0
  private drag: { x: number; y: number; moved: boolean } | null = null
  private raycaster = new THREE.Raycaster()
  private listeners: [EventTarget, string, EventListener][] = []

  private host: HTMLElement

  constructor(host: HTMLElement) {
    this.host = host
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.setClearColor(0xe6ddd8)
    const canvas = this.renderer.domElement
    canvas.classList.add('o3d-canvas')
    canvas.tabIndex = 0
    canvas.style.outline = 'none'
    host.appendChild(canvas)
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative'
    this.overlay = document.createElement('div')
    this.overlay.className = 'o3d-overlay'
    host.appendChild(this.overlay)

    this.scene.add(new THREE.HemisphereLight(0xfff4ea, 0xd8c9ea, 1.9))
    const sun = new THREE.DirectionalLight(0xfff1e0, 2.3)
    sun.position.set(-30, 60, 34)
    sun.castShadow = true
    sun.shadow.mapSize.set(4096, 4096)
    Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 200 })
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.03
    this.scene.add(sun)
    this.scene.add(this.deskMarks)
    this.hover = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ color: 0x70a65b, transparent: true, opacity: 0.35, depthWrite: false }))
    this.hover.rotation.x = -Math.PI / 2
    this.hover.position.y = 0.02
    this.hover.visible = false
    this.scene.add(this.hover)

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(host)
    this.resize()
    this.listen()
    this.renderer.setAnimationLoop(() => this.frame())
    void this.load().catch((e: unknown) => this.onError?.(e instanceof Error ? e.message : String(e)))
  }

  // ---- loading

  private async load() {
    const manifest = await fetchManifest()
    const m3 = manifest.models3d
    if (!m3) throw new Error('The 3D look is not available yet (no models3d in the office manifest).')
    await loadMapData(manifest)
    this.urls = { ...m3.kit, ...m3.props, ...m3.characters }
    const layout = (await (await fetch(m3.layout)).json()) as Layout3d
    const needed = new Set([...layout.objects, ...layout.walls].map((p) => p.model))
    for (const id of Object.keys(m3.characters)) needed.add(id)
    await this.loadModels([...needed], m3)
    if (this.disposed) return
    this.buildRoom(layout)
    this.ready = true
    this.sync()
    this.fitCamera()
    this.onReady?.()
  }

  private async loadModels(ids: string[], m3: Models3d) {
    const loader = new GLTFLoader()
    await Promise.all(
      ids.map(async (id) => {
        const url = this.urls[id]
        if (!url) return // a placement naming a model the manifest lacks: skip it rather than fail the room
        const gltf = await loader.loadAsync(url)
        gltf.scene.updateMatrixWorld(true)
        this.models.set(id, gltf)
      }),
    )
    if (!this.models.size) throw new Error(`no 3D models could be loaded (${m3.layout})`)
  }

  // ---- the room: one InstancedMesh per model mesh, walls grouped by the side they face

  private buildRoom(layout: Layout3d) {
    const byModel = (list: Placement[]) => list.reduce<Record<string, Placement[]>>((m, p) => ((m[p.model] ||= []).push(p), m), {})
    for (const [model, list] of Object.entries(byModel(layout.objects))) this.instance(this.scene, model, list, !model.startsWith('floor'))
    for (const [facing, out] of Object.entries(WALL_OUT)) {
      const list = layout.walls.filter((w) => w.facing === facing)
      if (!list.length) continue
      const group = new THREE.Group()
      this.scene.add(group)
      for (const [model, l] of Object.entries(byModel(list))) this.instance(group, model, l, true)
      this.walls.push({ group, out: new THREE.Vector2(...out) })
    }
  }

  private instance(parent: THREE.Object3D, model: string, list: Placement[], shadows: boolean) {
    const gltf = this.models.get(model)
    if (!gltf) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const one = new THREE.Vector3(1, 1, 1)
    gltf.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      let gap = false
      let held = false
      for (let a: THREE.Object3D | null = o; a; a = a.parent) {
        if (a.name === 'panel-gap') gap = true
        if (a.name === 'held-items') held = true
      }
      if (held) return
      const ps = gap ? list.filter((p) => p.panelGap) : list
      if (!ps.length) return
      const im = new THREE.InstancedMesh(o.geometry, o.material, ps.length)
      ps.forEach((p, i) => {
        const at = toWorld(p.x, p.z)
        at.y = p.y ?? 0
        m.compose(at, q.setFromAxisAngle(up, ((p.rot ?? 0) * Math.PI) / 180), one).multiply(o.matrixWorld)
        im.setMatrixAt(i, m)
      })
      im.castShadow = shadows
      im.receiveShadow = true
      parent.add(im)
    })
  }

  // ---- data from React

  setSceneData(d: SceneData) {
    this.data = d
    if (this.ready) this.sync()
  }

  private isMine(id: string) {
    return id.startsWith(`${this.data.me}/`)
  }

  private sync() {
    const d = this.data
    const ids = new Set(d.agents.map((a) => a.agent_id))
    for (const s of this.agents.values()) if (!ids.has(s.id) && !s.leaving) this.leave(s)
    for (const a of d.agents) {
      let s = this.agents.get(a.agent_id)
      if (s && s.skin !== this.skinOf(a)) {
        this.drop(s)
        s = undefined
      }
      if (!s || s.leaving) {
        if (s) this.drop(s)
        s = this.spawn(a)
      }
      const present = d.owners[a.owner]?.present
      s.name.textContent = a.name.split('/').pop() ?? a.name
      s.tag.style.opacity = present ? '1' : '0.6'
      s.icon.textContent = d.icons[a.agent_id] ?? ''
      this.setBubble(s, d.bubbles[a.agent_id])
    }
    for (const id of [...this.selected]) if (!ids.has(id)) this.selected.delete(id)
    this.place()
    this.refreshSelection(false)
    this.refreshDesks()
  }

  private skinOf(a: OfficeAgent) {
    return this.models.has(a.skin) ? a.skin : 'dev-hoodie'
  }

  private spawn(a: OfficeAgent): Agent3D {
    const skin = this.skinOf(a)
    const gltf = this.models.get(skin)!
    const root = gltf.scene.clone(true)
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    const color = new THREE.Color().setHSL(ownerHue(a.owner) / 360, 0.7, 0.5)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.44, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }))
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.025
    root.add(ring)
    root.userData.agentId = a.agent_id
    this.scene.add(root)

    const tag = document.createElement('div')
    tag.className = 'o3d-tag'
    const bubble = document.createElement('div')
    bubble.className = 'o3d-bubble'
    const line = document.createElement('div')
    line.className = 'o3d-name'
    const icon = document.createElement('span')
    const name = document.createElement('span')
    line.append(icon, name)
    tag.append(bubble, line)
    this.overlay.appendChild(tag)

    const s: Agent3D = {
      id: a.agent_id, owner: a.owner, skin, root, mixer: new THREE.AnimationMixer(root), action: null, clip: '', ring,
      pos: new THREE.Vector2(SPAWN.x + 0.5, SPAWN.y + 0.5), heading: 0, path: [], dest: null, leaving: false, placed: false,
      sent: null, tag, name, icon, bubble, top: root.getObjectByName('head-top') ?? null,
    }
    this.agents.set(a.agent_id, s)
    return s
  }

  private drop(s: Agent3D) {
    this.scene.remove(s.root)
    s.mixer.stopAllAction()
    s.ring.geometry.dispose()
    ;(s.ring.material as THREE.Material).dispose()
    s.tag.remove()
    this.agents.delete(s.id)
    this.selected.delete(s.id)
    if (this.following === s.id) this.following = null
  }

  private leave(s: Agent3D) {
    s.leaving = true
    this.walkTo(s, { x: SPAWN.x, y: SPAWN.y })
    this.selected.delete(s.id)
    if (this.following === s.id) this.following = null
  }

  private place() {
    const result = resolveTargets(this.data, (id) => {
      const s = this.agents.get(id)
      return s ? this.tileOf(s) : null
    })
    const t = now()
    for (const [id, p] of result) {
      const s = this.agents.get(id)
      if (!s) continue
      if (!s.placed) {
        s.placed = true
        s.pos.set(p.x + 0.5, p.y + 0.5)
        s.dest = p
        s.path = []
        continue
      }
      if (s.sent) {
        const target = this.data.agents.find((a) => a.agent_id === id)?.at
        const confirmed = target?.kind === 'tile' && target.x === s.sent.tile.x && target.y === s.sent.tile.y
        if (confirmed || s.sent.until <= t) s.sent = null
        else continue
      }
      if (s.dest && s.dest.x === p.x && s.dest.y === p.y) continue
      this.walkTo(s, p)
    }
  }

  private tileOf(s: Agent3D): Point {
    return { x: Math.floor(s.pos.x), y: Math.floor(s.pos.y) }
  }

  private walkTo(s: Agent3D, tile: Point): boolean {
    const here = this.tileOf(s)
    const path = findPath(here, tile)
    if (!path.length && (here.x !== tile.x || here.y !== tile.y)) return false
    s.dest = tile
    s.path = path.length ? path : [tile]
    return true
  }

  private setBubble(s: Agent3D, text: string | undefined) {
    s.bubble.hidden = !text
    if (!text) return
    const typing = text === '…'
    s.bubble.classList.toggle('is-typing', typing)
    s.bubble.textContent = typing ? '' : text
  }

  // ---- selection, desks

  selectOnly(ids: string[]) {
    this.selected = new Set(ids.filter((id) => this.isMine(id)))
    this.refreshSelection()
    if (this.selected.size === 1) this.follow([...this.selected][0])
  }

  private refreshSelection(notify = true) {
    for (const s of this.agents.values()) {
      const on = this.selected.has(s.id)
      s.ring.scale.setScalar(on ? 1.25 : 1)
      ;(s.ring.material as THREE.MeshBasicMaterial).opacity = on ? 1 : 0.85
      s.tag.classList.toggle('is-selected', on)
    }
    if (notify) this.callbacks?.onSelect([...this.selected])
  }

  private refreshDesks() {
    for (const c of this.deskMarks.children) (c as THREE.Mesh).geometry.dispose()
    this.deskMarks.clear()
    if (!this.data.pickingDesk) return
    const mat = new THREE.MeshBasicMaterial({ color: 0x70a65b, transparent: true, opacity: 0.55, depthWrite: false })
    for (const d of DESKS) {
      if (this.data.desks[d.id]) continue
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.48, 32), mat)
      ring.rotation.x = -Math.PI / 2
      ring.position.copy(toWorld(d.seat.x + 0.5, d.seat.y + 0.5)).setY(0.03)
      this.deskMarks.add(ring)
    }
  }

  private deskAt(p: Point): string | null {
    for (const d of DESKS) {
      const t = d.table
      const onTable = p.x >= t.x && p.x < t.x + t.w && p.y >= t.y && p.y < t.y + t.h
      if (onTable || (d.seat.x === p.x && d.seat.y === p.y)) return d.id
    }
    return null
  }

  private seatFacing(p: Point): Facing | null {
    for (const d of DESKS) if (d.seat.x === p.x && d.seat.y === p.y) return d.seat.face
    return null
  }

  // ---- moving my agents (same rules as the 2D scene)

  private moveSelectedTo(tile: Point) {
    if (!this.selected.size) return
    const taken = new Set<string>()
    for (const s of this.agents.values()) if (!this.selected.has(s.id) && s.dest) taken.add(tileKey(s.dest))
    for (const id of [...this.selected].sort()) {
      const p = walkable(tile.x, tile.y) ? nearestFree(tile, (x, y) => !taken.has(`${x},${y}`)) : null
      const s = this.agents.get(id)
      if (!p || !s) continue
      if (!this.walkTo(s, p)) continue
      taken.add(tileKey(p))
      s.sent = { tile: p, until: now() + 3000 }
      this.callbacks?.onMove(s.id, { kind: 'tile', x: p.x, y: p.y })
    }
  }

  goToPlace(spot: Point) {
    const mine = [...this.selected].map((id) => this.agents.get(id)).find(Boolean)
    const from = mine ? this.tileOf(mine) : null
    const p = nearestFree(spot, (x, y) => !from || (from.x === x && from.y === y) || findPath(from, { x, y }).length > 0)
    if (p) this.moveSelectedTo(p)
  }

  sendSelectedHome() {
    for (const id of this.selected) {
      const s = this.agents.get(id)
      if (s) s.sent = null
      this.callbacks?.onMove(id, { kind: 'desk' })
    }
  }

  walkSelectedTo(agentId: string) {
    const target = this.agents.get(agentId)
    if (!target) return
    const t = this.tileOf(target)
    const taken = new Set<string>([tileKey(t)])
    for (const id of [...this.selected].sort()) {
      const me = this.agents.get(id)
      if (!me) continue
      const p = nearestFree(t, (x, y) => !taken.has(`${x},${y}`), true)
      if (!p) continue
      taken.add(tileKey(p))
      this.walkTo(me, p)
      // Send the exact tile, so the world's echo matches the local walk instead of re-resolving "near".
      me.sent = { tile: p, until: now() + 3000 }
      this.callbacks?.onMove(id, { kind: 'tile', x: p.x, y: p.y })
    }
  }

  dismissNearby() {
    if (this.nearby) this.nearby.dismissed = true
  }

  private isDoor(t: Point) {
    return Math.abs(t.x - SPAWN.x) <= 1 && t.y >= SPAWN.y - 2 && t.y <= SPAWN.y
  }

  private goToDoor() {
    const mineIds = [...this.agents.values()].filter((s) => this.isMine(s.id) && !s.leaving).map((s) => s.id).sort()
    const id = this.selected.size === 1 && this.isMine([...this.selected][0]) ? [...this.selected][0] : mineIds[0]
    const s = id ? this.agents.get(id) : undefined
    if (!s) return
    if (!this.selected.has(s.id) || this.selected.size !== 1) {
      this.selected = new Set([s.id])
      this.refreshSelection()
    }
    this.doorIntent = s.id
    const here = this.tileOf(s)
    if (Math.hypot(here.x - SPAWN.x, here.y - SPAWN.y) <= 1.6) return
    const p = nearestFree(SPAWN, (x, y) => findPath(here, { x, y }).length > 0)
    if (p) this.moveSelectedTo(p)
  }

  private peerClick(s: Agent3D): PeerClick {
    const here = this.tileOf(s)
    const reachableBy = [...this.agents.values()]
      .filter((m) => this.isMine(m.id) && !m.leaving && distance(this.tileOf(m), here) <= REACH)
      .map((m) => m.id)
    return { agentId: s.id, screen: this.screenOf(s), reachableBy }
  }

  private closestPeer(mine: Agent3D): Agent3D | null {
    const here = this.tileOf(mine)
    let best: Agent3D | null = null
    let bestD = Infinity
    for (const s of this.agents.values()) {
      if (this.isMine(s.id) || s.leaving) continue
      const d = distance(this.tileOf(s), here)
      const dd = s.pos.distanceTo(mine.pos)
      if (d <= REACH && dd < bestD) {
        best = s
        bestD = dd
      }
    }
    return best
  }

  private openNearby() {
    const mine = this.selected.size === 1 ? this.agents.get([...this.selected][0]) : undefined
    const best = mine ? this.closestPeer(mine) : null
    if (mine && best) {
      this.nearby = { mine: mine.id, peer: best.id, dismissed: false }
      this.callbacks?.onNearby({ ...this.peerClick(best), auto: true })
    }
  }

  private checkNearby(dt: number) {
    const mine = this.selected.size === 1 ? this.agents.get([...this.selected][0]) : undefined
    this.checkDoor(dt, mine)
    const best = mine ? this.closestPeer(mine) : null
    if (!mine || !best) {
      if (this.nearby) this.callbacks?.onNearby(null)
      this.nearby = null
      this.stillS = 0
      return
    }
    this.stillS = mine.path.length ? 0 : this.stillS + dt
    if (this.nearby && (this.nearby.mine !== mine.id || this.nearby.peer !== best.id)) {
      this.callbacks?.onNearby(null)
      this.nearby = null
    }
    if (!this.nearby && this.stillS >= NEARBY_STILL_S) {
      this.nearby = { mine: mine.id, peer: best.id, dismissed: false }
      this.callbacks?.onNearby({ ...this.peerClick(best), auto: true })
    }
  }

  private checkDoor(dt: number, mine: Agent3D | undefined) {
    if (!mine) {
      this.doorStillS = 0
      return
    }
    const tiles = Math.hypot(mine.pos.x - (SPAWN.x + 0.5), mine.pos.y - (SPAWN.y + 0.5))
    if (tiles > 3) {
      this.awayFromDoor.add(mine.id)
      this.doorStillS = 0
      return
    }
    const still = !mine.path.length
    if (this.doorIntent === mine.id && tiles <= 1.6 && still) {
      this.doorIntent = null
      this.awayFromDoor.delete(mine.id)
      this.doorStillS = 0
      this.callbacks?.onDoor?.(mine.id)
      return
    }
    if (tiles <= 1.6 && still && this.awayFromDoor.has(mine.id)) {
      this.doorStillS += dt
      if (this.doorStillS >= 0.5) {
        this.awayFromDoor.delete(mine.id)
        this.doorStillS = 0
        this.callbacks?.onDoor?.(mine.id)
      }
    } else {
      this.doorStillS = 0
    }
  }

  // ---- camera

  follow(agentId: string | null) {
    this.following = agentId && this.agents.has(agentId) ? agentId : null
  }

  zoomBy(factor: number) {
    this.zoomTarget = THREE.MathUtils.clamp(this.zoomTarget * factor, 0.7, 6)
  }

  fitCamera() {
    this.zoomTarget = 1
    this.following = null
    this.target.set(0, 0, 1)
  }

  private rotate(step: number) {
    this.azTarget += (step * Math.PI) / 2
  }

  private viewHeight() {
    const aspect = this.host.clientWidth / Math.max(1, this.host.clientHeight)
    return Math.max(30, 58 / aspect) / this.zoom
  }

  private resize() {
    const w = this.host.clientWidth
    const h = this.host.clientHeight
    if (w && h) this.renderer.setSize(w, h)
  }

  private screenOf(s: Agent3D): Point {
    const v = new THREE.Vector3()
    ;(s.top ?? s.root).getWorldPosition(v)
    v.project(this.camera)
    return { x: ((v.x + 1) / 2) * this.host.clientWidth, y: ((1 - v.y) / 2) * this.host.clientHeight }
  }

  // ---- input

  private on(target: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) {
    target.addEventListener(type, fn, opts)
    this.listeners.push([target, type, fn])
  }

  private listen() {
    const canvas = this.renderer.domElement
    this.on(canvas, 'pointerdown', (e) => {
      const p = e as PointerEvent
      if (p.button !== 0) return
      canvas.focus()
      this.drag = { x: p.clientX, y: p.clientY, moved: false }
      canvas.setPointerCapture(p.pointerId)
    })
    this.on(canvas, 'pointermove', (e) => {
      const p = e as PointerEvent
      if (!this.drag) {
        this.showHover(p)
        return
      }
      const dx = p.clientX - this.drag.x
      const dy = p.clientY - this.drag.y
      if (!this.drag.moved && Math.hypot(dx, dy) < 4) return
      this.drag.moved = true
      this.following = null
      this.hover.visible = false
      const k = this.viewHeight() / this.host.clientHeight
      const sx = dx * k
      const sy = (dy * k) / Math.sin(ELEVATION)
      this.target.x -= Math.cos(this.az) * sx + Math.sin(this.az) * sy
      this.target.z -= -Math.sin(this.az) * sx + Math.cos(this.az) * sy
      this.target.x = THREE.MathUtils.clamp(this.target.x, -COLS / 2, COLS / 2)
      this.target.z = THREE.MathUtils.clamp(this.target.z, -ROWS / 2, ROWS / 2)
      this.drag.x = p.clientX
      this.drag.y = p.clientY
    })
    this.on(canvas, 'pointerup', (e) => {
      const d = this.drag
      this.drag = null
      if (d && !d.moved) this.click(e as PointerEvent)
    })
    this.on(canvas, 'pointerleave', () => {
      this.hover.visible = false
    })
    this.on(
      canvas,
      'wheel',
      (e) => {
        const w = e as WheelEvent
        w.preventDefault()
        this.zoomBy(Math.exp(-THREE.MathUtils.clamp(w.deltaY, -200, 200) * 0.0016))
      },
      { passive: false },
    )
    this.on(this.host, 'keydown', (e) => {
      const k = (e as KeyboardEvent).key.toLowerCase()
      if (k === 'h') this.sendSelectedHome()
      else if (k === 'e') this.openNearby()
      else if (k === 'f') this.follow(this.selected.size === 1 ? [...this.selected][0] : null)
      else if (k === '[') this.rotate(-1)
      else if (k === ']') this.rotate(1)
      else if (k === 'escape') {
        this.selected.clear()
        this.refreshSelection()
      }
    })
  }

  private pointer(e: MouseEvent) {
    const r = this.renderer.domElement.getBoundingClientRect()
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
  }

  private agentAt(e: MouseEvent): Agent3D | null {
    this.raycaster.setFromCamera(this.pointer(e), this.camera)
    const hit = this.raycaster.intersectObjects([...this.agents.values()].filter((s) => !s.leaving).map((s) => s.root), true)[0]
    for (let o: THREE.Object3D | null = hit?.object ?? null; o; o = o.parent) {
      const id = o.userData.agentId as string | undefined
      if (id) return this.agents.get(id) ?? null
    }
    return null
  }

  private tileAt(e: MouseEvent): Point | null {
    this.raycaster.setFromCamera(this.pointer(e), this.camera)
    const hit = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return null
    const t = { x: Math.floor(hit.x + COLS / 2), y: Math.floor(hit.z + ROWS / 2) }
    return t.x < 0 || t.y < 0 || t.x >= COLS || t.y >= ROWS ? null : t
  }

  private showHover(e: PointerEvent) {
    const canvas = this.renderer.domElement
    if (!this.ready) return
    if (this.agentAt(e)) {
      canvas.style.cursor = 'pointer'
      this.hover.visible = false
      return
    }
    const t = this.tileAt(e)
    if (!t) {
      canvas.style.cursor = 'default'
      this.hover.visible = false
      return
    }
    if (this.data.pickingDesk) {
      const desk = this.deskAt(t)
      canvas.style.cursor = desk && !this.data.desks[desk] ? 'pointer' : 'default'
      this.hover.visible = false
      return
    }
    if (!this.selected.size) {
      canvas.style.cursor = this.isDoor(t) ? 'pointer' : 'default'
      this.hover.visible = false
      return
    }
    const ok = walkable(t.x, t.y)
    canvas.style.cursor = ok ? 'pointer' : 'not-allowed'
    ;(this.hover.material as THREE.MeshBasicMaterial).color.set(ok ? 0x70a65b : 0xce8262)
    this.hover.position.copy(toWorld(t.x + 0.5, t.y + 0.5)).setY(0.02)
    this.hover.visible = true
  }

  private click(e: PointerEvent) {
    if (!this.ready) return
    const s = this.agentAt(e)
    if (s) {
      if (this.isMine(s.id)) {
        if (e.shiftKey) {
          if (this.selected.has(s.id)) this.selected.delete(s.id)
          else this.selected.add(s.id)
        } else {
          this.selected = new Set([s.id])
        }
        if (e.detail >= 2) this.callbacks?.onOpenAgent(s.id)
        this.refreshSelection()
        if (this.selected.size === 1) this.follow(s.id)
        return
      }
      const click = this.peerClick(s)
      if (click.reachableBy.length) {
        this.callbacks?.onPeerClick(click)
        return
      }
      if (!this.selected.size) {
        const first = [...this.agents.values()].filter((m) => this.isMine(m.id) && !m.leaving).sort((a, b) => a.id.localeCompare(b.id))[0]
        if (!first) {
          this.callbacks?.onPeerClick(click)
          return
        }
        this.selected = new Set([first.id])
        this.refreshSelection()
      }
      this.walkSelectedTo(s.id)
      return
    }
    const t = this.tileAt(e)
    if (!t) return
    if (this.data.pickingDesk) {
      const desk = this.deskAt(t)
      if (!desk) return
      const owner = this.data.desks[desk]
      if (owner && owner !== this.data.me) this.callbacks?.onDeskTaken(desk, owner)
      else this.callbacks?.onDeskPick(desk)
      return
    }
    if (this.isDoor(t) && [...this.agents.keys()].some((id) => this.isMine(id))) {
      this.goToDoor()
      return
    }
    this.moveSelectedTo(t)
  }

  // ---- per frame

  private frame() {
    if (this.disposed || document.hidden) return
    const dt = Math.min(this.clock.getDelta(), 0.08)
    this.az += (this.azTarget - this.az) * Math.min(1, dt * 7)
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 10)
    if (this.ready) {
      for (const s of [...this.agents.values()]) this.step(s, dt)
      this.checkNearby(dt)
    }
    const followed = this.following ? this.agents.get(this.following) : undefined
    if (followed) {
      const at = toWorld(followed.pos.x, followed.pos.y)
      this.target.lerp(at, Math.min(1, dt * 4))
    }
    const aspect = this.host.clientWidth / Math.max(1, this.host.clientHeight)
    const h = this.viewHeight()
    Object.assign(this.camera, { left: (-h * aspect) / 2, right: (h * aspect) / 2, top: h / 2, bottom: -h / 2 })
    this.camera.updateProjectionMatrix()
    const far = 120
    this.camera.position.set(
      this.target.x + Math.sin(this.az) * Math.cos(ELEVATION) * far,
      Math.sin(ELEVATION) * far,
      this.target.z + Math.cos(this.az) * Math.cos(ELEVATION) * far,
    )
    this.camera.lookAt(this.target)
    const camDir = new THREE.Vector2(Math.sin(this.az), Math.cos(this.az))
    for (const w of this.walls) {
      const want = w.out.dot(camDir) > CUT_AWAY ? 0.1 : 1
      w.group.scale.y += (want - w.group.scale.y) * Math.min(1, dt * 8)
    }
    this.renderer.render(this.scene, this.camera)
    if (this.ready) this.placeTags()
  }

  private step(s: Agent3D, dt: number) {
    const next = s.path[0]
    let moving = false
    if (next) {
      const tx = next.x + 0.5
      const ty = next.y + 0.5
      const dx = tx - s.pos.x
      const dy = ty - s.pos.y
      const dist = Math.hypot(dx, dy)
      const stepLen = WALK_SPEED * dt
      if (dist <= stepLen) {
        s.pos.set(tx, ty)
        s.path.shift()
      } else {
        s.pos.x += (dx / dist) * stepLen
        s.pos.y += (dy / dist) * stepLen
        moving = true
      }
      if (dist > 0.01) s.heading = Math.atan2(dx, dy)
      if (!s.path.length && s.leaving) {
        this.drop(s)
        return
      }
    }
    const tile = this.tileOf(s)
    const seat = !moving && !s.path.length ? this.seatFacing(tile) : null
    if (seat) s.heading = FACE_ANGLE[seat]
    let d = s.heading - s.root.rotation.y
    d = Math.atan2(Math.sin(d), Math.cos(d))
    s.root.rotation.y += d * Math.min(1, dt * 12)
    s.root.position.copy(toWorld(s.pos.x, s.pos.y))

    const talking = !!this.data.bubbles[s.id]
    const present = this.data.owners[s.owner]?.present
    const clip = moving || s.path.length ? 'walk' : seat ? (!present ? 'away' : talking ? 'type' : 'sit-idle') : talking ? 'talk' : 'idle'
    if (clip !== s.clip) this.play(s, clip)
    s.mixer.update(dt)
  }

  private play(s: Agent3D, clip: string) {
    const c = this.models.get(s.skin)?.animations.find((a) => a.name === clip)
    if (!c) return
    const a = s.mixer.clipAction(c)
    a.reset().play()
    if (s.action && s.action !== a) s.action.crossFadeTo(a, 0.2, false)
    s.action = a
    s.clip = clip
  }

  private placeTags() {
    const w = this.host.clientWidth
    const h = this.host.clientHeight
    const v = new THREE.Vector3()
    for (const s of this.agents.values()) {
      ;(s.top ?? s.root).getWorldPosition(v)
      v.y += 0.12
      v.project(this.camera)
      const x = ((v.x + 1) / 2) * w
      const y = ((1 - v.y) / 2) * h
      const off = x < -80 || y < -40 || x > w + 80 || y > h + 40
      s.tag.hidden = off
      if (!off) s.tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`
    }
  }

  // ---- teardown

  destroy() {
    this.disposed = true
    this.callbacks = null
    this.renderer.setAnimationLoop(null)
    this.observer.disconnect()
    for (const [t, type, fn] of this.listeners) t.removeEventListener(type, fn)
    for (const s of [...this.agents.values()]) this.drop(s)
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose()
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) {
          for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose()
          m.dispose()
        }
      }
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.overlay.remove()
  }
}

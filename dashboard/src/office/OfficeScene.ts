// Phaser scene for the Office. React owns the data (useLiveState) and pushes it in with setSceneData();
// the scene draws it, animates walking and reports clicks back through callbacks. It never calls the API.
//
// Pastel art objects and characters are loaded from public/office/manifest.json.

import Phaser from 'phaser'
import type { OfficeAgent } from '../api'
import {
  COLS,
  DESKS,
  ROWS,
  SPAWN,
  TILE,
  walkable,
  type Facing,
  type SeatRow,
  type Point,
} from './layout'
import { blockedRuns, distance, findPath, nearestFree } from './pathfind'
import { renderRoom } from './renderRoom'
import { CHAR_ANIMS, CHAR_FRAME, CHAR_FRAME_48, CHAR_SCALE, SKIN_BY_ID, ownerHue } from './skins'
import { applyCollisionImage } from './mapData'
import { resolveTargets } from './placement'
import { REACH, type OfficeRenderer, type PeerClick, type SceneCallbacks, type SceneData } from './renderer'

// Movement feel (pixels per second). Agents accelerate and brake instead of snapping between tiles.
const WALK_SPEED = 150
const ACCEL = 1100
const ARRIVE_RADIUS = 28 // start braking this close to the final waypoint
const WAYPOINT_RADIUS = 6
const FEET = { w: 16, h: 8 } // collision box at the feet, so heads can overlap furniture drawn behind them
const SYNC_MS = 250 // how often a keyboard-driven agent reports its tile
const NEARBY_STILL_MS = 300 // standing still this long next to a peer opens its menu
const DRIVE_HOLD_MS = 1200 // after keys are released, keep local authority this long

const DESK_FREE = 0x70a65b // outline on free desks while picking one
const USE_FOREGROUND = false
const FOREGROUND_DEPTH = 50_000 // the map's foreground plate draws over characters (depth = feet y)
const HUD_DEPTH = 60_000 // names, icons and bubbles stay above the foreground

/** Desk name tag: a solid chip (rounded box + text) so it reads on top of the busy desk art. */
interface DeskTag {
  box: Phaser.GameObjects.Container
  bg: Phaser.GameObjects.Graphics
  text: Phaser.GameObjects.Text
  look: string
}
// Desk tags sit on the floor behind the chair. Most are faint text, like a label painted on the floor (`chip: false`);
// my own desk and desks I can pick right now get a chip so they stand out.
const TAG_LOOK = {
  free: { fill: 0xfefaf2, stroke: 0x48506c, color: '#48506c', chip: false, alpha: 0.45 },
  taken: { fill: 0x9dd6b7, stroke: 0x2f6b52, color: '#2f5a44', chip: false, alpha: 0.7 },
  mine: { fill: 0xf4b592, stroke: 0x8a4a2c, color: '#4a2412', chip: true, alpha: 1 },
  pick: { fill: 0xd9f2c9, stroke: 0x70a65b, color: '#2f5a22', chip: true, alpha: 1 },
}
// From the seat, one tile away from the desk: the floor behind the chair.
// Side desks' chairs are drawn wider than a tile, so their tag sits a bit further out.
const BEHIND: Record<string, Point> = { right: { x: -1.7, y: 0 }, left: { x: 1.7, y: 0 }, down: { x: 0, y: -1 }, up: { x: 0, y: 1 } }

interface AgentSprite {
  id: string
  owner: string
  container: Phaser.GameObjects.Container
  hit: Phaser.GameObjects.Zone // click/hover target
  hud: Phaser.GameObjects.Container // name, icon, bubble: drawn above the foreground plate
  ring: Phaser.GameObjects.Ellipse | Phaser.GameObjects.Image
  token?: Phaser.GameObjects.Arc
  face?: Phaser.GameObjects.Text
  sheet?: Phaser.GameObjects.Sprite
  skin: string
  label: Phaser.GameObjects.Text
  icon: Phaser.GameObjects.Text
  bubble: Phaser.GameObjects.Text
  bubbleBox: Phaser.GameObjects.Container // nine-slice bubble + tail + text, or the typing dots
  bubbleBg?: Phaser.GameObjects.NineSlice
  typing?: Phaser.GameObjects.Sprite
  feet: Phaser.GameObjects.Zone // physics body at the feet; the container follows it
  body: Phaser.Physics.Arcade.Body
  path: Point[] // pixel waypoints
  dest: Point | null // destination tile
  facing: Facing
  leaving: boolean
  drivenUntil: number // keyboard authority (ms timestamp)
  lastSync: number
  lastTile: string
  stuckMs: number
  streaming?: boolean
  hovered?: boolean
  lastPlan: number // when the last walk was planned; frequent replans mean a remote owner is driving
  /** The tile I last sent for this agent and until when the world's echo of an older move is ignored. */
  sent: { tile: Point; until: number } | null
}

const center = (p: Point) => ({ x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2 + 6 })
const tileOf = (px: Point) => ({ x: Math.floor(px.x / TILE), y: Math.floor((px.y - 6) / TILE) })
const posOf = (s: { feet: Phaser.GameObjects.Zone }) => ({ x: s.feet.x, y: s.feet.y })
const TEXT_RES = Math.min(4, Math.ceil((window.devicePixelRatio || 1) * 2))
// Text must not use the pixel-art NEAREST filter (it shreds glyphs when scaled); give it smooth sampling and
// re-apply after every text change, since updating a canvas texture can reset it.
function crisp<T extends Phaser.GameObjects.Text>(t: T, value?: string): T {
  if (value !== undefined && t.text !== value) t.setText(value)
  t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR)
  return t
}
const ownerColor = (owner: string) => Phaser.Display.Color.HSLToColor(ownerHue(owner) / 360, 0.7, 0.5).color

export class OfficeScene extends Phaser.Scene implements OfficeRenderer {
  private data_: SceneData = { me: '', agents: [], desks: {}, owners: {}, bubbles: {}, icons: {}, pickingDesk: false }
  private sprites = new Map<string, AgentSprite>()
  private selected = new Set<string>()
  private deskLabels = new Map<string, DeskTag>()
  private deskHighlight!: Phaser.GameObjects.Graphics
  private selectBox!: Phaser.GameObjects.Graphics
  private drag: { start: Point; world: Point; mode: 'select' | 'pan'; scroll: Point } | null = null
  private sheets = new Set<string>()
  private sheetFrame: { width: number; height: number; foot: number } = { ...CHAR_FRAME, foot: CHAR_FRAME.height }
  private ready = false
  private firstSync = true
  private walls!: Phaser.Physics.Arcade.StaticGroup
  private keys: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key[]> | null = null
  private following: string | null = null
  private zoomTarget: number | null = null
  private nearby: { mine: string; peer: string; dismissed: boolean } | null = null
  private stillMs = 0
  private zoomAnchor: { screen: Point; world: Point } | null = null
  private hover!: Phaser.GameObjects.Graphics
  private feedback!: Phaser.GameObjects.Graphics // destination markers and the unreachable cross
  private markers: { x: number; y: number; agentId: string; born: number; bad?: boolean; sprite?: Phaser.GameObjects.Sprite }[] = []
  callbacks: SceneCallbacks | null = null
  onReady: (() => void) | null = null

  constructor() {
    super({ key: 'office', physics: { default: 'arcade', arcade: { debug: false } } })
  }

  preload() {
    this.load.json('manifest', 'office/manifest.json')
    this.load.on('filecomplete-json-manifest', () => {
      const manifest = this.cache.json.get('manifest') as { objects?: Record<string, string>; map?: Record<string, string>; ui?: Record<string, string> }
      const ui = manifest.ui ?? {}
      // Codex UI art for in-map chrome; anything missing falls back to drawn shapes.
      if (ui.ring) this.load.image('ui-ring', ui.ring)
      if (ui['ring-selected']) this.load.image('ui-ring-selected', ui['ring-selected'])
      if (ui.bubble) this.load.image('ui-bubble', ui.bubble)
      if (ui['bubble-tail']) this.load.image('ui-bubble-tail', ui['bubble-tail'])
      if (ui.target) this.load.spritesheet('ui-target', ui.target, { frameWidth: 32, frameHeight: 16 })
      if (ui.typing) this.load.spritesheet('ui-typing', ui.typing, { frameWidth: 16, frameHeight: 8 })
      const map = manifest.map
      if (map?.background && map.collision && map.seats) {
        // Gather-style map: one background plate, a foreground plate over characters, and a collision grid.
        this.load.image('map-bg', map.background)
        if (map.foreground) this.load.image('map-fg', map.foreground)
        this.load.image('map-collision', map.collision)
        this.load.json('map-seats', map.seats)
      } else {
        for (const [kind, path] of Object.entries(manifest.objects ?? {})) this.load.image(`object-${kind}`, path)
      }
    })
  }

  create() {
    if (this.textures.exists('ui-target')) {
      this.anims.create({ key: 'ui-target-pulse', frames: this.anims.generateFrameNumbers('ui-target', { start: 0, end: 2 }), frameRate: 6, yoyo: true, repeat: -1 })
    }
    if (this.textures.exists('ui-typing')) {
      this.anims.create({ key: 'ui-typing-dots', frames: this.anims.generateFrameNumbers('ui-typing', { start: 0, end: 2 }), frameRate: 5, repeat: -1 })
    }
    this.drawMap()
    this.walls = this.physics.add.staticGroup()
    for (const r of blockedRuns()) {
      const z = this.add.zone((r.x + r.w / 2) * TILE, (r.y + 0.5) * TILE, r.w * TILE, TILE)
      this.walls.add(z)
    }
    this.physics.world.setBounds(0, 0, COLS * TILE, ROWS * TILE)
    this.deskHighlight = this.add.graphics().setDepth(1)
    this.selectBox = this.add.graphics().setDepth(10_000)
    this.hover = this.add.graphics().setDepth(3)
    this.feedback = this.add.graphics().setDepth(3)

    const cam = this.cameras.main
    cam.setBackgroundColor(0xe6ddd8)
    this.fitCamera()
    this.scale.on('resize', () => this.fitCamera())

    this.setupInput()
    this.loadSheets()
    // Web fonts arrive after the first draw; redraw every text once they are ready.
    void document.fonts?.ready.then(() => {
      for (const tag of this.deskLabels.values()) this.paintTag(tag, tag.look, true)
      for (const sp of this.sprites.values()) for (const t of [sp.label, sp.bubble]) crisp(t).updateText()
    })
    this.ready = true
    this.sync()
    this.onReady?.()
  }

  /** Called by React whenever the Office state changes. */
  setSceneData(d: SceneData) {
    this.data_ = d
    if (this.ready) this.sync()
  }

  selectOnly(ids: string[]) {
    this.selected = new Set(ids.filter((id) => this.isMine(id)))
    this.refreshSelection()
    if (this.selected.size === 1) this.follow([...this.selected][0])
  }

  // map

  private drawMap() {
    if (this.textures.exists('map-bg') && this.textures.exists('map-collision') && this.cache.json.exists('map-seats')) {
      this.applyCollision()
      this.add.image(0, 0, 'map-bg').setOrigin(0).setDepth(-100)
      // The foreground plate is off: it contains whole desks, so it also covered agents standing in FRONT of them.
      // Proper occlusion needs per-object images with a baseline (sorted by y), not one plate.
      if (USE_FOREGROUND && this.textures.exists('map-fg')) this.add.image(0, 0, 'map-fg').setOrigin(0).setDepth(FOREGROUND_DEPTH)
    } else {
      renderRoom(this)
    }
    for (const d of DESKS) {
      const back = BEHIND[d.seat.face] ?? { x: 0, y: 1 }
      const at = { x: (d.seat.x + back.x + 0.5) * TILE, y: (d.seat.y + back.y + 0.5) * TILE }
      const text = crisp(
        this.add
          .text(0, 0, d.id, { fontFamily: 'Nunito, ui-sans-serif, system-ui', fontStyle: '800', fontSize: '11px', color: '#48506c', resolution: TEXT_RES })
          .setOrigin(0.5, 0.5),
      )
      const bg = this.add.graphics()
      // Under the agents (they walk over it), above the map plate.
      const box = this.add.container(at.x, at.y, [bg, text]).setDepth(-50)
      this.deskLabels.set(d.id, { box, bg, text, look: '' })
    }
  }

  private applyCollision() {
    applyCollisionImage(this.textures.get('map-collision').getSourceImage() as HTMLImageElement, this.cache.json.get('map-seats') as SeatRow[])
  }

  /** Smooth zoom: set a target and let update() glide there, keeping `anchor` (screen px) fixed. */
  zoomBy(factor: number, anchor?: Point) {
    const cam = this.cameras.main
    const fit = Math.min(this.scale.width / (COLS * TILE), this.scale.height / (ROWS * TILE))
    this.zoomTarget = Phaser.Math.Clamp((this.zoomTarget ?? cam.zoom) * factor, fit * 0.8, 3)
    const screen = anchor ?? { x: this.scale.width / 2, y: this.scale.height / 2 }
    const world = cam.getWorldPoint(screen.x, screen.y)
    this.zoomAnchor = { screen, world: { x: world.x, y: world.y } }
  }

  private glideZoom(delta: number) {
    if (this.zoomTarget === null) return
    const cam = this.cameras.main
    const k = 1 - Math.exp(-delta / 90) // ~90 ms time constant
    const z = cam.zoom + (this.zoomTarget - cam.zoom) * k
    const done = Math.abs(this.zoomTarget - z) < 0.002
    cam.setZoom(done ? this.zoomTarget : z)
    this.updateBounds()
    if (this.zoomAnchor && !(this.following && !this.mapFits())) {
      // Keep the world point under the cursor where it was.
      const { screen, world } = this.zoomAnchor
      cam.setScroll(world.x - (screen.x - cam.width * cam.originX) / cam.zoom - cam.width * cam.originX, world.y - (screen.y - cam.height * cam.originY) / cam.zoom - cam.height * cam.originY)
    }
    this.scaleDeskLabels()
    if (done) {
      this.zoomTarget = null
      this.zoomAnchor = null
      this.follow(this.following)
    }
  }

  /** Keep one of my agents in view. Never changes zoom; does nothing while the whole map fits on screen. */
  follow(agentId: string | null) {
    const cam = this.cameras.main
    const s = agentId ? this.sprites.get(agentId) : undefined
    this.following = s ? agentId : null
    if (!s || this.mapFits()) {
      cam.stopFollow()
      return
    }
    cam.startFollow(s.container, true, 0.12, 0.12)
  }

  private mapFits() {
    const cam = this.cameras.main
    return COLS * TILE * cam.zoom <= this.scale.width + 1 && ROWS * TILE * cam.zoom <= this.scale.height + 1
  }

  fitCamera() {
    const cam = this.cameras.main
    cam.stopFollow()
    this.zoomTarget = null
    this.zoomAnchor = null
    cam.setZoom(Math.min(this.scale.width / (COLS * TILE), this.scale.height / (ROWS * TILE)))
    this.updateBounds()
    cam.centerOn((COLS * TILE) / 2, (ROWS * TILE) / 2)
    this.scaleDeskLabels()
  }

  private scaleDeskLabels() {
    const k = 1 / this.cameras.main.zoom
    for (const tag of this.deskLabels.values()) tag.box.setScale(k)
  }

  /** Bounds only when the map is bigger than the view; otherwise they would pin it to the top-left. */
  private updateBounds() {
    const cam = this.cameras.main
    const pad = { x: Math.max(0, (this.scale.width / cam.zoom - COLS * TILE) / 2), y: Math.max(0, (this.scale.height / cam.zoom - ROWS * TILE) / 2) }
    cam.setBounds(-pad.x, -pad.y, COLS * TILE + 2 * pad.x, ROWS * TILE + 2 * pad.y)
  }

  // optional sprite sheets

  private loadSheets() {
    const manifest = (this.cache.json.get('manifest') ?? {}) as { characters?: Record<string, string>; characters48?: Record<string, string> }
    // Prefer the sheets drawn natively at 48x72 (no upscaling); fall back to the 32x48 ones scaled up.
    const native = Object.keys(manifest.characters48 ?? {}).length > 0
    const chars = (native ? manifest.characters48 : manifest.characters) ?? {}
    this.sheetFrame = native ? CHAR_FRAME_48 : { ...CHAR_FRAME, foot: CHAR_FRAME.height }
    const keys = Object.keys(chars)
    if (!keys.length) return
    for (const skin of keys) this.load.spritesheet(`char-${skin}`, chars[skin], { frameWidth: this.sheetFrame.width, frameHeight: this.sheetFrame.height })
    this.load.once('complete', () => {
      for (const skin of keys) {
        const key = `char-${skin}`
        if (!this.textures.exists(key)) continue
        this.sheets.add(skin)
        for (const [name, frames] of Object.entries(CHAR_ANIMS)) {
          this.anims.create({
            key: `${key}-${name}`,
            frames: this.anims.generateFrameNumbers(key, { frames: [...frames] }),
            frameRate: name.startsWith('walk') ? 8 : 2,
            repeat: -1,
          })
        }
      }
      for (const s of this.sprites.values()) this.applySkin(s, s.skin, true)
    })
    this.load.start()
  }

  // agents

  private isMine(id: string) {
    return id.startsWith(`${this.data_.me}/`)
  }

  private sync() {
    const d = this.data_
    const ids = new Set(d.agents.map((a) => a.agent_id))
    for (const [id, s] of this.sprites) {
      if (!ids.has(id) && !s.leaving) this.leave(s)
    }
    for (const a of d.agents) {
      let s = this.sprites.get(a.agent_id)
      if (!s || s.leaving) {
        s?.container.destroy()
        s?.hud.destroy()
        s?.hit.destroy()
        s?.feet.destroy()
        s = this.spawn(a)
      }
      this.applySkin(s, a.skin)
      const present = d.owners[a.owner]?.present
      crisp(s.label, a.name.split('/').pop() ?? a.name).setAlpha(present ? 1 : 0.6)
      crisp(s.icon, d.icons[a.agent_id] ?? '')
      this.setBubble(s, d.bubbles[a.agent_id])
    }
    for (const id of [...this.selected]) if (!ids.has(id)) this.selected.delete(id)
    this.resolveTargets()
    this.refreshSelection()
    this.refreshDesks()
    this.firstSync = false
  }

  private spawn(a: OfficeAgent): AgentSprite {
    const ring = this.textures.exists('ui-ring')
      ? this.add.image(0, 0, 'ui-ring').setTint(ownerColor(a.owner)).setScale(CHAR_SCALE * 0.9)
      : this.add.ellipse(0, 0, 26 * CHAR_SCALE, 10 * CHAR_SCALE, ownerColor(a.owner), 0.85).setStrokeStyle(0)
    const label = this.add
      .text(0, -50, '', { fontFamily: 'Nunito, ui-sans-serif, system-ui', fontStyle: '800', fontSize: '12px', color: '#fdf3e6', backgroundColor: '#48506cee', padding: { x: 6, y: 2 }, resolution: TEXT_RES })
      .setOrigin(0.5, 1)
    const icon = this.add.text(14, -40, '', { fontSize: '16px', resolution: TEXT_RES }).setOrigin(0, 1)
    const bubble = this.add
      .text(0, -60, '', {
        fontFamily: 'Nunito, ui-sans-serif, system-ui',
        fontStyle: '600',
        fontSize: '13px',
        color: '#2c283c',
        wordWrap: { width: 180 },
        resolution: TEXT_RES,
      })
      .setOrigin(0.5, 1)
    const bubbleParts: Phaser.GameObjects.GameObject[] = []
    const bubbleBg = this.textures.exists('ui-bubble') ? this.add.nineslice(0, 0, 'ui-bubble', undefined, 24, 24, 8, 8, 8, 8).setOrigin(0.5, 1) : undefined
    if (bubbleBg) bubbleParts.push(bubbleBg)
    if (this.textures.exists('ui-bubble-tail')) bubbleParts.push(this.add.image(0, 5, 'ui-bubble-tail').setOrigin(0.5, 1))
    bubbleParts.push(bubble)
    const typing = this.textures.exists('ui-typing') ? this.add.sprite(0, -9, 'ui-typing').setOrigin(0.5, 0.5).setScale(2).setVisible(false) : undefined
    if (typing) bubbleParts.push(typing)
    const bubbleBox = this.add.container(0, -60, bubbleParts).setVisible(false)
    if (!bubbleBg) bubble.setBackgroundColor('#ffffff').setPadding(6, 3, 6, 3)
    const container = this.add.container(0, 0, [ring])
    const hud = this.add.container(0, 0, [label, icon, bubbleBox]).setDepth(HUD_DEPTH)
    // Generous hit box from the feet up to the name tag, ~1.6 tiles wide. A standalone zone (origin at the feet)
    // instead of an interactive container: container hit areas are measured from the container's centre.
    const hit = this.add
      .zone(0, 0, 52, CHAR_FRAME.height * CHAR_SCALE + 30)
      .setOrigin(0.5, 1)
      .setDepth(HUD_DEPTH - 2)
      .setInteractive({ useHandCursor: true })
    const start = this.firstSync ? null : center(SPAWN) // newcomers walk in from the door
    const feet = this.add.zone(start?.x ?? -100, start?.y ?? -100, FEET.w, FEET.h)
    this.physics.add.existing(feet)
    const body = feet.body as Phaser.Physics.Arcade.Body
    body.setCollideWorldBounds(true).setMaxVelocity(WALK_SPEED * 1.6, WALK_SPEED * 1.6)
    this.physics.add.collider(feet, this.walls)
    const s: AgentSprite = {
      id: a.agent_id,
      owner: a.owner,
      container,
      hit,
      hud,
      ring,
      skin: '',
      label,
      icon,
      bubble,
      bubbleBox,
      bubbleBg,
      typing,
      feet,
      body,
      path: [],
      dest: null,
      facing: 'down',
      leaving: false,
      drivenUntil: 0,
      lastSync: 0,
      lastTile: '',
      stuckMs: 0,
      lastPlan: 0,
      sent: null,
    }
    if (!start) feet.setData('unplaced', true)
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => this.onAgentDown(s, p))
    hit.on('pointerover', () => this.setHover(s, true))
    hit.on('pointerout', () => this.setHover(s, false))
    // Clicking a speech bubble opens that conversation (mine) or the agent's menu (someone else's).
    bubble.setInteractive({ useHandCursor: true })
    bubble.on('pointerdown', (p: Phaser.Input.Pointer) => (this.isMine(s.id) ? this.callbacks?.onOpenAgent(s.id) : this.onAgentDown(s, p)))
    // The name tag is on the HUD layer; make it clickable too.
    label.setInteractive({ useHandCursor: true })
    label.on('pointerdown', (p: Phaser.Input.Pointer) => this.onAgentDown(s, p))
    label.on('pointerover', () => this.setHover(s, true))
    label.on('pointerout', () => this.setHover(s, false))
    this.sprites.set(a.agent_id, s)
    return s
  }

  private applySkin(s: AgentSprite, skin: string, force = false) {
    if (s.skin === skin && !force) return
    s.skin = skin
    s.token?.destroy()
    s.face?.destroy()
    s.sheet?.destroy()
    s.token = s.face = s.sheet = undefined
    const info = SKIN_BY_ID[skin] ?? SKIN_BY_ID['dev-hoodie']
    if (this.sheets.has(skin)) {
      const f = this.sheetFrame
      s.sheet = this.add.sprite(0, 0, `char-${skin}`, 18).setOrigin(0.5, f.foot / f.height).setScale((CHAR_FRAME.width * CHAR_SCALE) / f.width)
      s.container.addAt(s.sheet, 1)
    } else {
      s.token = this.add.circle(0, -16 * CHAR_SCALE, 13 * CHAR_SCALE, info.color).setStrokeStyle(2, 0xffffff)
      s.face = crisp(this.add.text(0, -16 * CHAR_SCALE, info.emoji, { fontSize: `${Math.round(16 * CHAR_SCALE)}px`, resolution: TEXT_RES }).setOrigin(0.5))
      s.container.addAt([s.token, s.face], 1)
    }
  }

  private leave(s: AgentSprite) {
    s.leaving = true
    s.drivenUntil = 0
    this.walkTo(s, { x: SPAWN.x, y: SPAWN.y })
    this.selected.delete(s.id)
    if (this.following === s.id) this.follow(null)
  }

  /** Plan a smoothed path to a tile and follow it with steering (see update()). */
  private walkTo(s: AgentSprite, tile: Point): boolean {
    const here = tileOf(posOf(s))
    const path = findPath(here, tile)
    if (!path.length && (here.x !== tile.x || here.y !== tile.y)) return false
    s.dest = tile
    s.streaming = this.time.now - s.lastPlan < 450 // updates arriving every ~250 ms: keep gliding, don't brake
    s.lastPlan = this.time.now
    s.path = path.map(center)
    if (!path.length) s.path = [center(tile)] // already on the tile: settle onto its centre
    s.stuckMs = 0
    return true
  }

  /** Turn each agent's symbolic target into a tile, without two agents claiming the same one. */
  private resolveTargets() {
    const d = this.data_
    const result = resolveTargets(d, (id) => {
      const other = this.sprites.get(id)
      return other ? tileOf(posOf(other)) : null
    })

    const now = this.time.now
    for (const [id, p] of result) {
      const s = this.sprites.get(id)!
      if (s.feet.getData('unplaced')) {
        // First time we see it: place it directly.
        s.feet.setData('unplaced', false)
        const c = center(p)
        s.body.reset(c.x, c.y)
        s.dest = p
        s.path = []
        continue
      }
      if (s.drivenUntil > now) continue // the owner is steering it with the keyboard right now
      // Rapid clicks: echoes of earlier moves arrive after the newest click. Keep walking to the newest target
      // until the world confirms it (or a while passes, in case the move was refused).
      if (s.sent) {
        const target = d.agents.find((a) => a.agent_id === id)?.at
        const confirmed = target?.kind === 'tile' && target.x === s.sent.tile.x && target.y === s.sent.tile.y
        if (confirmed || s.sent.until <= now) s.sent = null
        else continue
      }
      if (s.dest && s.dest.x === p.x && s.dest.y === p.y) continue
      this.walkTo(s, p)
    }
  }

  update(time: number, delta: number) {
    this.glideZoom(delta)
    this.checkNearby(delta)
    this.drawFeedback(time)
    const dt = Math.min(delta, 80) / 1000
    const drive = this.readKeys()
    const driven = drive && this.selected.size === 1 ? this.sprites.get([...this.selected][0]) : undefined
    for (const s of [...this.sprites.values()]) {
      let want = { x: 0, y: 0 }
      if (driven === s && drive) {
        // Keyboard: direct control, like Gather.
        s.path = []
        s.dest = null
        s.sent = null
        s.drivenUntil = time + DRIVE_HOLD_MS
        want = { x: drive.x * WALK_SPEED, y: drive.y * WALK_SPEED }
        this.syncDriven(s, time)
      } else if (s.path.length) {
        want = this.steer(s, delta)
      } else if (s.leaving) {
        s.container.destroy()
        s.hud.destroy()
        s.hit.destroy()
        s.feet.destroy()
        this.sprites.delete(s.id)
        continue
      } else if (s.drivenUntil > 0 && s.drivenUntil <= time + DRIVE_HOLD_MS - 60 && driven !== s) {
        this.syncDriven(s, time, true) // keys released: report where it stopped
        s.drivenUntil = 0
      }
      // Accelerate towards the wanted velocity; brake when there is none.
      const v = s.body.velocity
      const maxDv = ACCEL * dt
      const dvx = Phaser.Math.Clamp(want.x - v.x, -maxDv, maxDv)
      const dvy = Phaser.Math.Clamp(want.y - v.y, -maxDv, maxDv)
      s.body.setVelocity(v.x + dvx, v.y + dvy)
      const speed = s.body.velocity.length()
      const moving = speed > 12
      if (moving) {
        // Hysteresis: only switch between horizontal and vertical facing on a clear majority, so diagonal
        // walking doesn't flicker between two animations.
        const { x, y } = s.body.velocity
        const horizontal = s.facing === 'left' || s.facing === 'right'
        const goHorizontal = horizontal ? Math.abs(x) * 1.4 > Math.abs(y) : Math.abs(x) > Math.abs(y) * 1.4
        s.facing = goHorizontal ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up'
      }
      s.container.setPosition(Math.round(s.feet.x), Math.round(s.feet.y + FEET.h / 2)).setDepth(s.feet.y)
      s.hud.setPosition(s.container.x, s.container.y).setDepth(HUD_DEPTH + s.feet.y)
      s.hit.setPosition(s.container.x, s.container.y)
      this.scaleOverlay(s)
      this.animate(s, moving)
    }
    this.declutterLabels()
  }

  /** Agents standing close together would print their names on top of each other. A sideways overlap is
   *  fixed by sliding the later tag aside; a near-total one lifts it above the other block, at most twice, so a tag never
   *  climbs a whole stack of neighbours and floats far from its character. */
  private declutterLabels() {
    // Each agent's overlay block is its name tag plus, when shown, the speech bubble above it.
    const placed: { x: number; top: number; bottom: number; w: number }[] = []
    const list = [...this.sprites.values()].filter((s) => s.label.visible).sort((a, b) => b.feet.y - a.feet.y)
    for (const s of list) {
      const k = s.label.scaleX
      const bubble = s.bubbleBox.visible ? s.bubbleBox.getBounds() : null
      const w = Math.max(s.label.width * k, bubble?.width ?? 0)
      const bottom0 = s.hud.y + s.label.y
      const height = s.label.height * k + (bubble ? bubble.height + 8 * k : 0)
      const gap = 3 * k
      let bottom = bottom0
      let dx = 0
      let lifts = 0
      for (let tries = 0; tries < 6; tries++) {
        const x = s.hud.x + dx
        const hit = placed.find((p) => Math.abs(p.x - x) < (p.w + w) / 2 + gap && bottom > p.top - 1 && bottom - height < p.bottom + 1)
        if (!hit) break
        const overlapX = (hit.w + w) / 2 + gap - Math.abs(hit.x - x)
        // Lifting near the top wall would push the tag off the map: slide it aside instead.
        const roomAbove = hit.top - gap - height > 0
        if (overlapX < w * 0.8 || !roomAbove) dx += (x >= hit.x ? 1 : -1) * overlapX
        else if (lifts < 2) { bottom = hit.top - gap; lifts++ }
        else break // crowded: accept a little overlap rather than drifting away
      }
      const lift = bottom - bottom0
      s.label.x += dx
      s.icon.x += dx
      s.bubbleBox.x += dx
      if (lift) {
        s.label.y += lift
        s.icon.y += lift
        s.bubbleBox.y += lift
      }
      placed.push({ x: s.hud.x + dx, top: bottom - height, bottom, w })
    }
  }

  /** Proximity: when the one agent I'm controlling stands still within reach of someone else's agent, offer
   *  the menu for the closest one; close it when they part. Closing it by hand keeps it closed until they part. */
  // My agents that have been away from the entrance since they came in (walking out of it doesn't count).
  private awayFromDoor = new Set<string>()
  private doorStillMs = 0
  /** My agent sent to the door by clicking it: the "Heading home?" popup opens as soon as it gets there. */
  private doorIntent: string | null = null

  /** The entrance door and the floor just in front of it (the door art sits on the wall above the spawn tile). */
  private isDoor(t: Point): boolean {
    return Math.abs(t.x - SPAWN.x) <= 1 && t.y >= SPAWN.y - 2 && t.y <= SPAWN.y
  }

  /** Clicked the door: walk my selected agent (or my first one) there; the popup follows on arrival. */
  private goToDoor() {
    const mineIds = [...this.sprites.values()].filter((s) => this.isMine(s.id) && !s.leaving).map((s) => s.id).sort()
    const id = this.selected.size === 1 && this.isMine([...this.selected][0]) ? [...this.selected][0] : mineIds[0]
    const s = id ? this.sprites.get(id) : undefined
    if (!s) return
    if (!this.selected.has(s.id) || this.selected.size !== 1) {
      this.selected.clear()
      this.selected.add(s.id)
      this.refreshSelection()
    }
    this.doorIntent = s.id
    const here = tileOf(posOf(s))
    if (Math.hypot(here.x - SPAWN.x, here.y - SPAWN.y) <= 1.6) return // already there: checkDoor opens it
    const p = nearestFree(SPAWN, (x, y) => findPath(here, { x, y }).length > 0)
    if (p) this.moveSelectedTo(p)
  }

  private checkDoor(delta: number, mine: AgentSprite | undefined) {
    if (!mine) {
      this.doorStillMs = 0
      return
    }
    const door = center(SPAWN)
    const tiles = Math.hypot(mine.feet.x - door.x, mine.feet.y - door.y) / TILE
    if (tiles > 3) {
      this.awayFromDoor.add(mine.id)
      this.doorStillMs = 0
      return
    }
    const still = !mine.path.length && mine.body.velocity.length() < 12
    if (this.doorIntent === mine.id && tiles <= 1.6 && still) {
      this.doorIntent = null
      this.awayFromDoor.delete(mine.id)
      this.doorStillMs = 0
      this.callbacks?.onDoor?.(mine.id)
      return
    }
    if (tiles <= 1.6 && still && this.awayFromDoor.has(mine.id)) {
      this.doorStillMs += delta
      if (this.doorStillMs >= 500) {
        this.awayFromDoor.delete(mine.id)
        this.doorStillMs = 0
        this.callbacks?.onDoor?.(mine.id)
      }
    } else {
      this.doorStillMs = 0
    }
  }

  private checkNearby(delta: number) {
    const mine = this.selected.size === 1 ? this.sprites.get([...this.selected][0]) : undefined
    this.checkDoor(delta, mine)
    const best = mine ? this.closestPeer(mine) : null
    if (!mine || !best) {
      if (this.nearby) this.callbacks?.onNearby(null)
      this.nearby = null
      this.stillMs = 0
      return
    }
    const still = !mine.path.length && mine.body.velocity.length() < 12
    this.stillMs = still ? this.stillMs + delta : 0
    if (this.nearby && (this.nearby.mine !== mine.id || this.nearby.peer !== best.id)) {
      this.callbacks?.onNearby(null)
      this.nearby = null
    }
    if (!this.nearby && this.stillMs >= NEARBY_STILL_MS) {
      this.nearby = { mine: mine.id, peer: best.id, dismissed: false }
      this.callbacks?.onNearby({ ...this.peerClick(best), auto: true })
    }
  }

  private closestPeer(mine: AgentSprite): AgentSprite | null {
    const here = tileOf(posOf(mine))
    let best: AgentSprite | null = null
    let bestD = Infinity
    for (const s of this.sprites.values()) {
      if (this.isMine(s.id) || s.leaving) continue
      const d = distance(tileOf(posOf(s)), here)
      const px = Math.hypot(s.feet.x - mine.feet.x, s.feet.y - mine.feet.y)
      if (d <= REACH && px < bestD) {
        best = s
        bestD = px
      }
    }
    return best
  }

  /** Screen position (canvas px) of an agent's head plus who of mine can reach it. */
  private peerClick(s: AgentSprite): PeerClick {
    const cam = this.cameras.main
    const here = tileOf(posOf(s))
    const reachableBy = [...this.sprites.values()]
      .filter((m) => this.isMine(m.id) && !m.leaving && distance(tileOf(posOf(m)), here) <= REACH)
      .map((m) => m.id)
    const head = { x: s.feet.x, y: s.feet.y - CHAR_FRAME.height * CHAR_SCALE }
    return { agentId: s.id, screen: { x: (head.x - cam.worldView.x) * cam.zoom, y: (head.y - cam.worldView.y) * cam.zoom }, reachableBy }
  }

  /** The owner closed the proximity menu: don't reopen it until the agents part. */
  dismissNearby() {
    if (this.nearby) this.nearby.dismissed = true
  }

  /** E: open the menu for the closest agent within reach, even after it was dismissed. */
  private openNearby() {
    const mine = this.selected.size === 1 ? this.sprites.get([...this.selected][0]) : undefined
    const best = mine ? this.closestPeer(mine) : null
    if (mine && best) {
      this.nearby = { mine: mine.id, peer: best.id, dismissed: false }
      this.callbacks?.onNearby({ ...this.peerClick(best), auto: true })
    }
  }

  /** Speech bubble: words in a nine-slice bubble, or animated typing dots when the text is just "…". */
  private setBubble(s: AgentSprite, text: string | undefined) {
    if (!text) {
      s.bubbleBox.setVisible(false)
      s.typing?.stop()
      return
    }
    s.bubbleBox.setVisible(true)
    const dots = text.trim() === '…' && !!s.typing
    s.bubble.setVisible(!dots)
    if (dots) {
      if (!s.typing!.anims.isPlaying) s.typing!.play('ui-typing-dots')
      s.typing!.setVisible(true)
      s.bubbleBg?.setSize(44, 22)
      return
    }
    s.typing?.setVisible(false).stop()
    crisp(s.bubble, text)
    s.bubble.setY(-6)
    s.bubbleBg?.setSize(Math.max(24, Math.ceil(s.bubble.width) + 16), Math.max(22, Math.ceil(s.bubble.height) + 10))
  }

  /** Names, icons and bubbles keep the same on-screen size at any zoom, and sit just above the head. */
  private scaleOverlay(s: AgentSprite) {
    const k = 1 / this.cameras.main.zoom
    const head = -(CHAR_FRAME.height - 2) * CHAR_SCALE
    s.label.setScale(k).setPosition(0, head)
    s.icon.setScale(k).setPosition((s.label.width * k) / 2 + 3, head) // just right of the name tag, never over it
    s.bubbleBox.setScale(k).setPosition(0, head - s.label.height * k - 8)
  }

  /** Velocity towards the next waypoint, slowing down on the last one. Replans when stuck. */
  private steer(s: AgentSprite, delta: number): Point {
    const target = s.path[0]
    const dx = target.x - s.feet.x
    const dy = target.y - s.feet.y
    const dist = Math.hypot(dx, dy)
    const last = s.path.length === 1
    if (dist < (last ? 2 : WAYPOINT_RADIUS)) {
      s.path.shift()
      if (last) {
        s.body.reset(target.x, target.y) // settle exactly on the tile
        return { x: 0, y: 0 }
      }
      return this.steer(s, delta)
    }
    if (s.body.velocity.length() < 8 && s.body.blocked.none === false) s.stuckMs += delta
    else s.stuckMs = 0
    if (s.stuckMs > 600 && s.dest) this.walkTo(s, s.dest)
    const brake = last && !(s.streaming && this.time.now - s.lastPlan < 450)
    const speed = brake ? Math.min(WALK_SPEED, (WALK_SPEED * dist) / ARRIVE_RADIUS + 20) : WALK_SPEED
    return { x: (dx / dist) * speed, y: (dy / dist) * speed }
  }

  private readKeys(): Point | null {
    if (!this.keys) return null
    const down = (ks: Phaser.Input.Keyboard.Key[]) => ks.some((k) => k.isDown)
    const x = (down(this.keys.right) ? 1 : 0) - (down(this.keys.left) ? 1 : 0)
    const y = (down(this.keys.down) ? 1 : 0) - (down(this.keys.up) ? 1 : 0)
    if (!x && !y) return null
    const n = Math.hypot(x, y)
    return { x: x / n, y: y / n }
  }

  /** Tell the world where a keyboard-driven agent is (throttled, and once when it stops). */
  private syncDriven(s: AgentSprite, time: number, final = false) {
    const t = tileOf(posOf(s))
    const key = `${t.x},${t.y}`
    if (!final && (time - s.lastSync < SYNC_MS || key === s.lastTile)) return
    if (final && key === s.lastTile) return
    s.lastSync = time
    s.lastTile = key
    s.dest = t
    this.callbacks?.onMove(s.id, { kind: 'tile', x: t.x, y: t.y })
  }

  private animate(s: AgentSprite, moving: boolean) {
    if (s.sheet) {
      const key = `char-${s.skin}`
      const dir = s.facing === 'right' ? 'left' : s.facing
      const seat = !moving && this.seatAt(tileOf(posOf(s)))
      const name = moving ? `walk-${dir}` : seat ? (seat === 'right' ? 'sit-left' : `sit-${seat}`) : 'idle'
      s.sheet.setFlipX(s.facing === 'right' || seat === 'right')
      if (s.sheet.anims.currentAnim?.key !== `${key}-${name}`) s.sheet.play(`${key}-${name}`)
    } else if (s.token) {
      const bob = moving ? Math.sin(this.time.now / 70) * 2 : 0
      s.token.y = -16 * CHAR_SCALE + bob
      if (s.face) s.face.y = -16 * CHAR_SCALE + bob
    }
  }

  private seatAt(p: Point): Facing | null {
    for (const d of DESKS) if (d.seat.x === p.x && d.seat.y === p.y) return d.seat.face
    return null
  }

  // selection + desks

  private refreshSelection(notify = true) {
    for (const s of this.sprites.values()) {
      const sel = this.selected.has(s.id)
      if (s.ring instanceof Phaser.GameObjects.Image) {
        s.ring.setTexture(sel && this.textures.exists('ui-ring-selected') ? 'ui-ring-selected' : 'ui-ring')
        s.ring.setScale(CHAR_SCALE * 0.9 * (sel ? 1.1 : s.hovered ? 1.12 : 1)).setAlpha(sel || s.hovered ? 1 : 0.85)
      } else {
        s.ring.setStrokeStyle(sel || s.hovered ? 3 : 0, sel ? 0xffffff : 0xfff3e6)
        s.ring.setScale(sel ? 1.2 : s.hovered ? 1.15 : 1)
      }
    }
    if (notify) this.callbacks?.onSelect([...this.selected])
  }

  private refreshDesks() {
    const { desks, pickingDesk, me } = this.data_
    this.deskHighlight.clear()
    for (const d of DESKS) {
      const owner = desks[d.id]
      const tag = this.deskLabels.get(d.id)!
      crisp(tag.text, owner ? `${d.id} · ${owner}` : d.id)
      this.paintTag(tag, owner === me ? 'mine' : owner ? 'taken' : pickingDesk ? 'pick' : 'free')
      if (pickingDesk && !owner) {
        const t = d.table
        this.deskHighlight.lineStyle(2, DESK_FREE).strokeRect(t.x * TILE - 2, t.y * TILE - 2, t.w * TILE + 4, t.h * TILE + 4)
      }
    }
  }

  /** Redraw a desk tag's chip to fit its text in one of the TAG_LOOK styles. */
  private paintTag(tag: DeskTag, look: string, force = false) {
    if (!force && tag.look === look && tag.bg.getData('w') === tag.text.width) return
    const style = TAG_LOOK[look as keyof typeof TAG_LOOK] ?? TAG_LOOK.free
    tag.look = look
    tag.text.setColor(style.color).setAlpha(style.alpha)
    crisp(tag.text).updateText()
    const w = Math.ceil(tag.text.width) + 12
    const h = Math.ceil(tag.text.height) + 4
    tag.bg.clear()
    tag.bg.setData('w', tag.text.width)
    if (!style.chip) return
    tag.bg.fillStyle(0x2c283c, 0.25).fillRoundedRect(-w / 2, -h / 2 + 2, w, h, 4) // hard drop shadow
    tag.bg.fillStyle(style.fill, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 4)
    tag.bg.lineStyle(1.5, style.stroke, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 4)
    tag.bg.setData('w', tag.text.width)
  }

  private deskAt(p: Point): string | null {
    for (const d of DESKS) {
      const t = d.table
      const onTable = p.x >= t.x && p.x < t.x + t.w && p.y >= t.y && p.y < t.y + t.h
      if (onTable || (d.seat.x === p.x && d.seat.y === p.y)) return d.id
    }
    return null
  }

  // input

  private setHover(s: AgentSprite, on: boolean) {
    s.hovered = on
    this.refreshSelection(false)
    s.label.setBackgroundColor(on ? '#2c283cf0' : '#48506cdd')
    crisp(s.label)
  }

  private onAgentDown(s: AgentSprite, p: Phaser.Input.Pointer) {
    if (!p.leftButtonDown() || s.leaving) return
    this.drag = null
    if (this.isMine(s.id)) {
      if (p.event.shiftKey) {
        if (this.selected.has(s.id)) this.selected.delete(s.id)
        else this.selected.add(s.id)
      } else {
        this.selected = new Set([s.id])
      }
      if ((p.event as MouseEvent).detail >= 2) this.callbacks?.onOpenAgent(s.id)
      this.refreshSelection()
      if (this.selected.size === 1) this.follow(s.id)
      return
    }
    const click = this.peerClick(s)
    if (click.reachableBy.length) {
      this.callbacks?.onPeerClick(click)
      return
    }
    // Not within reach: walk my agent over; the proximity menu opens when it arrives.
    if (!this.selected.size) {
      const first = [...this.sprites.values()].filter((m) => this.isMine(m.id) && !m.leaving).sort((a, b) => a.id.localeCompare(b.id))[0]
      if (!first) {
        this.callbacks?.onPeerClick(click)
        return
      }
      this.selected = new Set([first.id])
      this.refreshSelection()
    }
    this.walkSelectedTo(s.id)
  }

  private setupInput() {
    this.input.mouse?.disableContextMenu()
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      // Phaser cancels the mousedown default, so the canvas host never gets focus by itself; keys need it.
      ;(this.game.canvas.parentElement as HTMLElement | null)?.focus({ preventScroll: true })
      if (over.length) return
      const cam = this.cameras.main
      this.drag = {
        start: { x: p.x, y: p.y },
        world: { x: p.worldX, y: p.worldY },
        mode: p.leftButtonDown() ? 'select' : 'pan',
        scroll: { x: cam.scrollX, y: cam.scrollY },
      }
    })
    this.input.on('gameout', () => {
      this.hover.clear()
      this.game.canvas.style.cursor = 'default'
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!this.drag) {
        this.showHover(p, over)
        return
      }
      const cam = this.cameras.main
      if (this.drag.mode === 'pan') {
        if (this.following) this.follow(null)
        cam.setScroll(this.drag.scroll.x - (p.x - this.drag.start.x) / cam.zoom, this.drag.scroll.y - (p.y - this.drag.start.y) / cam.zoom)
        return
      }
      const w = this.drag.world
      // Drag-select box: dark outline + mint wash so it reads on the pastel floor; line width stays 2 screen px.
      const r = { x: Math.min(w.x, p.worldX), y: Math.min(w.y, p.worldY), w: Math.abs(p.worldX - w.x), h: Math.abs(p.worldY - w.y) }
      const px = 1 / cam.zoom
      this.selectBox.clear().fillStyle(0x3f9a67, 0.2).fillRect(r.x, r.y, r.w, r.h)
      this.selectBox.lineStyle(4 * px, 0xfefaf2, 0.9).strokeRect(r.x, r.y, r.w, r.h)
      this.selectBox.lineStyle(2 * px, 0x2f6b4a, 1).strokeRect(r.x, r.y, r.w, r.h)
    })
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const drag = this.drag
      this.drag = null
      this.selectBox.clear()
      if (!drag || drag.mode === 'pan') return
      const moved = Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > 6
      if (moved) {
        const x0 = Math.min(drag.world.x, p.worldX)
        const x1 = Math.max(drag.world.x, p.worldX)
        const y0 = Math.min(drag.world.y, p.worldY)
        const y1 = Math.max(drag.world.y, p.worldY)
        const inside = [...this.sprites.values()].filter(
          (s) => this.isMine(s.id) && !s.leaving && s.feet.x >= x0 && s.feet.x <= x1 && s.feet.y >= y0 && s.feet.y <= y1,
        )
        if (!p.event.shiftKey) this.selected.clear()
        inside.forEach((s) => this.selected.add(s.id))
        this.refreshSelection()
        return
      }
      const tile = tileOf({ x: p.worldX, y: p.worldY + 6 })
      if (this.data_.pickingDesk) {
        const desk = this.deskAt(tile)
        const owner = desk ? this.data_.desks[desk] : undefined
        if (desk && !owner) this.callbacks?.onDeskPick(desk)
        else if (desk && owner && owner !== this.data_.me) this.callbacks?.onDeskTaken(desk, owner)
        return
      }
      if (this.isDoor(tile)) {
        this.goToDoor()
        return
      }
      // Any other click is a new destination: forget a pending trip to the door.
      this.doorIntent = null
      this.moveSelectedTo(tile)
    })
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      // Trackpads send many small deltas, mice a few big ones; scale by the delta so both feel the same.
      this.zoomBy(Math.exp(-Phaser.Math.Clamp(dy, -200, 200) * 0.0012), { x: p.x, y: p.y })
    })
    const keys = this.input.keyboard
    keys?.on('keydown-H', () => this.sendSelectedHome())
    keys?.on('keydown-ESC', () => {
      this.selected.clear()
      this.refreshSelection()
    })
    if (keys) {
      const K = Phaser.Input.Keyboard.KeyCodes
      const add = (...codes: number[]) => codes.map((c) => keys.addKey(c, true, false))
      this.keys = { up: add(K.W, K.UP), down: add(K.S, K.DOWN), left: add(K.A, K.LEFT), right: add(K.D, K.RIGHT) }
      keys.on('keydown-E', () => this.openNearby())
      keys.on('keydown-F', () => this.follow(this.selected.size === 1 ? [...this.selected][0] : null))
    }
  }

  /** Cursor + tile outline: tells the owner what a click will do before they click. */
  private showHover(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    const canvas = this.game.canvas
    this.hover.clear()
    if (over.length) {
      canvas.style.cursor = 'pointer'
      return
    }
    const t = tileOf({ x: p.worldX, y: p.worldY + 6 })
    if (this.data_.pickingDesk) {
      const desk = this.deskAt(t)
      canvas.style.cursor = desk && !this.data_.desks[desk] ? 'pointer' : 'default'
      return
    }
    if (this.isDoor(t) && [...this.sprites.keys()].some((id) => this.isMine(id))) {
      canvas.style.cursor = 'pointer'
      this.hover.lineStyle(2, 0xf5a524, 0.95).fillStyle(0xf5a524, 0.18)
      this.hover.fillRoundedRect((SPAWN.x - 1) * TILE + 2, (SPAWN.y - 2) * TILE + 2, 3 * TILE - 4, 3 * TILE - 4, 8)
        .strokeRoundedRect((SPAWN.x - 1) * TILE + 2, (SPAWN.y - 2) * TILE + 2, 3 * TILE - 4, 3 * TILE - 4, 8)
      return
    }
    if (!this.selected.size || t.x < 0 || t.y < 0 || t.x >= COLS || t.y >= ROWS) {
      canvas.style.cursor = 'default'
      return
    }
    const ok = walkable(t.x, t.y)
    canvas.style.cursor = ok ? 'pointer' : 'not-allowed'
    this.hover.lineStyle(2, ok ? 0x70a65b : 0xce8262, 0.9).fillStyle(ok ? 0x70a65b : 0xce8262, 0.18)
    this.hover.fillRoundedRect(t.x * TILE + 2, t.y * TILE + 2, TILE - 4, TILE - 4, 6).strokeRoundedRect(t.x * TILE + 2, t.y * TILE + 2, TILE - 4, TILE - 4, 6)
  }

  /** One destination marker per walking agent of mine (the latest click wins); a red cross for a click
   *  nobody can reach. */
  private drawFeedback(time: number) {
    const g = this.feedback.clear()
    this.markers = this.markers.filter((m) => {
      const age = time - m.born
      const s = this.sprites.get(m.agentId)
      const arrived = !m.bad && age > 150 && (!s || !s.path.length)
      if (age > (m.bad ? 700 : 15000) || arrived) {
        m.sprite?.destroy()
        return false
      }
      if (!m.bad && this.textures.exists('ui-target')) {
        if (!m.sprite) m.sprite = this.add.sprite(m.x, m.y, 'ui-target').setDepth(3).setScale(1.2).play('ui-target-pulse')
        return true
      }
      const pulse = 1 + 0.12 * Math.sin(age / 140)
      if (m.bad) {
        g.lineStyle(3, 0xce8262, 1 - age / 700)
        g.lineBetween(m.x - 7, m.y - 7, m.x + 7, m.y + 7).lineBetween(m.x - 7, m.y + 7, m.x + 7, m.y - 7)
      } else {
        g.fillStyle(0x70a65b, 0.25).fillEllipse(m.x, m.y, 26 * pulse, 12 * pulse)
        g.lineStyle(2, 0x70a65b, 0.95).strokeEllipse(m.x, m.y, 26 * pulse, 12 * pulse)
      }
      return true
    })
  }

  private mark(agentId: string, p: Point) {
    const c = center(p)
    for (const m of this.markers) if (m.agentId === agentId) m.sprite?.destroy()
    this.markers = this.markers.filter((m) => m.agentId !== agentId)
    this.markers.push({ x: c.x, y: c.y, agentId, born: this.time.now })
  }

  /** Steering: send the selected agents to a tile, spread over nearby free tiles. */
  moveSelectedTo(tile: Point) {
    if (!this.selected.size) return
    const taken = new Set<string>()
    for (const s of this.sprites.values()) {
      if (!this.selected.has(s.id) && s.dest) taken.add(`${s.dest.x},${s.dest.y}`)
    }
    let sent = 0
    for (const id of [...this.selected].sort()) {
      const p = walkable(tile.x, tile.y) ? nearestFree(tile, (x, y) => !taken.has(`${x},${y}`)) : null
      const from = this.sprites.get(id)
      if (!p || !from) continue
      const here = tileOf(posOf(from))
      if (!findPath(here, p).length && (here.x !== p.x || here.y !== p.y)) continue
      from.drivenUntil = 0
      taken.add(`${p.x},${p.y}`)
      this.walkTo(from, p) // start walking now; the world echo arrives a moment later
      this.mark(id, p)
      this.sendMove(from, p)
      sent++
    }
    if (!sent) {
      const c = center(tile)
      this.markers = this.markers.filter((m) => !m.bad)
      this.markers.push({ x: c.x, y: c.y, agentId: '', born: this.time.now, bad: true })
    }
  }

  /** Quick trips ("Pantry", "Manager room"): walk to the closest reachable free tile around a spot in that room,
   *  so the buttons keep working when the map art changes. */
  goToPlace(spot: Point) {
    const mine = [...this.selected].map((id) => this.sprites.get(id)).find(Boolean)
    const from = mine ? tileOf(posOf(mine)) : null
    const p = nearestFree(spot, (x, y) => !from || (from.x === x && from.y === y) || findPath(from, { x, y }).length > 0)
    if (p) this.moveSelectedTo(p)
  }

  sendSelectedHome() {
    for (const id of this.selected) {
      const s = this.sprites.get(id)
      if (s) s.sent = null
      this.callbacks?.onMove(id, { kind: 'desk' })
    }
  }

  /** Report a click-to-walk target; until the world echoes it back, older echoes don't pull the agent around. */
  private sendMove(s: AgentSprite, p: Point) {
    s.sent = { tile: p, until: this.time.now + 3000 }
    this.callbacks?.onMove(s.id, { kind: 'tile', x: p.x, y: p.y })
  }

  /** Steering towards another agent ("Walk over"). */
  walkSelectedTo(agentId: string) {
    const target = this.sprites.get(agentId)
    if (!target) return
    const t = tileOf(posOf(target))
    const taken = new Set<string>([`${t.x},${t.y}`])
    for (const id of [...this.selected].sort()) {
      const me = this.sprites.get(id)
      if (!me) continue
      const p = nearestFree(t, (x, y) => !taken.has(`${x},${y}`), true)
      if (p) {
        taken.add(`${p.x},${p.y}`)
        me.drivenUntil = 0
        this.walkTo(me, p)
        this.mark(id, p)
        // Send the exact tile, so the world's echo matches the local walk instead of re-resolving "near".
        this.sendMove(me, p)
      }
    }
  }
}

// The static 3D room built from layout3d.json: one InstancedMesh per model mesh, walls grouped by the side they face
// so the ones facing the camera can be lowered, and the glass doors as animated objects.

import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { COLS, ROWS } from '../layout'
import { inkMaterial, wantsOutline } from './look'

export interface Placement {
  model: string
  x: number
  z: number
  rot?: number
  y?: number
  facing?: string
  panelGap?: boolean
}
export interface Layout3d {
  objects: Placement[]
  walls: Placement[]
}

/** Tile coordinates (tile centre = x + 0.5) to world space: the room is centred on the origin. */
export const toWorld = (x: number, y: number) => new THREE.Vector3(x - COLS / 2, 0, y - ROWS / 2)

const DOOR_MODELS = new Set(['door-glass', 'door-glass-double'])
const DOOR_REACH = 1.6 // tiles from a door's centre that open it
const CUT_AWAY = 0.6 // lower a wall whose outside faces the camera this much (dot of its outward normal)
const WALL_OUT: Record<string, [number, number]> = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] }

/** Outline every mesh of a cloned model (characters, doors) with an ink child sharing its geometry. */
export function outline(root: THREE.Object3D, model: string) {
  const meshes: THREE.Mesh[] = []
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && wantsOutline(model, o.material as THREE.Material)) meshes.push(o)
  })
  for (const m of meshes) {
    const ink = new THREE.Mesh(m.geometry, inkMaterial())
    ink.userData.ink = true
    m.add(ink)
  }
}

interface Door {
  mixer: THREE.AnimationMixer
  clips: THREE.AnimationClip[]
  at: THREE.Vector2
  open: boolean
}

export class Room {
  private walls: { group: THREE.Group; out: THREE.Vector2 }[] = []
  private doors: Door[] = []
  private scene: THREE.Scene
  private models: Map<string, GLTF>

  constructor(scene: THREE.Scene, models: Map<string, GLTF>) {
    this.scene = scene
    this.models = models
  }

  build(layout: Layout3d) {
    const byModel = (list: Placement[]) => list.reduce<Record<string, Placement[]>>((m, p) => ((m[p.model] ||= []).push(p), m), {})
    for (const [model, list] of Object.entries(byModel(layout.objects))) {
      if (DOOR_MODELS.has(model)) for (const p of list) this.door(p)
      else this.instance(this.scene, model, list, !model.startsWith('floor'))
    }
    for (const [facing, out] of Object.entries(WALL_OUT)) {
      const list = layout.walls.filter((w) => w.facing === facing)
      if (!list.length) continue
      const group = new THREE.Group()
      this.scene.add(group)
      for (const [model, l] of Object.entries(byModel(list))) this.instance(group, model, l, true)
      this.walls.push({ group, out: new THREE.Vector2(...out) })
    }
  }

  /** Per frame: lower the walls facing the camera, open the doors someone stands near. */
  update(dt: number, camDir: THREE.Vector2, people: Iterable<THREE.Vector2>) {
    for (const w of this.walls) {
      const want = w.out.dot(camDir) > CUT_AWAY ? 0.1 : 1
      w.group.scale.y += (want - w.group.scale.y) * Math.min(1, dt * 8)
    }
    const near = [...people]
    for (const d of this.doors) {
      const open = near.some((p) => p.distanceTo(d.at) <= DOOR_REACH)
      if (open !== d.open) {
        d.open = open
        const clip = d.clips.find((c) => c.name === (open ? 'open' : 'close'))
        if (clip) {
          d.mixer.stopAllAction()
          const a = d.mixer.clipAction(clip)
          a.setLoop(THREE.LoopOnce, 1)
          a.clampWhenFinished = true
          a.reset().play()
        }
      }
      d.mixer.update(dt)
    }
  }

  /** Glass doors are separate objects with their own open/close clips (leaves pivot at the hinges). */
  private door(p: Placement) {
    const gltf = this.models.get(p.model)
    if (!gltf) return
    const root = gltf.scene.clone(true)
    root.position.copy(toWorld(p.x, p.z)).setY(p.y ?? 0)
    root.rotation.y = ((p.rot ?? 0) * Math.PI) / 180
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true
    })
    outline(root, p.model)
    this.scene.add(root)
    this.doors.push({ mixer: new THREE.AnimationMixer(root), clips: gltf.animations, at: new THREE.Vector2(p.x, p.z), open: false })
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
      if (wantsOutline(model, o.material as THREE.Material)) {
        const ink = new THREE.InstancedMesh(o.geometry, inkMaterial(), ps.length)
        ink.instanceMatrix = im.instanceMatrix
        parent.add(ink)
      }
    })
  }
}

// The drawn look of the 3D Office: flat toon shading in a few steps and a dark ink outline, like the 2D pixel art
// (whose sprites all carry a #48506c outline). Applied to Codex's models at load time; the models stay plain glTF.

import * as THREE from 'three'

const INK = 0x48506c
const OUTLINE = 0.022 // tiles

let gradient: THREE.DataTexture | null = null
/** Three light steps (shadow, mid, lit), nearest-sampled so the bands stay crisp. */
function toonGradient() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([150, 205, 255]), 3, 1, THREE.RedFormat)
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter
    gradient.generateMipmaps = false
    gradient.needsUpdate = true
  }
  return gradient
}

const toonCache = new Map<string, THREE.Material>()
/** A toon copy of a glTF material, shared by every mesh that used the original. */
export function toon(m: THREE.Material): THREE.Material {
  const hit = toonCache.get(m.uuid)
  if (hit) return hit
  let out: THREE.Material = m
  if (m instanceof THREE.MeshStandardMaterial) {
    out = new THREE.MeshToonMaterial({
      map: m.map, color: m.color, vertexColors: m.vertexColors, transparent: m.transparent, opacity: m.opacity,
      emissive: m.emissive, emissiveMap: m.emissiveMap, emissiveIntensity: m.emissiveIntensity, side: m.side,
      alphaTest: m.alphaTest, depthWrite: m.depthWrite, gradientMap: toonGradient(),
    })
    out.name = m.name
  }
  toonCache.set(m.uuid, out)
  return out
}

let ink: THREE.MeshBasicMaterial | null = null
/** Inverted hull: the back faces pushed out along the normals, before any instance matrix is applied, so one
 *  material outlines plain and instanced meshes alike. */
export function inkMaterial() {
  if (!ink) {
    ink = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })
    ink.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3( position ) + normalize( normal ) * ${OUTLINE.toFixed(4)};`,
      )
    }
    ink.customProgramCacheKey = () => 'office-ink'
  }
  return ink
}

/** Flat decor, glass and the floor get no outline: it would draw lines across the room. */
export function wantsOutline(model: string, material: THREE.Material) {
  if (material.transparent) return false
  return !/^(floor|rug|sun-patch|door-mat|card-mat|ludo-mat|floor-sticker|cable-cover|glass|window-wall)/.test(model)
}

export function disposeLook() {
  for (const m of toonCache.values()) m.dispose()
  toonCache.clear()
  gradient?.dispose()
  gradient = null
  ink?.dispose()
  ink = null
}

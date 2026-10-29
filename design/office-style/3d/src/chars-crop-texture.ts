// Each character GLB embedded the whole 2048×5440 palette-characters.png (all 16 skins), so a browser held 16 copies
// of a ~60 MB texture and the height broke GPUs limited to 4096 px. Every character only samples its own horizontal
// band, so crop each GLB's texture to that band (+ a small margin) and remap its V coordinates. Run after
// chars-build.ts; idempotent (a cropped file is cropped to the same band again).

import { NodeIO } from '@gltf-transform/core'
import { PNG } from 'pngjs'
import { ids, output } from './characters/sprite-shape'

const MARGIN = 4 // px above and below the band, so linear filtering never reads the neighbour's colours

export async function cropCharacterTextures() {
  const io = new NodeIO()
  for (const id of ids) {
    const path = output + id + '.glb'
    const doc = await io.read(path)
    const root = doc.getRoot()
    const textures = root.listTextures()
    if (textures.length !== 1) throw new Error(`${id}: expected one texture, found ${textures.length}`)
    const tex = textures[0]
    const png = PNG.sync.read(Buffer.from(tex.getImage()!))
    const prims = root.listMeshes().flatMap((m) => m.listPrimitives()).filter((p) => p.getAttribute('TEXCOORD_0'))
    let top = Infinity
    let bottom = -Infinity
    for (const p of prims) {
      const uv = p.getAttribute('TEXCOORD_0')!
      for (let i = 0; i < uv.getCount(); i++) {
        const y = uv.getElement(i, [])[1] * png.height
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
    }
    const y0 = Math.max(0, Math.floor(top) - MARGIN)
    const y1 = Math.min(png.height, Math.ceil(bottom) + MARGIN)
    const h = y1 - y0
    const out = new PNG({ width: png.width, height: h })
    png.data.copy(out.data, 0, y0 * png.width * 4, y1 * png.width * 4)
    // glTF UVs have their origin at the image's top-left, like PNG rows: v' = (v·H − y0) / h.
    const done = new Set<object>()
    for (const p of prims) {
      const uv = p.getAttribute('TEXCOORD_0')!
      if (done.has(uv)) continue
      done.add(uv)
      for (let i = 0; i < uv.getCount(); i++) {
        const [u, v] = uv.getElement(i, [])
        uv.setElement(i, [u, (v * png.height - y0) / h])
      }
    }
    tex.setImage(new Uint8Array(PNG.sync.write(out)))
    await io.write(path, doc)
    console.log(`${id}: texture ${png.width}×${png.height} → ${png.width}×${h} (rows ${y0}–${y1})`)
  }
}

if (import.meta.main) await cropCharacterTextures()

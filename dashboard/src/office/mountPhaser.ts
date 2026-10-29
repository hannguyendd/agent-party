// The 2D Office: a Phaser game holding the OfficeScene, sized to its host (ADR 0004 renderer contract).

import Phaser from 'phaser'
import { OfficeScene } from './OfficeScene'
import type { MountOptions, MountedRenderer } from './renderer'

export function mountPhaser({ host, data, callbacks, onReady }: MountOptions): MountedRenderer {
  // Draw at the screen's real resolution: a canvas sized in CSS pixels gets stretched on retina screens, and the
  // pixel-art plate (scaled down with nearest sampling to fit) loses half its pixels on the way. Capped at 2x.
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const scene = new OfficeScene()
  scene.dpr = dpr
  scene.setSceneData(data)
  scene.callbacks = callbacks
  scene.onReady = onReady
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent: host, width: host.clientWidth * dpr, height: host.clientHeight * dpr,
    backgroundColor: '#e6ddd8', pixelArt: true, roundPixels: true, antialias: false,
    scene: [scene], render: { pixelArt: true, antialias: false, roundPixels: true },
    // We size the canvas ourselves from the host (ResizeObserver below); RESIZE mode kept the old size when
    // only the host changed (e.g. widening the side column).
    // zoom 1/dpr: the canvas holds dpr × the host's pixels and shows at the host's CSS size (Phaser maps input).
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
    input: { keyboard: { target: host } },
    audio: { noAudio: true },
  })
  const observer = new ResizeObserver(() => {
    const w = host.clientWidth, h = host.clientHeight
    if (!w || !h || (game.scale.width === w * dpr && game.scale.height === h * dpr)) return
    game.scale.resize(w * dpr, h * dpr)
  })
  observer.observe(host)
  return {
    renderer: scene,
    destroy() {
      observer.disconnect()
      scene.callbacks = null
      game.destroy(true)
    },
  }
}

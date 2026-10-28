// The 2D Office: a Phaser game holding the OfficeScene, sized to its host (ADR 0004 renderer contract).

import Phaser from 'phaser'
import { OfficeScene } from './OfficeScene'
import type { MountOptions, MountedRenderer } from './renderer'

export function mountPhaser({ host, data, callbacks, onReady }: MountOptions): MountedRenderer {
  const scene = new OfficeScene()
  scene.setSceneData(data)
  scene.callbacks = callbacks
  scene.onReady = onReady
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent: host, width: host.clientWidth, height: host.clientHeight,
    backgroundColor: '#e6ddd8', pixelArt: true, roundPixels: true, antialias: false,
    scene: [scene], render: { pixelArt: true, antialias: false, roundPixels: true },
    // We size the canvas ourselves from the host (ResizeObserver below); RESIZE mode kept the old size when
    // only the host changed (e.g. widening the side column).
    scale: { mode: Phaser.Scale.NONE },
    input: { keyboard: { target: host } },
    audio: { noAudio: true },
  })
  const observer = new ResizeObserver(() => {
    const w = host.clientWidth, h = host.clientHeight
    if (w && h && (game.scale.width !== w || game.scale.height !== h)) game.scale.resize(w, h)
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

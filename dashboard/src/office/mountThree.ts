// The 3D Office: a three.js scene sized to its host (ADR 0004 renderer contract). Loaded only when someone picks
// the 3D look, so three.js stays out of the 2D bundle.

import { Office3D } from './three/Office3D'
import type { MountOptions, MountedRenderer } from './renderer'

export function mountThree({ host, data, callbacks, onReady, onError }: MountOptions): MountedRenderer {
  const office = new Office3D(host)
  office.callbacks = callbacks
  office.onReady = onReady
  office.onError = onError ?? null
  office.setSceneData(data)
  return { renderer: office, destroy: () => office.destroy() }
}

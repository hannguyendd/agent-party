// Which look draws the Office on this browser (ADR 0004). A per-person preference, so it lives in localStorage;
// 2D is the default and the fallback when 3D can't start.

import { useSyncExternalStore } from 'react'
import type { OfficeTheme } from './renderer'

const KEY = 'office.theme'
const listeners = new Set<() => void>()

export function getOfficeTheme(): OfficeTheme {
  try {
    return localStorage.getItem(KEY) === '3d' ? '3d' : '2d'
  } catch {
    return '2d'
  }
}

export function setOfficeTheme(theme: OfficeTheme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // storage blocked (private window): the choice lasts until reload
  }
  current = theme
  for (const l of listeners) l()
}

let current = getOfficeTheme()

function subscribe(l: () => void) {
  listeners.add(l)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      current = getOfficeTheme()
      l()
    }
  }
  addEventListener('storage', onStorage)
  return () => {
    listeners.delete(l)
    removeEventListener('storage', onStorage)
  }
}

export function useOfficeTheme(): OfficeTheme {
  return useSyncExternalStore(subscribe, () => current)
}

let webgl: boolean | null = null
/** True when this browser can draw WebGL at all; otherwise the 3D option is greyed out. Probed once: every probe
 *  makes a WebGL context, and components call this on each render, so probing each time piled up contexts until
 *  Chrome dropped the oldest one, which was the 3D Office's own. */
export function webglAvailable(): boolean {
  if (webgl === null) {
    try {
      const c = document.createElement('canvas')
      const gl = c.getContext('webgl2') || c.getContext('webgl')
      webgl = !!gl
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch {
      webgl = false
    }
  }
  return webgl
}

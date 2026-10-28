// Character portraits carry different amounts of transparent space (a penguin is shorter than a person), so
// centring the whole 32x48 image leaves most characters sitting low. Crop each portrait to its visible pixels once,
// pad it to a square, and cache the result as a data URL. No art numbers live in code.

import { useEffect, useState } from 'react'

const cache = new Map<string, Promise<string>>()

function trimToSquare(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')
      if (!ctx) return resolve(src)
      ctx.drawImage(img, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height)
      let x0 = width, y0 = height, x1 = -1, y1 = -1
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
          if (data[(y * width + x) * 4 + 3] > 0) {
            if (x < x0) x0 = x
            if (x > x1) x1 = x
            if (y < y0) y0 = y
            if (y > y1) y1 = y
          }
      if (x1 < 0) return resolve(src)
      const w = x1 - x0 + 1, h = y1 - y0 + 1, side = Math.max(w, h)
      const out = document.createElement('canvas')
      out.width = out.height = side
      out.getContext('2d')?.drawImage(c, x0, y0, w, h, Math.floor((side - w) / 2), Math.floor((side - h) / 2), w, h)
      resolve(out.toDataURL())
    }
    img.onerror = () => resolve(src)
    img.src = src
  })
}

/** The portrait cropped to its visible pixels and centred in a square (the original until that is ready). */
export function useTrimmed(src: string): string {
  const [url, setUrl] = useState(src)
  useEffect(() => {
    let live = true
    if (!cache.has(src)) cache.set(src, trimToSquare(src))
    void cache.get(src)!.then((u) => live && setUrl(u))
    return () => { live = false }
  }, [src])
  return url
}

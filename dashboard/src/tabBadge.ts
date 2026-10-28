// The browser tab shows what waits for me: "(3) Taggle Office" and a red dot on the tab icon.

import { useEffect } from 'react'

const BASE_ICON = '/office/ui/favicon.png'
let dotted: { count: number; url: string } | null = null

function iconLink(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  return link
}

/** The favicon with a red dot drawn on it (pixel icon: no smoothing). */
async function iconWithDot(): Promise<string> {
  const img = new Image()
  img.src = BASE_ICON
  await img.decode()
  const size = 64
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.drawImage(img, 0, 0, size, size)
  g.fillStyle = '#ff4d6d'
  g.strokeStyle = '#ffffff'
  g.lineWidth = 5
  g.beginPath()
  g.arc(size - 16, 16, 14, 0, Math.PI * 2)
  g.fill()
  g.stroke()
  return c.toDataURL('image/png')
}

export function useTabBadge(title: string, count: number) {
  useEffect(() => {
    document.title = count > 0 ? `(${count > 99 ? '99+' : count}) ${title}` : title
  }, [title, count])
  useEffect(() => {
    const link = iconLink()
    if (count <= 0) {
      link.href = BASE_ICON
      return
    }
    if (dotted) {
      link.href = dotted.url
      return
    }
    void iconWithDot().then((url) => {
      dotted = { count, url }
      link.href = url
    }).catch(() => {})
  }, [count])
}

// A small popup placed under (or above) the element that opened it, kept inside the window; closes on an outside
// click or Esc. Used by the look and desk pickers.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

export function useAnchoredPopover(anchor: HTMLElement, onClose: () => void, align: 'left' | 'right' = 'left') {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.getBoundingClientRect()
      const w = ref.current?.offsetWidth ?? 300
      const h = ref.current?.offsetHeight ?? 300
      const want = align === 'right' ? a.right - w : a.left
      const left = Math.max(8, Math.min(want, innerWidth - w - 8))
      const below = a.bottom + 6
      setPos({ left, top: below + h > innerHeight - 8 ? Math.max(8, a.top - h - 6) : below })
    }
    place()
    // Its content can grow after it opens (the desk mini-map loads late): place it again when its size changes.
    const ro = new ResizeObserver(place)
    if (ref.current) ro.observe(ref.current)
    addEventListener('resize', place)
    addEventListener('scroll', place, true)
    return () => { ro.disconnect(); removeEventListener('resize', place); removeEventListener('scroll', place, true) }
  }, [anchor, align])
  useEffect(() => {
    const out = (e: MouseEvent) => {
      const t = e.target as Node
      // Clicks on the map pick a desk there; they must not close the desk picker first.
      if (ref.current?.contains(t) || anchor.contains(t) || (t instanceof HTMLCanvasElement)) return
      onClose()
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', out)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc) }
  }, [anchor, onClose])
  const style: CSSProperties = pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }
  return { ref, style }
}

// Pick my desk: a popup under the Desk pill with a mini-map of the office, every desk where it really is. Free desks
// can be picked here or on the big map (outlined in green there while this is open); taken ones say whose they are.
// Without map art (manifest has no map) it falls back to a plain grid.

import { ownerCss } from './skins'
import { useAnchoredPopover } from './popover'
import { COLS, ROWS } from './layout'
import { useMiniMap } from './minimap'

export function DeskPicker({ anchor, deskIds, desks, me, busy, onPick, onClose }: {
  anchor: HTMLElement
  deskIds: string[]
  /** desk id -> owner */
  desks: Record<string, string>
  me: string
  busy?: boolean
  onPick: (id: string) => void
  onClose: () => void
}) {
  const { ref, style } = useAnchoredPopover(anchor, onClose, 'right')
  const free = deskIds.filter((id) => !desks[id]).length
  const map = useMiniMap()
  const placed = map ? deskIds.filter((id) => map.seats[id]) : []
  const desk = (id: string, compact: boolean) => {
    const owner = desks[id]
    const mine = owner === me
    const seat = map?.seats[id]
    return (
      <button key={id} role="option" aria-selected={mine} disabled={busy || (!!owner && !mine)}
        className={mine ? 'is-mine' : owner ? 'is-taken' : 'is-free'}
        style={compact && seat ? { left: `${((seat.x + 0.5) / COLS) * 100}%`, top: `${((seat.y + 0.5) / ROWS) * 100}%` } : undefined}
        title={mine ? `${id}: your desk` : owner ? `${id}: ${owner}'s desk` : `Sit at ${id}`}
        onClick={() => (mine ? onClose() : onPick(id))}>
        <b>{id}</b>
        {!compact && (owner ? <small><i style={{ background: ownerCss(owner) }} />{mine ? 'you' : owner}</small> : <small>free</small>)}
        {compact && owner && <i style={{ background: ownerCss(owner) }} />}
      </button>
    )
  }
  if (map && placed.length) {
    return (
      <div ref={ref} className="o-frame skin-pop desk-pop is-map" role="dialog" aria-label="Pick your desk" style={style}>
        <header><strong>Your desk</strong><span>{free} free · click a green one</span></header>
        <div className="desk-map" role="listbox" style={{ backgroundImage: `url(${map.background})`, aspectRatio: `${COLS} / ${ROWS}` }}>
          {placed.map((id) => desk(id, true))}
        </div>
        <footer className="desk-legend">
          <span><i className="is-free" />Free</span>
          <span><i className="is-mine" />Yours</span>
          <span><i className="is-taken" />Taken</span>
        </footer>
      </div>
    )
  }
  return (
    <div ref={ref} className="o-frame skin-pop desk-pop" role="dialog" aria-label="Pick your desk" style={style}>
      <header><strong>Your desk</strong><span>{free} free · or click one on the map</span></header>
      <div className="desk-grid" role="listbox">
        {deskIds.map((id) => desk(id, false))}
      </div>
    </div>
  )
}

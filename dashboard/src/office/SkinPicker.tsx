// Pick an agent's look: a small popup under the 👕 button that opened it.

import { useAnchoredPopover } from './popover'
import { SKINS } from './skins'

export function SkinPicker({ anchor, name, current, disabled, onPick, onClose }: {
  anchor: HTMLElement
  name: string
  current: string
  disabled?: boolean
  onPick: (skin: string) => void
  onClose: () => void
}) {
  const { ref, style } = useAnchoredPopover(anchor, onClose)
  return (
    <div ref={ref} className="o-frame skin-pop" role="dialog" aria-label={`Look for ${name}`} style={style}>
      <header><strong>Look</strong><span>{name}</span></header>
      <div className="skin-grid" role="listbox">
        {SKINS.map((s) => (
          <button key={s.id} role="option" aria-selected={current === s.id} className={current === s.id ? 'is-active' : ''} disabled={disabled} title={s.label}
            onClick={() => { onPick(s.id); onClose() }}>
            <img src={`office/characters/${s.id}-portrait.png`} width="32" height="48" alt={s.label} />
          </button>
        ))}
      </div>
    </div>
  )
}

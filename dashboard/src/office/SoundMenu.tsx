// 🎵 in the app bar: background music and sound effects, each with on/off and volume.

import { useState } from 'react'
import { playSfx, setSoundSettings, useSoundSettings } from '../sound'
import { useAnchoredPopover } from './popover'

function Panel({ anchor, onClose }: { anchor: HTMLElement; onClose: () => void }) {
  const s = useSoundSettings()
  const { ref, style } = useAnchoredPopover(anchor, onClose, 'right')
  return (
    <div ref={ref} className="o-frame skin-pop sound-pop" role="dialog" aria-label="Sound" style={style}>
      <header><strong>Sound</strong><span>this browser only</span></header>
      <div className="sound-row">
        <label className={`o-switch ${s.music ? 'is-on' : ''}`}>
          <input type="checkbox" checked={s.music} onChange={(e) => setSoundSettings({ music: e.target.checked })} aria-label="Background music" />
          <i />
        </label>
        <span><b>Background music</b><small>A soft lo-fi loop while you work</small></span>
      </div>
      <input className="sound-vol" type="range" min={0} max={1} step={0.05} value={s.musicVolume} disabled={!s.music}
        onChange={(e) => setSoundSettings({ musicVolume: Number(e.target.value) })} aria-label="Music volume" />
      <div className="sound-row">
        <label className={`o-switch ${s.sfx ? 'is-on' : ''}`}>
          <input type="checkbox" checked={s.sfx} onChange={(e) => setSoundSettings({ sfx: e.target.checked })} aria-label="Sound effects" />
          <i />
        </label>
        <span><b>Sound effects</b><small>Task done, approval waiting, new chat, error</small></span>
      </div>
      <input className="sound-vol" type="range" min={0} max={1} step={0.05} value={s.sfxVolume} disabled={!s.sfx}
        onChange={(e) => setSoundSettings({ sfxVolume: Number(e.target.value) })} onPointerUp={() => playSfx('done')} aria-label="Effects volume" />
      <div className="sound-try">
        <span>Try:</span>
        <button disabled={!s.sfx} onClick={() => playSfx('done')}>Done</button>
        <button disabled={!s.sfx} onClick={() => playSfx('attention')}>Needs you</button>
        <button disabled={!s.sfx} onClick={() => playSfx('pop')}>New chat</button>
        <button disabled={!s.sfx} onClick={() => playSfx('error')}>Error</button>
      </div>
    </div>
  )
}

export function SoundMenu() {
  const s = useSoundSettings()
  const [btn, setBtn] = useState<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button ref={setBtn} className={`office-bell office-sound ${open ? 'is-active' : ''} ${s.music ? 'is-playing' : ''}`}
        onClick={() => setOpen((v) => !v)} aria-expanded={open}
        title={s.music ? 'Music on' : s.sfx ? 'Sound effects on' : 'Sound off'} aria-label="Sound">
        <span aria-hidden className="office-sound-glyph">{s.music ? '♫' : s.sfx ? '🔊' : '🔇'}</span>
      </button>
      {open && btn && <Panel anchor={btn} onClose={() => setOpen(false)} />}
    </>
  )
}

// Office sounds, made in the browser with Web Audio (no audio files): short effects when something happens
// (a task done, an approval waiting, an error…) and an optional generated lo-fi loop as background music.
// Settings are a per-browser convenience (localStorage); effects on and music off by default.

import { useSyncExternalStore } from 'react'

export type Sfx = 'done' | 'attention' | 'pop' | 'error' | 'sparkle'

export interface SoundSettings {
  sfx: boolean
  sfxVolume: number // 0..1
  music: boolean
  musicVolume: number // 0..1
}

const KEY = 'office.sound'
const DEFAULTS: SoundSettings = { sfx: true, sfxVolume: 0.6, music: false, musicVolume: 0.35 }

function readSettings(): SoundSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SoundSettings>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

let settings = readSettings()
const listeners = new Set<() => void>()

export function soundSettings(): SoundSettings {
  return settings
}

export function setSoundSettings(patch: Partial<SoundSettings>) {
  settings = { ...settings, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    /* private window: settings last for this page only */
  }
  applyVolumes()
  if (patch.music === true) music.start()
  if (patch.music === false) music.stop()
  listeners.forEach((l) => l())
}

export function useSoundSettings(): SoundSettings {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => settings)
}

// ---- audio graph ----

let ctx: AudioContext | null = null
let sfxGain: GainNode | null = null
let musicGain: GainNode | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  if (!ctx) {
    ctx = new AudioContext()
    sfxGain = ctx.createGain()
    sfxGain.connect(ctx.destination)
    // Music goes through a warm low-pass so it sits behind everything else.
    const warm = ctx.createBiquadFilter()
    warm.type = 'lowpass'
    warm.frequency.value = 1600
    musicGain = ctx.createGain()
    musicGain.connect(warm).connect(ctx.destination)
    applyVolumes()
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  return ctx
}

function applyVolumes() {
  if (!ctx) return
  sfxGain?.gain.setTargetAtTime(settings.sfx ? settings.sfxVolume * 0.5 : 0, ctx.currentTime, 0.05)
  musicGain?.gain.setTargetAtTime(settings.music ? settings.musicVolume * 0.22 : 0, ctx.currentTime, 0.3)
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

/** One soft note: oscillator → envelope → bus. */
function note(bus: AudioNode, midi: number, at: number, dur: number, type: OscillatorType, peak: number, attack = 0.005) {
  const c = ctx!
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.value = hz(midi)
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(peak, at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(bus)
  o.start(at)
  o.stop(at + dur + 0.05)
}

// ---- effects ----

const LAST: Partial<Record<Sfx, number>> = {}

export function playSfx(kind: Sfx) {
  if (!settings.sfx) return
  const c = audio()
  if (!c || !sfxGain) return
  // A burst of notifications plays one sound, not ten.
  const nowMs = performance.now()
  if ((LAST[kind] ?? 0) > nowMs - 700) return
  LAST[kind] = nowMs
  const t = c.currentTime + 0.02
  const bus = sfxGain
  switch (kind) {
    case 'done': // rising major arpeggio: something finished
      ;[72, 76, 79, 84].forEach((m, i) => note(bus, m, t + i * 0.07, 0.35, 'triangle', 0.5))
      break
    case 'attention': // two-tone chime, twice: something waits for you
      ;[0, 0.32].forEach((d) => { note(bus, 81, t + d, 0.4, 'sine', 0.55); note(bus, 76, t + d + 0.13, 0.5, 'sine', 0.5) })
      break
    case 'pop': // soft blip: someone started talking / a new chat
      note(bus, 79, t, 0.12, 'square', 0.18)
      note(bus, 86, t + 0.05, 0.16, 'triangle', 0.35)
      break
    case 'error': // low falling buzz
      note(bus, 52, t, 0.25, 'sawtooth', 0.22)
      note(bus, 47, t + 0.16, 0.4, 'sawtooth', 0.22)
      break
    case 'sparkle': // recap ready
      ;[84, 88, 91, 96, 91].forEach((m, i) => note(bus, m, t + i * 0.05, 0.25, 'sine', 0.3))
      break
  }
}

// ---- background music: a generated lo-fi loop ----

// Fmaj7 – Em7 – Dm7 – Cmaj7, two bars each; melody from C major pentatonic.
const CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]
const PENTA = [72, 74, 76, 79, 81, 84]
const BPM = 74

const music = (() => {
  let timer: ReturnType<typeof setInterval> | null = null
  let nextTime = 0
  let step = 0 // eighth notes
  let lastMelody = 2

  function hat(at: number, peak: number) {
    const c = ctx!
    const len = Math.floor(c.sampleRate * 0.05)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = c.createBufferSource()
    src.buffer = buf
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 7000
    const g = c.createGain()
    g.gain.value = peak
    src.connect(hp).connect(g).connect(musicGain!)
    src.start(at)
  }

  function schedule() {
    const c = ctx!
    const eighth = 60 / BPM / 2
    while (nextTime < c.currentTime + 0.3) {
      const bar = Math.floor(step / 8)
      const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length]
      const inBar = step % 8
      const bus = musicGain!
      if (inBar === 0 && bar % 2 === 0) chord.forEach((m) => note(bus, m, nextTime, eighth * 16, 'triangle', 0.16, 0.6))
      if (inBar === 0 || inBar === 4) note(bus, chord[0] - 12, nextTime, eighth * 3, 'sine', 0.5, 0.02)
      if (inBar % 2 === 1) hat(nextTime + eighth * 0.08, 0.05) // a little swing
      if (Math.random() < (inBar % 2 ? 0.18 : 0.38)) {
        lastMelody = Math.max(0, Math.min(PENTA.length - 1, lastMelody + Math.round((Math.random() - 0.5) * 3)))
        note(bus, PENTA[lastMelody], nextTime, eighth * 2.5, 'square', 0.05, 0.01)
        note(bus, PENTA[lastMelody] - 12, nextTime, eighth * 2.5, 'sine', 0.12, 0.01)
      }
      nextTime += eighth
      step = (step + 1) % (8 * 8)
    }
  }

  return {
    start() {
      const c = audio()
      if (!c || timer) return
      applyVolumes()
      nextTime = c.currentTime + 0.1
      step = 0
      timer = setInterval(schedule, 100)
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
      applyVolumes()
    },
  }
})()

// Music that was on keeps playing after a reload. Browsers only allow sound after the page is clicked or a key is
// pressed: try now, and if the browser holds the audio back, start on the first click / key.
if (typeof window !== 'undefined' && settings.music) {
  const kick = () => {
    music.start()
    if (ctx && ctx.state === 'running') {
      removeEventListener('pointerdown', kick, true)
      removeEventListener('keydown', kick, true)
    }
  }
  addEventListener('pointerdown', kick, true)
  addEventListener('keydown', kick, true)
  setTimeout(kick, 0)
}

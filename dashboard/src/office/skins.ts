// Skins an owner can pick for an agent (CONTEXT.md "Skin"). Ids match the world server's SKINS.
// Sprite sheets come from the manifest; a skin without one renders as a coloured token with an emoji face.

export interface SkinInfo {
  id: string
  label: string
  emoji: string
  color: number
}

export const SKINS: SkinInfo[] = [
  { id: 'dev-hoodie', label: 'Dev (hoodie)', emoji: '🧑‍💻', color: 0x3b82f6 },
  { id: 'designer', label: 'Designer', emoji: '👩‍🎨', color: 0xf97316 },
  { id: 'lead', label: 'Tech lead', emoji: '🧔', color: 0x64748b },
  { id: 'shiba', label: 'Shiba', emoji: '🐕', color: 0xd97706 },
  { id: 'cat', label: 'Cat', emoji: '🐱', color: 0xa16207 },
  { id: 'penguin', label: 'Penguin', emoji: '🐧', color: 0x1e293b },
  { id: 'alien', label: 'Alien', emoji: '👽', color: 0x22c55e },
  { id: 'robot', label: 'Robot', emoji: '🤖', color: 0x94a3b8 },
]
export const SKIN_BY_ID: Record<string, SkinInfo> = Object.fromEntries(SKINS.map((s) => [s.id, s]))

/** Sprite sheet layout from the asset brief: 4 columns x 5 rows of 32x48 frames. Sizes on the map are given
 *  relative to this frame. */
export const CHAR_FRAME = { width: 32, height: 48 }
/** The same layout drawn natively at 48x72 (manifest `characters48`); feet touch y=70, so the bottom edge of
 *  row 70 (71) is the anchor. Preferred when present. */
export const CHAR_FRAME_48 = { width: 48, height: 72, foot: 71 }
/** On-map size relative to a 32x48 frame: people stand ~1.5x that next to the furniture (= the 48x72 sheets at 1:1). */
export const CHAR_SCALE = 1.5
export const CHAR_ANIMS = {
  'walk-down': [0, 1, 2, 3],
  'walk-left': [4, 5, 6, 7], // walk-right mirrors this row
  'walk-up': [8, 9, 10, 11],
  'sit-down': [12],
  'sit-left': [13],
  'sit-up': [14],
  wave: [15],
  type: [16, 17],
  idle: [18, 19],
} as const

/** Stable colour per owner (CONTEXT.md "Owner colour"). */
export function ownerHue(owner: string): number {
  let h = 0
  for (const ch of owner) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}
export const ownerCss = (owner: string) => `hsl(${ownerHue(owner)} 70% 50%)`

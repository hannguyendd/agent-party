// Pixel icons drawn for the Office (public/office/ui, listed under "ui" in manifest.json).

export type IconName =
  | 'office' | 'agents' | 'approvals' | 'approvals-pending' | 'directory' | 'settings'
  | 'zoom-in' | 'zoom-out' | 'fit' | 'close' | 'send' | 'stop' | 'takeover' | 'handback' | 'fork'
  | 'inject' | 'inquiry' | 'assignment' | 'party' | 'recap' | 'host' | 'desk' | 'back'
  | 'notifications-on' | 'online' | 'away'
  | 'attach' | 'image' | 'file' | 'pantry' | 'mention' | 'question' | 'search' | 'keyboard' | 'new-chat'
  | 'people' | 'clock' | 'check'

export function Icon({ name, size = 16, className, label }: { name: IconName; size?: 16 | 32; className?: string; label?: string }) {
  return (
    <img
      src={`office/ui/${name}.png`}
      srcSet={`office/ui/${name}.png 1x, office/ui/${name}@2x.png 2x`}
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      className={`o-icon ${className ?? ''}`}
      draggable={false}
    />
  )
}

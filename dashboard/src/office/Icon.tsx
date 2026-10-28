// Pixel icons drawn for the Office (public/office/ui, listed under "ui" in manifest.json).

export type IconName =
  | 'office' | 'agents' | 'approvals' | 'approvals-pending' | 'directory' | 'settings'
  | 'zoom-in' | 'zoom-out' | 'fit' | 'close' | 'send' | 'stop' | 'takeover' | 'handback' | 'fork'
  | 'inject' | 'inquiry' | 'assignment' | 'party' | 'recap' | 'host' | 'desk' | 'back'
  | 'notifications-on' | 'online' | 'away'

export function Icon({ name, size = 16, className, label }: { name: IconName; size?: number; className?: string; label?: string }) {
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

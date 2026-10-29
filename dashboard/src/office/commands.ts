// Commands from the quick search and keyboard shortcuts to whichever screen handles them (a window event, so the
// palette doesn't need a handle on Office state).

import { useEffect } from 'react'

export type OfficeCommand =
  | { type: 'bell' }
  | { type: 'new-agent' }
  | { type: 'message'; agentId?: string }
  | { type: 'find'; agentId: string }
  | { type: 'whats-new' }

const EVENT = 'office-command'

export function officeCommand(cmd: OfficeCommand) {
  // After a screen change the Office mounts first, then hears the command.
  setTimeout(() => window.dispatchEvent(new CustomEvent<OfficeCommand>(EVENT, { detail: cmd })), 0)
}

export function useOfficeCommand(handler: (cmd: OfficeCommand) => void) {
  useEffect(() => {
    const on = (e: Event) => handler((e as CustomEvent<OfficeCommand>).detail)
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [handler])
}

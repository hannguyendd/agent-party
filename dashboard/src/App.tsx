import { Suspense, lazy, useCallback, useState } from 'react'
import SettingsView from './office/SettingsView'
import { useLiveState } from './useLiveState'
import { useApprovalNotifications } from './useNotifications'

// Phaser is large; load it only when the Office opens.
const OfficeView = lazy(() => import('./office/OfficeView'))

/** Side-column tab on the Office screen. */
export type SideTab = 'agents' | 'chats' | 'approvals'
export type SettingsSection = 'agents' | 'mesh' | 'notifications'

/** Two screens: the Office, where all daily work happens, and Settings for configuration. */
export type View = { kind: 'office'; side?: SideTab } | { kind: 'settings'; section?: SettingsSection; agentId?: string }

export default function App() {
  const [view, setView] = useState<View>({ kind: 'office' })
  // The conversation open in the Office side column; its history is loaded like any opened conversation.
  const [openConv, setOpenConv] = useState<string | null>(null)
  const { state, setNode, clearOfficeError } = useLiveState(view.kind === 'office' ? openConv : null)

  // A click on a browser notification opens that conversation in the Office.
  const openApproval = useCallback((a: { conversation_id: string }) => {
    setOpenConv(a.conversation_id)
    setView({ kind: 'office', side: 'approvals' })
  }, [])
  useApprovalNotifications(state.approvals, openApproval)

  if (view.kind === 'settings') return <SettingsView state={state} view={view} go={setView} setNode={setNode} />
  return (
    <div className="h-full">
      <Suspense fallback={<div className="grid h-full place-items-center text-xs text-muted">Opening the office…</div>}>
        <OfficeView state={state} view={view} go={setView} clearError={clearOfficeError} openConv={openConv} setOpenConv={setOpenConv} />
      </Suspense>
    </div>
  )
}

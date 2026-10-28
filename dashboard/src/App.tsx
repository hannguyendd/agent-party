import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { api, type SetupState } from './api'
import SetupView from './office/SetupView'
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
  const { state, setNode, clearOfficeError, refetchAll } = useLiveState(view.kind === 'office' ? openConv : null)
  // First run: until this machine has joined (owner + office server), show the web setup instead of the Office.
  const [setup, setSetup] = useState<SetupState | null>(null)
  // After connecting in this session, stay on the setup screen to show the status until "Continue".
  const [justJoined, setJustJoined] = useState(false)
  useEffect(() => {
    api.setup().then(setSetup).catch(() => {})
  }, [state.connected])
  const preview = new URLSearchParams(location.search).has('preview')
  const onSetupSaved = (s: SetupState) => {
    if (!setup?.configured) setJustJoined(true)
    setSetup(s)
    void refetchAll().catch(() => {})
  }

  // A click on a browser notification opens that conversation in the Office.
  const openApproval = useCallback((a: { conversation_id: string }) => {
    setOpenConv(a.conversation_id)
    setView({ kind: 'office', side: 'approvals' })
  }, [])
  useApprovalNotifications(state.approvals, openApproval)

  if (!preview && setup && (!setup.configured || justJoined))
    return <SetupView state={state} setup={setup} onSaved={onSetupSaved} onContinue={() => setJustJoined(false)} />
  if (view.kind === 'settings')
    return <SettingsView state={state} view={view} go={setView} setNode={setNode} setup={setup} onSetupSaved={onSetupSaved} />
  return (
    <div className="h-full">
      <Suspense fallback={<div className="grid h-full place-items-center text-xs text-muted">Opening the office…</div>}>
        <OfficeView state={state} view={view} go={setView} clearError={clearOfficeError} openConv={openConv} setOpenConv={setOpenConv} />
      </Suspense>
    </div>
  )
}

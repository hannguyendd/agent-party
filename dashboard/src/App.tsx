import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { api, type SetupState } from './api'
import SetupView from './office/SetupView'
import SettingsView from './office/SettingsView'
import { useLiveState } from './useLiveState'
import { useBrowserNotifications } from './useNotifications'
import { notificationTarget } from './office/nav'
import { useNotificationText } from './office/people'
import OfflineScreen from './office/OfflineScreen'
import HistoryView from './office/HistoryView'

// Phaser is large; load it only when the Office opens.
const OfficeView = lazy(() => import('./office/OfficeView'))

/** Side-column tab on the Office screen. */
export type SideTab = 'agents' | 'chats' | 'approvals'
export type SettingsSection = 'agents' | 'mesh' | 'notifications'

/** Three screens: the Office, where all daily work happens; History, every past conversation in full; and
 *  Settings for configuration. `conv` opens that conversation. */
export type View =
  | { kind: 'office'; side?: SideTab; conv?: string }
  | { kind: 'history'; conv?: string }
  | { kind: 'settings'; section?: SettingsSection; agentId?: string }

export default function App() {
  const [view, setView] = useState<View>({ kind: 'office' })
  // The conversation open in the Office side column (or on History); its messages are loaded like any opened one.
  const [openConv, setOpenConv] = useState<string | null>(null)
  const go = useCallback((v: View) => {
    if ((v.kind === 'office' || v.kind === 'history') && v.conv) setOpenConv(v.conv)
    setView(v)
  }, [])
  const { state, setNode, clearOfficeError, refetchAll } = useLiveState(view.kind !== 'settings' ? openConv : null)
  // First run: until this machine has joined (owner + office server), show the web setup instead of the Office.
  const [setup, setSetup] = useState<SetupState | null>(null)
  // After connecting in this session, stay on the setup screen to show the status until "Continue".
  const [justJoined, setJustJoined] = useState(false)
  useEffect(() => {
    api.setup().then(setSetup).catch(() => {})
  }, [state.connected])
  const preview = new URLSearchParams(location.search).has('preview')
  const org = state.office?.org
  useEffect(() => {
    document.title = org ? `${org} Office` : 'Agent Mesh'
  }, [org])
  const onSetupSaved = (s: SetupState) => {
    if (!setup?.configured) setJustJoined(true)
    setSetup(s)
    void refetchAll().catch(() => {})
  }

  // Browser notifications while the tab is in the background; a click opens what it is about.
  const noteText = useNotificationText(state)
  const openNote = useCallback((n: Parameters<typeof notificationTarget>[0]) => go(notificationTarget(n)), [go])
  useBrowserNotifications(state.notifications, noteText, openNote)

  // Offline (chosen at log out or at the door): ask to come back. Refreshing doesn't change it.
  if (!preview && setup?.configured && state.online === false) return <OfflineScreen org={org} />
  if (!preview && setup && (!setup.configured || justJoined))
    return <SetupView state={state} setup={setup} onSaved={onSetupSaved} onContinue={() => setJustJoined(false)} />
  if (view.kind === 'history')
    return <HistoryView state={state} view={view} go={go} openConv={openConv} setOpenConv={setOpenConv} />
  if (view.kind === 'settings')
    return <SettingsView state={state} view={view} go={go} setNode={setNode} setup={setup} onSetupSaved={onSetupSaved} />
  return (
    <div className="h-full">
      <Suspense fallback={<div className="grid h-full place-items-center text-xs text-muted">Opening the office…</div>}>
        <OfficeView state={state} view={view as Extract<View, { kind: 'office' }>} go={go} clearError={clearOfficeError} openConv={openConv} setOpenConv={setOpenConv} />
      </Suspense>
    </div>
  )
}

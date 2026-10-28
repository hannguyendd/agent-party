// Where things lead in the app (plain helpers; components stay in .tsx files).

import type { AppNotification } from '../api'
import type { View } from '../App'

/** A notification opens its conversation (in the Approvals tab when it asks for a decision), else the Approvals tab. */
export function notificationTarget(n: AppNotification): View {
  const side = n.kind === 'approval' || n.kind === 'assignment' ? 'approvals' : 'chats'
  return n.conversation_id ? { kind: 'office', side, conv: n.conversation_id } : { kind: 'office', side: 'approvals' }
}

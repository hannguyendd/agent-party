// How conversation states read in the Office (chips in the chat header and the Chats list).

import type { ConversationStatus } from '../api'

export const STATUS: Record<ConversationStatus, { label: string; tone: 'run' | 'wait' | 'idle' | 'done' | 'err' }> = {
  idle: { label: 'Idle', tone: 'idle' },
  running: { label: 'Working', tone: 'run' },
  awaiting_approval: { label: 'Needs approval', tone: 'wait' },
  awaiting_owner: { label: 'Waiting for you', tone: 'wait' },
  interrupted: { label: 'Stopped', tone: 'idle' },
  done: { label: 'Done', tone: 'done' },
  error: { label: 'Error', tone: 'err' },
}

export const ACTIVE_STATUSES: ConversationStatus[] = ['running', 'awaiting_approval', 'awaiting_owner']
export const NEEDS_YOU: ConversationStatus[] = ['awaiting_approval', 'awaiting_owner']

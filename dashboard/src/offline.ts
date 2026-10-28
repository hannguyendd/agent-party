// Online / offline for this owner (node-server presence.py). Offline: agents leave the Office and peers can't reach
// them; the node keeps serving this page, which then asks to go online. Survives refresh and restarts.

import { api } from './api'

export const goOffline = () => api.setPresence(false)
export const goOnline = () => api.setPresence(true)

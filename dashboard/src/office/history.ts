// Plain helpers for the History page.

import type { Conversation, Message } from '../api'
import { plainPreview } from './render-md'

/** "Today", "Yesterday", a weekday this week, else the date. */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((start(now) - start(d)) / 86400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' })
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })
}

/** The conversation as Markdown: who said what and when; tool calls as one line each. */
export function conversationMarkdown(
  conv: Conversation,
  messages: Message[],
  nameOfAgent: (id: string) => string,
  nameOf: (id: string) => string | null,
): string {
  const mine = nameOfAgent(conv.agent_id)
  const peer = conv.peer_agent_id ? nameOfAgent(conv.peer_agent_id) : null
  const title = conv.topic || plainPreview(conv.title, nameOf) || 'Conversation'
  const out = [
    `# ${title}`,
    '',
    `- Agents: ${mine}${peer ? ` ${conv.direction === 'inbound' ? '←' : '→'} ${peer}` : ''}`,
    `- Started: ${new Date(conv.created_at).toLocaleString()}`,
    `- Status: ${conv.status}, ${conv.turn_count} turns`,
    '',
  ]
  const speaker = (m: Message) => (m.role === 'owner' ? 'You' : m.role === 'peer' ? peer ?? 'Peer' : m.role === 'agent' ? mine : 'System')
  for (const m of messages) {
    const at = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (m.kind === 'text' && m.content.trim()) out.push(`### ${speaker(m)} · ${at}`, '', m.content.trim(), '')
    else if (m.kind === 'tool_use' && m.content !== 'ToolSearch') out.push(`> ${mine} used ${m.content.replace(/^mcp__mesh__/, 'mesh ')} · ${at}`, '')
    else if (m.kind === 'file') out.push(`> File: ${String(m.data.name ?? m.content)} · ${at}`, '')
    else if (m.kind === 'status' && m.content.trim()) out.push(`> ${m.content.trim()}`, '')
  }
  return out.join('\n')
}

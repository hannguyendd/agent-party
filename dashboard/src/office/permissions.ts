// Quick permission levels for an agent (the agent card). Settings keeps the full tool lists for anything else.

export type PermissionLevel = 'read' | 'edit' | 'full' | 'custom'

/** Same as the node's DEFAULT_ALLOWED_TOOLS: read and look around; anything that changes something asks first. */
export const READ_TOOLS = ['Read', 'Bash(ls*)', 'Bash(rg *)', 'Bash(grep *)', 'Bash(git status*)', 'Bash(git log*)', 'Bash(git diff*)']
const EDIT_TOOLS = [...READ_TOOLS, 'Edit', 'Write', 'MultiEdit', 'NotebookEdit']
const FULL_TOOLS = [...EDIT_TOOLS, 'Bash']

export const LEVELS: { id: Exclude<PermissionLevel, 'custom'>; label: string; hint: string; tools: string[] }[] = [
  { id: 'read', label: 'Read only', hint: 'Reads and searches; asks you before any change', tools: READ_TOOLS },
  { id: 'edit', label: 'Can edit files', hint: 'Edits files in its folder without asking; other commands still ask', tools: EDIT_TOOLS },
  { id: 'full', label: 'Full access', hint: 'Edits files and runs any command without asking', tools: FULL_TOOLS },
]

export function levelOf(allowed: string[]): PermissionLevel {
  const set = new Set(allowed)
  return LEVELS.find((l) => l.tools.length === set.size && l.tools.every((t) => set.has(t)))?.id ?? 'custom'
}

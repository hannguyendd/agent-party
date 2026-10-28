// A chat bubble's text: Markdown with agent names (see render-md.ts).

import { useMemo } from 'react'
import type { LiveState } from '../useLiveState'
import { agentNames } from './people'
import { renderMarkdown } from './render-md'

export function Markdown({ text, state, className }: { text: string; state: LiveState; className?: string }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => renderMarkdown(text, agentNames(state)), [text, state.office?.agents, state.agents])
  // Sanitized by DOMPurify in renderMarkdown; links open outside the dashboard.
  return (
    <div
      className={`o-md ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest('a')
        if (a) {
          e.preventDefault()
          window.open(a.href, '_blank', 'noopener,noreferrer')
        }
      }}
    />
  )
}

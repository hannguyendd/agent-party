// Chat text as Markdown, with agent IDs shown as names. Peer text is untrusted: everything goes through DOMPurify.

import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: true })

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
// owner/name as used in agent IDs; an optional @ in front.
// Markdown markers (*, _, ~, >) may sit right next to it, as in **@han/be**.
const AGENT_ID = /(^|[\s(["'`*_~>])(@?)([A-Za-z0-9_-]{1,40}\/[A-Za-z0-9._-]{1,60})(?=$|[\s).,:;!?"'\]`*_~<])/g

/** Markdown to safe HTML. `nameOf` gives a display name for a known agent ID (null for anything else), so
 *  "@han/be" reads "@Backend Agent" (the ID stays in the tooltip). Code spans and blocks are left as written. */
export function renderMarkdown(text: string, nameOf: (id: string) => string | null): string {
  const parts = text.split(/(```[\s\S]*?```|`[^`\n]*`)/g)
  const tag = (id: string, name: string, at: boolean) => `<span class="o-agent-tag" title="${escapeHtml(id)}">${at ? '@' : ''}${escapeHtml(name)}</span>`
  const withNames = parts
    .map((part, i) => {
      if (i % 2 === 1) {
        // Code stays as written, except a code span that is only an agent ID (agents like to write `@han/be`).
        const only = /^`(@?)([A-Za-z0-9_-]{1,40}\/[A-Za-z0-9._-]{1,60})`$/.exec(part)
        const name = only && nameOf(only[2])
        return only && name ? tag(only[2], name, !!only[1]) : part
      }
      return part.replace(AGENT_ID, (all, lead: string, at: string, id: string) => {
        const name = nameOf(id)
        return name ? lead + tag(id, name, !!at) : all
      })
    })
    .join('')
  const html = marked.parse(withNames, { async: false }) as string
  return DOMPurify.sanitize(html, { ALLOWED_ATTR: ['href', 'title', 'class'], FORBID_TAGS: ['style', 'img', 'iframe', 'form', 'input'] })
}

/** One line of plain text for list previews: Markdown markers dropped, agent IDs as names. */
export function plainPreview(text: string, nameOf: (id: string) => string | null): string {
  return text
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/(\*\*|__|~~|`)/g, '')
    .replace(/(^|\s)[*_](\S)/g, '$1$2')
    .replace(/(\S)[*_](?=\s|$)/g, '$1')
    .replace(AGENT_ID, (all, lead: string, at: string, id: string) => {
      const name = nameOf(id)
      return name ? `${lead}${at}${name}` : all
    })
    .replace(/\s+/g, ' ')
    .trim()
}

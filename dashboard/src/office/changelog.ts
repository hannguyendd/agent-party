// "What's new" data: the repo's CHANGELOG.md, bundled into the dashboard at build time (`make release` stamps it), so the
// list always matches the version this node runs. After an update it opens once; the version last shown is a
// per-browser mark.

import changelog from '../../../CHANGELOG.md?raw'

export interface Release {
  version: string // "0.2.1", or "" for the Unreleased section
  date: string
  groups: { title: string; items: string[] }[]
}

export function parseChangelog(text: string): Release[] {
  const out: Release[] = []
  let cur: Release | null = null
  for (const line of text.split('\n')) {
    const h2 = line.match(/^## (?:v(\d[\w.-]*)(?:\s*\(([^)]*)\))?|Unreleased)\s*$/)
    if (h2) {
      cur = { version: h2[1] ?? '', date: h2[2] ?? '', groups: [] }
      out.push(cur)
      continue
    }
    if (!cur) continue
    const h3 = line.match(/^### (.+)/)
    if (h3) cur.groups.push({ title: h3[1].trim(), items: [] })
    else if (/^- /.test(line)) {
      if (!cur.groups.length) cur.groups.push({ title: 'Changes', items: [] })
      cur.groups[cur.groups.length - 1].items.push(line.slice(2).trim())
    }
  }
  return out.filter((r) => r.groups.some((g) => g.items.length))
}

export const RELEASES = parseChangelog(changelog)

/** -1, 0 or 1, comparing "0.2.10" and "0.2.9" as numbers. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d > 0 ? 1 : -1
  }
  return 0
}

/** Releases newer than `since` up to `current` (all released ones when `since` is empty). */
export function releasesBetween(since: string, current: string): Release[] {
  return RELEASES.filter((r) => r.version && compareVersions(r.version, current) <= 0 && (!since || compareVersions(r.version, since) > 0))
}

const KEY = 'party.whatsnew.seen'

export function seenVersion(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function markSeen(version: string) {
  try {
    localStorage.setItem(KEY, version)
  } catch {
    /* private window: it just opens again next time */
  }
}

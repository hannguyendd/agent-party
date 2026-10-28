// How much of a machine's Claude plan is used: the 5-hour window and the week, with reset times.

import type { PlanUsage } from '../api'
import { timeAgo } from '../components/format'

const WINDOWS: [string, string][] = [['five_hour', '5 hours'], ['seven_day', 'Week']]

function resetIn(ts: number | null): string {
  if (!ts) return ''
  const mins = Math.round((ts * 1000 - Date.now()) / 60000)
  if (mins <= 0) return 'resetting'
  if (mins < 60) return `resets in ${mins}m`
  if (mins < 24 * 60) return `resets in ${Math.round(mins / 60)}h`
  return `resets ${new Date(ts * 1000).toLocaleDateString(undefined, { weekday: 'short' })}`
}

export function UsageMeters({ usage, compact }: { usage: PlanUsage | null | undefined; compact?: boolean }) {
  const rows = WINDOWS.filter(([k]) => usage?.[k]?.utilization != null)
  if (!rows.length) return <span className="o-usage-none">Claude usage shows up after the next turn.</span>
  const newest = Math.max(...rows.map(([k]) => usage![k].at))
  return (
    <div className={`o-usage ${compact ? 'is-compact' : ''}`}>
      {rows.map(([k, label]) => {
        const u = usage![k]
        const pct = Math.round((u.utilization ?? 0) * 100)
        const tone = u.status === 'rejected' || pct >= 90 ? 'is-err' : pct >= 70 || u.status === 'allowed_warning' ? 'is-wait' : 'is-ok'
        return (
          <div key={k} className={`o-usage-row ${tone}`} title={`${label}: ${pct}% used${u.resets_at ? `, ${resetIn(u.resets_at)}` : ''}`}>
            <span className="o-usage-label">{label}</span>
            <span className="o-usage-bar"><i style={{ width: `${Math.min(100, pct)}%` }} /></span>
            <span className="o-usage-pct">{u.status === 'rejected' ? 'limit hit' : `${pct}%`}</span>
            {!compact && <span className="o-usage-reset">{resetIn(u.resets_at)}</span>}
          </div>
        )
      })}
      {!compact && <span className="o-usage-at">as of {timeAgo(new Date(newest * 1000).toISOString())}</span>}
    </div>
  )
}

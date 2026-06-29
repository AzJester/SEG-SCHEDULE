import type { Week } from './engine/dates'

export function n1(v: number): string {
  if (Math.abs(v) < 0.05) return ''
  return v.toFixed(1)
}

export function n0(v: number): string {
  if (Math.abs(v) < 0.5) return ''
  return Math.round(v).toString()
}

export function money0(v: number): string {
  return Math.round(v).toLocaleString()
}

// Background tint for a weekly FTE cell (0 → blank, ~1.0 → strong).
export function heatStyle(fte: number): React.CSSProperties {
  if (fte <= 0.001) return {}
  const a = Math.min(fte, 1.2) / 1.2
  return { background: `rgba(52, 87, 213, ${0.08 + a * 0.5})`, color: a > 0.6 ? '#fff' : undefined }
}

// Tint for an FTE total relative to capacity (over 1.0 → amber/red).
export function loadStyle(fte: number): React.CSSProperties {
  if (fte <= 0.001) return {}
  if (fte > 1.05) return { background: 'rgba(194, 69, 47, .14)', color: '#9c2f1f' }
  if (fte > 0.9) return { background: 'rgba(47, 143, 91, .14)', color: '#1f6b41' }
  return {}
}

export function gapStyle(gap: number): React.CSSProperties {
  if (gap > 4) return { background: 'rgba(194, 121, 11, .16)', color: '#8a560a' }
  if (gap < -2) return { background: 'rgba(194, 69, 47, .16)', color: '#9c2f1f' }
  return {}
}

export interface WeekWindow {
  weeks: Week[]
  start: number
  visible: Week[]
}

export function windowWeeks(weeks: Week[], start: number, span: number): WeekWindow {
  const s = Math.max(0, Math.min(start, weeks.length - span))
  return { weeks, start: s, visible: weeks.slice(s, s + span) }
}

import type { ISODate } from '../types'

// All dates are handled as UTC to avoid timezone drift in the browser.

export function parse(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day))
}

export function fmt(d: Date): ISODate {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

// 0 = Sunday ... 6 = Saturday
export function dow(d: Date): number {
  return d.getUTCDay()
}

// Monday of the week containing d.
export function mondayOf(d: Date): Date {
  const wd = dow(d)
  const delta = wd === 0 ? -6 : 1 - wd
  return addDays(d, delta)
}

export interface Week {
  index: number
  monday: ISODate
  friday: ISODate
  label: string // e.g. "8/4"
  year: number
}

export function buildWeeks(horizonStart: ISODate, count: number): Week[] {
  const start = mondayOf(parse(horizonStart))
  const weeks: Week[] = []
  for (let i = 0; i < count; i++) {
    const monday = addDays(start, i * 7)
    const friday = addDays(monday, 4)
    weeks.push({
      index: i,
      monday: fmt(monday),
      friday: fmt(friday),
      label: `${monday.getUTCMonth() + 1}/${monday.getUTCDate()}`,
      year: monday.getUTCFullYear(),
    })
  }
  return weeks
}

// NETWORKDAYS: count Mon–Fri days in [start, end] inclusive, minus holidays.
export function networkDays(start: Date, end: Date, holidays: Set<string>): number {
  if (end < start) return 0
  let count = 0
  let cur = new Date(start)
  while (cur <= end) {
    const wd = dow(cur)
    if (wd !== 0 && wd !== 6 && !holidays.has(fmt(cur))) count++
    cur = addDays(cur, 1)
  }
  return count
}

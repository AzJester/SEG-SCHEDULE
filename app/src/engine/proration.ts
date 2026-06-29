import type { Booking, Dataset, Employee } from '../types'
import { addDays, buildWeeks, networkDays, parse, type Week } from './dates'

// Reimplements the workbook's Manpower / Clusterpower LAMBDA.
//
//   weekly FTE = NETWORKDAYS(overlap(booking, week) − holidays) / 5 × unit
//
// The four week-overlap cases (outside, full, starts mid-week, ends mid-week)
// fall out of intersecting the booking window with the Mon–Fri week window
// before counting working days. Cluster rows drop holidays (Clusterpower).

export interface EngineContext {
  weeks: Week[]
  holidays: Set<string>
  empById: Map<string, Employee>
  groupUsesHolidays: Map<string, boolean>
}

export function buildContext(ds: Dataset): EngineContext {
  return {
    weeks: buildWeeks(ds.horizonStart, ds.weeks),
    holidays: new Set(ds.holidays),
    empById: new Map(ds.employees.map((e) => [e.id, e])),
    groupUsesHolidays: new Map(ds.groups.map((g) => [g.id, g.usesHolidays])),
  }
}

// FTE for one booking in one week (0..unit).
export function weeklyFte(b: Booking, week: Week, ctx: EngineContext): number {
  const bStart = parse(b.start)
  const bEnd = parse(b.end)
  const wStart = parse(week.monday)
  const wEnd = parse(week.friday)
  const oStart = bStart > wStart ? bStart : wStart
  const oEnd = bEnd < wEnd ? bEnd : wEnd
  if (oEnd < oStart) return 0
  const emp = ctx.empById.get(b.employeeId)
  const useHol = emp ? (ctx.groupUsesHolidays.get(emp.groupId) ?? true) : true
  const days = networkDays(oStart, oEnd, useHol ? ctx.holidays : EMPTY_SET)
  return (days / 5) * b.unit
}

const EMPTY_SET = new Set<string>()

// Hours for one booking in one week = FTE × the person's planned weekly hours
// (change ②: per-person hours, not a flat 40).
export function weeklyHours(b: Booking, week: Week, ctx: EngineContext): number {
  const emp = ctx.empById.get(b.employeeId)
  const wk = emp ? emp.weeklyHours : 40
  return weeklyFte(b, week, ctx) * wk
}

// Per-week FTE series for a booking across the whole horizon.
export function fteSeries(b: Booking, ctx: EngineContext): number[] {
  return ctx.weeks.map((w) => weeklyFte(b, w, ctx))
}

export function hoursSeries(b: Booking, ctx: EngineContext): number[] {
  return ctx.weeks.map((w) => weeklyHours(b, w, ctx))
}

// Capacity (hours) for a person in a week, bounded by employment dates.
export function capacityHours(emp: Employee, week: Week, ctx: EngineContext): number {
  const empStart = parse(emp.employmentStart)
  const empEnd = emp.employmentEnd ? parse(emp.employmentEnd) : parse('2999-12-31')
  const wStart = parse(week.monday)
  const wEnd = parse(week.friday)
  const oStart = empStart > wStart ? empStart : wStart
  const oEnd = empEnd < wEnd ? empEnd : wEnd
  if (oEnd < oStart) return 0
  const useHol = ctx.groupUsesHolidays.get(emp.groupId) ?? true
  const days = networkDays(oStart, oEnd, useHol ? ctx.holidays : EMPTY_SET)
  return (days / 5) * emp.weeklyHours
}

export function sum(arr: number[]): number {
  let s = 0
  for (const v of arr) s += v
  return s
}

export function addInto(target: number[], src: number[]): void {
  for (let i = 0; i < src.length; i++) target[i] += src[i]
}

export function zeros(n: number): number[] {
  return new Array(n).fill(0)
}

export { addDays }

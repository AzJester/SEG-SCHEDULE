import type { Booking, Dataset, Filters } from '../types'
import {
  addInto, capacityHours, fteSeries, hoursSeries, sum, zeros, type EngineContext,
} from './proration'

// ---- Filtering (the shared slicers) ----
export function committedCodes(ds: Dataset): Set<string> {
  return new Set(ds.committedScale.filter((t) => t.committed).map((t) => t.code))
}

export function applyFilters(ds: Dataset, f: Filters): Booking[] {
  const empGroup = new Map(ds.employees.map((e) => [e.id, e.groupId]))
  const firm = committedCodes(ds)
  return ds.bookings.filter((b) => {
    if (f.groupId && empGroup.get(b.employeeId) !== f.groupId) return false
    if (f.programId && b.programId !== f.programId) return false
    if (f.projectId && b.projectId !== f.projectId) return false
    if (f.employeeId && b.employeeId !== f.employeeId) return false
    if (f.committed === 'committed' && !firm.has(b.committedCode)) return false
    else if (f.committed && f.committed !== 'committed' && b.committedCode !== f.committed) return false
    return true
  })
}

// ---- Generic pivot ----
export interface PivotItem {
  path: string[] // grouping labels, outer → inner
  series: number[]
}

export interface PivotRow {
  id: string
  label: string
  depth: number
  isGroup: boolean
  values: number[]
  total: number
}

export function buildPivot(items: PivotItem[], nWeeks: number): PivotRow[] {
  interface Node {
    label: string
    values: number[]
    children: Map<string, Node>
    order: number
  }
  const root: Node = { label: '', values: zeros(nWeeks), children: new Map(), order: 0 }
  let counter = 0
  for (const it of items) {
    let node = root
    addInto(node.values, it.series)
    for (const label of it.path) {
      let child = node.children.get(label)
      if (!child) {
        child = { label, values: zeros(nWeeks), children: new Map(), order: counter++ }
        node.children.set(label, child)
      }
      addInto(child.values, it.series)
      node = child
    }
  }
  const rows: PivotRow[] = []
  let rid = 0
  const walk = (node: Node, depth: number, prefix: string) => {
    const kids = [...node.children.values()].sort((a, b) => a.order - b.order)
    for (const k of kids) {
      const id = `${prefix}/${rid++}`
      rows.push({
        id,
        label: k.label,
        depth,
        isGroup: k.children.size > 0,
        values: k.values,
        total: sum(k.values),
      })
      walk(k, depth + 1, id)
    }
  }
  walk(root, 0, 'r')
  return rows
}

// ---- Report definitions ----
export type Measure = 'fte' | 'hours'

export interface ReportDef {
  id: string
  name: string
  measure: Measure
  dims: string[] // human labels for header context
  describe: string
}

export const REPORTS: ReportDef[] = [
  { id: 'staff-load', name: 'Staff Load', measure: 'fte', dims: ['Group', 'Employee', 'Project'], describe: 'How loaded each team is, by person and project.' },
  { id: 'staff-project', name: 'Staff Per Project', measure: 'hours', dims: ['Project', 'Committed', 'Task', 'Employee'], describe: 'Who is on each project, in hours.' },
  { id: 'programs', name: 'Projects & Programs', measure: 'fte', dims: ['Program', 'Committed', 'Project'], describe: 'Demand by program and project.' },
  { id: 'charge', name: 'Charge Codes', measure: 'hours', dims: ['Charge Code', 'Program'], describe: 'Hours rolled up by charge code (uses the % split).' },
  { id: 'program-year', name: 'Hours per Program-Year', measure: 'hours', dims: ['Program', 'Year'], describe: 'Program totals grouped by calendar year.' },
]

function lookups(ds: Dataset) {
  return {
    emp: new Map(ds.employees.map((e) => [e.id, e])),
    grp: new Map(ds.groups.map((g) => [g.id, g.name])),
    prog: new Map(ds.programs.map((p) => [p.id, p.name])),
    proj: new Map(ds.projects.map((p) => [p.id, p.name])),
    task: new Map(ds.tasks.map((t) => [t.id, t.name])),
    code: new Map(ds.chargeCodes.map((c) => [c.id, c.code])),
    committed: new Map(ds.committedScale.map((c) => [c.code, c.label])),
  }
}

export function buildReport(
  reportId: string,
  ds: Dataset,
  bookings: Booking[],
  ctx: EngineContext,
): PivotRow[] {
  const L = lookups(ds)
  const nWeeks = ctx.weeks.length
  const items: PivotItem[] = []

  if (reportId === 'charge') {
    // Explode each booking into its charge-code allocations.
    for (const b of bookings) {
      const hrs = hoursSeries(b, ctx)
      for (const a of b.allocations) {
        const scaled = hrs.map((h) => (h * a.percent) / 100)
        items.push({ path: [L.code.get(a.chargeCodeId) ?? a.chargeCodeId, L.prog.get(b.programId) ?? b.programId], series: scaled })
      }
    }
    return buildPivot(items, nWeeks)
  }

  for (const b of bookings) {
    const emp = L.emp.get(b.employeeId)
    const empName = emp ? emp.lastName : b.employeeId
    const series = reportId === 'staff-load' || reportId === 'programs' ? fteSeries(b, ctx) : hoursSeries(b, ctx)
    let path: string[]
    switch (reportId) {
      case 'staff-load':
        path = [emp ? (L.grp.get(emp.groupId) ?? '') : '', empName, L.proj.get(b.projectId) ?? '']
        break
      case 'staff-project':
        path = [L.proj.get(b.projectId) ?? '', L.committed.get(b.committedCode) ?? b.committedCode, L.task.get(b.taskId) ?? '', empName]
        break
      case 'programs':
        path = [L.prog.get(b.programId) ?? '', L.committed.get(b.committedCode) ?? b.committedCode, L.proj.get(b.projectId) ?? '']
        break
      default:
        path = [empName]
    }
    items.push({ path, series })
  }
  return buildPivot(items, nWeeks)
}

// Special case: program → year totals (collapse weeks into year buckets).
export function buildProgramYear(ds: Dataset, bookings: Booking[], ctx: EngineContext): PivotRow[] {
  const L = lookups(ds)
  const years = [...new Set(ctx.weeks.map((w) => w.year))].sort()
  const yearIndex = new Map(years.map((y, i) => [y, i]))
  const items: PivotItem[] = []
  for (const b of bookings) {
    const hrs = hoursSeries(b, ctx)
    const byYear = zeros(years.length)
    ctx.weeks.forEach((w, i) => { byYear[yearIndex.get(w.year)!] += hrs[i] })
    items.push({ path: [L.prog.get(b.programId) ?? b.programId], series: byYear })
  }
  return buildPivot(items, years.length)
}

export function programYearLabels(ctx: EngineContext): string[] {
  return [...new Set(ctx.weeks.map((w) => w.year))].sort().map(String)
}

// ---- Liability / gap (change ④: exclude Unavailable + Cluster) ----
export interface LiabilityRow {
  employeeId: string
  lastName: string
  group: string
  capacity: number[]
  booked: number[]
  gap: number[] // capacity − booked
  totalCapacity: number
  totalBooked: number
  totalGap: number
}

export function buildLiability(ds: Dataset, bookings: Booking[], ctx: EngineContext): LiabilityRow[] {
  const grpName = new Map(ds.groups.map((g) => [g.id, g.name]))
  const excludedGroup = new Set(ds.groups.filter((g) => g.excludedFromLiability).map((g) => g.id))
  const nWeeks = ctx.weeks.length
  const bookedByEmp = new Map<string, number[]>()
  for (const b of bookings) {
    let arr = bookedByEmp.get(b.employeeId)
    if (!arr) { arr = zeros(nWeeks); bookedByEmp.set(b.employeeId, arr) }
    addInto(arr, hoursSeries(b, ctx))
  }
  const rows: LiabilityRow[] = []
  for (const emp of ds.employees) {
    if (emp.isPlaceholder || excludedGroup.has(emp.groupId)) continue
    const capacity = ctx.weeks.map((w) => capacityHours(emp, w, ctx))
    const booked = bookedByEmp.get(emp.id) ?? zeros(nWeeks)
    const gap = capacity.map((c, i) => c - booked[i])
    rows.push({
      employeeId: emp.id,
      lastName: emp.lastName,
      group: grpName.get(emp.groupId) ?? '',
      capacity, booked, gap,
      totalCapacity: sum(capacity),
      totalBooked: sum(booked),
      totalGap: sum(gap),
    })
  }
  rows.sort((a, b) => b.totalGap - a.totalGap)
  return rows
}

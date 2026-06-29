import type { Dataset } from '../types'
import type { PivotRow } from '../engine/aggregate'
import type { Week } from '../engine/dates'

// Build an array-of-arrays from a pivot (indented label, total, then weekly values).
export function pivotToGrid(rows: PivotRow[], weeks: Week[], firstCol: string, measure: 'fte' | 'hours'): (string | number)[][] {
  const round = (v: number) => measure === 'fte' ? Math.round(v * 100) / 100 : Math.round(v)
  const header = [firstCol, 'Total', ...weeks.map((w) => w.label)]
  const body = rows.map((r) => [
    `${'  '.repeat(r.depth)}${r.label}`,
    round(r.total),
    ...weeks.map((w) => round(r.values[w.index] ?? 0)),
  ])
  return [header, ...body]
}

// All Excel export helpers lazy-load SheetJS so it stays out of the main bundle.

function tsStamp(): string {
  // Avoids argless Date in module scope; fine at call time in the browser.
  return new Date().toISOString().slice(0, 10)
}

async function xlsx() {
  return await import('xlsx')
}

function triggerDownload(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// Export a single grid (array-of-arrays: first row is headers) to one .xlsx sheet.
export async function exportGrid(filename: string, sheetName: string, aoa: (string | number)[][]) {
  const XLSX = await xlsx()
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  triggerDownload(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename)
}

// Export the whole dataset to a workbook that mirrors the original layout:
// one sheet per group (the 12 booking tables) plus reference sheets. Round-trips
// with the importer.
export async function exportDatasetWorkbook(ds: Dataset) {
  const XLSX = await xlsx()
  const wb = XLSX.utils.book_new()

  const emp = new Map(ds.employees.map((e) => [e.id, e]))
  const grpName = new Map(ds.groups.map((g) => [g.id, g.name]))
  const prog = new Map(ds.programs.map((p) => [p.id, p.name]))
  const proj = new Map(ds.projects.map((p) => [p.id, p.name]))
  const task = new Map(ds.tasks.map((t) => [t.id, t.name]))
  const code = new Map(ds.chargeCodes.map((c) => [c.id, c.code]))
  const commLabel = new Map(ds.committedScale.map((c) => [c.code, c.label]))

  const chargeCell = (b: (typeof ds.bookings)[number]) => {
    if (b.allocations.length === 0) return ''
    if (b.allocations.length === 1) return code.get(b.allocations[0].chargeCodeId) ?? ''
    return b.allocations.map((a) => `${code.get(a.chargeCodeId) ?? '?'} ${a.percent}%`).join(' | ')
  }

  const header = ['Group', 'Employee Last Name', 'Program', 'Project', 'Task', 'LCAT for T&M', 'Charge Code', 'Start Date', 'End Date', 'Unit', 'Committed', 'Notes']

  for (const g of ds.groups) {
    const rows = ds.bookings.filter((b) => emp.get(b.employeeId)?.groupId === g.id)
    if (rows.length === 0) continue
    const aoa: (string | number)[][] = [header]
    for (const b of rows) {
      const e = emp.get(b.employeeId)
      aoa.push([
        g.name, e?.lastName ?? '', prog.get(b.programId) ?? '', proj.get(b.projectId) ?? '',
        task.get(b.taskId) ?? '', b.lcat, chargeCell(b), b.start, b.end, b.unit,
        commLabel.get(b.committedCode) ?? b.committedCode, b.notes,
      ])
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), g.name.slice(0, 31))
  }

  // Reference sheets
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Program', 'PM', 'Contract type'],
    ...ds.programs.map((p) => [p.name, p.pm, p.contractType]),
  ]), 'Programs')

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Last name', 'Group', 'Weekly hours', 'Full/part time', 'Employment start', 'Employment end', 'Placeholder'],
    ...ds.employees.map((e) => [e.lastName, grpName.get(e.groupId) ?? '', e.weeklyHours, e.fullTime ? 'Full' : 'Part', e.employmentStart, e.employmentEnd ?? '', e.isPlaceholder ? 'Yes' : '']),
  ]), 'Roster')

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Code', 'Label', 'Counts as committed'],
    ...ds.committedScale.map((c) => [c.code, c.label, c.committed ? 'Yes' : 'No']),
  ]), 'Committed Scale')

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Holiday'], ...ds.holidays.map((h) => [h]),
  ]), 'Holidays')

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  triggerDownload(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `SEG-Schedule-export-${tsStamp()}.xlsx`)
}

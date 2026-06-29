import type {
  Booking, ChargeCode, CommittedTier, Dataset, Employee, Group, Program, Project, Task,
} from '../types'
import { seedDataset } from '../data/seed'

// Parses the real SEG-Schedule.xlsx entirely in the browser. The 12 group sheets
// carry the bookings (header row 4, data from row 5, columns A–L). Reference data
// is derived from those rows and enriched from the Holidays and "Column Drop Down
// Menus" sheets. Nothing leaves the browser.

const GROUP_SHEETS = ['TDAA', 'TDAM', 'TDES', 'TDEV', 'PMO', 'VPE', 'SUB', 'SEG South', 'Dahlgren', 'Cluster', 'FTO', 'TD-Other']
const HEADER_ROW = 3 // 0-based index of the header row (row 4)
const FIRST_WEEK_COL = 14 // 0-based: column O

export interface ImportResult {
  dataset: Dataset
  summary: {
    bookings: number
    programs: number
    projects: number
    tasks: number
    chargeCodes: number
    employees: number
    holidays: number
    horizonStart: string
    weeks: number
  }
}

type Row = unknown[]

function iso(v: unknown): string | null {
  if (v instanceof Date) {
    // Use UTC parts to avoid off-by-one from local tz.
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`
  }
  return v ? String(v) : null
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x'
}

// Stable, unique id from a label within a namespace.
function idFactory(prefix: string) {
  const used = new Map<string, string>()
  let n = 0
  return (label: string): string => {
    if (used.has(label)) return used.get(label)!
    n += 1
    const id = `${prefix}-${slug(label)}-${n}`
    used.set(label, id)
    return id
  }
}

function committedCode(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) return '0'
  return s.split(' - ')[0].trim() // "4 - Yes" -> "4"
}

export async function parseWorkbook(data: ArrayBuffer): Promise<ImportResult> {
  const XLSX = await import('xlsx') // lazy-loaded so it isn't in the main bundle
  const wb = XLSX.read(data, { cellDates: true })

  // ---- Holidays ----
  const holidays: string[] = []
  const hws = wb.Sheets['Holidays']
  if (hws) {
    const hrows = XLSX.utils.sheet_to_json<Row>(hws, { header: 1, defval: null })
    for (let i = 2; i < hrows.length; i++) {
      const d = iso(hrows[i]?.[1])
      if (d && !holidays.includes(d)) holidays.push(d)
    }
    holidays.sort()
  }

  // ---- Dropdowns: PM/contract type by program, hours/full-part by last name ----
  const pmByProgram = new Map<string, { pm: string; type: string }>()
  const rosterByName = new Map<string, { fullTime: boolean; hours: number }>()
  const dws = wb.Sheets['Column Drop Down Menus']
  if (dws) {
    const drows = XLSX.utils.sheet_to_json<Row>(dws, { header: 1, defval: null })
    for (let i = 1; i < drows.length; i++) {
      const r = drows[i]
      if (r[0]) pmByProgram.set(String(r[0]).trim(), { pm: String(r[2] ?? '').trim(), type: String(r[3] ?? 'CPFF').trim() || 'CPFF' })
      if (r[9]) {
        const name = String(r[9]).trim()
        if (!rosterByName.has(name)) rosterByName.set(name, { fullTime: Number(r[10]) >= 1, hours: Number(r[11]) || 40 })
      }
    }
  }

  // ---- Groups ----
  const groupId = idFactory('grp')
  const groups: Group[] = GROUP_SHEETS.map((name) => ({
    id: groupId(name),
    name,
    usesHolidays: name !== 'Cluster',
    excludedFromLiability: name === 'Cluster',
  }))
  const groupIdByName = new Map(groups.map((g) => [g.name, g.id]))

  const progId = idFactory('pg')
  const projId = idFactory('pj')
  const taskId = idFactory('tk')
  const codeId = idFactory('cc')
  const empId = idFactory('emp')

  const programs = new Map<string, Program>()
  const projects = new Map<string, Project>()
  const tasks = new Map<string, Task>()
  const chargeCodes = new Map<string, ChargeCode>()
  const employees = new Map<string, Employee>()
  const bookings: Booking[] = []

  let horizonStart = seedDataset.horizonStart
  let weeks = seedDataset.weeks
  let gotHorizon = false

  for (const sheetName of GROUP_SHEETS) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue
    const rows = XLSX.utils.sheet_to_json<Row>(ws, { header: 1, defval: null })

    // Horizon from the weekly header columns (once).
    if (!gotHorizon && rows[HEADER_ROW]) {
      const hdr = rows[HEADER_ROW]
      const first = iso(hdr[FIRST_WEEK_COL])
      if (first) {
        horizonStart = first
        let w = 0
        for (let c = FIRST_WEEK_COL; c < hdr.length; c++) if (hdr[c] != null && hdr[c] !== '') w++
        if (w > 0) weeks = w
        gotHorizon = true
      }
    }

    for (let i = HEADER_ROW + 1; i < rows.length; i++) {
      const r = rows[i]
      if (!r) continue
      const [grpRaw, empRaw, progRaw, projRaw, taskRaw, lcatRaw, codeRaw, startRaw, endRaw, unitRaw, commRaw, notesRaw] = r
      const start = iso(startRaw)
      const end = iso(endRaw)
      if (!progRaw || unitRaw == null || !start || !end) continue // not a real booking row

      const programName = String(progRaw).trim()
      const projectName = String(projRaw ?? '').trim() || '(unspecified)'
      const taskName = String(taskRaw ?? '').trim() || '(unspecified)'
      const groupName = String(grpRaw ?? sheetName).trim()
      const gId = groupIdByName.get(groupName) ?? groupIdByName.get(sheetName)!
      const lastName = String(empRaw ?? '').trim() || '(unnamed)'

      // Program
      if (!programs.has(programName)) {
        const meta = pmByProgram.get(programName)
        programs.set(programName, { id: progId(programName), name: programName, pm: meta?.pm ?? '', contractType: meta?.type ?? 'CPFF' })
      }
      const programId = programs.get(programName)!.id

      // Project (scoped to program)
      const projKey = `${programName}||${projectName}`
      if (!projects.has(projKey)) projects.set(projKey, { id: projId(projKey), programId, name: projectName })
      const projectId = projects.get(projKey)!.id

      // Task (scoped to project)
      const taskKey = `${projKey}||${taskName}`
      if (!tasks.has(taskKey)) tasks.set(taskKey, { id: taskId(taskKey), projectId, name: taskName })
      const tId = tasks.get(taskKey)!.id

      // Charge code
      let chargeCodeId = ''
      const codeStr = String(codeRaw ?? '').trim()
      if (codeStr) {
        if (!chargeCodes.has(codeStr)) chargeCodes.set(codeStr, { id: codeId(codeStr), code: codeStr, programId })
        chargeCodeId = chargeCodes.get(codeStr)!.id
      }

      // Employee
      const empKey = `${groupName}||${lastName}`
      if (!employees.has(empKey)) {
        const roster = rosterByName.get(lastName)
        const placeholder = lastName.startsWith('**') || /unavailable/i.test(lastName)
        employees.set(empKey, {
          id: empId(empKey),
          lastName,
          groupId: gId,
          weeklyHours: roster?.hours ?? 40,
          fullTime: roster?.fullTime ?? true,
          employmentStart: '2024-01-01',
          employmentEnd: null,
          isPlaceholder: placeholder,
        })
      }
      const employeeId = employees.get(empKey)!.id

      bookings.push({
        id: `bk-${bookings.length}`,
        employeeId, programId, projectId, taskId: tId,
        lcat: String(lcatRaw ?? '').trim(),
        start, end,
        unit: Number(unitRaw) || 0,
        committedCode: committedCode(commRaw),
        notes: String(notesRaw ?? '').trim(),
        allocations: chargeCodeId ? [{ chargeCodeId, percent: 100 }] : [],
      })
    }
  }

  // Committed scale: keep the known workbook scale (covers observed codes); it's
  // configurable in Admin and being revised anyway.
  const committedScale: CommittedTier[] = seedDataset.committedScale

  const dataset: Dataset = {
    asOf: iso(new Date()) ?? seedDataset.asOf,
    horizonStart,
    weeks,
    groups,
    programs: [...programs.values()],
    projects: [...projects.values()],
    tasks: [...tasks.values()],
    chargeCodes: [...chargeCodes.values()],
    employees: [...employees.values()],
    committedScale,
    holidays,
    bookings,
  }

  return {
    dataset,
    summary: {
      bookings: bookings.length,
      programs: programs.size,
      projects: projects.size,
      tasks: tasks.size,
      chargeCodes: chargeCodes.size,
      employees: employees.size,
      holidays: holidays.length,
      horizonStart,
      weeks,
    },
  }
}

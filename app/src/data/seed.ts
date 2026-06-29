import type {
  Booking, ChargeCode, CommittedTier, Dataset, Employee, Group, Program, Project, Task,
} from '../types'

// ---------------------------------------------------------------------------
// SYNTHETIC demo data. No real employee names or charge codes — the workbook is
// "SEG Internal Use Only" and GitHub Pages is public. This dataset is invented to
// exercise every feature: per-person hours, part-timers, Unavailable placeholders,
// the Cluster (no-holiday) group, multi-charge-code splits, and committed tiers.
// ---------------------------------------------------------------------------

const groups: Group[] = [
  { id: 'tdaa', name: 'TDAA', usesHolidays: true, excludedFromLiability: false },
  { id: 'tdam', name: 'TDAM', usesHolidays: true, excludedFromLiability: false },
  { id: 'tdes', name: 'TDES', usesHolidays: true, excludedFromLiability: false },
  { id: 'tdev', name: 'TDEV', usesHolidays: true, excludedFromLiability: false },
  { id: 'pmo', name: 'PMO', usesHolidays: true, excludedFromLiability: false },
  { id: 'vpe', name: 'VPE', usesHolidays: true, excludedFromLiability: false },
  { id: 'sub', name: 'SUB', usesHolidays: true, excludedFromLiability: false },
  { id: 'seg-south', name: 'SEG South', usesHolidays: true, excludedFromLiability: false },
  { id: 'dahlgren', name: 'Dahlgren', usesHolidays: true, excludedFromLiability: false },
  { id: 'cluster', name: 'Cluster', usesHolidays: false, excludedFromLiability: true },
  { id: 'fto', name: 'FTO', usesHolidays: true, excludedFromLiability: false },
  { id: 'td-other', name: 'TD-Other', usesHolidays: true, excludedFromLiability: false },
]

const programSpec: Array<[string, string, string, string]> = [
  // id, name, PM, contract type
  ['falcon', 'Falcon Net', 'Reyes', 'CPFF'],
  ['aegis', 'Aegis Link', 'Okafor', 'CPFF'],
  ['orion', 'Orion Sustainment', 'Bauer', 'T&M'],
  ['sentry', 'Sentry Watch', 'Nguyen', 'FFP'],
  ['atlas', 'Atlas Logistics', 'Carter', 'CPFF'],
  ['vanguard', 'Vanguard R&D', 'Delgado', 'CPFF'],
  ['harbor', 'Harbor Defense', 'Stein', 'T&M'],
  ['summit', 'Summit Analytics', 'Park', 'CPFF'],
  ['ironwood', 'Ironwood Modernization', 'Flores', 'CPFF'],
  ['keystone', 'Keystone Ops', 'Lee', 'CPFF'],
]

const programs: Program[] = programSpec.map(([id, name, pm, ct]) => ({
  id: `pg-${id}`, name, pm, contractType: ct,
}))

const projects: Project[] = []
const tasks: Task[] = []
const chargeCodes: ChargeCode[] = []
const projSuffix = ['Engineering', 'Integration', 'Sustainment']
const taskNames = ['Requirements', 'Design', 'Build', 'Test & Verify', 'Field Support']

programSpec.forEach(([id], pi) => {
  const programId = `pg-${id}`
  const nProj = 2 + (pi % 2) // 2–3 projects
  for (let j = 0; j < nProj; j++) {
    const projectId = `pj-${id}-${j}`
    projects.push({ id: projectId, programId, name: `${programSpec[pi][1]} – ${projSuffix[j]}` })
    const nTask = 2 + ((pi + j) % 2)
    for (let k = 0; k <= nTask; k++) {
      tasks.push({ id: `tk-${id}-${j}-${k}`, projectId, name: taskNames[(j + k) % taskNames.length] })
    }
  }
  // 2 charge codes per program
  for (let c = 0; c < 2; c++) {
    const n = 40 + pi
    const code = `SG${String(40 + pi).padStart(3, '0')}.00.000.6100.${String(c + 1).padStart(3, '0')}.${401000 + n}`
    chargeCodes.push({ id: `cc-${id}-${c}`, code, programId })
  }
})

// Roster: varied weekly hours + a placeholder ("Unavailable") per several groups.
const empSpec: Array<[string, string, number, boolean]> = [
  // lastName, groupId, weeklyHours, fullTime
  ['Abbott', 'tdaa', 40, true],
  ['Boyd', 'tdaa', 32, false],
  ['Calderon', 'tdaa', 40, true],
  ['Dunn', 'tdam', 40, true],
  ['Espinoza', 'tdam', 24, false],
  ['Farrell', 'tdam', 40, true],
  ['Gentry', 'tdes', 40, true],
  ['Hooper', 'tdes', 40, true],
  ['Ibarra', 'tdes', 20, false],
  ['Jennings', 'tdev', 40, true],
  ['Kessler', 'tdev', 40, true],
  ['Lozano', 'tdev', 32, false],
  ['Mathis', 'pmo', 40, true],
  ['Novak', 'pmo', 40, true],
  ['Ortega', 'vpe', 40, true],
  ['Pruitt', 'sub', 40, true],
  ['Quintero', 'sub', 40, true],
  ['Rasmussen', 'seg-south', 40, true],
  ['Sharma', 'seg-south', 40, true],
  ['Tran', 'dahlgren', 40, true],
  ['Underwood', 'dahlgren', 32, false],
  ['Vega', 'fto', 40, true],
  ['Whitfield', 'td-other', 40, true],
]

const employees: Employee[] = empSpec.map(([lastName, groupId, weeklyHours, fullTime], i) => ({
  id: `emp-${i}`,
  lastName,
  groupId,
  weeklyHours,
  fullTime,
  employmentStart: '2024-01-01',
  employmentEnd: lastName === 'Ibarra' ? '2026-03-27' : null, // someone rolling off mid-horizon
  isPlaceholder: false,
}))

// Open unstaffed positions held as placeholders (excluded from liability).
;['tdaa', 'tdes', 'tdev'].forEach((g, i) => {
  employees.push({
    id: `emp-ph-${i}`,
    lastName: `**Unavailable ${g.toUpperCase()}`,
    groupId: g,
    weeklyHours: 40,
    fullTime: true,
    employmentStart: '2024-01-01',
    employmentEnd: null,
    isPlaceholder: true,
  })
})

// Cluster "employees" = CPU / GPU compute capacity (no holidays, excluded from liability).
employees.push(
  { id: 'emp-cpu', lastName: 'CPU Pool', groupId: 'cluster', weeklyHours: 40, fullTime: true, employmentStart: '2024-01-01', employmentEnd: null, isPlaceholder: false },
  { id: 'emp-gpu', lastName: 'GPU Pool', groupId: 'cluster', weeklyHours: 40, fullTime: true, employmentStart: '2024-01-01', employmentEnd: null, isPlaceholder: false },
)

// Current committed scale (configurable — change ③). Final values TBD with Melanie.
const committedScale: CommittedTier[] = [
  { code: '0', label: '0 - No', sort: 0, committed: false },
  { code: '0.5', label: '0.5 - Not committed, see impacts', sort: 1, committed: false },
  { code: '1', label: '1 - Yes, not defined', sort: 2, committed: false },
  { code: '2', label: '2 - Yes, waiting on funds/info', sort: 3, committed: false },
  { code: '3', label: '3 - Yes, partial funding', sort: 4, committed: false },
  { code: '4', label: '4 - Yes', sort: 5, committed: true },
  { code: '10', label: '10 - Done', sort: 6, committed: true },
]

// Federal holidays across the horizon (FY pattern, like the workbook's Holidays tab).
const holidays: string[] = [
  '2025-09-01', // Labor Day
  '2025-11-27', '2025-11-28', // Thanksgiving
  '2025-12-25', // Christmas
  '2026-01-01', // New Year
  '2026-01-19', // MLK
  '2026-02-16', // Presidents
  '2026-05-25', // Memorial
  '2026-06-19', // Juneteenth
  '2026-07-03', // July 4 (observed)
]

// ---- Bookings: one row = one person · one task, charge codes split inside. ----
const committedCycle = ['4', '4', '3', '2', '4', '1', '4', '0.5', '10', '4']
const unitCycle = [1, 1, 0.5, 1, 0.75, 1, 0.5, 1, 1, 0.25]
const windows: Array<[string, string]> = [
  ['2025-08-04', '2026-07-31'],
  ['2025-08-04', '2025-12-26'],
  ['2025-10-06', '2026-04-24'],
  ['2026-01-05', '2026-07-31'],
  ['2025-08-18', '2026-02-27'],
]

function projectsOf(programId: string) { return projects.filter((p) => p.programId === programId) }
function tasksOf(projectId: string) { return tasks.filter((t) => t.projectId === projectId) }
function codesOf(programId: string) { return chargeCodes.filter((c) => c.programId === programId) }

const bookings: Booking[] = []
let b = 0
// Each non-cluster employee gets 1–3 bookings across programs.
const staff = employees.filter((e) => e.groupId !== 'cluster' && !e.isPlaceholder)
staff.forEach((emp, ei) => {
  const nb = 1 + (ei % 3)
  for (let n = 0; n < nb; n++) {
    const prog = programs[(ei + n * 3) % programs.length]
    const projs = projectsOf(prog.id)
    const proj = projs[(ei + n) % projs.length]
    const tks = tasksOf(proj.id)
    const tk = tks[(n + ei) % tks.length]
    const codes = codesOf(prog.id)
    const [start, end] = windows[(ei + n) % windows.length]
    // Every third booking splits across two charge codes (change ①).
    const split = (b % 3 === 0) && codes.length > 1
    const allocations = split
      ? [{ chargeCodeId: codes[0].id, percent: 60 }, { chargeCodeId: codes[1].id, percent: 40 }]
      : [{ chargeCodeId: codes[0].id, percent: 100 }]
    bookings.push({
      id: `bk-${b}`,
      employeeId: emp.id,
      programId: prog.id,
      projectId: proj.id,
      taskId: tk.id,
      lcat: prog.contractType === 'T&M' ? 'Senior Engineer' : '',
      start, end,
      unit: unitCycle[b % unitCycle.length],
      committedCode: committedCycle[b % committedCycle.length],
      notes: split ? 'Split funding across two charge codes' : '',
      allocations,
    })
    b++
  }
})

// A couple of placeholder bookings (open reqs) and Cluster compute bookings.
const phEmp = employees.filter((e) => e.isPlaceholder)
phEmp.forEach((emp, i) => {
  const prog = programs[i % programs.length]
  const proj = projectsOf(prog.id)[0]
  const tk = tasksOf(proj.id)[0]
  bookings.push({
    id: `bk-${b++}`,
    employeeId: emp.id, programId: prog.id, projectId: proj.id, taskId: tk.id,
    lcat: '', start: '2026-01-05', end: '2026-07-31', unit: 1,
    committedCode: '2', notes: 'Open requisition', allocations: [{ chargeCodeId: codesOf(prog.id)[0].id, percent: 100 }],
  })
})
;['emp-cpu', 'emp-gpu'].forEach((id, i) => {
  const prog = programs[i]
  const proj = projectsOf(prog.id)[0]
  const tk = tasksOf(proj.id)[0]
  bookings.push({
    id: `bk-${b++}`,
    employeeId: id, programId: prog.id, projectId: proj.id, taskId: tk.id,
    lcat: '', start: '2025-08-04', end: '2026-07-31', unit: 1,
    committedCode: '4', notes: 'Compute capacity (no holidays)', allocations: [{ chargeCodeId: codesOf(prog.id)[0].id, percent: 100 }],
  })
})

export const seedDataset: Dataset = {
  asOf: '2026-06-29',
  horizonStart: '2025-08-04',
  weeks: 52,
  groups,
  programs,
  projects,
  tasks,
  chargeCodes,
  employees,
  committedScale,
  holidays,
  bookings,
}

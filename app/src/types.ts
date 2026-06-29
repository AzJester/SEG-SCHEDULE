// Domain model for the SEG staff-scheduling app.
// Bookings are the source of truth; weekly effort is computed, never stored.

export type ISODate = string // 'YYYY-MM-DD'

export interface Group {
  id: string
  name: string
  // Cluster uses the no-holiday "Clusterpower" variant and is excluded from liability.
  usesHolidays: boolean
  excludedFromLiability: boolean
}

export interface Program {
  id: string
  name: string
  pm: string
  contractType: string // CPFF, T&M, FFP, ...
}

export interface Project {
  id: string
  programId: string
  name: string
}

export interface Task {
  id: string
  projectId: string
  name: string
}

export interface ChargeCode {
  id: string
  code: string // e.g. SG040.00.000.6100.006.401000
  programId: string
}

export interface Employee {
  id: string
  lastName: string
  groupId: string
  weeklyHours: number // per-person capacity (change ②) — not a flat 40
  fullTime: boolean
  employmentStart: ISODate
  employmentEnd: ISODate | null
  isPlaceholder: boolean // "**Unavailable ..." open positions — excluded from liability (change ④)
}

// Configurable committed scale (change ③). `committed` flags tiers that count
// as firm work for the "committed only" filter.
export interface CommittedTier {
  code: string // stored on bookings
  label: string
  sort: number
  committed: boolean
}

// One row = one person · one task (change ①). Charge codes split inside the row.
export interface ChargeAllocation {
  chargeCodeId: string
  percent: number // allocations on a booking must sum to 100
}

export interface Booking {
  id: string
  employeeId: string
  programId: string
  projectId: string
  taskId: string
  lcat: string // labor category, for T&M
  start: ISODate
  end: ISODate
  unit: number // fraction of the person: 1.0 full, 0.5 half
  committedCode: string
  notes: string
  allocations: ChargeAllocation[]
}

export interface Dataset {
  asOf: ISODate
  horizonStart: ISODate // first Monday of the weekly grid
  weeks: number
  groups: Group[]
  programs: Program[]
  projects: Project[]
  tasks: Task[]
  chargeCodes: ChargeCode[]
  employees: Employee[]
  committedScale: CommittedTier[]
  holidays: ISODate[]
  bookings: Booking[]
}

export interface Filters {
  groupId: string // '' = all
  programId: string
  projectId: string
  employeeId: string
  committed: string // '' = all | 'committed' = firm tiers only | specific code
}

export const EMPTY_FILTERS: Filters = {
  groupId: '',
  programId: '',
  projectId: '',
  employeeId: '',
  committed: '',
}

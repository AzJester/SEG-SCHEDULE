import type { ReactNode } from 'react'
import type { Dataset } from '../types'
import type { FieldSpec, Rec } from '../components/RecordDrawer'

export interface Column {
  label: string
  render: (rec: Rec) => ReactNode
  num?: boolean
}

export interface EntityConfig {
  key: keyof Dataset & string // dataset array this entity lives in
  idKey: string // identity field (usually 'id')
  tab: string
  singular: string
  columns: Column[]
  fields: FieldSpec[]
  makeNew: () => Rec
  deleteGuard: (id: string) => string | null // returns reason to block, or null
}

let seq = 0
function newId(prefix: string): string {
  seq += 1
  return `${prefix}-${Date.now().toString(36)}${seq}`
}

const CONTRACT_TYPES = ['CPFF', 'T&M', 'FFP', 'CPIF', 'IDIQ'].map((c) => ({ value: c, label: c }))

export function buildEntities(ds: Dataset): EntityConfig[] {
  const programName = (id: unknown) => ds.programs.find((p) => p.id === id)?.name ?? '—'
  const projectName = (id: unknown) => ds.projects.find((p) => p.id === id)?.name ?? '—'
  const groupName = (id: unknown) => ds.groups.find((g) => g.id === id)?.name ?? '—'
  const programOpts = ds.programs.map((p) => ({ value: p.id, label: p.name }))
  const projectOpts = ds.projects.map((p) => ({ value: p.id, label: p.name }))
  const groupOpts = ds.groups.map((g) => ({ value: g.id, label: g.name }))

  return [
    {
      key: 'employees', idKey: 'id', tab: 'Roster', singular: 'Employee',
      columns: [
        { label: 'Last name', render: (r) => String(r.lastName) },
        { label: 'Group', render: (r) => <span className="pill gray">{groupName(r.groupId)}</span> },
        { label: 'Weekly hrs', render: (r) => String(r.weeklyHours), num: true },
        { label: 'Type', render: (r) => (r.fullTime ? 'Full-time' : 'Part-time') },
        { label: 'Employment', render: (r) => <span className="muted">{String(r.employmentStart)} → {r.employmentEnd ? String(r.employmentEnd) : 'present'}</span> },
        { label: 'Flag', render: (r) => (r.isPlaceholder ? <span className="pill warn">Unavailable</span> : groupName(r.groupId) === 'Cluster' ? <span className="pill accent">Compute</span> : '') },
      ],
      fields: [
        { key: 'lastName', label: 'Last name', type: 'text', required: true },
        { key: 'groupId', label: 'Group', type: 'select', options: groupOpts, required: true },
        { key: 'weeklyHours', label: 'Weekly hours', type: 'number', required: true, min: 0, max: 80, help: 'Per-person capacity (not a flat 40).' },
        { key: 'fullTime', label: 'Full-time', type: 'checkbox', help: 'Full-time employee' },
        { key: 'employmentStart', label: 'Employment start', type: 'date', required: true },
        { key: 'employmentEnd', label: 'Employment end', type: 'date', nullable: true, help: 'Leave blank if still employed.' },
        { key: 'isPlaceholder', label: 'Unavailable placeholder', type: 'checkbox', help: 'Open/unstaffed position (excluded from liability).' },
      ],
      makeNew: () => ({ id: newId('emp'), lastName: '', groupId: '', weeklyHours: 40, fullTime: true, employmentStart: '2025-01-01', employmentEnd: null, isPlaceholder: false }),
      deleteGuard: (id) => {
        const n = ds.bookings.filter((b) => b.employeeId === id).length
        return n ? `Has ${n} booking(s). Reassign or delete them first.` : null
      },
    },
    {
      key: 'programs', idKey: 'id', tab: 'Programs', singular: 'Program',
      columns: [
        { label: 'Program', render: (r) => String(r.name) },
        { label: 'PM', render: (r) => String(r.pm) },
        { label: 'Contract', render: (r) => <span className="pill gray">{String(r.contractType)}</span> },
        { label: 'Projects', render: (r) => String(ds.projects.filter((p) => p.programId === r.id).length), num: true },
        { label: 'Charge codes', render: (r) => String(ds.chargeCodes.filter((c) => c.programId === r.id).length), num: true },
      ],
      fields: [
        { key: 'name', label: 'Program name', type: 'text', required: true },
        { key: 'pm', label: 'Program manager', type: 'text' },
        { key: 'contractType', label: 'Contract type', type: 'select', options: CONTRACT_TYPES },
      ],
      makeNew: () => ({ id: newId('pg'), name: '', pm: '', contractType: 'CPFF' }),
      deleteGuard: (id) => {
        const refs = [
          ds.projects.some((p) => p.programId === id) && 'projects',
          ds.chargeCodes.some((c) => c.programId === id) && 'charge codes',
          ds.bookings.some((b) => b.programId === id) && 'bookings',
        ].filter(Boolean)
        return refs.length ? `Referenced by ${refs.join(', ')}. Remove those first.` : null
      },
    },
    {
      key: 'projects', idKey: 'id', tab: 'Projects', singular: 'Project',
      columns: [
        { label: 'Project', render: (r) => String(r.name) },
        { label: 'Program', render: (r) => programName(r.programId) },
        { label: 'Tasks', render: (r) => String(ds.tasks.filter((t) => t.projectId === r.id).length), num: true },
      ],
      fields: [
        { key: 'name', label: 'Project name', type: 'text', required: true },
        { key: 'programId', label: 'Program', type: 'select', options: programOpts, required: true },
      ],
      makeNew: () => ({ id: newId('pj'), name: '', programId: '' }),
      deleteGuard: (id) => {
        const refs = [
          ds.tasks.some((t) => t.projectId === id) && 'tasks',
          ds.bookings.some((b) => b.projectId === id) && 'bookings',
        ].filter(Boolean)
        return refs.length ? `Referenced by ${refs.join(', ')}. Remove those first.` : null
      },
    },
    {
      key: 'tasks', idKey: 'id', tab: 'Tasks', singular: 'Task',
      columns: [
        { label: 'Task', render: (r) => String(r.name) },
        { label: 'Project', render: (r) => projectName(r.projectId) },
        { label: 'Program', render: (r) => programName(ds.projects.find((p) => p.id === r.projectId)?.programId) },
      ],
      fields: [
        { key: 'name', label: 'Task name', type: 'text', required: true },
        { key: 'projectId', label: 'Project', type: 'select', options: projectOpts, required: true },
      ],
      makeNew: () => ({ id: newId('tk'), name: '', projectId: '' }),
      deleteGuard: (id) => {
        const n = ds.bookings.filter((b) => b.taskId === id).length
        return n ? `Has ${n} booking(s). Remove them first.` : null
      },
    },
    {
      key: 'chargeCodes', idKey: 'id', tab: 'Charge codes', singular: 'Charge code',
      columns: [
        { label: 'Code', render: (r) => <code className="inline">{String(r.code)}</code> },
        { label: 'Program', render: (r) => programName(r.programId) },
      ],
      fields: [
        { key: 'code', label: 'Charge code', type: 'text', required: true, help: 'e.g. SG040.00.000.6100.006.401000' },
        { key: 'programId', label: 'Program', type: 'select', options: programOpts, required: true },
      ],
      makeNew: () => ({ id: newId('cc'), code: '', programId: '' }),
      deleteGuard: (id) => {
        const n = ds.bookings.filter((b) => b.allocations.some((a) => a.chargeCodeId === id)).length
        return n ? `Used by ${n} booking allocation(s). Remove them first.` : null
      },
    },
    {
      key: 'groups', idKey: 'id', tab: 'Groups', singular: 'Group',
      columns: [
        { label: 'Group', render: (r) => String(r.name) },
        { label: 'Uses holidays', render: (r) => (r.usesHolidays ? 'Yes' : <span className="pill accent">No (compute)</span>) },
        { label: 'In liability', render: (r) => (r.excludedFromLiability ? <span className="pill warn">Excluded</span> : 'Included') },
        { label: 'People', render: (r) => String(ds.employees.filter((e) => e.groupId === r.id).length), num: true },
      ],
      fields: [
        { key: 'name', label: 'Group name', type: 'text', required: true },
        { key: 'usesHolidays', label: 'Subtracts holidays', type: 'checkbox', help: 'Off = compute capacity (Clusterpower, runs through holidays).' },
        { key: 'excludedFromLiability', label: 'Exclude from liability', type: 'checkbox', help: 'On for Cluster (CPU/GPU).' },
      ],
      makeNew: () => ({ id: newId('grp'), name: '', usesHolidays: true, excludedFromLiability: false }),
      deleteGuard: (id) => {
        const n = ds.employees.filter((e) => e.groupId === id).length
        return n ? `Has ${n} employee(s). Reassign them first.` : null
      },
    },
    {
      key: 'committedScale', idKey: 'code', tab: 'Committed scale', singular: 'Committed tier',
      columns: [
        { label: 'Code', render: (r) => <code className="inline">{String(r.code)}</code> },
        { label: 'Label', render: (r) => String(r.label) },
        { label: 'Counts as committed', render: (r) => (r.committed ? <span className="pill good">Yes</span> : 'No') },
        { label: 'Sort', render: (r) => String(r.sort), num: true },
      ],
      fields: [
        { key: 'code', label: 'Code', type: 'text', required: true, help: 'Stored on bookings (e.g. 4, 10, 0.5).' },
        { key: 'label', label: 'Label', type: 'text', required: true },
        { key: 'committed', label: 'Counts as committed', type: 'checkbox', help: 'Included by the "Committed only" filter.' },
        { key: 'sort', label: 'Sort order', type: 'number' },
      ],
      makeNew: () => ({ code: '', label: '', committed: false, sort: ds.committedScale.length }),
      deleteGuard: (code) => {
        const n = ds.bookings.filter((b) => b.committedCode === code).length
        return n ? `Used by ${n} booking(s). Re-tag them first.` : null
      },
    },
  ]
}

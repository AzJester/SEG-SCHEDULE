import type { Dataset, Filters } from '../types'
import { EMPTY_FILTERS } from '../types'

export function FilterBar({
  ds, filters, onChange,
}: {
  ds: Dataset
  filters: Filters
  onChange: (f: Filters) => void
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  const projects = filters.programId
    ? ds.projects.filter((p) => p.programId === filters.programId)
    : ds.projects
  const dirty = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)

  return (
    <div className="filterbar">
      <div className="field">
        <label>Group</label>
        <select value={filters.groupId} onChange={(e) => set({ groupId: e.target.value })}>
          <option value="">All groups</option>
          {ds.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Program</label>
        <select value={filters.programId} onChange={(e) => set({ programId: e.target.value, projectId: '' })}>
          <option value="">All programs</option>
          {ds.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Project</label>
        <select value={filters.projectId} onChange={(e) => set({ projectId: e.target.value })}>
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Employee</label>
        <select value={filters.employeeId} onChange={(e) => set({ employeeId: e.target.value })}>
          <option value="">All employees</option>
          {ds.employees.map((e) => <option key={e.id} value={e.id}>{e.lastName}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Committed</label>
        <select value={filters.committed} onChange={(e) => set({ committed: e.target.value })}>
          <option value="">All</option>
          <option value="committed">Committed only</option>
          {ds.committedScale.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
      </div>
      {dirty && (
        <button className="btn ghost sm filter-reset" onClick={() => onChange(EMPTY_FILTERS)}>
          Clear filters
        </button>
      )}
    </div>
  )
}

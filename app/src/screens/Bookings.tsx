import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Booking, Filters } from '../types'
import { EMPTY_FILTERS } from '../types'
import { FilterBar } from '../components/FilterBar'
import { applyFilters } from '../engine/aggregate'
import { hoursSeries, sum } from '../engine/proration'
import { money0 } from '../ui'

function blankBooking(): Booking {
  return {
    id: `bk-${Date.now()}-${Math.floor(performance.now())}`,
    employeeId: '', programId: '', projectId: '', taskId: '',
    lcat: '', start: '2025-08-04', end: '2026-07-31', unit: 1,
    committedCode: '4', notes: '', allocations: [{ chargeCodeId: '', percent: 100 }],
  }
}

export function Bookings() {
  const { ds, ctx, upsertBooking, deleteBooking } = useStore()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [editing, setEditing] = useState<Booking | null>(null)

  const bookings = useMemo(() => applyFilters(ds, filters), [ds, filters])
  const L = useMemo(() => ({
    emp: new Map(ds.employees.map((e) => [e.id, e])),
    grp: new Map(ds.groups.map((g) => [g.id, g.name])),
    prog: new Map(ds.programs.map((p) => [p.id, p.name])),
    proj: new Map(ds.projects.map((p) => [p.id, p.name])),
    task: new Map(ds.tasks.map((t) => [t.id, t.name])),
    committed: new Map(ds.committedScale.map((c) => [c.code, c.label])),
  }), [ds])

  return (
    <>
      <FilterBar ds={ds} filters={filters} onChange={setFilters} />
      <div className="content">
        <div className="panel">
          <div className="panel-head">
            <h2>Bookings</h2>
            <span className="hint">{bookings.length} of {ds.bookings.length} rows · one row = one person · one task</span>
            <div className="right">
              <button className="btn primary sm" onClick={() => setEditing(blankBooking())}>+ New booking</button>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Employee</th><th>Group</th><th>Program</th><th>Project / Task</th>
                  <th className="num">Unit</th><th>Committed</th><th>Charge codes</th>
                  <th>Window</th><th className="num">Hours</th><th></th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const emp = L.emp.get(b.employeeId)
                  const total = sum(hoursSeries(b, ctx))
                  return (
                    <tr key={b.id}>
                      <td>{emp?.lastName ?? '—'}</td>
                      <td><span className="pill gray">{emp ? L.grp.get(emp.groupId) : ''}</span></td>
                      <td>{L.prog.get(b.programId)}</td>
                      <td>{L.proj.get(b.projectId)} <span className="muted">· {L.task.get(b.taskId)}</span></td>
                      <td className="num">{b.unit}</td>
                      <td><span className="pill accent">{(L.committed.get(b.committedCode) ?? b.committedCode).split(' - ')[0]}</span></td>
                      <td>{b.allocations.length === 1 ? '1 code' : <span className="pill warn">{b.allocations.length} codes (split)</span>}</td>
                      <td className="muted">{b.start} → {b.end}</td>
                      <td className="num">{money0(total)}</td>
                      <td><button className="btn ghost sm" onClick={() => setEditing(structuredClone(b))}>Edit</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {editing && (
        <BookingDrawer
          key={editing.id}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(b) => { upsertBooking(b); setEditing(null) }}
          onDelete={ds.bookings.some((x) => x.id === editing.id) ? () => { deleteBooking(editing.id); setEditing(null) } : undefined}
        />
      )}
    </>
  )
}

function BookingDrawer({
  initial, onClose, onSave, onDelete,
}: {
  initial: Booking
  onClose: () => void
  onSave: (b: Booking) => void
  onDelete?: () => void
}) {
  const { ds } = useStore()
  const [b, setB] = useState<Booking>(initial)
  const set = (patch: Partial<Booking>) => setB((cur) => ({ ...cur, ...patch }))

  const projects = ds.projects.filter((p) => p.programId === b.programId)
  const tasks = ds.tasks.filter((t) => t.projectId === b.projectId)
  const codes = ds.chargeCodes.filter((c) => c.programId === b.programId)

  const allocSum = b.allocations.reduce((a, x) => a + (Number(x.percent) || 0), 0)
  const errors: string[] = []
  if (!b.employeeId) errors.push('Pick an employee.')
  if (!b.programId || !b.projectId || !b.taskId) errors.push('Pick program, project and task.')
  if (b.end < b.start) errors.push('End date is before start date.')
  if (Math.round(allocSum) !== 100) errors.push(`Charge-code split must total 100% (now ${allocSum}%).`)
  if (b.allocations.some((a) => !a.chargeCodeId)) errors.push('Every allocation needs a charge code.')

  const setAlloc = (i: number, patch: Partial<{ chargeCodeId: string; percent: number }>) =>
    setB((cur) => ({ ...cur, allocations: cur.allocations.map((a, j) => (j === i ? { ...a, ...patch } : a)) }))

  return (
    <div className="scrim" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head"><h2>{ds.bookings.some((x) => x.id === b.id) ? 'Edit booking' : 'New booking'}</h2></div>
        <div className="drawer-body">
          <div className="form-row">
            <label>Employee</label>
            <select value={b.employeeId} onChange={(e) => set({ employeeId: e.target.value })}>
              <option value="">Select…</option>
              {ds.employees.map((e) => <option key={e.id} value={e.id}>{e.lastName} ({ds.groups.find((g) => g.id === e.groupId)?.name})</option>)}
            </select>
          </div>
          <div className="grid2">
            <div className="form-row">
              <label>Program</label>
              <select value={b.programId} onChange={(e) => set({ programId: e.target.value, projectId: '', taskId: '', allocations: [{ chargeCodeId: '', percent: 100 }] })}>
                <option value="">Select…</option>
                {ds.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Project</label>
              <select value={b.projectId} disabled={!b.programId} onChange={(e) => set({ projectId: e.target.value, taskId: '' })}>
                <option value="">Select…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid2">
            <div className="form-row">
              <label>Task</label>
              <select value={b.taskId} disabled={!b.projectId} onChange={(e) => set({ taskId: e.target.value })}>
                <option value="">Select…</option>
                {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>LCAT (T&amp;M)</label>
              <input type="text" value={b.lcat} onChange={(e) => set({ lcat: e.target.value })} placeholder="optional" />
            </div>
          </div>
          <div className="grid2">
            <div className="form-row">
              <label>Start</label>
              <input type="date" value={b.start} onChange={(e) => set({ start: e.target.value })} />
            </div>
            <div className="form-row">
              <label>End</label>
              <input type="date" value={b.end} onChange={(e) => set({ end: e.target.value })} />
            </div>
          </div>
          <div className="grid2">
            <div className="form-row">
              <label>Unit (FTE fraction)</label>
              <input type="number" min={0} max={1} step={0.05} value={b.unit} onChange={(e) => set({ unit: Number(e.target.value) })} />
            </div>
            <div className="form-row">
              <label>Committed</label>
              <select value={b.committedCode} onChange={(e) => set({ committedCode: e.target.value })}>
                {ds.committedScale.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <label>Charge-code allocation <span className="muted">(one row, split by %)</span></label>
            {b.allocations.map((a, i) => (
              <div className="alloc-row" key={i}>
                <select value={a.chargeCodeId} onChange={(e) => setAlloc(i, { chargeCodeId: e.target.value })} disabled={!b.programId}>
                  <option value="">Select code…</option>
                  {codes.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
                </select>
                <input type="number" min={0} max={100} value={a.percent} onChange={(e) => setAlloc(i, { percent: Number(e.target.value) })} />
                <button className="btn ghost sm" disabled={b.allocations.length === 1} onClick={() => setB((cur) => ({ ...cur, allocations: cur.allocations.filter((_, j) => j !== i) }))}>✕</button>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <button className="btn sm" onClick={() => setB((cur) => ({ ...cur, allocations: [...cur.allocations, { chargeCodeId: '', percent: 0 }] }))}>+ Add charge code</button>
              <span className={`alloc-sum ${Math.round(allocSum) === 100 ? 'ok' : 'bad'}`}>{allocSum}% allocated</span>
            </div>
          </div>

          <div className="form-row">
            <label>Notes</label>
            <input type="text" value={b.notes} onChange={(e) => set({ notes: e.target.value })} />
          </div>

          {errors.length > 0 && (
            <div className="banner" style={{ background: '#fae3df', color: '#8a2c1c', borderColor: '#e7c4bd' }}>
              {errors.map((e, i) => <div key={i}>• {e}</div>)}
            </div>
          )}
        </div>
        <div className="drawer-foot">
          {onDelete && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={onDelete}>Delete</button>}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={errors.length > 0} onClick={() => onSave(b)}>Save booking</button>
        </div>
      </div>
    </div>
  )
}

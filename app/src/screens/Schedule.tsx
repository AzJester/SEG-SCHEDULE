import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Filters } from '../types'
import { EMPTY_FILTERS } from '../types'
import { FilterBar } from '../components/FilterBar'
import { applyFilters } from '../engine/aggregate'
import { addInto, fteSeries, sum, zeros } from '../engine/proration'
import { heatStyle, n1 } from '../ui'

const SPAN = 16

export function Schedule() {
  const { ds, ctx } = useStore()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [start, setStart] = useState(0)
  const bookings = useMemo(() => applyFilters(ds, filters), [ds, filters])

  const rows = useMemo(() => {
    const grpName = new Map(ds.groups.map((g) => [g.id, g.name]))
    const byEmp = new Map<string, number[]>()
    for (const b of bookings) {
      let arr = byEmp.get(b.employeeId)
      if (!arr) { arr = zeros(ctx.weeks.length); byEmp.set(b.employeeId, arr) }
      addInto(arr, fteSeries(b, ctx))
    }
    return ds.employees
      .filter((e) => byEmp.has(e.id))
      .map((e) => ({
        id: e.id,
        name: e.lastName,
        group: grpName.get(e.groupId) ?? '',
        series: byEmp.get(e.id)!,
        total: sum(byEmp.get(e.id)!),
      }))
      .sort((a, b) => (a.group + a.name).localeCompare(b.group + b.name))
  }, [ds, ctx, bookings])

  const maxStart = Math.max(0, ctx.weeks.length - SPAN)
  const s = Math.min(start, maxStart)
  const visible = ctx.weeks.slice(s, s + SPAN)

  return (
    <>
      <FilterBar ds={ds} filters={filters} onChange={setFilters} />
      <div className="content">
        <div className="panel">
          <div className="panel-head">
            <h2>Staff loading heatmap</h2>
            <span className="hint">FTE per person per week. Darker = more committed.</span>
            <div className="right">
              <button className="btn sm" disabled={s === 0} onClick={() => setStart(Math.max(0, s - SPAN))}>← Earlier</button>
              <button className="btn sm" disabled={s >= maxStart} onClick={() => setStart(Math.min(maxStart, s + SPAN))}>Later →</button>
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="empty">No bookings for the current filters.</div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: 150 }}>Employee</th>
                    <th>Group</th>
                    <th className="num">Total FTE</th>
                    {visible.map((w) => <th key={w.index} className="num">{w.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td><span className="pill gray">{r.group}</span></td>
                      <td className="total-col">{r.total.toFixed(1)}</td>
                      {visible.map((w) => {
                        const v = r.series[w.index]
                        return <td key={w.index} className="heat" style={heatStyle(v)}>{n1(v)}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

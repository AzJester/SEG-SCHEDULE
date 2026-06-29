import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Filters } from '../types'
import { EMPTY_FILTERS } from '../types'
import { FilterBar } from '../components/FilterBar'
import { applyFilters, buildLiability } from '../engine/aggregate'
import { exportGrid } from '../export/excel'
import { gapStyle, money0, n0 } from '../ui'

const SPAN = 14

export function Liability() {
  const { ds, ctx } = useStore()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [start, setStart] = useState(0)
  const bookings = useMemo(() => applyFilters(ds, filters), [ds, filters])
  const rows = useMemo(() => buildLiability(ds, bookings, ctx), [ds, bookings, ctx])

  const totals = useMemo(() => {
    const cap = rows.reduce((a, r) => a + r.totalCapacity, 0)
    const booked = rows.reduce((a, r) => a + r.totalBooked, 0)
    const underbooked = rows.filter((r) => r.totalGap > 8).length
    return { cap, booked, gap: cap - booked, underbooked }
  }, [rows])

  const maxStart = Math.max(0, ctx.weeks.length - SPAN)
  const s = Math.min(start, maxStart)
  const visible = ctx.weeks.slice(s, s + SPAN)

  return (
    <>
      <FilterBar ds={ds} filters={filters} onChange={setFilters} />
      <div className="content">
        <div className="banner">
          Liability excludes <strong>Unavailable</strong> placeholders and the <strong>Cluster</strong> group
          (CPU/GPU), matching the workbook's AH_Removed rule. Gap = capacity − booked hours, per person per week.
        </div>
        <div className="cards">
          <div className="card"><div className="k">Capacity</div><div className="v">{money0(totals.cap)}</div><div className="d">hrs across horizon</div></div>
          <div className="card"><div className="k">Booked</div><div className="v">{money0(totals.booked)}</div><div className="d">hrs to funded work</div></div>
          <div className="card"><div className="k">Liability gap</div><div className="v" style={{ color: totals.gap > 0 ? 'var(--warn)' : 'var(--good)' }}>{money0(totals.gap)}</div><div className="d">unbooked capacity</div></div>
          <div className="card"><div className="k">Under-booked people</div><div className="v">{totals.underbooked}</div><div className="d">&gt; 8 hrs open</div></div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Gap by person and week</h2>
            <span className="hint">Positive = unbooked hours. Negative = over-allocated.</span>
            <div className="right">
              <button className="btn sm" onClick={() => exportGrid(`liability-${ds.asOf}.xlsx`, 'Liability', [
                ['Employee', 'Group', 'Total gap', ...ctx.weeks.map((w) => w.label)],
                ...rows.map((r) => [r.lastName, r.group, Math.round(r.totalGap), ...ctx.weeks.map((w) => Math.round(r.gap[w.index]))]),
              ])}>Export Excel</button>
              <button className="btn sm" disabled={s === 0} onClick={() => setStart(Math.max(0, s - SPAN))}>← Earlier</button>
              <button className="btn sm" disabled={s >= maxStart} onClick={() => setStart(Math.min(maxStart, s + SPAN))}>Later →</button>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 150 }}>Employee</th>
                  <th>Group</th>
                  <th className="num">Total gap</th>
                  {visible.map((w) => <th key={w.index} className="num">{w.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employeeId}>
                    <td>{r.lastName}</td>
                    <td><span className="pill gray">{r.group}</span></td>
                    <td className="total-col">{money0(r.totalGap)}</td>
                    {visible.map((w) => {
                      const v = r.gap[w.index]
                      return <td key={w.index} className="heat" style={gapStyle(v)}>{n0(v)}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}

import { useState } from 'react'
import type { PivotRow } from '../engine/aggregate'
import type { Week } from '../engine/dates'
import { heatStyle, n0, n1 } from '../ui'

const SPAN = 14

export function PivotTable({
  rows, weeks, measure, firstColLabel,
}: {
  rows: PivotRow[]
  weeks: Week[]
  measure: 'fte' | 'hours'
  firstColLabel: string
}) {
  const [start, setStart] = useState(0)
  const maxStart = Math.max(0, weeks.length - SPAN)
  const s = Math.min(start, maxStart)
  const visible = weeks.slice(s, s + SPAN)
  const fmt = measure === 'fte' ? n1 : n0

  if (rows.length === 0) return <div className="empty">No data for the current filters.</div>

  return (
    <>
      <div className="panel-head" style={{ borderTop: '1px solid var(--border)' }}>
        <span className="hint">
          Weeks {s + 1}–{Math.min(s + SPAN, weeks.length)} of {weeks.length} · {measure === 'fte' ? 'FTE' : 'hours'}
        </span>
        <div className="right">
          <button className="btn sm" disabled={s === 0} onClick={() => setStart(Math.max(0, s - SPAN))}>← Earlier</button>
          <button className="btn sm" disabled={s >= maxStart} onClick={() => setStart(Math.min(maxStart, s + SPAN))}>Later →</button>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: 240 }}>{firstColLabel}</th>
              <th className="num">Total</th>
              {visible.map((w) => <th key={w.index} className="num">{w.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.isGroup && r.depth === 0 ? 'group-row' : ''}>
                <td className={`indent-${Math.min(r.depth, 3)}`}>{r.label}</td>
                <td className="total-col">{fmt(r.total)}</td>
                {visible.map((w) => {
                  const v = r.values[w.index]
                  return (
                    <td key={w.index} className="heat" style={measure === 'fte' ? heatStyle(v) : undefined}>
                      {fmt(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

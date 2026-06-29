import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Filters } from '../types'
import { EMPTY_FILTERS } from '../types'
import { FilterBar } from '../components/FilterBar'
import { PivotTable } from '../components/PivotTable'
import {
  REPORTS, applyFilters, buildProgramYear, buildReport, programYearLabels,
} from '../engine/aggregate'
import { exportGrid, pivotToGrid } from '../export/excel'

export function Reports() {
  const { ds, ctx } = useStore()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [reportId, setReportId] = useState('staff-load')
  const def = REPORTS.find((r) => r.id === reportId)!

  const bookings = useMemo(() => applyFilters(ds, filters), [ds, filters])

  const { rows, weeks, measure, firstCol } = useMemo(() => {
    if (reportId === 'program-year') {
      const labels = programYearLabels(ctx)
      return {
        rows: buildProgramYear(ds, bookings, ctx),
        weeks: labels.map((l, i) => ({ index: i, monday: l, friday: l, label: l, year: Number(l) })),
        measure: 'hours' as const,
        firstCol: 'Program',
      }
    }
    return {
      rows: buildReport(reportId, ds, bookings, ctx),
      weeks: ctx.weeks,
      measure: def.measure,
      firstCol: def.dims[0],
    }
  }, [ds, bookings, ctx, reportId, def])

  return (
    <>
      <FilterBar ds={ds} filters={filters} onChange={setFilters} />
      <div className="content">
        <div className="tag-row" style={{ marginBottom: 16 }}>
          {REPORTS.map((r) => (
            <button
              key={r.id}
              className={`btn sm ${r.id === reportId ? 'primary' : ''}`}
              onClick={() => setReportId(r.id)}
            >
              {r.name}
            </button>
          ))}
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>{def.name}</h2>
            <span className="hint">{def.describe}</span>
            <div className="right">
              <button className="btn sm" onClick={() => exportGrid(`${def.id}-${ds.asOf}.xlsx`, def.name, pivotToGrid(rows, weeks, firstCol, measure))}>Export Excel</button>
              <span className="pill gray">{def.dims.join(' › ')}</span>
            </div>
          </div>
          <PivotTable rows={rows} weeks={weeks} measure={measure} firstColLabel={firstCol} />
        </div>
      </div>
    </>
  )
}

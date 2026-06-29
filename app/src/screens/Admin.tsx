import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Dataset } from '../types'
import { buildEntities, type EntityConfig } from '../admin/entities'
import { RecordDrawer, type Rec } from '../components/RecordDrawer'
import { parseWorkbook } from '../import/workbook'

export function Admin() {
  const { ds, update, resetDemo } = useStore()
  const entities = useMemo(() => buildEntities(ds), [ds])
  const [tab, setTab] = useState<string>(entities[0].tab)
  const [editing, setEditing] = useState<{ rec: Rec; isNew: boolean } | null>(null)

  const isHolidays = tab === 'Holidays'
  const cfg = entities.find((e) => e.tab === tab)

  return (
    <div className="content">
      <div className="banner">
        Everything here is editable and feeds the rollups and validation. Changes recompute the
        reports immediately. Roster hours are per-person; the committed scale and groups (incl. the
        Cluster no-holiday / liability rules) are fully configurable.
      </div>
      <DataTools />
      <div className="tag-row" style={{ marginBottom: 16 }}>
        {entities.map((e) => (
          <button key={e.tab} className={`btn sm ${e.tab === tab ? 'primary' : ''}`} onClick={() => setTab(e.tab)}>{e.tab}</button>
        ))}
        <button className={`btn sm ${isHolidays ? 'primary' : ''}`} onClick={() => setTab('Holidays')}>Holidays</button>
        <button className="btn sm danger" style={{ marginLeft: 'auto' }} onClick={() => { if (confirm('Reset all demo data to seed?')) resetDemo() }}>
          Reset demo data
        </button>
      </div>

      {isHolidays ? (
        <HolidaysEditor ds={ds} update={update} />
      ) : cfg ? (
        <EntityTable
          cfg={cfg}
          ds={ds}
          onAdd={() => setEditing({ rec: cfg.makeNew(), isNew: true })}
          onEdit={(rec) => setEditing({ rec: { ...rec }, isNew: false })}
        />
      ) : null}

      {editing && cfg && !isHolidays && (
        <RecordDrawer
          title={`${editing.isNew ? 'New' : 'Edit'} ${cfg.singular.toLowerCase()}`}
          fields={cfg.fields}
          initial={editing.rec}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          extraValidate={(rec) => {
            // Block an identity that collides with a different existing record.
            const list = ds[cfg.key] as unknown as Rec[]
            const origId = editing.rec[cfg.idKey]
            const newIdv = rec[cfg.idKey]
            const clash = list.some((x) => x[cfg.idKey] === newIdv && x[cfg.idKey] !== origId)
            return clash ? [`${cfg.idKey} "${String(newIdv)}" already exists.`] : []
          }}
          onSave={(rec) => {
            const list = ds[cfg.key] as unknown as Rec[]
            const origId = editing.rec[cfg.idKey]
            const exists = list.some((x) => x[cfg.idKey] === origId)
            const next = exists ? list.map((x) => (x[cfg.idKey] === origId ? rec : x)) : [...list, rec]
            update({ [cfg.key]: next } as unknown as Partial<Dataset>)
            setEditing(null)
          }}
          onDelete={() => {
            const reason = cfg.deleteGuard(String(editing.rec[cfg.idKey]))
            if (reason) { alert(`Cannot delete: ${reason}`); return }
            const list = ds[cfg.key] as unknown as Rec[]
            update({ [cfg.key]: list.filter((x) => x[cfg.idKey] !== editing.rec[cfg.idKey]) } as unknown as Partial<Dataset>)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function EntityTable({
  cfg, ds, onAdd, onEdit,
}: {
  cfg: EntityConfig
  ds: Dataset
  onAdd: () => void
  onEdit: (rec: Rec) => void
}) {
  const rows = ds[cfg.key] as unknown as Rec[]
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{cfg.tab}</h2>
        <span className="hint">{rows.length} record(s)</span>
        <div className="right">
          <button className="btn primary sm" onClick={onAdd}>+ New {cfg.singular.toLowerCase()}</button>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {cfg.columns.map((c) => <th key={c.label} className={c.num ? 'num' : ''}>{c.label}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={String(r[cfg.idKey]) || i}>
                {cfg.columns.map((c) => <td key={c.label} className={c.num ? 'num' : ''}>{c.render(r)}</td>)}
                <td><button className="btn ghost sm" onClick={() => onEdit(r)}>Edit</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={cfg.columns.length + 1} className="empty">No records yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DataTools() {
  const { ds, update } = useStore()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const onExcel = async (file: File) => {
    setBusy(true); setMsg(null)
    try {
      const buf = await file.arrayBuffer()
      const { dataset, summary } = await parseWorkbook(buf)
      if (summary.bookings === 0) throw new Error('No bookings found. Is this the SEG-Schedule workbook?')
      const ok = confirm(
        `Import will REPLACE the current data with:\n\n` +
        `• ${summary.bookings} bookings\n• ${summary.employees} employees\n• ${summary.programs} programs, ${summary.projects} projects, ${summary.tasks} tasks\n` +
        `• ${summary.chargeCodes} charge codes\n• ${summary.holidays} holidays\n• ${summary.weeks} weeks from ${summary.horizonStart}\n\nProceed?`,
      )
      if (!ok) { setBusy(false); return }
      update(dataset)
      setMsg({ ok: true, text: `Imported ${summary.bookings} bookings and ${summary.employees} employees from the workbook.` })
    } catch (e) {
      setMsg({ ok: false, text: `Import failed: ${e instanceof Error ? e.message : String(e)}` })
    }
    setBusy(false)
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(ds, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `seg-schedule-${ds.asOf}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const onJson = async (file: File) => {
    setBusy(true); setMsg(null)
    try {
      const parsed = JSON.parse(await file.text()) as Dataset
      if (!Array.isArray(parsed.bookings) || !Array.isArray(parsed.employees)) throw new Error('Not a SEG dataset file.')
      update(parsed)
      setMsg({ ok: true, text: `Loaded ${parsed.bookings.length} bookings from JSON.` })
    } catch (e) {
      setMsg({ ok: false, text: `Load failed: ${e instanceof Error ? e.message : String(e)}` })
    }
    setBusy(false)
  }

  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head">
        <h2>Import / export</h2>
        <span className="hint">Load the real SEG-Schedule.xlsx (parsed in your browser — nothing is uploaded) or back up / restore JSON.</span>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '14px 18px', alignItems: 'center' }}>
        <label className="btn primary sm" style={{ cursor: 'pointer' }}>
          {busy ? 'Working…' : 'Import Excel (.xlsx)'}
          <input type="file" accept=".xlsx" style={{ display: 'none' }} disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onExcel(f); e.target.value = '' }} />
        </label>
        <button className="btn sm" onClick={exportJson}>Export JSON</button>
        <label className="btn sm" style={{ cursor: 'pointer' }}>
          Import JSON
          <input type="file" accept=".json" style={{ display: 'none' }} disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onJson(f); e.target.value = '' }} />
        </label>
        {msg && <span className={`pill ${msg.ok ? 'good' : 'bad'}`} style={{ marginLeft: 4 }}>{msg.text}</span>}
      </div>
    </div>
  )
}

function HolidaysEditor({ ds, update }: { ds: Dataset; update: (p: Partial<Dataset>) => void }) {
  const [date, setDate] = useState('')
  const add = () => {
    if (!date || ds.holidays.includes(date)) return
    update({ holidays: [...ds.holidays, date].sort() })
    setDate('')
  }
  const remove = (h: string) => update({ holidays: ds.holidays.filter((x) => x !== h) })

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Holiday calendar</h2>
        <span className="hint">Subtracted from working days. The Cluster group ignores these.</span>
        <div className="right" style={{ gap: 8 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn primary sm" disabled={!date} onClick={add}>+ Add holiday</button>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Date</th><th></th></tr></thead>
          <tbody>
            {ds.holidays.map((h) => (
              <tr key={h}>
                <td>{h}</td>
                <td><button className="btn ghost sm" onClick={() => remove(h)}>Remove</button></td>
              </tr>
            ))}
            {ds.holidays.length === 0 && <tr><td colSpan={2} className="empty">No holidays.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import { useState } from 'react'

export type FieldType = 'text' | 'number' | 'date' | 'checkbox' | 'select'

export interface FieldSpec {
  key: string
  label: string
  type: FieldType
  options?: Array<{ value: string; label: string }>
  required?: boolean
  min?: number
  max?: number
  step?: number
  nullable?: boolean // for date fields that may be blank
  help?: string
}

export type Rec = Record<string, unknown>

export function RecordDrawer({
  title, fields, initial, isNew, onSave, onClose, onDelete, extraValidate,
}: {
  title: string
  fields: FieldSpec[]
  initial: Rec
  isNew: boolean
  onSave: (rec: Rec) => void
  onClose: () => void
  onDelete?: () => void
  extraValidate?: (rec: Rec) => string[]
}) {
  const [rec, setRec] = useState<Rec>(initial)
  const set = (key: string, value: unknown) => setRec((r) => ({ ...r, [key]: value }))

  const errors: string[] = []
  for (const f of fields) {
    const v = rec[f.key]
    if (f.required && (v === '' || v === null || v === undefined)) errors.push(`${f.label} is required.`)
    if (f.type === 'number' && v !== '' && v !== null && v !== undefined) {
      const num = Number(v)
      if (Number.isNaN(num)) errors.push(`${f.label} must be a number.`)
      else if (f.min !== undefined && num < f.min) errors.push(`${f.label} must be ≥ ${f.min}.`)
      else if (f.max !== undefined && num > f.max) errors.push(`${f.label} must be ≤ ${f.max}.`)
    }
  }
  if (extraValidate) errors.push(...extraValidate(rec))

  return (
    <div className="scrim" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head"><h2>{title}</h2></div>
        <div className="drawer-body">
          {fields.map((f) => (
            <div className="form-row" key={f.key}>
              <label>{f.label}{f.required && <span style={{ color: 'var(--bad)' }}> *</span>}</label>
              {f.type === 'select' ? (
                <select value={String(rec[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)}>
                  <option value="">Select…</option>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'checkbox' ? (
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
                  <input type="checkbox" checked={Boolean(rec[f.key])} onChange={(e) => set(f.key, e.target.checked)} />
                  <span className="muted">{f.help ?? 'Enabled'}</span>
                </label>
              ) : f.type === 'number' ? (
                <input type="number" min={f.min} max={f.max} step={f.step ?? 1}
                  value={rec[f.key] === null || rec[f.key] === undefined ? '' : String(rec[f.key])}
                  onChange={(e) => set(f.key, e.target.value === '' ? '' : Number(e.target.value))} />
              ) : f.type === 'date' ? (
                <input type="date" value={String(rec[f.key] ?? '')}
                  onChange={(e) => set(f.key, e.target.value === '' && f.nullable ? null : e.target.value)} />
              ) : (
                <input type="text" value={String(rec[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)} />
              )}
              {f.help && f.type !== 'checkbox' && <span className="muted" style={{ fontSize: 11 }}>{f.help}</span>}
            </div>
          ))}
          {errors.length > 0 && (
            <div className="banner" style={{ background: '#fae3df', color: '#8a2c1c', borderColor: '#e7c4bd' }}>
              {errors.map((e, i) => <div key={i}>• {e}</div>)}
            </div>
          )}
        </div>
        <div className="drawer-foot">
          {onDelete && !isNew && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={onDelete}>Delete</button>}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={errors.length > 0} onClick={() => onSave(rec)}>Save</button>
        </div>
      </div>
    </div>
  )
}

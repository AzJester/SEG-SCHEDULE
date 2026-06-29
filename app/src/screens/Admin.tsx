import { useState } from 'react'
import { useStore } from '../store'
import type { CommittedTier } from '../types'

export function Admin() {
  const { ds, update, resetDemo } = useStore()
  const [tab, setTab] = useState<'roster' | 'committed' | 'programs' | 'holidays'>('roster')

  const setTier = (i: number, patch: Partial<CommittedTier>) =>
    update({ committedScale: ds.committedScale.map((t, j) => (j === i ? { ...t, ...patch } : t)) })

  const grpName = new Map(ds.groups.map((g) => [g.id, g.name]))

  return (
    <div className="content">
      <div className="banner">
        Reference data drives validation and the rollups. The committed scale is editable here
        (change ③ — final values TBD with Melanie); roster hours are per-person (change ②).
      </div>
      <div className="tag-row" style={{ marginBottom: 16 }}>
        {(['roster', 'committed', 'programs', 'holidays'] as const).map((t) => (
          <button key={t} className={`btn sm ${t === tab ? 'primary' : ''}`} onClick={() => setTab(t)}>
            {t === 'roster' ? 'Roster' : t === 'committed' ? 'Committed scale' : t === 'programs' ? 'Programs' : 'Holidays'}
          </button>
        ))}
        <button className="btn sm danger" style={{ marginLeft: 'auto' }} onClick={() => { if (confirm('Reset all demo data to seed?')) resetDemo() }}>
          Reset demo data
        </button>
      </div>

      {tab === 'roster' && (
        <div className="panel"><div className="panel-head"><h2>Roster</h2><span className="hint">{ds.employees.length} people · per-person weekly hours</span></div>
          <div className="table-scroll"><table>
            <thead><tr><th>Last name</th><th>Group</th><th className="num">Weekly hrs</th><th>Type</th><th>Employment</th><th>Flag</th></tr></thead>
            <tbody>{ds.employees.map((e) => (
              <tr key={e.id}>
                <td>{e.lastName}</td>
                <td><span className="pill gray">{grpName.get(e.groupId)}</span></td>
                <td className="num">{e.weeklyHours}</td>
                <td>{e.fullTime ? 'Full-time' : 'Part-time'}</td>
                <td className="muted">{e.employmentStart} → {e.employmentEnd ?? 'present'}</td>
                <td>{e.isPlaceholder ? <span className="pill warn">Unavailable</span> : grpName.get(e.groupId) === 'Cluster' ? <span className="pill accent">Compute</span> : ''}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}

      {tab === 'committed' && (
        <div className="panel"><div className="panel-head"><h2>Committed scale</h2><span className="hint">Edit labels and which tiers count as "committed"</span></div>
          <div className="table-scroll"><table>
            <thead><tr><th>Code</th><th>Label</th><th>Counts as committed?</th></tr></thead>
            <tbody>{ds.committedScale.map((t, i) => (
              <tr key={t.code}>
                <td><code className="inline">{t.code}</code></td>
                <td><input type="text" style={{ width: '100%' }} value={t.label} onChange={(e) => setTier(i, { label: e.target.value })} /></td>
                <td><input type="checkbox" checked={t.committed} onChange={(e) => setTier(i, { committed: e.target.checked })} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}

      {tab === 'programs' && (
        <div className="panel"><div className="panel-head"><h2>Programs</h2><span className="hint">{ds.programs.length} programs</span></div>
          <div className="table-scroll"><table>
            <thead><tr><th>Program</th><th>PM</th><th>Contract</th><th className="num">Projects</th><th className="num">Charge codes</th></tr></thead>
            <tbody>{ds.programs.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td><td>{p.pm}</td><td><span className="pill gray">{p.contractType}</span></td>
                <td className="num">{ds.projects.filter((x) => x.programId === p.id).length}</td>
                <td className="num">{ds.chargeCodes.filter((x) => x.programId === p.id).length}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}

      {tab === 'holidays' && (
        <div className="panel"><div className="panel-head"><h2>Holiday calendar</h2><span className="hint">Subtracted from working days (Cluster ignores these)</span></div>
          <div className="table-scroll"><table>
            <thead><tr><th>Date</th></tr></thead>
            <tbody>{ds.holidays.map((h) => <tr key={h}><td>{h}</td></tr>)}</tbody>
          </table></div>
        </div>
      )}
    </div>
  )
}

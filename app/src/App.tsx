import { useState } from 'react'
import { StoreProvider, useStore } from './store'
import { Bookings } from './screens/Bookings'
import { Schedule } from './screens/Schedule'
import { Reports } from './screens/Reports'
import { Liability } from './screens/Liability'
import { Admin } from './screens/Admin'

type View = 'bookings' | 'schedule' | 'reports' | 'liability' | 'admin'

const NAV: Array<{ id: View; label: string; ico: string; title: string; sub: string }> = [
  { id: 'bookings', label: 'Bookings', ico: '✎', title: 'Bookings', sub: 'The plan: one row per person · task. Edits recompute everything live.' },
  { id: 'schedule', label: 'Schedule', ico: '▦', title: 'Schedule', sub: 'Per-person weekly loading heatmap.' },
  { id: 'reports', label: 'Reports', ico: '📊', title: 'Reports', sub: 'Pivot views — the workbook outputs, filtered together.' },
  { id: 'liability', label: 'Liability', ico: '⚠', title: 'Liability / gap', sub: 'Who is on payroll but not booked to funded work, and when.' },
  { id: 'admin', label: 'Admin', ico: '⚙', title: 'Reference data', sub: 'Roster, committed scale, programs, holidays.' },
]

function Shell() {
  const [view, setView] = useState<View>('reports')
  const { ds } = useStore()
  const meta = NAV.find((n) => n.id === view)!

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          <div className="mark">SEG Schedule</div>
          <div className="sub">Staff loading & liability</div>
        </div>
        {NAV.map((n) => (
          <button key={n.id} className={`nav-item ${n.id === view ? 'active' : ''}`} onClick={() => setView(n.id)}>
            <span className="ico">{n.ico}</span>{n.label}
          </button>
        ))}
        <div className="spacer" />
        <div className="note">
          Demo on synthetic data · as-of {ds.asOf}<br />
          {ds.bookings.length} bookings · {ds.weeks} weeks
        </div>
      </nav>
      <main className="main">
        <div className="topbar">
          <h1>{meta.title}</h1>
          <p>{meta.sub}</p>
        </div>
        {view === 'bookings' && <Bookings />}
        {view === 'schedule' && <Schedule />}
        {view === 'reports' && <Reports />}
        {view === 'liability' && <Liability />}
        {view === 'admin' && <Admin />}
      </main>
    </div>
  )
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

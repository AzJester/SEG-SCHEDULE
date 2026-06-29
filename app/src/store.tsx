import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Booking, Dataset } from './types'
import { seedDataset } from './data/seed'
import { buildContext, type EngineContext } from './engine/proration'

const STORAGE_KEY = 'seg-schedule-v1'

function load(): Dataset {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Dataset
  } catch {
    /* ignore corrupt storage */
  }
  return seedDataset
}

interface Store {
  ds: Dataset
  ctx: EngineContext
  upsertBooking: (b: Booking) => void
  deleteBooking: (id: string) => void
  update: (patch: Partial<Dataset>) => void
  resetDemo: () => void
}

const StoreCtx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ds, setDs] = useState<Dataset>(load)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ds)) } catch { /* quota */ }
  }, [ds])

  const ctx = useMemo(() => buildContext(ds), [ds])

  const store = useMemo<Store>(() => ({
    ds,
    ctx,
    upsertBooking: (b) =>
      setDs((d) => {
        const exists = d.bookings.some((x) => x.id === b.id)
        return {
          ...d,
          bookings: exists ? d.bookings.map((x) => (x.id === b.id ? b : x)) : [...d.bookings, b],
        }
      }),
    deleteBooking: (id) => setDs((d) => ({ ...d, bookings: d.bookings.filter((x) => x.id !== id) })),
    update: (patch) => setDs((d) => ({ ...d, ...patch })),
    resetDemo: () => { localStorage.removeItem(STORAGE_KEY); setDs(seedDataset) },
  }), [ds, ctx])

  return <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>
}

export function useStore(): Store {
  const s = useContext(StoreCtx)
  if (!s) throw new Error('useStore must be used within StoreProvider')
  return s
}

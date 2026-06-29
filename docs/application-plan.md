# SEG Flexible Staff Scheduling — Application Build Plan

A plan for replacing `SEG-Schedule.xlsx` with a purpose-built web application.

Reference: `SEG_Schedule_Architecture.svg` (Rev. B) in the repo root documents the
current workbook architecture and the four pending team-feedback changes. This plan
carries those changes forward as first-class requirements.

---

## 1. Why move off Excel

The workbook works, but its design is the source of its problems:

- **A live formula grid is the engine.** ~2,300 booking rows × ~178 weekly columns of
  the `Manpower` LAMBDA recalc on every edit. That calc chain is ~7.8 MB and is the
  direct cause of the size, slowness, and crash history (the same pain that pushed SEG
  off Microsoft Project years ago).
- **Outputs are only correct after a manual Power Query refresh.** Stale pivots are the
  most likely failure mode. Correctness depends on a human remembering a step.
- **Single-writer.** One person edits and re-posts the file on a cadence and emails it
  out. No concurrent editing, no real history, no live truth.
- **The data model fights the work.** One charge code per row forces duplicate rows for
  split-funded tasks. Weekly hours are hard-coded to 40. The committed scale is baked in.

An application keeps the *exact same logic* but moves the heavy computation server-side,
makes the database the single source of truth, and gives every user a live, filtered view
without anyone refreshing or emailing anything.

### What must not change

The numbers. The new system has to reproduce today's pivot outputs before anyone trusts
it. Proration math, holiday handling, the four week-overlap cases, FTE-vs-hours, and the
liability calculation all carry over unchanged in *meaning*. Section 8 makes matching the
current outputs a hard gate.

---

## 2. Pending changes to fold in (from team feedback, Rev. B)

These are requirements for the rebuild, not nice-to-haves:

| # | Area | Change |
|---|------|--------|
| ① | Booking model | Support **multiple charge codes with a % split on one row**. One row = one person · one task; charge-code allocation lives inside the row and must sum to 100%. |
| ② | Roster + hours | **Per-person weekly hours** (not a flat 40). The hours view scales by each person's planned hours/week. Part-time and non-standard schedules are normal. |
| ③ | Committed scale | The committed scale **is being revised** (final values TBD — Melanie). Make it **data-driven and configurable**, not hard-coded, so it can change without a rebuild. |
| ④ | Gap analysis | **Exclude Unavailable placeholders and the Cluster group** from missing-hours and liability. |

Open question that gates Phase 3: the **new committed values from Melanie**, and whether
the new scale changes the meaning of the slicer tiers (several views filter on the
`4 - Yes` style codes). The model below treats committed as configurable so this can land
late without rework.

---

## 3. Target architecture

```
                         ┌──────────────────────────────────────────┐
   Browser (SPA)         │  React + TypeScript, minimalist UI         │
   ──────────────        │  Booking grid · Reports · Liability · Admin│
                         └───────────────┬────────────────────────────┘
                                         │  HTTPS / JSON
                         ┌───────────────▼────────────────────────────┐
   Backend API           │  FastAPI (Python)                           │
   ──────────────        │  • Proration engine (Manpower/Clusterpower) │
                         │  • Aggregation / reporting service          │
                         │  • Validation, auth, audit                  │
                         └───────────────┬────────────────────────────┘
                                         │  SQL
                         ┌───────────────▼────────────────────────────┐
   Data                  │  PostgreSQL  (bookings = source of truth)   │
                         │  Derived weekly effort computed, not stored │
                         └─────────────────────────────────────────────┘
```

**The key architectural decision:** store bookings as rows; do **not** store the weekly
grid. The grid is derived data. Computing 2,300 bookings × 178 weeks server-side is
milliseconds of work in Python/SQL — the same calculation that crashes Excel is trivial
when it isn't 400,000 live cells in a spreadsheet. Cache results and recompute on edit.

### Recommended stack and why

- **PostgreSQL** — relational data with clear keys (employees, programs, bookings,
  allocations). Handles the roster/booking/charge-code relationships cleanly.
- **FastAPI (Python)** — the proration and aggregation logic is date math and
  group-by rollups. Python (with `numpy`/`pandas` and `numpy.busday_count` for
  NETWORKDAYS) expresses this directly, is trivial to unit-test against the workbook,
  and makes the Excel import/export (via `openpyxl`) straightforward.
- **React + TypeScript** with a component kit (**Mantine** or **shadcn/ui**) for a clean,
  minimal UI. **TanStack Table** for the booking grid and pivot views, **TanStack Query**
  for data fetching/caching.
- **Auth: Microsoft Entra ID (Azure AD) SSO.** SEG is a Microsoft shop and the file is
  "Internal Use Only." SSO gives identity for free and fits existing accounts.
- **Hosting: Azure** (App Service or Container Apps + Azure Database for PostgreSQL) for
  the same reason. A single container on any host works too.

This is a recommendation, not a constraint. A TypeScript-only stack (Next.js full-stack,
Prisma, Postgres) is a reasonable alternative if the team prefers one language. The data
model, engine spec, and phasing below are stack-independent.

---

## 4. Data model

Bookings are the source of truth. Everything else is reference data or derived.

**Reference / setup**
- `groups` — TDAA, TDAM, TDES, TDEV, PMO, VPE, SUB, SEG South, Dahlgren, Cluster, FTO,
  TD-Other. Flags: `excluded_from_liability` (true for Cluster), `uses_holidays`
  (false for Cluster → Clusterpower behavior).
- `programs` — ~90 rows: name, PM, contract type (mostly CPFF).
- `projects` — belong to a program.
- `tasks` — belong to a project.
- `charge_codes` — e.g. `SG040.00.000.6100.006.401000`, linked to program/project.
- `employees` (roster) — last name, group, `weekly_hours` (**per person** — change ②),
  full/part-time, employment start/end. `is_placeholder` true for `**Unavailable …`
  open positions (**excluded from liability** — change ④).
- `committed_scale` — **configurable** (change ③): code, label, sort order, and a flag
  for which tiers count as "committed" for filtering. Seed with the current values
  (`0 - No` … `4 - Yes`, `10 - Done`); replace with Melanie's new values when ready.
- `holidays` — date list, FY2021 onward.

**Plan (the bookings)**
- `bookings` — one row = **one person · one task** (change ①): employee, program,
  project, task, LCAT (for T&M), start date, end date, `unit` (FTE fraction: 1.0 full,
  0.5 half), `committed` (FK to committed_scale), notes.
- `booking_charge_allocations` — child rows: booking → charge_code → `percent`.
  **Must sum to 100% per booking** (validated). This is what lets one task span multiple
  charge codes on a single booking row instead of duplicated rows.

**Derived (computed, cached — never hand-entered)**
- Weekly effort per booking (FTE) and per charge-code allocation (hours).
- The aggregate rollups that today are pivot caches.
- Liability/gap per person per week.

---

## 5. The compute engine (replaces the `Manpower` LAMBDA)

One module, heavily tested, that every number flows through.

**Weekly FTE for one booking in one Monday-anchored week:**

```
effort_fte(week) = NETWORKDAYS(overlap(booking[start,end], week), minus holidays) / 5 × unit
```

- Weeks are Monday→Friday (5 working days). `numpy.busday_count` with a holiday list is
  the direct NETWORKDAYS equivalent.
- The four overlap cases (outside the window → 0, full week, starts mid-week, ends
  mid-week) fall out of intersecting the booking window with the week window before
  counting working days. A normal week → `unit`; a one-holiday week → `0.8 × unit`;
  partial weeks prorate to the day. Same behavior as the LAMBDA.
- **Cluster group** uses the `Clusterpower` variant: identical, but **no holiday
  exclusion** (CPU/GPU capacity runs through holidays). Implemented as the same function
  with an empty holiday set, driven by `groups.uses_holidays = false`.

**Hours (change ②):**

```
hours(week) = effort_fte(week) × employee.weekly_hours
```

A full-time 40-hr person at unit 1.0 → 40 hrs in a normal week; a 20-hr part-timer →
20 hrs. This replaces the flat ×40.

**Charge-code split (change ①):**

```
hours_for_charge(week, code) = hours(week) × allocation.percent
```

The weekly horizon is configurable (today: FTE to 12/25/2028, hours to 12/27/2027 — the
app should use **one consistent horizon** and fix that mismatch).

---

## 6. Reporting / aggregation (replaces the 9 pivots + slicers)

A reporting service runs group-by rollups over the computed weekly values. Every report
takes the same filter set, so one filter bar drives all views (the slicers today):
**Committed, Group, Program, Project, Employee**, plus a date range.

Parity targets, one report each:

- **Staff Load** — group → person → project, weekly.
- **Staff Per Project** (+ Hours, + As-Hours) — project → committed → task → person.
- **Projects & Programs** — demand by program.
- **Charge Codes** — rolled up by charge code (uses the % split), ties plan to billing.
- **Hours per Project** and **Hours per Program-Year**.
- **Liability / gap** — see below.

UI: expandable pivot-style tables (TanStack Table grouping) and a per-person weekly
**heatmap** for at-a-glance loading. CSV/Excel export on every view.

**Liability / gap (the headline insight, change ④):**

```
gap(person, week) = capacity(person, week) − booked_hours(person, week)
```

`capacity` derives from the person's `weekly_hours`, prorated by working days in the week
and bounded by their employment start/end. **Exclude** `is_placeholder` employees
(Unavailable) and the Cluster group. Surfaces who is on payroll but not booked to funded
work, and when.

---

## 7. The application (clean, minimal GUI)

Five screens. Restrained, dense-where-it-matters, no chrome the planners don't need.

1. **Bookings** — the workhorse, replaces the 12 group tabs. A filterable, inline-editable
   table of bookings. "Group" is a filter, so a planner sees just their group and works as
   they do today. Add/edit drawer with cascading Program → Project → Task, employee
   picker, LCAT, **multi-charge-code rows with % that must total 100%**, start/end,
   unit, committed, notes. Validation inline (no bad codes, no >100% splits, no dates
   outside employment).

2. **Schedule** — the per-person / per-project weekly heatmap. Read-only, computed live.
   This is "Staff Load" made visual.

3. **Reports** — the pivot parity views (Section 6) behind one shared filter bar.

4. **Liability** — the gap dashboard. Under-booked people and weeks, front and center.

5. **Admin** — reference data: roster (with per-person hours), programs + PMs, groups,
   charge codes, holidays, and the **editable committed scale**. Role-gated.

Cross-cutting:
- **Snapshots / "posting"** — replaces "Melanie posts a version and emails it." Save a
  named, dated snapshot (schedule-as-of), share a read-only link, export to Excel/PDF.
  History is kept; no more files in inboxes.
- **Roles** — planners edit their group; leads view all; admins manage reference data.
- **Audit log** — who changed what, when. Something the workbook never had.

---

## 8. Migration and the correctness gate

**Importer:** parse the existing `SEG-Schedule.xlsx` — the 12 group tables, roster,
programs, committed scale, holidays — into the new schema. One charge code per existing
row collapses into the new allocation model where a person·task already repeats only to
split funding.

**Golden-master test (the hard gate):** export the current workbook's pivot values and
assert the engine reproduces them cell-for-cell across a representative slice of
people/programs/weeks. **No cutover until this passes.** This is what turns "trust me" into
"the numbers match." Decide up front how to treat the per-person-hours change ② (the new
hours will *intentionally* differ where someone isn't 40 hrs/week — those deltas are
expected and should be reviewed, not treated as failures).

---

## 9. Phasing

| Phase | Scope | Exit criteria |
|-------|-------|---------------|
| **0 — Discovery** | Lock the new committed scale (Melanie ③), confirm proration edge cases, confirm horizon, SSO/hosting decision, build-vs-buy decision. | Decisions signed off. |
| **1 — Engine + data** | Schema, importer, proration engine, golden-master tests against the workbook. | Engine reproduces current pivot numbers (Section 8). |
| **2 — Read-only reporting** | All 9 report views + filters + heatmap, fed from imported data. | Users validate views match the workbook. |
| **3 — Editing** | Booking CRUD, validation, multi-charge-code (①), per-person hours (②), live recompute. | Planners can replace their tab end-to-end. |
| **4 — Insight + posting** | Liability dashboard (④), snapshots, Excel/PDF export, audit, roles. | Replaces the email-the-file workflow. |
| **5 — Rollout** | Parallel run beside the workbook, training, then decommission Excel. | Workbook retired. |

Phases 1–2 de-risk everything: the team sees real numbers in a real UI before a single
write path exists, and the golden-master gate proves correctness early.

---

## 10. Key decisions to confirm

1. **Build vs. buy.** This plan assumes a custom build. If an off-the-shelf
   resource-planning tool is on the table, evaluate it against Sections 4–6 (multi-charge
   split, per-person hours, configurable committed scale, the specific liability rule)
   before committing to either path.
2. **Stack** — recommended FastAPI + Postgres + React/TS; TypeScript-only is a fine
   alternative.
3. **Hosting + auth** — recommended Azure + Entra ID SSO given the Microsoft environment.
4. **The new committed scale** (③) — blocks Phase 3; everything else can proceed without it.
5. **Horizon** — fix the FTE-vs-hours window mismatch by standardizing on one.

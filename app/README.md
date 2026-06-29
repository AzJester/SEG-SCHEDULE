# SEG Schedule — web app (demo)

A client-side rebuild of `SEG-Schedule.xlsx`: labor forecasting and staff
scheduling, running entirely in the browser. See `../docs/application-plan.md`
for the full design rationale and `../SEG_Schedule_Architecture.svg` for the
workbook architecture this replaces.

## What it does

- **Bookings** — the plan. One row = one person · one task, with charge codes
  **split by % inside the row** (no more duplicate rows for split funding).
- **Schedule** — per-person weekly loading heatmap.
- **Reports** — the workbook's pivot views (Staff Load, Staff Per Project,
  Projects & Programs, Charge Codes, Hours per Program-Year) behind one shared
  filter bar.
- **Liability** — capacity − booked, per person per week, excluding Unavailable
  placeholders and the Cluster group.
- **Admin** — roster (per-person weekly hours), the editable committed scale,
  programs, and the holiday calendar.

The proration engine (`src/engine/`) reimplements the workbook's
`Manpower` / `Clusterpower` LAMBDA: `NETWORKDAYS(overlap − holidays) / 5 × unit`,
with the Cluster no-holiday variant and hours scaled by each person's weekly
hours. Bookings are the source of truth; the weekly grid is computed, never
stored. Edits persist to the browser's localStorage. "Reset demo data" in Admin
restores the seed.

> The seed data in `src/data/seed.ts` is **synthetic** — invented to exercise
> every feature. To use real numbers, replace that dataset (it conforms to the
> `Dataset` type in `src/types.ts`).

## Develop

```bash
cd app
npm install
npm run dev      # local dev server
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build
```

## Deploy (GitHub Pages)

`.github/workflows/deploy-pages.yml` builds `app/` and publishes to Pages on
every push to `main` (and the working branch). **One-time setup:** in the repo,
go to **Settings → Pages → Source → "GitHub Actions"**. The site then serves at
`https://<owner>.github.io/SEG-SCHEDULE/`.

The Vite `base` is `/SEG-SCHEDULE/` to match the project-Pages path. If the repo
is renamed or served from a custom domain, set `BASE_PATH` (e.g. `BASE_PATH=/`)
when building.

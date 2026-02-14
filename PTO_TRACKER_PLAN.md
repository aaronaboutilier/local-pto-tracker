# PTO Tracker Plan & Progress

## Objective
Build a local-first PTO tracker that is decoupled from calendar rendering, with:
- `localStorage` persistence
- Fiscal year boundaries starting in April
- PTO buckets (`vpp`, `vacation`, `sick`, `personal`)
- Hours ↔ Days display toggle
- Event metadata stored in `extendedProps`

---

## Architecture Summary

### 1) Data Model & Storage Strategy
Store under a single key:
- `local_pto_tracker_v1`

Conceptual structure:

```json
{
  "settings": {
    "hoursPerDay": 7.5,
    "fiscalYearStartMonth": 3
  },
  "balances": {
    "2025": {
      "vacation": 112.5,
      "vpp": 37.5,
      "sick": 75,
      "personal": 15
    }
  },
  "events": []
}
```

Data responsibilities:
- **Accounting layer**: fiscal-year math, balances, usage totals
- **Calendar layer**: display/edit events only

### 2) Composable Store (`src/composables/usePtoStore.js`)
Responsibilities:
- Maintain reactive state (`settings`, `yearlyBalances`, `events`)
- Compute fiscal year via `getFiscalYear(date)` with April boundary
- Compute `currentFy`, `activeBalance`, and `usageStats`
- `load()` and `save()` from/to `localStorage`
- Expose actions like `addEvent(event)`
- Deep-watch state for auto-save

Default balances (hours):
- `vacation`: 112.5
- `vpp`: 37.5
- `sick`: 75
- `personal`: 15

### 3) PTO Tracker UI (`src/components/PtoTracker.vue`)
Responsibilities:
- Show FY heading and bucket rows
- Toggle display mode: `days` / `hours`
- Convert by `hoursPerDay`
- Render usage + balance with progress bars

Buckets:
- VPP Vacation
- Regular Vacation
- Sick Days
- Personal

### 4) Calendar Integration
- Add event metadata during create/edit:
  - `extendedProps.type`
  - `extendedProps.hours`
- Keep FullCalendar events compatible:

```js
{
  title: 'VPP Day',
  start: '2025-06-12',
  extendedProps: {
    type: 'vpp',
    hours: 7.5
  },
  color: '#8E44AD'
}
```

### 5) Fiscal Year Rules
- March 30, 2025 → FY2024
- April 2, 2025 → FY2025

### 6) VPP vs Vacation Recommendation
Track VPP separately from regular vacation and visualize both side-by-side.
Optional behavior to add later: suggest consuming VPP first.

---

## Implementation Backlog

### Phase A — Store & Persistence
- [x] Create `src/composables/usePtoStore.js`
- [x] Add `load()` on app startup
- [x] Add deep auto-save to `localStorage`
- [x] Add fiscal year helpers and computed stats

### Phase B — PTO Tracker UI
- [x] Create `src/components/PtoTracker.vue`
- [x] Add days/hours toggle
- [x] Add bucket usage progress bars
- [x] Mount tracker into app layout
- [x] Add fiscal-year start month and bucket-size settings controls

### Phase C — Event Metadata Wiring
- [x] Add `extendedProps.type` to events
- [x] Add `extendedProps.hours` to events
- [x] Set default PTO hours for all-day entries
- [x] Ensure FY usage computes from `event.start`

### Phase D — Event Creation/Edit UX (Next)
- [x] Add create/edit modal
- [x] Add PTO Type dropdown
- [x] Add Duration (hours) input
- [x] Save through composable actions

---

## Progress Tracker

## Status Legend
- `DONE`: implemented and verified
- `IN PROGRESS`: partially implemented
- `TODO`: not started

| Area | Status | Notes |
|---|---|---|
| Calendar shell (Year/Month/Week/Day views) | DONE | Implemented with toolbar + navigation + FullCalendar/custom year grid |
| Sample event rendering | DONE | Now flows through composable state and FullCalendar |
| localStorage persistence | DONE | `usePtoStore` loads/saves under `local_pto_tracker_v1` |
| Fiscal-year accounting (April start) | DONE | Implemented via `getFiscalYear()` and FY-scoped `usageStats` |
| PTO buckets (VPP/Vacation/Sick/Personal) | DONE | Balances + usage totals wired into tracker |
| Days/Hours toggle UI | DONE | Implemented in `PtoTracker.vue` |
| Event metadata (`type`, `hours`) | DONE | Added to sample events with fallback defaults in store |
| Event create/edit modal | DONE | Modal wired to date click + event click with store upsert/delete |
| PTO settings options (FY start + bucket sizes) | DONE | Sidebar controls update settings and current FY bucket sizes with local persistence |

---

## Next Implementation Slice
1. Optional: add drag/resize support and write-back to `extendedProps.hours`.
2. Optional: add recurring PTO templates (e.g., monthly personal day).
3. Optional: add export/import JSON backup for local-first portability.
4. Optional: add VPP-first deduction helper recommendations.

# Bulk Issue Report — Design

**Bead:** PP-sn34
**Date:** 2026-07-12
**Prototype:** [`2026-07-12-bulk-report-prototype.html`](./2026-07-12-bulk-report-prototype.html) (open in a browser; interactive)
**Status:** Design approved, ready for implementation plan

## Problem

A technician walks the floor and finds problems on a dozen machines. Today the only
way to record them is to type a list into a group chat or email — like this real
example from last night:

> Hokus Pokus: not reading drained ball in trough about half the time
> Grand Prix: right spinner rejecting
> Future Spa: Key broken off in back box, can't turn extra balls off
> Torpedo Alley: not kicking out any ball to start the game …
> Harlem: Start button gets stuck

…and then someone re-enters each line into the single-issue `/report` form, one at a
time. That's slow and lossy.

**The person who wrote that list should be the one entering it — directly.** This
feature is an _authoring_ tool: a technician bangs out "machine + what's wrong" many
times in one grid and submits the batch. It is **not** a "paste someone else's block
and parse it" tool — the author is present, so structured fast entry beats fragile
text parsing.

## Scope

- **In:** desktop-first authoring grid; technician+ only; per-row and batch submit;
  reuse of the existing issue fields (machine, title, severity, priority, status,
  frequency, assignee, watch, description).
- **Out:** photo/image upload (explicitly dropped); paste-to-seed parsing; anonymous/
  public use; mobile-optimized layout (mobile is secondary — the grid should not
  break, but the design target is desktop).

## Users & access

- **Route:** `/report/bulk` (sibling of the existing `/report`).
- **Access:** **technician and admin only.** Add a matrix permission
  `issues.report.bulk` (technician: true, admin: true; everyone else false) so
  enforcement runs through `checkPermission()` per CORE-ARCH-008 and the
  `/help/permissions` page auto-documents it. Members, guests, and anonymous visitors
  never see the page (redirect or 403).
- Rationale for the floor: bulk creation is a maintenance-workflow power tool, and the
  technician+ gate is also the abuse control (see Rate limiting).

## Layout (settled in prototype)

A vertical list of issue rows on the PinPoint dark theme, using the real form
controls (native selects, not badges). Each row **reflows** between two states:

**Collapsed (2 lines)** — the fast-triage view:

- Line 1: `Machine` · `Severity` · `Priority` · **More ▾**
- Line 2: `Problem (issue title)` · **Submit ▸**

**Expanded (4 lines)** — the full form:

- Line 1: `Machine` · `Problem (issue title)` · **▴** (collapse)
- Line 2: `Severity` · `Priority` · `Status` · `Frequency`
- Line 3: `Description`
- Line 4: `Assignee` · `Watch` · **Submit ▸**

Notes:

- The **More ▾ / ▴** toggle lives at the end of line 1 in both states, so it stays put
  as the row reflows. Collapsed leads with machine + severity + priority so a screen of
  rows scans as "which machine, how bad, what."
- **Machine** is a searchable select that resolves to a real `machineId` (same model as
  the single-report form) — **not** free text. This makes "unresolved machine" nearly
  impossible; a "bad row" is just a missing machine or empty problem.
- **Problem** is the issue title.
- Follow `pinpoint-design-bible` for surfaces, spacing, and the page archetype; align
  the badge/label vocabulary with `STATUS/SEVERITY/PRIORITY/FREQUENCY_CONFIG`.
- Two view controls at the page level: **density** (comfortable/compact) and
  **Expand all / Collapse all**. (Density can be deferred if it complicates v1.)
- No per-row delete control. Unwanted rows are simply left un-submitted; an empty row is
  ignored by submit.

### Defaults per new row

`status: new`, `severity: minor`, `priority: medium`, `frequency: intermittent`,
`watch: true`, `assignee: unassigned`. These match the schema defaults, so most rows
need only machine + problem before submitting.

## Submission

Two paths, both reusing the existing `createIssue` service (so timeline events,
watcher setup, notifications, and idempotency all come for free):

1. **Per-row quick-submit** — the row's **Submit ▸** creates that single issue
   immediately. On success the row collapses to a slim confirmation strip
   (✓ machine — problem · Created #NN) with an **Undo** affordance, and the pending
   count drops. This supports the "trickle-submit while walking the list" workflow.
2. **Submit all** — the bottom bar creates every remaining ready row in one pass
   (iterating `createIssue`, **not** a single DB transaction).

**Partial failure (decided):** on Submit all, **create the good rows and keep the bad
rows in place, flagged inline with a reason** (e.g. missing machine). Never
all-or-nothing; never discard typed data. A good row that succeeds becomes a
confirmation strip; a bad row stays editable with its error until fixed and resubmitted.

**Idempotency:** each row carries a client-generated idempotency key passed to
`createIssue`, so a double-click, a retry, or a Submit-all that overlaps a per-row
submit never creates a duplicate.

**Reporter & permissions:** `reportedBy` = the current technician. Techs may set every
field directly — no field-downgrade logic like the public `/report` path (which forces
`status=new`, `priority=medium` for restricted reporters).

**Notifications:** dispatched after each issue commits via `after()` + the existing
`planNotification`/`dispatchNotification` flow (CORE-ARCH-011 / Doodle-Bug safe). A
batch of N issues produces the same notification behavior as N single reports.

## Rate limiting (bypass — decided)

**The public IP rate limiter (`checkPublicIssueLimit`) and Turnstile CAPTCHA are NOT
invoked on this path.** Those exist to throttle _anonymous_ public reporting; this route
is authenticated and permission-gated, so the technician+ gate is the abuse control.
A batch of 9 issues would otherwise blow the 5-per-15-min public limit immediately.

To guard against runaway accidents (not abuse), enforce a **generous soft cap** on
rows per batch server-side (~50). Exceeding it is a clear validation error, not a
silent throttle.

## Progressive enhancement

The grid is an inherently interactive authoring surface (dynamic add-row, reflow,
quick-submit), so it is a client component — a sanctioned "interaction leaf" exception
to the Server-Components default. Submission still goes through server actions. Where
feasible, per-row submit is a `<form action={serverAction}>` so a single row can submit
without client JS; the batch/add-row conveniences are JS enhancements on top.

## Testing (per CORE-TEST-005)

- **Integration (PGlite + direct action):** the batch/single server action — permission
  gate (technician+ only), N issues created with correct fields, partial-failure creates
  good rows and reports bad ones, idempotency key prevents duplicates, soft cap enforced.
- **RTL unit:** grid form-state, row reflow (collapsed ↔ expanded), quick-submit →
  confirmation strip → undo, add-row.
- **Smoke E2E:** the page renders without a 500 for a technician and is forbidden for a
  member.

## Open follow-ups (not v1 blockers)

- Density control may be deferred if it complicates the first cut.
- Mobile layout polish (secondary target).
- Possible future "paste-to-seed rows" accelerator — explicitly out of scope now.

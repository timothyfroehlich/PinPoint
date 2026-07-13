# Quick Issue Report — Design

**Bead:** PP-sn34
**Date:** 2026-07-12
**Prototype:** [`2026-07-12-quick-report-prototype.html`](./2026-07-12-quick-report-prototype.html) (open in a browser; interactive)
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

- **In:** desktop-first authoring grid; member+ only; per-row and batch submit;
  reuse of the existing issue fields (machine, title, severity, priority, status,
  frequency, assignee, watch, description).
- **Out:** photo/image upload (explicitly dropped); paste-to-seed parsing; anonymous/
  public use; mobile-optimized layout (mobile is secondary — the grid should not
  break, but the design target is desktop).

## Users & access

- **Route:** `/report/quick` (sibling of the existing `/report`).
- **Access:** **member, technician, and admin.** Matrix permission
  `issues.report.quick` (member: true, technician: true, admin: true; guest and
  unauthenticated: false) so enforcement runs through `checkPermission()` per
  CORE-ARCH-008 and the `/help/permissions` page auto-documents it. Guests and
  anonymous visitors are redirected to the single-issue `/report` page rather
  than shown a 403 — quick authoring simply isn't offered to them.
- Rationale for the floor: quick creation is a trusted-contributor workflow tool,
  and the member+ gate is also the abuse control (see Rate limiting).

## Layout (settled in prototype)

A vertical list of issue rows on the PinPoint dark theme, using the real form
controls (native selects, not badges). Each row **reflows** between two states.

The **collapsed** state is itself responsive — driven by the row's own width
via a container query (CORE-RESP: component-internal reflow), not the viewport:

**Collapsed, wide row (2 lines)** — the desktop fast-triage view:

- Line 1: `Machine` · `Severity` · `Priority` · **More ▾**
- Line 2: `Problem (issue title)` · **Discard** · **Submit ▸**

**Collapsed, narrow row (3 lines)** — the mobile view:

- Line 1: `Machine` · `Severity` · `Priority`
- Line 2: `Problem (issue title)`
- Line 3: **More ▾** · **Discard** · **Submit ▸**

In the narrow view the `Machine` control shows the selected machine's **initials**
(e.g. `GP`) to stay compact alongside severity and priority; it expands to the
full `Name (INITIALS)` once the row is wide enough.

**Expanded (full form):**

- `Machine` · **▴** (collapse)
- `Problem (issue title)`
- `Severity` · `Priority` · `Status` · `Frequency`
- `Description`
- `Assignee` · `Watch` · **Discard** · **Submit ▸**

Notes:

- Collapsed leads with machine + severity + priority so a screen of
  rows scans as "which machine, how bad, what." Severity precedes Priority
  everywhere, matching the single-report form.
- **Machine** is a searchable select that resolves to a real `machineId` (same model as
  the single-report form) — **not** free text. This makes "unresolved machine" nearly
  impossible; a "bad row" is just a missing machine or empty problem.
- **Problem** is the issue title.
- Follow `pinpoint-design-bible` for surfaces, spacing, and the page archetype; align
  the badge/label vocabulary with `STATUS/SEVERITY/PRIORITY/FREQUENCY_CONFIG`.
- Two view controls at the page level: **density** (comfortable/compact) and
  **Expand all / Collapse all**. (Density can be deferred if it complicates v1.)
- Each row has a **Discard** control. An empty row discards immediately; a row with
  typed content asks for confirmation first (typed data is never dropped silently).
  Discarding the last remaining row resets it to a fresh blank row. An un-submitted
  empty row is otherwise ignored by submit.
- **Navigation guard:** while any un-submitted row has content, a `beforeunload`
  guard warns before an accidental back/close would lose the batch.
- **Keyboard:** `Enter` in the Problem field quick-submits a ready row; after any
  submit, focus advances to the next blank row's machine picker.

### Defaults per new row

`status: new`, `severity: minor`, `priority: medium`, `frequency: intermittent`,
`watch: true`, `assignee: unassigned`. These match the schema defaults, so most rows
need only machine + problem before submitting.

## Submission

Two paths, both reusing the existing `createIssue` service (so timeline events,
watcher setup, notifications, and idempotency all come for free):

1. **Per-row quick-submit** — the row's **Submit ▸** creates that single issue
   immediately. On success the row collapses to a slim confirmation strip
   (✓ `Created <id> for <machine> - <title>`, where `<id>` links to the new issue)
   with an **Undo** affordance, and the pending count drops. This supports the
   "trickle-submit while walking the list" workflow.
2. **Submit all** — the bottom bar creates every remaining ready row in one pass
   (iterating `createIssue`, **not** a single DB transaction).

**Partial failure (decided):** on Submit all, **create the good rows and keep the bad
rows in place, flagged inline with a reason** (e.g. missing machine). Never
all-or-nothing; never discard typed data. A good row that succeeds becomes a
confirmation strip; a bad row stays editable with its error until fixed and resubmitted.

**Idempotency:** each row carries a client-generated idempotency key passed to
`createIssue`, so a double-click, a retry, or a Submit-all that overlaps a per-row
submit never creates a duplicate.

**Reporter & permissions:** `reportedBy` = the current user. Member+ may set every
field directly — no field-downgrade logic like the public `/report` path (which forces
`status=new`, `priority=medium` for restricted reporters).

**Notifications:** dispatched after each issue commits via `after()` + the existing
`planNotification`/`dispatchNotification` flow (CORE-ARCH-011 / Doodle-Bug safe). A
batch of N issues produces the same notification behavior as N single reports.

## Rate limiting (bypass — decided)

**The public IP rate limiter (`checkPublicIssueLimit`) and Turnstile CAPTCHA are NOT
invoked on this path.** Those exist to throttle _anonymous_ public reporting; this route
is authenticated and permission-gated, so the member+ gate is the abuse control.
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
  gate (member+ only), N issues created with correct fields, partial-failure creates
  good rows and reports bad ones, idempotency key prevents duplicates, soft cap enforced.
- **RTL unit:** grid form-state, row reflow (collapsed ↔ expanded), quick-submit →
  confirmation strip → undo (with a fresh idempotency key), add-row.
- **Smoke E2E:** the page renders without a 500 for a member and redirects a guest to
  the single-issue `/report` page.

## Open follow-ups (not v1 blockers)

- Density control may be deferred if it complicates the first cut.
- Mobile layout polish (secondary target).
- Possible future "paste-to-seed rows" accelerator — explicitly out of scope now.

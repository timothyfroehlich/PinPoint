# Machine Details Page Redesign

**Date:** 2026-02-15
**Status:** Approved

## Overview

Redesign the machine details page from a two-column layout (sidebar + issues) to a single full-width details pane with a collapsible issues section below. Add four new text fields for machine notes and descriptions, with inline editing.

## Schema Changes

Four new nullable `text` columns on the `machines` table:

| Column              | Type   | Nullable | Visible To          | Editable By    |
| ------------------- | ------ | -------- | ------------------- | -------------- |
| `description`       | `text` | Yes      | Everyone (public)   | Owner + Admins |
| `tournamentNotes`   | `text` | Yes      | Everyone (public)   | Owner + Admins |
| `ownerRequirements` | `text` | Yes      | Authenticated users | Owner + Admins |
| `ownerNotes`        | `text` | Yes      | Owner only          | Owner only     |

All columns default to `NULL`. No data backfill needed. Single Drizzle migration.

## Layout

### Before (current)

Two-column grid: left sidebar (4 cols, sticky) with machine info card, right content (8 cols) with issues list.

### After (new)

Single full-width column:

1. **Header** — Back button, machine name, status badge, watch button, Report Issue button, QR code
2. **Details pane** — Full-width card with internal two-column layout:
   - Left column: Machine metadata (initials, owner, status, dates, issue counts)
   - Right column: Text fields (description, tournament notes, owner's requirements, owner's notes)
3. **Issues expando** — Collapsible section below the details pane

Responsive: Internal two-column layout stacks to single column on mobile.

```
+------------------------------------------------------+
|  <- Back    Machine Name    [Status]   [Watch]        |
|             INITIALS         [Report Issue] [QR]      |
+------------------------------------------------------+
|  DETAILS PANE (full width)                            |
|  +---------------------+----------------------------+|
|  | Machine Info         | Description                ||
|  |  Initials: ABC       | "1992 Williams pin..."     ||
|  |  Owner: Tim          |                            ||
|  |  Status: *           | Tournament Notes           ||
|  |  Added: Jan 2024     | "A division, position 3"   ||
|  |  Open Issues: 3      |                            ||
|  |  Total Issues: 12    | Owner's Requirements       ||
|  |                      | "Do not adjust playfield"  ||
|  |                      |                            ||
|  |                      | Owner's Notes (owner only) ||
|  |                      | "Spare parts in cabinet"   ||
|  +---------------------+----------------------------+|
+------------------------------------------------------+
|  > Open Issues (3)                    [collapsed]     |
+------------------------------------------------------+
```

## Inline Editing

- Click a pencil icon (or "Add..." placeholder) to enter edit mode
- Field transitions to a `<textarea>` with Save (primary) and Cancel (ghost) buttons below
- Save triggers a server action with optimistic UI update
- Cancel reverts to view mode
- Auto-focus on textarea when entering edit mode
- No pencil icon shown for users without edit permission
- Owner's Notes section completely hidden from non-owners

## Owner's Requirements on Issues (Cross-Cutting)

When `machine.ownerRequirements` is set, an amber callout banner appears on every issue for that machine:

- **Location:** Issue detail page, below issue description, above timeline/comments
- **Component:** shadcn `Alert` with amber/warning variant
- **Header:** "Owner's Requirements"
- **Body:** Plain text from `machine.ownerRequirements`
- **Data flow:** Sourced from the machine relation already fetched on the issue page (no extra query)
- **Visibility:** Authenticated users only

```
+-- Owner's Requirements --------------------------------+
| Do not adjust playfield angle. Contact owner           |
| before ordering replacement parts.                     |
+--------------------------------------------------------+
```

## Issues Expando

- **Collapsed state:** Section header "Open Issues" with count badge, chevron icon
- **Expanded state:** All open issue cards (no 5-item limit), sorted newest first
- **Default:** Collapsed
- **Empty state:** "Open Issues (0)", expands to `MachineEmptyState` component
- **Report Issue button** stays in the page header, not inside the expando

## Text Format

All four fields are plain text only. No markdown, no rich text.

## Files Affected

- `src/server/db/schema.ts` — Add 4 columns to `machines` table
- `src/app/(app)/m/[initials]/page.tsx` — Layout restructure, add text field sections, add expando
- `src/app/(app)/m/[initials]/machine-info-display.tsx` — Update for new layout
- `src/app/(app)/m/actions.ts` — New server actions for updating text fields
- `src/app/(app)/m/[initials]/update-machine-form.tsx` — May need updates if edit dialog changes
- Issue detail page — Add requirements callout banner
- New component: `InlineEditableField` — Reusable inline edit component
- New component: `OwnerRequirementsCallout` — Callout banner for issues
- Drizzle migration file — Generated via `pnpm db:generate`

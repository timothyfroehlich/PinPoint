# Machine Presence Status Design

**Issue**: GitHub #1009 — Add 'game no longer present' flag for machines
**Date**: 2026-02-18
**Status**: Approved

## Problem

There's no way to indicate a machine's physical presence at the venue. The only "status" is derived from open issues (operational/needs_service/unplayable), which represents health — not whether the machine is actually on the floor. Machines get loaned out, removed by owners, or haven't arrived yet, and the machine list has no way to reflect this.

## Design

### Presence Statuses

New `presence_status` column on the `machines` table. Five values:

| Value             | Label           | Meaning                                         |
| :---------------- | :-------------- | :---------------------------------------------- |
| `on_the_floor`    | On the floor    | Active, set up for play (default)               |
| `off_the_floor`   | Off the floor   | In the space but not set up for play            |
| `on_loan`         | On loan         | Temporarily at an event or another venue        |
| `pending_arrival` | Pending arrival | Committed to the collective, hasn't arrived yet |
| `removed`         | Removed         | No longer part of the collective                |

- Type: text enum, non-nullable, default `"on_the_floor"`
- Two independent dimensions: **presence** (where is it?) and **health** (what shape is it in?)

### Data Model

- Add `presence_status` column to `machines` table via Drizzle migration
- New helper file `src/lib/machines/presence.ts`:
  - `MachinePresenceStatus` type
  - `getMachinePresenceLabel()` — human-readable labels
  - `getMachinePresenceStyles()` — CSS classes (neutral/muted palette, distinct from health colors)
  - `VALID_MACHINE_PRESENCE_STATUSES` — for filter validation
  - `isOnTheFloor()` — convenience check

### UI: Machine List (`/m`)

- **Default filter**: only show machines where `presence_status = "on_the_floor"`
- New presence filter in the existing filter bar to include other statuses
- When non-"on the floor" machines are visible via filter, show a presence badge on their cards (visually distinct from the green/yellow/red health badge)

### UI: Machine Detail (`/m/[initials]`)

- Presence status badge displayed in the header area near the health status badge
- Non-"on the floor" machines get a visual indicator (muted/dimmed treatment)

### UI: Edit Machine Modal

- Add presence status dropdown/select to the existing edit machine modal
- Same permissions as other edit fields (admins + machine owner)
- No notes field, no confirmation dialog

### UI: Issues List

- Default query excludes issues for machines where `presence_status != "on_the_floor"`
- Filter option to include issues from inactive machines

### Permissions

- Uses existing edit machine permissions: admins + machine owner
- No new permission checks needed

### What Doesn't Change

- Open issues are left as-is when presence status changes (no auto-close)
- Health status derivation (`deriveMachineStatus()`) is unaffected
- No timeline events or machine history table
- No notes/reason field on status changes

## Decisions

- **No timeline**: Presence changes aren't destructive, low audit value. `updatedAt` is sufficient.
- **No separate permissions**: Reuse edit machine modal permissions to keep it simple.
- **Hidden by default**: Non-"on the floor" machines are filtered out of both machine list and issues list by default, keeping the UI focused on what's playable.
- **Column on machines table**: Simplest approach. A separate table would over-engineer what's essentially a single attribute.

# PinballMap orphaned listings — design (PP-l81u)

**Date:** 2026-08-09
**Bead:** PP-l81u (parent epic PP-o355)
**Scope:** backend only. UI wiring, cleanup controls, and permission changes are explicitly out.

## Problem

Two defects, both CORE-ARCH-012 (honest failure) violations, both currently depending on a caller remembering an unwritten rule.

**Defect 1 — omission silently unlists.** `resolvePbmLinkColumns` takes `pinballmapListed` / `pinballmapLmxId` as optional inputs and defaults them to `false` / `null`. On an UPDATE that is a real state change: a listed machine becomes unlisted, with no error and no signal. Exactly one caller gets it right today, via a hand-written `linkUnchanged` block in `updateMachineAction`.

**Defect 2 — re-targeting orphans a live public listing.** When the link target changes, the carry-over is deliberately skipped: `pinballmapListed` goes false and `pinballmapLmxId` is discarded. That is correct about the _new_ title, but the entry for the _old_ title is still live on pinballmap.com. Nobody removed it, and the lmx was the only handle PinPoint had for removing it later.

The existing desync check cannot see the result. `derivePbmMachineStatus` is keyed to a machine's _current_ `pinballmapMachineId`, so an entry no machine points at produces no signal at all.

### Framing

`pinballmapListed` and `pinballmapLmxId` are not PinPoint's own state. They are PinPoint's _mirror_ of a fact owned by pinballmap.com. A write to that mirror may carry it forward, update it to reflect an action actually performed, or record it as unknown — but must never overwrite it by inference. Both defects are the mirror being written from inference rather than observation.

## Decisions

These were settled with Tim on 2026-08-09 and are not open.

1. **The unsynced state is legal.** PinballMap write credentials are optional configuration; PinPoint must work fully without them. This is not hypothetical — `applyAutoLinkWrite` (`src/lib/pinballmap/sync.ts:80`) sets `pinballmapListed: true` from the observed snapshot alone, with no credentials involved. An operator who never provisioned writes still accumulates listed machines.

2. **A retitle is never blocked** — not by PBM state, not by credential state, not by PBM availability. Blocking would make an optional integration hold an unrelated core workflow hostage, and would strand precisely the unprovisioned operator who cannot unlist through PinPoint at all.

3. **The abandoned listing is recorded against the machine that abandoned it**, in a dedicated side table. Not location-level (that is PP-o355.31).

4. **The machine enters a desynced state**, surfaced on the existing PinballMap card on the machine Info tab.

5. **No cleanup control in this bead.** The fix is manual: remove the entry on pinballmap.com.

6. **Records self-clear.** Because cleanup is manual, the record must disappear on its own once the entry is gone — otherwise it is a permanent stale warning about a resolved problem. The hourly snapshot sync already fetches the lineup, and it reads with `PINBALLMAP_API_TOKEN` (the access gate), not the operator write credentials. So self-clearing works for every operator regardless of provisioning. **No dismiss action is needed** — the record is self-verifying.

7. **Cascade delete** when a machine is deleted. The resulting class of desync — a live entry with no PinPoint record at all — is caught by the fleet dashboard (PP-o355.7.2) and by PP-o355.31, not here.

## Design

### Data model

A new table, one row per abandoned entry:

| column                  | notes                                                                     |
| ----------------------- | ------------------------------------------------------------------------- |
| `machine_id`            | FK → `machines`, `ON DELETE CASCADE` (decision 7)                         |
| `lmx_id`                | the entry's id on PinballMap; unique — an entry can only be orphaned once |
| `pinballmap_machine_id` | the _old_ catalog title, so the UI can name what is still on the map      |
| `created_at`            | when it was abandoned                                                     |

**Why a table and not columns on `machines`.** A machine can abandon more than one entry. Retitle A→B orphans A's entry; auto-link then marks the machine listed under B within the hour (no credentials needed, per decision 1); a second correction B→C orphans B's entry too. A single set of columns would overwrite the first — silently discarding a live public listing, which is this bead's own bug reintroduced one level up. Tim's Rule-of-Three caveat applies: DRY at two when the shared thing is load-bearing.

Deriving orphans from existing timeline events was considered and rejected. The timeline is an append-only log; answering "is this still orphaned?" would mean replaying events and reasoning about what later undid what. State rendered on every page load should be a row that is read, not a log that is folded.

`pinballmapLmxId` cannot be reused to hold this. The `machines_pinballmap_lmx_requires_listed` CHECK forbids an lmx without `pinballmap_listed`, and keeping `listed` true would be worse — the `machines_pinballmap_listed_unique` partial index is on `pinballmap_machine_id`, so it would claim the _new_ title's listing slot.

### The seam

`resolvePbmLinkColumns` splits by intent:

- **A create entry point** that accepts no listing state at all. A machine being created cannot already be listed, so the hazard is removed by construction rather than by discipline.
- **An update entry point** that takes the stored machine row and decides carry-over versus clear itself. The `linkUnchanged` comparison moves out of `updateMachineAction` and into the resolver, so no caller computes it independently.

The update entry point returns **columns plus an optional abandonment record**, not columns alone. If it returned columns alone, a caller could apply them and skip recording the abandonment — defect 1 again, one level up. Making the record part of the return value is what stops the next write path from reintroducing this by omission. The cost is that every caller handles a second return field even when it is always null for them; that cost is accepted deliberately.

### Write path

`updateMachineAction` applies the columns and, when an abandonment is returned, inserts the row — **in the same transaction**. Both are local writes, so no side effect sits inside a transaction (CORE-ARCH-011). Either the retitle and the record both land, or neither does.

The abandonment also earns a timeline receipt, consistent with the existing `pinballmap_listing` events. The current action vocabulary is `listed | unlisted | linked | reconnected`; this adds one more.

### Self-clear

`reconcileAfterSync` (`src/lib/pinballmap/sync.ts:173`) deletes abandonment rows whose `lmx_id` no longer appears in the freshly-synced lineup.

**Only on a successful sync.** If a fetch fails and yields an empty or partial lineup, treating "absent from the lineup" as "cleaned up" would wipe every record at once and report cleanup that nobody performed — CORE-ARCH-012 again, in the one place it is easiest to miss. This is a required test, not a nicety.

### Surfacing

`derivePbmMachineStatus` stays as it is. A machine's current listing state and its abandoned entries are two independent facts — a machine can be entirely correct about the title it points at _now_ while still having abandoned an entry under a former title. Folding them into one reason enum would force a false choice between them, and would violate the three-concept separation (catalog association / listing intent / availability) established in `status.ts`.

The card therefore reads both: existing status, plus any abandoned entries. Copy and layout belong to the UI bead.

## Out of scope

| Deferred to               | What                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| new bead (see below)      | A cleanup control. `client.removeMachine({ credentials, lmxId })` already exists and is tested from #1818; what is missing is an action that works from an abandonment record instead of a machine's current listing columns — `unlistMachineFromPinballMapAction` reads `machine.pinballmapLmxId` and refuses unless `machine.pinballmapListed` is true, which is exactly what an orphan is not. |
| PP-o355.7.2               | Fleet-wide view of everything needing cleanup.                                                                                                                                                                                                                                                                                                                                                    |
| PP-o355.31                | Finding entries no machine ever claimed — including ones created directly on pinballmap.com and ones predating PinPoint.                                                                                                                                                                                                                                                                          |
| cleanup bead / PP-o355.21 | Widening `machines.pinballmap.push` to technician. Nothing in this bead writes to PinballMap, so no push permission is involved.                                                                                                                                                                                                                                                                  |

## Test plan

Layer per CORE-TEST-005. Integration means PGlite plus a direct action call; the PinballMap client is mocked at its seam (CORE-TEST-006, CORE-PBM-001 — never reach pinballmap.com).

**Integration**

- Retitling a listed machine records exactly one abandonment, with the correct lmx and old title id
- Retitling again records a second without losing the first
- Retitling an unlisted machine records nothing
- A save that does not change the title leaves the listing intact
- Machine create is unaffected and records nothing
- `reconcileAfterSync` clears a record once its lmx is absent from a successfully-synced lineup
- **A failed sync clears nothing**
- Deleting a machine removes its abandonment rows
- The abandonment and the machine columns commit atomically — a failure in either leaves neither

**Unit**

- The create entry point cannot express listing state
- The update entry point carries listing forward on an unchanged title, and clears plus reports an abandonment on a changed one

## Implementation notes

- Migration numbering: main carries `0062` as of #1825 (PP-rnup). Sync main before generating; this becomes `0063`.
- Table and column names, the exact return type of the update entry point, where the clearing query lives, and the new timeline action name are implementation choices, not design decisions.

# PBM bead alignment audit — drafted edits, pending Tim's approval

_Generated 2026-07-23 by a read-only audit subagent, spot-checked by the lead session. **Nothing here has been applied.** This is staged text for `bd update` once the open questions below are answered._

Source of truth for the spec: `docs/pbm-listing-redesign-refresher.md`.

---

## Verdicts

| Bead       | Title                                  | Bucket             | Reason                                                                          |
| ---------- | -------------------------------------- | ------------------ | ------------------------------------------------------------------------------- |
| PP-o355.4  | comments → timeline + convert-to-issue | ALIGNED            | Untouched by the redesign                                                       |
| PP-o355.5  | outbound writes (sole-editor token)    | STALE              | Cites "the single edit modal"; scopes `exclude` as an outbound write            |
| PP-o355.6  | per-user account linking               | ALIGNED            | Pure auth/token                                                                 |
| PP-o355.7  | status page (control room)             | **CONFLICTS**      | Treats on-map-but-not-listed as human backlog; misses invalid pairs + tie guard |
| PP-o355.8  | Admin Integrations page                | ALIGNED            | No listing-state coupling                                                       |
| PP-o355.13 | modal closes on click                  | REDUNDANT (later)  | Dies with the Dialog; keep open until the page ships                            |
| PP-o355.14 | unsaved-changes guard                  | STALE              | Sole motivating consumer retired                                                |
| PP-o355.15 | "title already listed"                 | STALE + dup-of-.17 | Reactive catch vs. proactive tie guard                                          |
| PP-o355.17 | unique-violation on dupe list          | REDUNDANT          | Same root cause as .15                                                          |
| PP-o355.18 | Discord alert on new PBM machines      | ALIGNED            | Region-wide discovery, unrelated                                                |
| PP-h059    | backfill fleet from snapshot           | **CONFLICTS**      | Bulk-sets `listed=true`, bypassing the tie rule                                 |
| PP-o355.10 | prod rollout checklist                 | ALIGNED            | Operational only                                                                |
| PP-3bbr    | manual manufacturer/year               | ALIGNED            | Filed from this design session                                                  |
| PP-5sgt.5  | model identity + backbox image         | ALIGNED            | Filed from this design session                                                  |

---

## PP-o355.7 — control room (drafted description)

> Concept model: six derived states, never a stored status column — computed at render from (catalog match, `listed`, `lmx`, snapshot). See `docs/pbm-listing-redesign-refresher.md` §5–7 for the state machine, availability matrix, and tie rule. Availability never drives listing.
>
> v1 scope:
>
> - Tech/admin page (`pinballmap.status.view`). Counters + tabs: **Needs attention** / **Unlinked** / **All-listed**.
> - "Needs attention" covers three categories:
>   - **MISSING_ON_PBM** — listed here, title absent from the lineup. The one direction still requiring a human: Accept locally or Re-add on PBM. Self-resolves if PBM's 7-day lmx resurrection window returns the same lmx (verified against their Rails source, `api/v1/location_machine_xrefs_controller.rb:77`).
>   - **Invalid availability×listing pairs** — `pending_arrival`/`removed` while Listed. Hard error per the matrix; never auto-fixed, so it needs a place to surface.
>   - **Tie-guarded duplicates** — 2+ machines sharing a catalog title tied at the same presence rank; auto-link/auto-heal paused for that title, listing actions hidden on those machines, alert names the conflict.
> - The old second desync direction — "on-map-but-not-listed-here" — is **no longer a backlog item**; it self-resolves via auto-link unless tied.
> - Unlinked tab unchanged (UNMATCHED backlog).
> - Per-row Add/Remove live on the machine edit page, not here — this page deep-links to it.
>
> Acceptance: page counts/lists MISSING_ON_PBM, invalid availability×listing pairs, and tie-guarded duplicates; unlinked backlog listed; the old "on map but not listed" direction is absent from the backlog; no presence-derived "should be listed" logic.

## PP-h059 — backfill (drafted step 3 + NOTES)

Lead-session amendment: the redesign's auto-link **already performs the listed/lmx backfill on first sync**, tie rule included. This bead should shrink to the match half only.

> 3. For each matched machine, set `pinballmap_machine_id` and copy manufacturer/year/opdb_id/ipdb_id from the catalog row. Respect `machines_pinballmap_link_exclusive`. **Do not set `pinballmap_listed` or `pinballmap_lmx_id` in this pass.** Once matches are set, the next sync's auto-link sets `listed=true` and captures the lmx for any matched machine whose title is on the lineup, correctly applying the tie-guard rank rule — instead of blindly listing every match and risking a constraint violation.
>
> Safe at scale: PBM's real per-token rate limits (index 120/min, destroy 100/5min, update 50/10min, global 120/min) are far looser than our self-imposed 1 sync/hour, and soft-deleted lmx ids are never recycled onto a different machine.

NOTES: drop the "...sets `pinballmap_listed=true`, one write per matched machine" claim.

**Tradeoff for Tim:** the bead's stated purpose was to populate prod _before_ .11/.12 land so the feature isn't empty on ship. Shrinking it means listed state doesn't appear until the redesign ships.

## PP-o355.5 — outbound writes (drafted wire-surfaces line)

> Wire surfaces: Info-card comment composer, presence-change CTA (soft guidance for temporary moves), the machine edit page's Pinball Map section (title change → auto-link at save; IC toggle; confirm-lineup — Add/Remove ship with the listing redesign, not here). Mirror outbound writes into the timeline.

## PP-o355.15 — tie guard (drafted description; supersedes .17)

> Implement the tie-guard from the settled listing redesign (`docs/pbm-listing-redesign-refresher.md` §7): when machines share a catalog title edition, drop any whose availability makes Listed invalid (`pending_arrival`, `removed`), then rank the rest by `MACHINE_PRESENCE_RANK`. Exactly one at the lowest rank holds the listing — auto-link/auto-heal run normally. Two or more tied → the guard fires: auto-link/auto-heal pause for that title, Add/Remove hidden on the tied machines' edit pages, and an alert names the conflict (surfaced in the control room, PP-o355.7). Resolve by retitling one machine, marking one "Not on Pinball Map," or changing one's availability.
>
> As a backstop only (e.g. a race), the write path should still catch the partial-unique-index violation gracefully instead of 500ing — this bead's original narrower scope, kept as the last-resort path.
>
> Supersedes PP-o355.17 (same root cause, found independently via /code-review on #1679).

**Acceptance:** tied machines have listing actions hidden and syncing paused with an alert naming the conflict; the lone lowest-rank machine lists/auto-links normally; a direct constraint hit surfaces a clear message, not a raw 500.

## PP-o355.13 / PP-o355.14

- **.13** — don't close yet; the modal is live in prod. Close when the edit-page bead ships. The applied `onInteractOutside` guard stays as a defensive pattern for other Popover-in-Dialog cases.
- **.14** — acceptance can't be satisfied as written ("Edit Machine dialog migrated onto it"). No replacement drafted; depends on open question 1.

---

## Open questions for Tim

**ANSWERED 2026-07-23:**

- **Q4 — where the tie-guard alert surfaces: BOTH.** Inline banner on each tied machine's settings page _and_ a row in the control room (PP-o355.7). Folded into refresher §7. The PP-o355.15 draft below already says "hidden on the tied machines' edit pages ... surfaced in the control room" — consistent, no edit needed.
- **Bead granularity — smaller beads approved.** Break the work down rather than filing two large ones.
- **200/201 resurrect-vs-mint — not surfacing it.** No bead, no UI. Noted in refresher §6a.

**STILL OPEN:**

1. **PP-o355.14** — with Edit Machine becoming a page, is there another real Dialog needing a general unsaved-changes guard, or does this close as superseded?
2. **PP-o355.15/.17** — close .17 as duplicate and rewrite .15 as the full tie-guard, or keep them split (.17 = DB backstop only)?
3. **PP-h059 ordering** — accept losing the pre-ship prod population (see tradeoff above)?

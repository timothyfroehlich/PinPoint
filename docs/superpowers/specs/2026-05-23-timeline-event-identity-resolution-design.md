# Timeline Event Identity Resolution — Design

**Date:** 2026-05-23
**Status:** Approved design (pre-implementation)
**Feature:** PP-0x98 machine timeline (PR #1380)
**Author:** Tim + Claude (design dialogue)

## 1. Problem

The machine timeline records events (comments, machine lifecycle changes, issue
lifecycle changes, reassignments) into `timeline_events`. The current
implementation **snapshots denormalized display data** — primarily people's
names — into the `event_data` JSONB at write time. This is wrong for a feed
that must stay truthful over time:

- **Stale names.** "Owner changed to Alice" keeps saying "Alice" after Alice
  renames herself to "Alic4eva".
- **Null names.** When a profile lookup misses at write time, the event stores
  `toOwnerName: null` and renders "Owner changed from X to —" (review finding
  #9).
- **Wrong owner events for invited users.** Assigning an _invited_ (not-yet-
  registered) user as owner stores a null active owner id, so the timeline
  renders "Owner removed" — or emits nothing at all (review findings #1–#4).

The underlying mistake is conflating two different kinds of data inside an
event:

1. **Historical facts** — what happened, when, and the structural before/after
   of a transition. These are immutable and _must_ be preserved as point-in-time
   values. ("Owner changed at time T from person A to person B" is history; it
   must never silently re-render as a later state.)
2. **Display of the people/objects involved** — names, invited-vs-real status,
   profile links, current machine/issue titles. These should **always reflect
   current reality**, never a frozen snapshot.

## 2. Principle

> **Store stable identifiers and immutable enums in events. Resolve every
> human-facing display field live, at render time, via joins.**

- `event_data` carries only immutable facts: the event kind, and where a
  transition has structural endpoints, those endpoints as **stable references**
  — enum values for statuses (`fixed` → `wont_fix`; enum labels are code, not
  user data) and **IDs** for people.
- Names, invited/real status, avatars, profile links, and current
  machine/issue titles are resolved at render time by joining the stored IDs
  against the current `user_profiles` / `invited_users` / `machines` / `issues`
  rows.

This makes the Alice-rename case and finding #9 structurally impossible: there
is no stored name to go stale or come back null.

## 3. The invited-user constraint (why this needs care)

PinPoint has **two separate identity tables**:

- `user_profiles` — real accounts; `id` _is_ the Supabase auth user id (no
  random default, cannot be created before the user authenticates).
- `invited_users` — people invited but not yet signed up; random `id`, keyed by
  a unique `email`.

Machines reference an owner via `owner_id` **xor** `invited_owner_id`; issues
reference a reporter via `reported_by` **xor** `invited_reported_by`. This dual-
column "real-or-invited" pattern is an established PinPoint convention.

Critically, **`invited_users` rows are ephemeral.** The `handle_new_user`
signup trigger (security-locked in migration `0035_lock_handle_new_user`), when
an invited person signs up:

1. creates their `user_profiles` row (id = auth id),
2. **rewrites live references**: `machines.invited_owner_id` → `owner_id`,
   `issues.invited_reported_by` → `reported_by`,
3. **deletes** the `invited_users` row.

So by the time an invited person becomes real, the `invited_users.id` they were
referenced by no longer exists, and only _current_ ownership was migrated — not
historical references. A naive design that pointed a timeline event at
`invited_users.id` would dangle the moment that person signs up.

## 4. Chosen approach: rewrite references at conversion (relationally)

We extend the existing conversion to rewrite the timeline's person-references
invited→real, exactly as it already rewrites machines and issues. This keeps the
ephemeral invariant (no new long-lived invited state), keeps the render-time
resolver dumb (it resolves whatever id the event currently holds), and produces
the desired behavior for free:

- While Bob is invited: his owner-change event references `invited_users.id` and
  renders "(invited) Bob".
- The instant Bob signs up: the conversion rewrites the reference to his
  `user_profiles.id`. The event now renders "Bob" with a live name and a profile
  link, and the "(invited)" marker drops — because it was never a stored fact,
  only live display.

This is preferred over a "keep `invited_users` rows forever with a forward
pointer" design because it is _additive_ to the existing trigger (mechanical,
mirrors the rewrites already there) and changes no invariant.

**The enabling decision — person references are stored relationally, not in
JSONB.** This is what makes the conversion rewrite safe instead of brittle:

- The rewrite becomes a single `UPDATE … WHERE invited_id = X`, structurally
  identical to the machines/issues rewrites the trigger already performs.
- A real **foreign key enforces correctness**: an `invited_users` row cannot be
  deleted while a timeline event still references it unless the rewrite ran (or
  `onDelete` handles it). A missed event surfaces as an error, not a silent
  dangling reference. JSONB would give no such safety net and would require
  fragile per-kind JSON surgery inside the security-locked trigger.

## 5. Data model

### 5.1 `timeline_events` (existing, reshaped before first ship)

Keeps the columns that are genuine event facts:

- `id`, `machine_id`, `created_at`, `source_type`, `tag`, `deleted_at`,
  `deleted_by`
- `content` (jsonb) — comment body (the comment's own current state; already
  handled, editable)
- `event_data` (jsonb) — **immutable facts only**: the event kind and any
  enum-valued transition endpoints (e.g. `fromStatus`, `toStatus`). **No names,
  no emails, no invited flags.**
- `author_id` — **retained** as "the acting real user / comment author, if any"
  (nullable, FK → `user_profiles`, `onDelete set null`). It drives comment
  authorship and the `own_or_owner` delete permission, which always involve a
  real, logged-in user. It does **not** attempt to hold invited people.
- `sequence` — **new** monotonic tiebreaker (see §8).

### 5.2 `timeline_event_people` (new child table)

Polymorphic person references for actors and subjects, uniform across all event
kinds and arities (e.g. `owner_changed` has both a from- and a to-person):

| column       | type    | notes                                                 |
| :----------- | :------ | :---------------------------------------------------- |
| `event_id`   | uuid FK | → `timeline_events.id`, `onDelete cascade`            |
| `role`       | text    | e.g. `from_owner`, `to_owner`, `assignee`, `reporter` |
| `user_id`    | uuid FK | → `user_profiles.id`, nullable, `onDelete set null`   |
| `invited_id` | uuid FK | → `invited_users.id`, nullable, `onDelete restrict`   |

- **XOR check:** exactly one of `user_id` / `invited_id` is non-null (mirrors the
  machines/issues `owner_check`).
- `onDelete restrict` on `invited_id` is the safety net: the signup trigger's
  delete of an `invited_users` row fails loudly if any timeline reference was not
  rewritten first. **The failure modes are not symmetric:**
  - With `cascade`, a rewrite gap is a **permanent** loss. The person-reference
    row is deleted the moment the `invited_users` row is (at signup); the rewrite
    that would have repointed it already didn't run, so the event is orphaned
    forever with no automatic recovery — even though the real account now exists,
    nothing links the event to it.
  - With `restrict`, the same gap is **recoverable**. It merely fails the signup
    transaction: fix the rewrite, the user retries, the event repoints correctly,
    no data lost.
    We therefore choose `restrict` — a recoverable signup failure beats permanent
    silent history loss. The conversion integration test exercises this path, so a
    gap surfaces in dev rather than in prod.
- Indexed on `(event_id)` and on `(invited_id)` (the conversion rewrite's WHERE).

The **invited-reporter-as-actor** case (an issue opened by an invited reporter,
where the event's "actor" is an invited person) is modeled as a `reporter` role
in this table with `author_id` left null; the renderer attributes the event to
the resolved reporter. This keeps `author_id` meaning "real acting user" and
avoids making it polymorphic.

## 6. Conversion rewrite (signup trigger)

Extend `handle_new_user` (the function behind `on_auth_user_created`) with one
additional step, executed in the same transaction as the existing rewrites and
**before** the `invited_users` row is deleted:

```
UPDATE timeline_event_people
   SET user_id = <new profile id>, invited_id = NULL
 WHERE invited_id = <converting invited_users.id>;
```

This mirrors the existing `machines` / `issues` rewrites. Because the table is
new and the change is additive, this is the lowest-risk possible modification to
the locked trigger. The `onDelete restrict` FK guarantees the delete cannot
succeed while any reference remains, so a logic regression fails closed.

## 7. Render-time resolution

The timeline query joins `timeline_event_people` → `user_profiles` /
`invited_users` and produces, per person-reference, a resolved value via a single
shared resolver:

- **Real user, exists:** current `name` + profile link.
- **Real user, deleted** (FK nulled): "former user" (no link). Dovetails with
  email-privacy — we never want frozen PII lying around anyway.
- **Invited user (not yet converted):** current invited `name` + "(invited)"
  marker, no profile link.

The resolver is a small, independently testable unit: input a person-reference
row (the user_id/invited_id pair plus the joined name fields), output
`{ displayName, href | null, isInvited }`. All call sites (actor attribution,
owner from/to, assignee, reporter) use it, so display rules can't drift between
event kinds.

Performance is a non-issue: the timeline paginates (~25 rows/page) and already
joins for author display; adding the people join + the per-page profile/invited
lookups is negligible.

## 8. Companion fix: deterministic ordering (review finding #6)

`getMachineTimeline` currently orders by `desc(created_at), desc(id)` where `id`
is a random UUID (`gen_random_uuid()`). Events emitted in one transaction share
`created_at` (Postgres `now()` is transaction-constant), so the tiebreak is
arbitrary — `machine_added` and `owner_set` can render in either order across
loads. The code comment claiming this is "deterministic" is false.

Since we are reshaping `timeline_events` before it ever ships, add a `sequence`
`bigserial` column and order by `desc(created_at), desc(sequence)`. Insertion
order within a transaction is then monotonic, guaranteeing `machine_added`
before `owner_set`. Remove the misleading comment.

## 9. Migration cost: zero

`timeline_events` is created in migration `0036`, which ships for the first time
in PR #1380 (currently unmerged). **The table does not exist in production and
holds no rows anywhere except local dev.** Therefore:

- We amend the `0036` migration (and `schema.ts`) in place — reshape
  `event_data`, add `timeline_event_people`, add `sequence` — with **no
  backfill**.
- The seed/backfill scripts (`seed-timeline-demo.mjs`,
  `seed-timeline-backfill.mjs`) are updated to emit the new shape; because they
  _derive_ events from current machines/issues, this is a regeneration, not a
  migration.
- Local dev resets via `db:reset` (allowed). Prod only ever sees the final
  shape.

## 10. Bugs this closes

- **#1** (invited owner mislabeled) — owners are stored as person-references
  supporting invited ids; the "invited owner ⇒ null active id ⇒ Owner removed"
  failure mode cannot occur.
- **#2 / #3 / #4** (owner-event emit family in `m/actions.ts`) — same root: the
  emit logic records a person-reference (`to_owner` role with `user_id` xor
  `invited_id`) instead of a possibly-null `owner_id`, so create / update /
  forcePromote all emit a correct, resolvable event.
- **#9** (`toOwnerName: null`) — names are never stored; resolved live.
- **#6** (non-deterministic ordering) — fixed via §8.

## 11. Non-goals / out of scope

- **No unified person-identity table.** We keep the two-table model and bridge
  it at conversion. A single canonical `person` identity is a larger refactor and
  is not justified here.
- **Transition facts stay historical.** We do not re-derive past transitions
  from current object state. Only the _display of the people/objects_ is live.
- **Comment authorship & permission model unchanged.** `author_id` keeps its
  current meaning and continues to drive the `own_or_owner` delete check.
- **The remaining review findings are tracked in their own beads**, not in this
  spec — mechanical fixes independent of the identity-resolution architecture:
  - **PP-ii3u** — filter dropping `?page=` (#5), delete-dialog swallowing errors
    (#8), `TagSelect` controlled/uncontrolled flip (#10), and the minor
    invalid-tag-in-pagination-hrefs (#12).
  - **PP-vrp4** — `isClosed` closed→closed transition (issues #1).
  - **PP-h850** — TOCTOU on concurrent comment edit/delete (#7).
  - Review findings #11 (softDelete `sourceType` guard) and #13 (icon-map crash
    fallback) were assessed and **declined as YAGNI** (not reachable today).
- **This spec's implementation is tracked as PP-tv9l.**

## 12. Testing

- **Resolver unit tests** — real-user / deleted-user / invited-user inputs →
  correct `{ displayName, href, isInvited }`.
- **Conversion integration test** (the headline guarantee): seed an
  `invited_users` owner → emit an owner event referencing the invited id →
  simulate signup (run the trigger) → assert the event's person-reference now
  points at the new `user_profiles.id` and the resolver returns the real name +
  link with no "(invited)". Assert no `timeline_event_people` row dangles and the
  `invited_users` row is gone.
- **Owner-event emit tests** covering the _invited_ sub-paths of
  `createMachineAction` / `updateMachineAction` / forcePromote — closes the
  false-green coverage gap (review finding #15), which currently exercises only
  the active-user branch.
- **Ordering test** — two events in one transaction render `machine_added`
  before `owner_set` deterministically across repeated reads.
- **Email-privacy assertion** — no event row (in `event_data` or
  `timeline_event_people`) stores a name or email; display resolves to names,
  never emails (CORE-SEC-007).

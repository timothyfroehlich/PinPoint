---
name: pinpoint-chores
description: Runbook for the weekly PinPoint "chores" session — the human-in-the-loop maintenance pass (Supabase CLI pin, TS-7 rollout, Dependabot, changelog, Sentry/Supabase advisors, cloud-routine beads). Use when Tim says "let's do chores", when the SessionStart chores-nag fires ("🧹 Weekly chores are N days overdue"), or when you want the chores checklist. After finishing, re-arm the nag with `bd defer`.
---

# pinpoint-chores

> **Use when:** the SessionStart nag fires (`🧹 Weekly chores are N days overdue — say "let's do chores".`), Tim says "let's do chores" / "do the chores", or you want the weekly maintenance checklist. Triggers on "chores", "weekly chores", "chores nag".

The weekly **chores** session is one focused, human-in-the-loop pass over the periodic maintenance that used to be scattered across the session-start briefing and various routines. Doing it here keeps the briefing slim (it drops to "status of open PRs") and gives version-drift / advisor / cloud-routine review a single home.

This skill is the runbook. The checklist itself is duplicated on the recurring **Weekly Chores** bead (labeled `weekly-chore`) so both a human reading `bd show` and this skill stay in sync — keep them matched when items change.

## How the nag works (context)

- **State + due date** live on one recurring bead labeled `weekly-chore` (durable, DoltHub-synced across Tim's machines).
- **The nudge** is a SessionStart hook, `.claude/hooks/session-start-chores-nag.sh`. It looks the bead up **by label** (never a hardcoded ID) and reads its `defer_until` + `status`. The state machine it enforces:
  - **Dormant** — `defer_until` in the **future** → no nag (between cycles, after the re-defer).
  - **Due** — `defer_until` in the **past** AND status is **not** `in_progress` and **not** `closed` → **nag**.
  - **Working** — status `in_progress` → no nag (you moved the bead there when you started this session; see below).
- **Reset** = when you finish, re-defer the bead one week out (which also takes it out of `in_progress`). Because state is on the synced bead, doing chores on ANY machine clears the nag everywhere.

Design record: **PP-ld0o.3** (Option C). Epic: **PP-ld0o**.

## Running the chores

Find the bead first (by label, so you have its ID for comments + the reset):

    bd list --label weekly-chore --json

**Move it to in-progress** — this silences the nag while you work (a `due` bead only nags when it is NOT `in_progress`), and logs the start:

    bd update <chores-bead> --status in_progress

Then work the checklist. For each item, note findings as a comment on the bead (`bd comments add <chores-bead> "..."`) and file follow-up beads for anything actionable — don't fix everything inline; chores is triage + quick wins.

### Checklist

1. **Stale Supabase CLI pin check** (PP-nlv6)
   - Compare the pinned Supabase CLI version against the latest release. The pin lives in CI setup / config; a version-drift nudge belongs here, not in per-session briefing.
   - If stale, file/refresh a bead to bump it (or bump it if trivial and verified).

2. **TypeScript-7 rollout status**
   - Read `docs/plans/2026-06-27-typescript-7-upgrade-plan.md` for the current phase.
   - The pinned `tsgo` nightly (`@typescript/native-preview`) needs a bump to the **GA release** when TS 7.0 GA lands (~July 2026). Related bead: **PP-rl1l**.
   - When bumping, re-validate 0-divergence parity vs `tsc 6`: `pnpm run typecheck:tsc6`.

3. **Dependabot updates**
   - Review open Dependabot PRs (`gh pr list --author "app/dependabot"`). Merge the safe ones via the normal PR workflow; file a bead for any that need real work.

4. **Changelog PR from the Weekly Review routine**
   - The consolidated Weekly Review cloud routine opens a changelog PR (`docs/changelog-<date>`) when user-facing PRs merged that week. Review and merge it via the normal PR workflow (or correct/supplement first).

5. **Sentry + Supabase advisor checks**
   - Run the Sentry error scan and the Supabase advisor checks that previously lived in the session-start briefing. Triage new issues into beads.

6. **Review beads filed by the Weekly Review routine**
   - The consolidated Weekly Review cloud routine files beads for its security findings (`security` label) and its flaky-test report (`flaky-test` label). Review everything filed since the last chores session and act on / prioritize / decline each.
   - Handy: `bd list --label security` and `bd list --label flaky-test`, or `bd list --json` filtered by recent `created_at`.

## Finish: re-arm the nag

When chores are done, **re-defer the bead one week out** so it goes dormant and the nag clears everywhere:

    bd defer --until=<next Saturday> <chores-bead>

`<next Saturday>` = the next Saturday's date in `YYYY-MM-DD` (e.g. `bd defer --until=2026-07-18 PP-qehv`). Optionally leave a run summary comment first:

    bd comments add <chores-bead> "Chores done <date>: <one-line summary of what was reviewed / filed>."

Do **not** close the bead — it's a recurring holder. Deferring it (status `deferred`, future `defer_until`) is what makes it dormant; nothing else is needed — don't flip it back to `open`. The nag stays silent until that date passes.

> **Note:** `bd defer --until=<date>` is interpreted as **UTC midnight** of that date. In US-Central that's the evening before, so a "next Saturday" re-arm actually becomes due Friday evening local — the nag's day-count boundary flips then, not at local Saturday midnight. Close enough for a weekly cadence; just don't expect the count to tick over exactly at local midnight.

> Beads sync note: `bd` writes locally; the lead handles `bd dolt push`. Don't push beads from a chores session unless you're the lead.

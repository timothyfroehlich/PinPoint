---
name: pinpoint-chores
description: Runbook for the weekly PinPoint "chores" session — the human-in-the-loop maintenance pass (Supabase CLI pin, TS-7 rollout, Dependabot, changelog, Sentry/Supabase advisors, PinballMap vendored-docs drift, GHA infra-flake triage, cloud-routine beads). Use when Tim says "let's do chores", when the SessionStart chores-nag fires ("🧹 Weekly chores are N days overdue"), or when you want the chores checklist. After finishing, re-arm the nag with `bd defer`.
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

**Delegate the context-heavy items to subagents.** The checklist keeps growing, and several items burn a lot of context (the GHA infra-flake triage, the Sentry / Supabase advisor sweeps, the Weekly-Review bead review). As lead, farm those out to subagents and keep just the synthesis — don't run everything inline. Give each subagent the item's runbook pointer and have it report back findings + proposed beads; you decide and file. Cheap, quick items (version-pin checks, the vendored-docs diff) can stay inline.

Then work the checklist. For each item, note findings as a comment on the bead (`bd comments add <chores-bead> "..."`) and file follow-up beads for anything actionable — don't fix everything inline; chores is triage + quick wins.

### Checklist

1. **Stale version-pin checks** (Supabase CLI — PP-nlv6; pnpm corepack pin — PP-w0eq)
   - **Supabase CLI pin.** Compare the pinned Supabase CLI version against the latest release. The pin lives in CI setup / config; a version-drift nudge belongs here, not in per-session briefing. If stale, file/refresh a bead to bump it (or bump it if trivial and verified).
   - **pnpm corepack pin.** The pnpm binary is pinned in the `packageManager` field of `package.json` (corepack). **Dependabot cannot bump this field** — it's an open, unimplemented feature request ([dependabot-core#4830](https://github.com/dependabot/dependabot-core/issues/4830)); Dependabot's pnpm support only updates deps _inside_ the lockfile, never the corepack pin. So this is the only watcher it has, and it silently rots without it (that's how we ended up 9 months behind on 10.2.0 until npm's audit-endpoint retirement forced the jump — PP-w0eq).
     - **Apply a 30-day cooldown** (supply-chain soak — same rationale as the Dependabot npm cooldown): bump only to the newest stable pnpm ≥30 days old, never the just-released `latest`.
     - Find the newest eligible version:

       ```bash
       npm view pnpm time --json | python3 -c "import json,sys,datetime as d; t=json.load(sys.stdin); c=d.datetime.now(d.UTC)-d.timedelta(days=30); r=[(v,ts) for v,ts in t.items() if '-' not in v and v.split('.')[0].isdigit()]; r.sort(key=lambda x:list(map(int,x[0].split('.')))); print(next(v for v,ts in reversed(r) if d.datetime.fromisoformat(ts.replace('Z','+00:00'))<=c))"
       ```

     - If it's newer than the current pin (mind major bumps — read the pnpm release notes/migration guide first), bump via `corepack use pnpm@<version>`, then verify no lockfile churn (`pnpm install --frozen-lockfile` → only `package.json` should change), `pnpm audit --audit-level=high` still resolves, and `pnpm run check` is green. PR it through the normal workflow; file a bead if a major bump needs real migration work.

2. **TypeScript-7 rollout status**
   - Read `docs/plans/2026-06-27-typescript-7-upgrade-plan.md` for the current phase.
   - The pinned `tsgo` nightly (`@typescript/native-preview`) needs a bump to the **GA release** when TS 7.0 GA lands (~July 2026). Related bead: **PP-rl1l**.
   - When bumping, re-validate 0-divergence parity vs `tsc 6`: `pnpm run typecheck:tsc6`.

3. **Dependabot updates**
   - Review open Dependabot PRs (`gh pr list --author "app/dependabot"`). Merge the safe ones via the normal PR workflow; file a bead for any that need real work.

4. **Changelog PR from the Weekly Review routine**
   - The consolidated Weekly Review cloud routine opens a changelog PR (`docs/changelog-<date>`) when user-facing PRs merged that week. Review and merge it via the normal PR workflow (or correct/supplement first).

5. **Sentry + Supabase advisor checks** (moved here from the session-start briefing)
   - **Sentry — new production errors.** Requires the Sentry MCP OAuth handshake; if the query tools aren't registered, run `mcp__plugin_sentry_sentry__authenticate`, complete the browser login, then `/reload-plugins` (tool registration is a one-time handshake — completing OAuth alone won't expose the query tools). Then `mcp__plugin_sentry_sentry__find_organizations` → `mcp__plugin_sentry_sentry__search_issues` with `query: "is:unresolved firstSeen:>-7d"`. Flag high-event-count issues and new regressions; triage into beads.
   - **Supabase advisors — prod** (`project_id` = `udhesuizjsgxfeotqybn`, PinPoint-Prod). Load the deferred tool first (`ToolSearch` query `select:mcp__plugin_supabase_supabase__get_advisors`), then call `mcp__plugin_supabase_supabase__get_advisors` twice: `type: "security"` (RLS gaps, exposed tables/functions, auth misconfig) and `type: "performance"` (unindexed FKs, RLS initplan re-evaluation, unused indexes). ERROR-level security lints are immediate-attention. **Known-intentional:** tables with RLS **enabled but zero policies** are the deliberate Drizzle-superuser-only pattern (migration 0034), not a regression — don't file them. If the MCP isn't connected, note the one-line skip and move on. File beads for genuine findings.

6. **Review beads filed by the Weekly Review routine**
   - The consolidated Weekly Review cloud routine files beads for its security findings (`security` label) and its flaky-test report (`flaky-test` label). Review everything filed since the last chores session and act on / prioritize / decline each.
   - Handy: `bd list --label security` and `bd list --label flaky-test`, or `bd list --json` filtered by recent `created_at`.

7. **PinballMap vendored-docs drift check** (CORE-PBM-001)
   - Fetch the live `https://pinballmap.com/llms.txt` and `https://pinballmap.com/robots.txt`, and diff each against the vendored copy in `docs/external/` (`pinballmap-llms.txt`, `pinballmap-robots.txt`). These must stay **byte-identical** to what PBM serves.
   - If either changed: refresh the vendored file verbatim from source, then re-review the conduct / rate-limit / attribution implications against `src/lib/pinballmap/`. File a bead if the change affects API conduct (not just a trivial wording tweak).
   - This weekly check is our **standing** drift guard — there is no automated drift GHA (the once-planned PP-o355.9 was closed in favor of this).

8. **GHA infra-flake triage**
   - Run the weekly triage procedure in `docs/runbooks/gha-flake-log.md`: read the recent weekly `gha-flake-week` sighting beads (current ISO week + prior 2) plus the permanent `gha-flake-log` ledger, pull new sightings past the ledger cursor, cluster by signature, rule out non-issues, spin genuine recurring infra issues into child beads, catch regressions against `fixed` rows, close aged-out weekly beads, then rewrite the ledger and advance the cursor.
   - This is context-heavy — a good candidate to delegate to a subagent (see "Running the chores").

## Finish: re-arm the nag

When chores are done, **re-defer the bead one week out** so it goes dormant and the nag clears everywhere:

    bd defer --until=<next Saturday> <chores-bead>

`<next Saturday>` = the next Saturday's date in `YYYY-MM-DD` (e.g. `bd defer --until=2026-07-18 PP-qehv`). Optionally leave a run summary comment first:

    bd comments add <chores-bead> "Chores done <date>: <one-line summary of what was reviewed / filed>."

Do **not** close the bead — it's a recurring holder. Deferring it (status `deferred`, future `defer_until`) is what makes it dormant; nothing else is needed — don't flip it back to `open`. The nag stays silent until that date passes.

> **Note:** `bd defer --until=<date>` is interpreted as **UTC midnight** of that date. In US-Central that's the evening before, so a "next Saturday" re-arm actually becomes due Friday evening local — the nag's day-count boundary flips then, not at local Saturday midnight. Close enough for a weekly cadence; just don't expect the count to tick over exactly at local midnight.

> Beads sync note: `bd` writes locally; the lead handles `bd dolt push`. Don't push beads from a chores session unless you're the lead.

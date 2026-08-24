---
name: pinpoint-chores
description: Runbook for the weekly PinPoint "chores" session — the human-in-the-loop maintenance pass, ten checklist items: the Supabase CLI and pnpm version pins (each with its own cooldown and its own set of sites to update), TS-7 rollout, Dependabot PRs, changelog, Sentry and Supabase advisors, cloud-routine review beads, PinballMap vendored-docs drift, GHA infra-flake triage, prod backup validation (`pnpm run chores:backups`), and the memory-and-context review it hands to `pinpoint-memory-review`. Use when Tim says "let's do chores", when the SessionStart chores-nag fires ("🧹 Weekly chores are N days overdue"), or when you want the chores checklist. After finishing, re-arm the nag with `bd defer`. Session-start project health is `pinpoint-briefing`, not this.
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

1. **Stale version-pin checks** (Supabase CLI — PP-nlv6; pnpm version pin — PP-w0eq)
   - **Supabase CLI pin.** Compare the pinned Supabase CLI version against the latest release. A version-drift nudge belongs here, not in per-session briefing. If stale, file/refresh a bead to bump it (or bump it if trivial and verified).
     - The pin is **9 sites across 4 files** — `ci.yml` (×6), plus `preview-control.yaml`, `preview-sync.yaml`, `preview-reaper.yaml` (×1 each). A bump is a multi-site edit: change **all nine or none**. A partial bump leaves jobs on mismatched CLI versions, which surfaces as a job-specific CI failure that reads like a flake rather than a bad edit.
     - List every pin, then compare against the newest release:

       ```bash
       rg -n -A6 'uses: supabase/setup-cli' .github/workflows/*.y*ml | rg 'version:'
       gh api /repos/supabase/cli/releases/latest --jq .tag_name
       ```

       (`-A6` matters — one call site has an extra `if:` line before `with:`, so a smaller window silently misses it and you'd bump 8 of 9.)
   - **pnpm version pin.** The pnpm binary is pinned in the `packageManager` field of `package.json` with its SHA-512 integrity hash, and `mise` reads and verifies that declaration directly without Corepack. **Dependabot cannot bump this field** — it's an open, unimplemented feature request ([dependabot-core#4830](https://github.com/dependabot/dependabot-core/issues/4830)); Dependabot's pnpm support only updates deps _inside_ the lockfile, never the `packageManager` pin. So this is the only watcher it has, and it silently rots without it (that's how we ended up 9 months behind on 10.2.0 until npm's audit-endpoint retirement forced the jump — PP-w0eq).
     - **Apply a 30-day cooldown** (supply-chain soak — same rationale as the Dependabot npm cooldown): bump only to the newest stable pnpm ≥30 days old, never the just-released `latest`.
     - Find the newest eligible version:

       ```bash
       npm view pnpm time --json | python3 -c "import json,sys,datetime as d; t=json.load(sys.stdin); c=d.datetime.now(d.UTC)-d.timedelta(days=30); r=[(v,ts) for v,ts in t.items() if '-' not in v and v.split('.')[0].isdigit()]; r.sort(key=lambda x:list(map(int,x[0].split('.')))); print(next(v for v,ts in reversed(r) if d.datetime.fromisoformat(ts.replace('Z','+00:00'))<=c))"
       ```

     - If it's newer than the current pin (mind major bumps — read the pnpm release notes/migration guide first), update `packageManager` in `package.json` with the new version and its sha512 integrity hash (e.g. from `npm view pnpm@<version> dist.integrity` converted to `+sha512.<hex>`), run `mise install` and `mise lock`, then verify no unexpected `pnpm-lock.yaml` churn (`pnpm install --frozen-lockfile`), `pnpm audit --audit-level=high` still resolves, and `pnpm run check` is green. PR it through the normal workflow; file a bead if a major bump needs real migration work.
   - **bd cloud version pin** (from the 2026-08-16 shared-DB schema incident). Cloud beads routines pin `bd` to an exact version at a **single source**: `BD_PINNED_VERSION` in `scripts/beads-cloud-init.sh`. The setup script (`scripts/beads-cloud-setup.sh`) reads that constant and installs exactly it, and the runtime guard checks against it, so both move with one edit; the claude.ai UI holds only a version-free one-line shim and never needs touching. When Tim's local/Bazzite `bd` moves past the pin, bump **that one line** — every cloud routine refuses to run until the installed binary matches. Exact-pin is deliberate: an accidental _newer_ release migrated the shared DB and locked every client out for two days, so a loud refusal is the safe failure. Compare the pin against the installed `bd version`; bump only once the newer version is running clean locally.

2. **TypeScript compiler maintenance**
   - TypeScript 7 is installed as `typescript`; its native `tsc` runs the app, test, E2E, and Next build type checks. Read `docs/plans/2026-06-27-typescript-7-upgrade-plan.md` only for the rollout record.
   - When bumping `typescript`, run `pnpm run typecheck`, `pnpm run typecheck:tests`, `pnpm run typecheck:e2e`, and `pnpm run build`.
   - When bumping `oxlint` / `oxlint-tsgolint`, run `pnpm run lint` (the sole lint engine; see `AGENTS.md` § "Lint engine (Oxlint)").

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

9. **Prod backup validation**
   - Run `pnpm run chores:backups`. It calls `supabase backups list` against PinPoint-Prod and asserts the daily physical backups are still happening: newest COMPLETED backup < 48h old, at least 7 retained, `walg_enabled` true. It warns on a 24–48h-old newest backup, any non-`COMPLETED` entry, and a >36h gap inside the window; it reports `pitr_enabled` so a posture change is visible.
   - **What this proves and doesn't.** It attests that backups **exist** and are being **retained**. It does **not** prove they restore — a real restore drill means restoring a physical backup into a throwaway project, which isn't a weekly-cadence activity. Don't let a green run read as "DR is verified."
   - On **FAIL**: check the Supabase dashboard and `status.supabase.com` before assuming the script is wrong, then file a **P1** bead. This is the only signal we have that the DR posture in `AGENTS.md` §7 is still true.
   - On **WARN**: note it as a comment on the chores bead; a single skipped day isn't an incident, a pattern across weeks is.
   - Requires the Supabase CLI to be logged in (`supabase login`) — auth comes from its stored token, not an env var. `pnpm run db:backup` is unrelated: that's a data-only `public`-schema dev-seeding dump with no schema and no `auth.users`, not a DR artifact.

10. **Memory & context review** (PP-uoqg)
    - Load the `pinpoint-memory-review` skill and run a pass. It reviews every store of recorded context across both machines — beads memories, Claude auto-memories on the Mac and Bazzite, and the canonical context files — then proposes prunes, promotions, and dedupes and hands Tim a short veto list.
    - **This is also the sync mechanism.** Claude auto-memory is per-machine and syncs nowhere, so skipping this item is what lets the two machines drift apart. It is the reason Bazzite once knew a tmux fix for twelve days while the Mac rediscovered it from scratch.
    - The most context-heavy item on the list — **delegate the verification fan-out to subagents** per that skill and keep only the synthesis inline.
    - The veto list is presented **in-session**, one line per item. Tim drills into whichever ones he wants; don't hand him a document.

## Finish: re-arm the nag

When chores are done, **re-defer the bead one week out** so it goes dormant and the nag clears everywhere:

    bd defer --until=<next Saturday> <chores-bead>

`<next Saturday>` = the next Saturday's date in `YYYY-MM-DD` (e.g. `bd defer --until=2026-07-18 PP-qehv`). Optionally leave a run summary comment first:

    bd comments add <chores-bead> "Chores done <date>: <one-line summary of what was reviewed / filed>."

Do **not** close the bead — it's a recurring holder. Deferring it (status `deferred`, future `defer_until`) is what makes it dormant; nothing else is needed — don't flip it back to `open`. The nag stays silent until that date passes.

> **Note:** `bd defer --until=<date>` is interpreted as **UTC midnight** of that date. In US-Central that's the evening before, so a "next Saturday" re-arm actually becomes due Friday evening local — the nag's day-count boundary flips then, not at local Saturday midnight. Close enough for a weekly cadence; just don't expect the count to tick over exactly at local midnight.

> Beads sync note: `bd` writes locally; the lead handles `bd dolt push`. Don't push beads from a chores session unless you're the lead.

# Memory-Pressure Investigation & Reduction Plan — 16 GB M5 Air

**Date:** 2026-06-01 · **Author:** investigation session (Claude) · **Status:** data + recommendations (no levers implemented yet)

## The thesis: a 5-developer workload on one developer's RAM

PinPoint is developed **solo**, but with 4–5 parallel Claude Code sessions across git worktrees — i.e. a **5-person team's workload collapsed onto one 16 GB MacBook Air**. A real 5-person team has ~80 GB of combined RAM and never shares a Postgres or an editor process. You're sharing one machine. So the macOS _"system has run out of application memory"_ lockups aren't a mystery — they're the arithmetic of **per-developer overhead × 5, with no per-developer machines to absorb it.**

The whole reduction strategy follows from this: **deduplicate the things a team would never share** (one DB instead of 5, one MCP server instead of 5, serialized heavy work instead of 5 concurrent), and **bound the per-run peaks** (worker caps, pressure gate).

## Method (so the numbers are trustworthy)

- Metric is **`phys_footprint`** (via `footprint -p <pid>`), _not_ RSS. RSS double-counts shared frameworks across processes — that's literally why the Force-Quit panel showed cmux and Chrome at an identical, inflated 14.24 GB (its per-app numbers sum to ~34 GB on a 16 GB machine; they're unreliable).
- Harness: `scripts/diagnostics/mem-budget.sh` (`snap` / `watch` / `reduce`), attributing per-app subtrees and per-run process trees by pgid.
- **Lesson paid for in this investigation:** the first two "max-workers" measurements were invalid — `pnpm run test:integration -- --max-workers=1` appends _after_ the script's hardcoded `--max-workers=4` and vitest ignored the override, so "1 vs 4" was really "4 vs 4." Always verify a cap took effect (wall-clock is the tell) before trusting a comparison.

## Measured memory budget (phys_footprint)

| Component                               | Cost                 | Notes                                                                                                                    |
| --------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1 Claude session **core**               | ~330 MB              | the `claude` binary                                                                                                      |
| **chrome-devtools-mcp** per session     | **~567 MB**          | 3 Node procs (npm-exec + server + telemetry watchdog); **bigger than the session core**; launches a Chrome too when used |
| 1 idle session total                    | **~900 MB**          | core + chrome-devtools-mcp; **×5 ≈ 4.5 GB before any work**                                                              |
| 1 Supabase stack (containers)           | **~175 MB**          | 5 containers (db/kong/auth/rest/inbucket), inside the VM                                                                 |
| **OrbStack VM** host overhead           | **~1.4 GB**          | nearly fixed once running; **does not shrink promptly when containers stop**                                             |
| Integration suite, `--max-workers=4`    | **~6.6 GB**          | ~1.5 GB per concurrent PGlite fork                                                                                       |
| Integration suite, `--max-workers=2`    | **~3.3 GB**          | wall-clock ~12 s                                                                                                         |
| Integration suite, `--max-workers=1`    | **~1.8 GB**          | wall-clock 17 s (vs 9 s at 4)                                                                                            |
| Unit suite (uncapped, ~9 jsdom workers) | ~3.2 GB              | no worker cap today                                                                                                      |
| Your own Google Chrome                  | ~0.9–1 GB            | 13 procs                                                                                                                 |
| Swap                                    | dynamic, seen 2–8 GB | reclaimed after you _quit_ (not pause) sessions                                                                          |

**The cliff:** a single 4-worker integration run drove free RAM to **74–89 MB**. Two of those concurrently (two sessions) ≈ 13 GB transient — that's the lockup.

## Key findings

1. **PGlite is not leaking — it's concurrent-fork multiplication.** `pool: forks` + `isolate: true` ⇒ a new forked process per test file, each re-importing the module graph + a ~128 MB PGlite WASM heap ≈ ~1.5 GB/fork. `--max-workers` caps _concurrent_ forks, so **peak ≈ max-workers × 1.5 GB, independent of test count.** Forks are reaped between files (verified). → **Capping workers is a real, large lever; adding tests (PR-1469 RECLASS) raises runtime, not peak.**
2. **One PGlite fork (~1.5 GB) costs ~8× a whole Supabase Postgres stack (~175 MB).** The "lightweight in-memory" framing is backwards at scale. A _single shared_ Postgres serving integration tests is far lighter than N in-process WASM instances — but switching is medium/high effort (needs per-worker isolation: schema-per-worker or template-clone à la IntegreSQL) and is only worth it if worker-capping proves insufficient.
3. **chrome-devtools-mcp is the recent regression.** It's enabled **globally** (plugin loaded in every session), ~567 MB × N. Adding it ~tripled per-session footprint — which matches "things got much worse recently." (It's _probably_ not the literal "Google Chrome" row in your OOM screenshot — that was most likely your own browser + the panel's inflated accounting — but it's a real ~567 MB × 5 = ~2.8 GB standing cost.)
4. **The lockup vector is the `sem` bypass.** The host-wide `sem --jobs 2` lock only wraps `preflight`. Bare `test:integration` / `build` / `smoke` run **unguarded**, so N sessions × ~4–6 GB stack up with nothing serializing them. (Slot allocation and the worktree-add `flock` are otherwise **sound** — verified.)
5. **Your preflight "startup failures" — root-caused.** In the parallel phase, `lint:fix` (eslint --fix) and `format:fix` (prettier --write) **write the same ~521 source files simultaneously**; prettier reads a file mid-write → parse error → `npm-run-all` cascade-kills the run. Secondary: `test:ensure-schema` regenerating `schema.sql` while parallel consumers read it.
6. **Stopping stacks ≠ freeing host RAM (immediately).** OrbStack's VM holds the freed memory (~1.4 GB) until it deflates or restarts. And **restarting OrbStack resurrects all previously-running stacks** (`restart: unless-stopped`) — so "quit OrbStack to free memory" only lasts until next launch.

## Recommendations — ranked (GB saved across 5 sessions × low effort/risk)

### Tier 1 — biggest win per effort

1. **Disable `chrome-devtools-mcp` globally; enable on demand.** ~**2.8 GB** across 5 sessions, one settings edit. Re-enable only when actively browser-debugging. _(trivial / low)_
2. **Extend the host-wide `sem` lock to the bare heavy scripts** (`test`, `test:integration`, `test:integration:supabase`, `build`, `smoke`), not just `preflight`. Caps concurrent heavy runs across all sessions → kills the lockup vector. Reuses the existing `preflight-locked.sh` pattern. _(small / low)_
3. **Add a memory-pressure gate** — `scripts/guard/mem-precheck.sh` reading `kern.memorystatus_level` + swap, prepended to heavy scripts **and** a `PreToolUse` hook blocking heavy commands under pressure, with a `FORCE_MEM_PRECHECK=skip` override. Prevents starting a 6 GB run at 100 MB free. _(small / low)_
4. **Cap `--max-workers=2` on the integration projects** (from 4) in `package.json`: peak ~6.6 GB→~3.3 GB for ~3 s more wall-clock. Also add `--max-workers=4` to the uncapped **unit** script. _(trivial / low)_ ✅ _verified lever_

### Tier 2 — structural "share what a team wouldn't"

5. **`--changed` inner loop.** A `test:changed` workflow (`vitest --changed <merge-base>`) so local iteration runs only affected tests — fewer forks, shorter peak window. Full suite stays in CI. _(small / low)_
6. **On-demand / shared Supabase.** Enforce "only the active worktree's stack runs"; consider a **single shared Postgres** for the local integration path (with the **schema-change fence**: a guard in `db:migrate`/`db:generate`/`db:reset` that refuses when `.env.local` points at the shared stack). Saves ~(N−1)×175 MB container + avoids N×1.4 GB VM pressure. _(medium / medium)_
7. **Cap the OrbStack VM memory** to measured need so Docker can't balloon to ~half RAM. _(trivial / low, GUI)_

### Tier 3 — hygiene & correctness (from the audit)

8. **Fix the preflight race:** serialize `lint:fix` → `format:fix`; write `schema.sql` atomically (tmp+rename); run `test:ensure-schema` once as a serial pre-step. Ends the intermittent startup failures. _(trivial / low)_
9. **Prune the unit layer (PR #1469).** Merge Wave 1 deletes now; the asset is your integration/permissions tests, the liability is mock-heavy/implementation-coupled unit tests. Run **Stryker once, scoped to `src/lib/permissions/**`\*_ as a one-time value audit — not a standing gate. _(medium / low)\*
10. **Audit bugs:** `db:fast-reset` truncates `user_profiles` but not `auth.users`; 8 leaked nested-worktree slots (`worktree_orphan_sweep.py --apply`); one unit-project file misusing PGlite; dead `save_manifest()`. _(trivial / low)_

### Deliberately NOT recommended

- **Switching integration to shared Postgres right now** (do worker-cap first; only escalate if still OOM).
- **`vmThreads`/`vmForks` pool** (docs warn they leak; you have no leak).
- Worker caps as the _only_ fix — they bound a single run, but 5 × capped runs still need the `sem` + pressure gate.

## "5-devs-on-one-Mac" budget check (post-recommendations)

5×330 MB cores + 1 shared MCP (567) + 1 shared stack (175) + OrbStack (1.4 GB) + macOS/apps (~4 GB) + **one** serialized capped test run (~3.3 GB) ≈ **~11 GB** — fits in 16 GB with headroom. Today's path (5×900 MB + 5 stacks + N concurrent 6.6 GB runs) does not.

## Sequencing

1. Tier 1 (#1–4) — immediate, reversible, ~5 GB of breathing room.
2. #8 (preflight fix) — unblocks your daily friction.
3. #5 (`--changed`) + #9 (prune) — lighten the inner loop.
4. Re-measure with the harness; only then decide on #6 (shared Postgres) if still tight.

## Open items / to verify before implementing

- Confirm Vitest version vs the v4.0.18 sequential-OOM regression (#9560).
- Test `pool: threads` for integration (shares module graph across workers → could cut the per-fork duplication further; PGlite-in-threads stability unverified).
- Decide shared-stack vs per-worktree once worker-capping is measured in practice.

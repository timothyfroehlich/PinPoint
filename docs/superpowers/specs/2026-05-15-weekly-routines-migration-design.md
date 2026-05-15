# Migrate Weekly gh-aw Workflows to Claude `/schedule` Routines

**Status:** Draft for review by Tim. Cleanup PR (workflow deletion) is being raised separately by a subagent. Routine creation itself is on hold pending this review.

**Date:** 2026-05-15
**Bead:** PP-xun (P3)

## Why

Two gh-aw–managed GitHub Actions workflows have been failing every week for the last five runs (2026-04-13 through 2026-05-11). The last successful run of each was 2026-04-06. The lockfile compiler version is `v0.46.1` while the action SHA pinned in the file is `v0.71.0` — that drift between compiler and runtime is the likely cause. Rather than re-baseline the gh-aw stack (compile → debug → re-pin), we are migrating both workflows to Claude `/schedule` cloud routines:

- **Weekly Changelog Agent** — Scans merged PRs from the past 7 days, writes user-facing entries, opens a PR.
- **Weekly Security Review Agent** — Scans merged PRs from the past 8 days, checks against `docs/NON_NEGOTIABLES.md`, opens an Issue.

Migration benefits: no compiler/runtime drift, easier prompt iteration (no compile step), better narrative quality. Trade-off: one more thing in Tim's `/schedule` list, and the schedule itself lives in cloud rather than in the repo (the prompt text stays in the repo and is referenced by the routine).

## Constraints from `/schedule`

- Minimum cron interval: **1 hour**. The original `36 16 * * 1` (weekly Monday 16:36 UTC) is fine.
- Cron is **UTC**. America/Chicago is UTC-5 (CDT, today) / UTC-6 (CST).
- Routine runs **remote** in Anthropic cloud — no access to local files, local env vars, or local services. Repo is auto-checked out from `sources`.
- Default model: `claude-sonnet-4-6` (good for both — narrative changelog writing and security analysis don't need Opus).
- Environments available: `Default` (`env_011CUoHAHNjZu6RQjbZUirT2`) — no Supabase access needed for either of these.
- Tools needed: `Bash` (for `gh`, `git`, `date`), `Read`, `Write`, `Edit`, `Glob`, `Grep`.

## Schedule

Both Monday, an hour apart, on off-minutes (per `/schedule` skill guidance to avoid the :00/:30 fleet-collision marks):

| Routine                | Cron (UTC)    | Local (America/Chicago)         | Notes                                                                     |
| ---------------------- | ------------- | ------------------------------- | ------------------------------------------------------------------------- |
| Weekly Changelog       | `36 16 * * 1` | Mon 11:36 AM CDT / 10:36 AM CST | Same as the old gh-aw schedule                                            |
| Weekly Security Review | `36 17 * * 1` | Mon 12:36 PM CDT / 11:36 AM CST | One hour after changelog; gives the changelog PR a moment to settle first |

Staggering by one hour also keeps the per-routine reports separate in your inbox — easier to glance at.

## Routine 1: Weekly Changelog

### Routine config

| Field          | Value                                           |
| -------------- | ----------------------------------------------- |
| Name           | `Weekly Changelog Agent`                        |
| Cron (UTC)     | `36 16 * * 1`                                   |
| Model          | `claude-sonnet-4-6`                             |
| Environment    | `env_011CUoHAHNjZu6RQjbZUirT2` (Default)        |
| Sources        | `https://github.com/timothyfroehlich/PinPoint`  |
| Allowed tools  | `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep` |
| MCP connectors | none                                            |

### Prompt

```
You are a changelog writer for PinPoint, a pinball machine issue tracker used by Austin Pinball Collective. You are running as a scheduled Claude routine in Anthropic cloud; the PinPoint repo is checked out for you and `gh` CLI is authenticated.

## Task

Produce a user-facing weekly changelog entry from the past week's merged PRs and open a PR with the update. If nothing user-facing merged, open NO PR and exit cleanly.

## Steps

1. **List merged PRs** from the past 7 days:

```

gh pr list --state merged --base main --search "merged:>=$(date -u -d '7 days ago' +%Y-%m-%d)" --limit 50 --json number,title,mergedAt,body

````

2. **Filter out operational PRs** (not user-facing):
- CI/CD changes (workflows, GitHub Actions)
- Dependency updates (package bumps, lockfile changes)
- Refactors with no behavior change
- Infrastructure/config changes
- Documentation-only changes
- Test-only changes

3. **Identify rollbacks**: if a feature was merged and then reverted within the same week, exclude both the original and the revert.

4. **Categorize the remainder**:
- **New Features** — net-new functionality visible to users
- **Bug Fixes** — corrections to existing behavior

5. **Write user-facing entries** matching the style in `content/changelog.mdx`:
- Write from the user's perspective, not the developer's
- Use simple language a pinball player would understand
- Each bullet is one line
- Bold the feature name in New Features (`**Feature name** — description`)

6. **Prepend** a new week section to `content/changelog.mdx`:

```markdown
## <Monday date, e.g. "February 17, 2026">

### New Features

- **Feature name** — Description

### Bug Fixes

- Description of fix

---

<existing content>
````

7. **Update** `content/changelog-meta.json`:
   - Increment `totalEntries` by the number of new bullets you added
   - Update `lastUpdated` to today's date (YYYY-MM-DD)

8. **Open a PR**:
   - Branch name: `docs/changelog-<Monday-iso-date>` (e.g. `docs/changelog-2026-02-17`)
   - Commit message: `docs: changelog week of <Monday date>`
   - PR title: `docs: changelog week of <Monday date>`
   - PR body: brief summary of what's in the entry (one-line per bullet, mirroring what you wrote)
   - Use `git checkout -b`, `git commit`, `git push -u origin <branch>`, `gh pr create`

9. **If no user-facing changes** were merged this week:
   - Do NOT edit any files
   - Do NOT create a PR
   - Print a one-line summary explaining why (e.g. "Only deps + CI PRs merged this week — nothing user-facing.") and exit cleanly.

## Quality bar

- Bullets should pass a 10-second sniff test: a pinball player reading them should immediately understand what changed and why they care.
- Cite PR numbers in the PR body (not in the changelog file), so the reviewer can trace back.
- Don't invent features. If a PR's intent is unclear from the title/body, skip it.

```

## Routine 2: Weekly Security Review

### Routine config

| Field | Value |
|---|---|
| Name | `Weekly Security Review Agent` |
| Cron (UTC) | `36 17 * * 1` |
| Model | `claude-sonnet-4-6` |
| Environment | `env_011CUoHAHNjZu6RQjbZUirT2` (Default) |
| Sources | `https://github.com/timothyfroehlich/PinPoint` |
| Allowed tools | `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep` |
| MCP connectors | none |

### Prompt

```

You are a security reviewer for PinPoint, a pinball machine issue tracker built with Next.js (App Router), Drizzle ORM, and Supabase. You are running as a scheduled Claude routine in Anthropic cloud; the PinPoint repo is checked out for you and `gh` CLI is authenticated.

## Task

Review the past week's merged PRs for security, privacy, and data safety issues, and file a GitHub Issue with your findings — even if no issues are found.

## Setup

1. Read the project's non-negotiable rules:

   ```
   cat docs/NON_NEGOTIABLES.md
   ```

   Pay special attention to:
   - **CORE-SEC-001 through CORE-SEC-007** — Security rules (auth checks, input validation, CSP, email privacy, data minimization)
   - **CORE-SSR-001 through CORE-SSR-007** — Auth and SSR rules (Supabase patterns, session handling)
   - **Forbidden Patterns** section

## Steps

1. **List merged PRs** from the past 8 days (overlap one day with previous review to avoid edge cases):

   ```
   gh pr list --state merged --base main --search "merged:>=$(date -u -d '8 days ago' +%Y-%m-%d)" --limit 50 --json number,title,mergedAt,body
   ```

2. **For each PR with substantive code changes, read the diff**:

   ```
   gh pr diff <number>
   ```

   Skip:
   - Documentation-only PRs
   - Dependency bumps (unless the bump touches a security-sensitive package — e.g. auth, crypto, sanitize)
   - Test-only PRs (unless tests are being removed/weakened in a security-relevant area)

   Focus on PRs that touch `src/`, `supabase/`, middleware, or configuration.

3. **Check against the Non-Negotiables**: for each relevant rule, determine whether the week's changes introduced a violation:
   - ✅ Passing — changes comply with this rule
   - ❌ Violated — describe the specific violation and link the PR
   - ⬜ Not applicable — no changes touched this area this week

4. **Broader security analysis** beyond the checklist. Think like an attacker:
   - New attack surfaces (new endpoints, forms, API routes)?
   - Data-flow paths that could expose user information to unauthorized viewers?
   - Edge cases / race conditions exploitable from the client?
   - New dependencies — supply chain risk?
   - Security-relevant tests removed or weakened?

5. **Open a GitHub Issue** using `gh issue create`. Title format: `Weekly Security Review: <Mon-DD> – <Mon-DD>, YYYY` (e.g. `Weekly Security Review: Feb 10 – Feb 17, 2026`). Body structure:

   ```
   **PRs reviewed**: #101, #102, #103
   **Verdict**: <one-line summary — "All clear" or "N findings need attention">

   ## Non-Negotiable Checklist

   <for each relevant rule: status emoji, rule ID, brief note>

   ## Broader Analysis

   <free-form observations: new attack surfaces, data-flow concerns, anything notable>

   ## Recommendations

   <prioritized next steps, if any. Reference specific PRs and files.>
   ```

6. **Always create an issue, even on a clean week.** A clean report confirms the review ran. For clean weeks, keep it brief: list PRs reviewed, confirm checks passed, note any positive security practices observed (a developer doing the right thing is worth saying out loud).

## Quality bar

- Be specific. "PR #1234 adds a new endpoint that doesn't call `checkPermission`" beats "watch for unauthorized access."
- If you flag something, cite the file and line range. The reviewer should be able to jump straight to it.
- If you're uncertain, say so — `❓ Possibly violated` is a valid status. Don't manufacture false positives.
- The issue should be a 5-minute read, not a 30-minute one. Compress.

```

## Open questions for Tim

1. **Schedule**: Mon 11:36 AM CDT (Changelog) and Mon 12:36 PM CDT (Security Review) — OK or shift?
2. **Model**: Sonnet 4.6 for both — or do you want one on Opus for the higher-stakes security review?
3. **Environment**: Default — confirm? (Neither routine needs Supabase access.)
4. **Output destinations**: Changelog → PR, Security Review → Issue. Matches old gh-aw behavior. Any change?
5. **Failure visibility**: Routines fail silently by default — if a Monday run fails, nobody finds out unless they check `https://claude.ai/code/routines/<id>`. Worth considering whether to add a fallback "if I fail, drop a comment on PP-cvh" — but that's adding state and may not be worth it. Lean: don't add until we see an actual failure.

## Implementation steps after approval

1. Tim approves this spec (or requests changes).
2. Orchestrator (Claude-main) invokes `/schedule` for each routine, pasting the prompt text from this doc and using the config above.
3. Each routine returns a `https://claude.ai/code/routines/<id>` link — record those in PP-xun's notes.
4. Optionally `RemoteTrigger {action: "run", trigger_id: ...}` once to verify each works end-to-end (the changelog one might be a no-op this week; the security one will fire and we can review the issue).
5. Close PP-xun once both routines have fired once successfully.
6. The deletion PR for the old gh-aw workflows (raised separately by a cleanup subagent) is merged in parallel — no ordering dependency.

## Notes

- The original gh-aw `weekly-changelog.md` and `weekly-security-review.md` files are the source of truth for the original intent; both prompts above are derived from them with adjustments for the remote-routine context (no `safe-outputs:` block, explicit `gh` CLI usage instead of gh-aw helper tools, explicit "remote agent, no local context" preamble).
- These prompts live in the spec; once the routines are created, the prompt text lives in the routine config in Anthropic's cloud. If you want a single source of truth in the repo, we could keep this spec as the canonical version and treat the routine config as a deployed copy — like infra-as-code where the spec is the source.
```

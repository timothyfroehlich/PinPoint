# Human-Gated Merges + UI Screenshots (PP-wi85)

**Date:** 2026-07-17
**Bead:** PP-wi85
**Status:** Design approved (Tim + Claude, 2026-07-17); implemented in this PR.

## Purpose

`.claude/hooks/block-direct-merge.cjs` already blocked `gh pr merge`, `gh api
.../merge`, and MCP `mcp__github__merge_pull_request` — but it deliberately
steered agents to `scripts/workflow/merge-pr.sh`, which merges once its 5
gates (`ci`/`reviewed`/`currency`/`threads`/`no_conflict`) pass, with **no
human-approval gate**. That is exactly how recent Claude sessions auto-merged
features without Tim's explicit approval: passing the gates was treated as
equivalent to Tim's sign-off, which it never was.

Tim (solo dev) wants two things:

1. **No merges by ANY path unless he explicitly runs the merge himself.**
2. **UI-touching PRs get desktop+mobile screenshots auto-posted to the PR**
   so he can eyeball them before merging — code review doesn't substitute for
   looking at the rendered UI.

## Scope

### 1. Hard merge gate — `.claude/hooks/block-direct-merge.cjs`

Extended to additionally block an agent Bash call invoking
`scripts/workflow/merge-pr.sh`, detected at a command-start position
(mirroring the existing `cmdStart` regex used for the `gh pr merge` check):
after `^`, `;`, `&&`, `||`, `|`, `&`, newline, `$(`, `<(`, `(`, backtick — and
additionally tolerating `bash`/`sh` interpreter wrappers, an `env
[VAR=val...]` prefix, and a relative/absolute path prefix ahead of the
`merge-pr.sh` basename. The existing quote-stripping (single- and
double-quoted spans replaced with empty quotes before matching) is reused
unchanged, so `echo`/`rg`/docs mentions of "merge-pr.sh" don't false-positive.

Block message for this case:

> Merge is human-only. You cannot run merge-pr.sh. Finish the PR (CI green,
> reviews resolved, screenshots posted if UI), then hand Tim the exact command
> to run himself: `! scripts/workflow/merge-pr.sh <PR> --human`

Exit code 2 (deny), matching the existing `gh pr merge` / MCP-merge block
behavior.

**The `.claude-merge-bypass` sentinel file mechanism was removed entirely.**
Under a hard gate there is no agent-usable bypass — the hook no longer reads
any filesystem state at all. The only merge channel is a human typing a
`!`-prefixed command in Claude Code: that is a shell passthrough which does
**not** generate a `PreToolUse` event, so it is never intercepted. This is the
one open feasibility item in this design — see "Open feasibility item" below.
Malformed JSON payloads on stdin still fail open (exit 0), unchanged.

Test coverage: `src/test/unit/hooks/block-direct-merge.test.ts` (new),
mirroring the subprocess-invocation pattern already used by
`verify-guard-stack.test.ts` (spawn `node` on the hook, JSON on stdin, assert
exit code + stderr). Cases added: `bash scripts/workflow/merge-pr.sh 123` →
blocked; `./scripts/workflow/merge-pr.sh 123` → blocked; bare `merge-pr.sh
123` → blocked; absolute-path invocation → blocked; `sh merge-pr.sh` →
blocked; chained after another command (`&&`) → blocked; a quoted mention
(`echo "run merge-pr.sh"`, `rg "merge-pr.sh" docs/`) → **not** blocked; an
unrelated `gh pr view` → **not** blocked; a stray `.claude-merge-bypass`-shaped
command → still blocked (proves there's nothing left for a sentinel to flip).

### 2. Defense-in-depth guard in `scripts/workflow/merge-pr.sh`

The Claude Code hook only fires inside Claude Code. Other harnesses that run
in this repo (Codex, Gemini, Antigravity) don't wire it. `merge-pr.sh` now
requires a `--human` flag to actually execute a merge:

```
scripts/workflow/merge-pr.sh <PR> --human [--dry-run] [--force] [--bypass-merge-requirements]
```

Omitting `--human` (when not `--dry-run`) fails fast, before any GitHub API
call, with a `REFUSE:` message naming the canonical command. `--dry-run` is
exempt from the `--human` requirement — it takes no action, so previewing
gate status is harmless. This exemption only matters **outside** Claude Code:
inside Claude Code, the hook in §1 blocks the Bash call before the script
runs at all, `--dry-run` included, so a Claude Code agent can never invoke
`merge-pr.sh` in any form.

`--human` is a same-tool guard against non-interactive/scripted invocation —
it cannot verify a human is actually typing the command, and doesn't try to.
It stops accidental/scripted calls; it is not a security boundary on its own.

All documented invocations were updated to the canonical `<PR> --human` form:
`AGENTS.md`, `pinpoint-pr-workflow` SKILL.md, `pinpoint-orchestrator`
SKILL.md, `pinpoint-superpowers-bridge` SKILL.md, `pinpoint-agy-execute`
SKILL.md, `scripts/workflow/AGENTS.md`, and the script's own usage/help text.

### 3. Commit-time screenshot reminder — `.claude/hooks/ui-screenshot-reminder.cjs`

New PostToolUse hook (pattern copied from the existing
`preflight-reminder.sh`). Fires on a Bash `git commit` (detected via the same
cmdStart + quote-stripping approach as the merge-blocking hooks). Diffs
`origin/main...HEAD` (three-dot / merge-base diff, so it reflects the whole
branch's cumulative changes, not just the latest commit) and, if any changed
file matches a UI glob (`src/app/**/*.tsx`, `src/app/**/*.css`,
`src/components/**`, any `*.css`, `tailwind*`, `design-token*`), prints one
line to stderr:

> 🖼 UI-touching change — before handing this PR to Tim, post screenshots:
> scripts/workflow/pr-screenshots.mjs <PR> (desktop+mobile).

Always exits 0 (non-blocking nudge, not a gate) and fails open silently if
`origin/main` is unreachable or the cwd isn't a git repo. Registered in
`.claude/settings.json` under `PostToolUse` (matcher `Bash`), immediately
after the `preflight-reminder.sh` entry. No network calls beyond the local
`git diff` (reads git's already-fetched knowledge of `origin/main`; does not
fetch).

Test coverage: `src/test/unit/hooks/ui-screenshot-reminder.test.ts` (new) —
builds a scratch git repo per test with a fake `origin/main` ref (via
`git update-ref refs/remotes/origin/main <sha>`, no real remote needed) so
the diff resolves deterministically; asserts the reminder fires for
`src/components/**`, `src/app/**/*.tsx`, and `*.css` changes, stays silent for
non-UI changes and non-commit commands, and fails open when `origin/main`
doesn't exist.

### 4. Screenshot workflow — `scripts/workflow/pr-screenshots.mjs`

Node ESM script:

```
node scripts/workflow/pr-screenshots.mjs <PR> [--pages a,b,c] [--force-auth]
```

- **Viewports:** desktop `1440×900`, mobile `390×844`. Two PNGs per manifest
  page.
- **Page manifest:** `scripts/workflow/ui-screenshot-manifest.json`, an id →
  `{ label, route, authRole, seedNeeds }` map. Seeded with six core pages:
  issues list (`/issues`), issue detail (`/m/AFM/i/1`), report form
  (`/report`), dashboard (`/dashboard`), a machine detail (`/m/TAF`), and
  collections (`/c/collections`). `--pages` filters to a subset; default is
  every manifest page.
- **Auth:** reuses the existing E2E harness — `e2e/support/auth-state.ts`'s
  `STORAGE_STATE` role→path convention (`e2e/.auth/{admin,member,technician}.json`)
  is duplicated as a small local constant (documented hardening follow-up:
  import the shared TS constant instead once there's a clean way to do so
  from a plain `.mjs` script without pulling in `tsx`). If storage state is
  missing (or `--force-auth` is passed), the script shells out to `pnpm exec
playwright test --project=auth-setup`, which — via `e2e/global-setup.ts` —
  resets and reseeds the **local** dev DB. This is the same reset the E2E
  suite already does locally; it is never run against production, and
  `baseURL` is always `http://localhost:<PORT>` (CORE-SEC-008), resolved via
  `@next/env`'s `loadEnvConfig` the same way `playwright.config.ts` does
  (worktree-aware `PORT`).
- **Capture:** launches one `chromium` instance via `@playwright/test`'s
  exported `chromium.launch()` (not the test runner), opens one
  `BrowserContext` per (role, viewport) pair reused across pages in that
  pair, navigates with `waitUntil: "networkidle"`, screenshots to a temp dir.
- **Hosting:** pushes PNGs to a dedicated **orphan branch `pr-screenshots`**
  (created if missing) at path `pr-<N>/<shortsha>/<viewport>-<pagelabel>.png`.
  Done entirely inside a throwaway temp directory with its **own fresh `git
init`** — deliberately **not** `git worktree add` against the main repo —
  so it never touches the working tree and never trips the repo's Husky
  post-checkout hook (which would otherwise allocate a worktree port slot for
  a directory that exists only to hold PNGs for a few seconds). The repo is
  public, so `https://raw.githubusercontent.com/<owner>/<repo>/pr-screenshots/<path>`
  renders inline in PR comments without auth.
- **Comment:** posts or updates ONE sticky PR comment (found by marker
  `<!-- pr-screenshots -->`, mirroring `mark-claude-review.sh`'s sticky-marker
  pattern including the `--paginate` + `jq -s add` slurp-and-flatten so a
  marker on page 2+ of a busy PR isn't missed) — a section per page with a
  desktop|mobile markdown image table, headed by the capture's head SHA.

Hardening follow-ups deliberately deferred (best-effort per Tim's framing of
this as a hooks/tooling change, not a polished feature):

- No retry/backoff on flaky navigation — single attempt per page.
- Session staleness is handled only via the manual `--force-auth` escape
  hatch, not detected automatically (an expired JWT would just screenshot a
  login page).
- The `pr-screenshots` branch has no pruning/TTL, unlike the preview-
  deployment reaper (`pinpoint-preview-deployments`) — it will grow
  unbounded. A follow-up bead should add an hourly/weekly reaper mirroring
  that pattern once the branch's actual growth rate is known.
- PR-number/local-HEAD mismatch is a warning, not a hard failure (covers the
  common case of forgetting to push before shooting screenshots).

### 5. Docs + skill updates

- `AGENTS.md` §2.2 rule 6 and §9 "Landing the plane": merge is explicitly
  human-only via ANY path including `merge-pr.sh`; the agent's terminal state
  on a PR is "ready-for-review + CI green + reviews resolved + screenshots
  posted if UI-touching + hand Tim `! scripts/workflow/merge-pr.sh <PR>
--human`." Added an explicit UI-screenshot step and vocabulary guidance
  ("ready for Tim to merge", never "merged").
- `pinpoint-pr-workflow` SKILL.md: new §3.5 "Post UI screenshots" (before the
  ready-for-review label step, now §3.6); Phase 4 rewritten around the
  human-only handoff — what the agent does (§4.1: hand off, don't merge),
  what `merge-pr.sh --human` does for reference (§4.2-4.4, reframed as "Tim
  runs this"), and what to do if the script itself is broken (§4.5: flag it,
  don't work around it).
- `pinpoint-orchestrator`, `pinpoint-superpowers-bridge`, and
  `pinpoint-agy-execute` SKILL.md files updated to the same human-only
  framing. `pinpoint-agy-execute` additionally corrects a pre-existing
  inaccuracy: Antigravity doesn't have the Claude-Code-specific PreToolUse
  hook, so its actual enforcement there is the explicit "do not merge"
  instruction plus `merge-pr.sh`'s own `--human` requirement.
- `scripts/workflow/AGENTS.md`: merge-pr.sh marked human-only in the scripts
  table and the "Key Design Decisions" section; added `pr-screenshots.mjs`
  and `ui-screenshot-manifest.json` to the scripts table.
- `.claude/hooks/block-bad-shell-patterns.cjs`: fixed a stale header comment
  that pre-dated this change and claimed `gh pr merge` was only "ask"-gated,
  not hard-blocked — it was already hard-blocked by `block-direct-merge.cjs`
  before this PR; the comment was simply wrong.

## Open feasibility item

The `!`-bypass assumption — that a human-typed `!`-prefixed command in Claude
Code does not generate a `PreToolUse` event, and so is invisible to
`block-direct-merge.cjs` — is the load-bearing mechanism for this whole
design. It could not be independently verified from inside the implementing
subagent (no way to simulate a human keystroke in this environment). If it
turns out `!` commands **do** fire `PreToolUse` in some Claude Code version,
the practical effect is simply that Tim would also need to run the merge
command outside Claude Code (a separate terminal) — the agent-side guarantee
(no agent can merge, by any path) holds either way, since it doesn't depend
on this assumption at all.

## Non-goals / explicitly out of scope

- No attempt to detect or block a human running `gh pr merge` directly in a
  separate terminal — that's not a Claude Code tool call and was never in
  scope for a PreToolUse hook.
- No screenshot diffing / visual-regression tooling — this posts current
  screenshots for human review, it does not compare against a baseline.
- No automatic pruning of the `pr-screenshots` branch (see hardening
  follow-ups above).

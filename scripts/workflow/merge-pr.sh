#!/usr/bin/env bash
# merge-pr.sh — composite gate-then-merge enforcer.
# Re-evaluates all 5 PR gates at merge time (TOCTOU safety vs label-time gates),
# squash-merges with --match-head-commit if all pass, removes ready-for-review label on failure.
#
# Usage: merge-pr.sh <PR> (--human|--dependabot) [--dry-run] [--force] [--bypass-merge-requirements]
#   --human                       Authorizes a merge. Merging is human-authorized only
#                                 (PP-wi85) — this script refuses to execute a merge
#                                 without it (or --dependabot). Not required for --dry-run:
#                                 a human or CI process previewing gate status without
#                                 merging is fine. This is NOT an agent-preview allowance —
#                                 inside Claude Code, block-direct-merge.cjs blocks an agent
#                                 from invoking this script at all, --dry-run included.
#   --dependabot                  Substitutes for --human on Dependabot dependency-bump PRs
#                                 ONLY (PP-c0uy). This is the single, deliberately narrow
#                                 hole in the PP-wi85 human-only rule. It grants NO gate
#                                 relief — all 5 gates still run with their normal rules —
#                                 and it adds three hard preconditions on top:
#                                   1. PR author is a trusted Dependabot identity
#                                   2. EVERY commit on the PR is Dependabot-authored
#                                      (blocks riding a human commit in on a bot branch)
#                                   3. every changed file is inside the dependency-bump
#                                      allowlist (see DEPENDABOT_* below)
#                                 Any precondition failure is a hard REFUSE with no bypass.
#                                 --force and --bypass-merge-requirements are rejected
#                                 outright in combination with --dependabot.
#   --dry-run                     Print would-do summary, take no action. Does not require --human.
#   --force                       Bypass currency + threads + reviewed gates.
#   --bypass-merge-requirements   Bypass ci gate AND pass --admin to gh pr merge
#                                 (overrides GitHub branch-protection rules).
#                                 Combine with --force to bypass currency + threads + reviewed + ci together.
#
# Canonical human-run command: scripts/workflow/merge-pr.sh <PR> --human
#
# no_conflict gate is NEVER bypassable — GitHub rejects conflicting merges regardless of --admin.
# Authorship gate has no bypass; this script operates only on PRs you authored OR PRs authored
# by trusted Dependabot bot identities (app/dependabot, dependabot[bot], dependabot).
# Both --force and --bypass-merge-requirements require manual permission approval
# (settings.json permissions.ask).
#
# Defense-in-depth note (PP-wi85, amended by PP-c0uy): the --human flag is a
# same-tool guard against non-interactive/scripted invocation — it does not (and
# cannot) verify a human is actually typing the command. It stops accidental/scripted
# calls. The enforcement boundary used to be that Claude Code's block-direct-merge.cjs
# PreToolUse hook refused to let an agent invoke this script at all (any flags).
# PP-c0uy narrows that: the hook now permits exactly one agent-usable shape —
# `merge-pr.sh <PR> --dependabot` with none of --human/--force/--bypass-merge-requirements.
# The hook only sees a command string, so it CANNOT verify the PR is Dependabot-authored;
# the three preconditions enforced below in this script are the authoritative check.
# Cross-tool (Codex/Gemini/Antigravity) coverage is best-effort only.

set -euo pipefail

PR=""
DRY_RUN=false
FORCE=false
BYPASS_REQS=false
HUMAN=false
DEPENDABOT=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)                   DRY_RUN=true ;;
    --force)                     FORCE=true ;;
    --bypass-merge-requirements) BYPASS_REQS=true ;;
    --human)                     HUMAN=true ;;
    --dependabot)                DEPENDABOT=true ;;
    *) if [ -z "$PR" ]; then PR="$arg"; else echo "Error: unexpected argument $arg" >&2; exit 1; fi ;;
  esac
done

if [ -z "$PR" ] || ! [[ "$PR" =~ ^[0-9]+$ ]]; then
  echo "Usage: $0 <PR> (--human|--dependabot) [--dry-run] [--force] [--bypass-merge-requirements]" >&2
  exit 1
fi

# --dependabot grants no gate relief. Rejecting the bypass flags outright (rather than
# silently ignoring them) keeps the carve-out from ever becoming a general-purpose
# agent merge path: an agent that wants a bypass has to ask a human for --human --force.
if [ "$DEPENDABOT" = "true" ] && { [ "$FORCE" = "true" ] || [ "$BYPASS_REQS" = "true" ]; }; then
  echo "REFUSE: --dependabot cannot be combined with --force or --bypass-merge-requirements." >&2
  echo "        The Dependabot carve-out grants no gate relief whatsoever. If a gate genuinely" >&2
  echo "        needs bypassing, that is a human decision: $0 $PR --human --force" >&2
  exit 1
fi

# Merges are human-authorized only (PP-wi85), with the single Dependabot carve-out
# (PP-c0uy) below. --dry-run is exempt — it takes no action, so a human or CI process
# previewing gate status without merging is fine.
if [ "$DRY_RUN" != "true" ] && [ "$HUMAN" != "true" ] && [ "$DEPENDABOT" != "true" ]; then
  echo "REFUSE: merges are human-authorized only. Canonical command: scripts/workflow/merge-pr.sh $PR --human" >&2
  echo "        (forgot --human? add it to merge. --dry-run previews gate status without merging.)" >&2
  exit 1
fi

# shellcheck source=./_pr-gates.sh
# shellcheck disable=SC1091
source "$(dirname "$0")/_pr-gates.sh"

# --- Authorship gate (no --force bypass) ---
PR_INFO=$(gh pr view "$PR" --json author,title,url,labels,headRefOid,mergeable)
PR_AUTHOR=$(jq -r .author.login <<< "$PR_INFO")
PR_TITLE=$(jq -r .title <<< "$PR_INFO")
PR_URL=$(jq -r .url <<< "$PR_INFO")
PR_LABELS=$(jq -r '.labels | map(.name) | join(",")' <<< "$PR_INFO")
PR_HEAD_SHA=$(jq -r .headRefOid <<< "$PR_INFO")
CURRENT_USER=$(gh api user --jq .login)

# NOTE: is_trusted_author() also returns true for your own PRs, so it is NOT a
# usable Dependabot check. The --dependabot preconditions below use
# is_dependabot_login() (from _pr-gates.sh) directly.
is_trusted_author() {
  local author="$1"
  [ "$author" = "$CURRENT_USER" ] && return 0
  is_dependabot_login "$author" && return 0
  return 1
}

if ! is_trusted_author "$PR_AUTHOR"; then
  echo "REFUSE: merge-pr.sh only operates on your own PRs or Dependabot PRs (PR author: $PR_AUTHOR, you: $CURRENT_USER)" >&2
  exit 1
fi

echo "Target: PR #$PR — $PR_TITLE"
echo "URL: $PR_URL"
echo "Head SHA: $PR_HEAD_SHA"

# --- Dependabot carve-out preconditions (PP-c0uy) ---
# Only evaluated when --dependabot was passed. Every failure is a hard REFUSE with
# no bypass flag: the whole point of this path is that it is mechanically incapable
# of merging anything other than a pure, bot-authored dependency bump. These run
# under --dry-run too, so an agent can verify eligibility without merging.
#
# Path allowlist — the file footprint of a dependency/action bump, nothing else.
# Anything outside it (source, migrations, config, docs) means a human is in the
# loop somewhere and the PR goes back to the --human path.
dependabot_path_allowed() {
  case "$1" in
    pnpm-lock.yaml|package.json|pnpm-workspace.yaml|.github/dependabot.yml) return 0 ;;
    .github/workflows/*) return 0 ;;
  esac
  return 1
}

if [ "$DEPENDABOT" = "true" ]; then
  echo "--dependabot: verifying carve-out preconditions..."

  # Precondition 1: PR author is a trusted Dependabot identity.
  if ! is_dependabot_login "$PR_AUTHOR"; then
    echo "REFUSE: --dependabot requires a Dependabot-authored PR (author: $PR_AUTHOR)." >&2
    echo "        Use the human path instead: $0 $PR --human" >&2
    exit 1
  fi
  echo "  PASS: dependabot-author: $PR_AUTHOR"

  # Precondition 2: EVERY commit on the PR is Dependabot-authored. This is the guard
  # against someone pushing a commit onto a dependabot/* branch and riding it through
  # the carve-out. Commits with zero authors, or an author GitHub can't map to a login,
  # count as a failure — fail closed.
  COMMIT_AUTHORS=$(gh pr view "$PR" --json commits --jq '
    .commits[] |
    if (.authors | length) == 0 then "<no-author>"
    else (.authors[] | if (.login // "") == "" then "<no-login>" else .login end)
    end')
  if [ -z "$COMMIT_AUTHORS" ]; then
    echo "REFUSE: --dependabot could not read the PR's commit authors (empty result) — failing closed." >&2
    exit 1
  fi
  NON_BOT_COMMIT_AUTHORS=()
  while IFS= read -r commit_author; do
    [ -z "$commit_author" ] && continue
    if ! is_dependabot_login "$commit_author"; then
      NON_BOT_COMMIT_AUTHORS+=("$commit_author")
    fi
  done <<< "$COMMIT_AUTHORS"
  if [ ${#NON_BOT_COMMIT_AUTHORS[@]} -gt 0 ]; then
    echo "REFUSE: --dependabot requires EVERY commit to be Dependabot-authored." >&2
    echo "        Non-Dependabot commit author(s): ${NON_BOT_COMMIT_AUTHORS[*]}" >&2
    echo "        A human commit on a Dependabot branch makes this a human-reviewed PR: $0 $PR --human" >&2
    exit 1
  fi
  echo "  PASS: dependabot-commits: all commits Dependabot-authored"

  # Precondition 3: every changed file is inside the dependency-bump allowlist.
  # Uses the paginated REST files endpoint (field is `filename`, unlike `gh pr view
  # --json files` which returns `path`) because gh's GraphQL file list truncates.
  CHANGED_FILES=$(gh api --paginate "repos/$(_repo_slug)/pulls/${PR}/files" --jq '.[].filename')
  if [ -z "$CHANGED_FILES" ]; then
    echo "REFUSE: --dependabot could not read the PR's changed files (empty result) — failing closed." >&2
    exit 1
  fi
  # GitHub caps this endpoint at 3000 files, silently. A dependency bump is never
  # anywhere near that, so treat hitting the cap as "we cannot see the whole diff".
  CHANGED_FILE_COUNT=$(printf '%s\n' "$CHANGED_FILES" | wc -l | tr -d ' ')
  if [ "$CHANGED_FILE_COUNT" -ge 3000 ]; then
    echo "REFUSE: --dependabot saw $CHANGED_FILE_COUNT changed files — at/over GitHub's 3000-file" >&2
    echo "        API cap, so the allowlist check cannot see the whole diff. Failing closed." >&2
    exit 1
  fi
  DISALLOWED_FILES=()
  while IFS= read -r changed_file; do
    [ -z "$changed_file" ] && continue
    if ! dependabot_path_allowed "$changed_file"; then
      DISALLOWED_FILES+=("$changed_file")
    fi
  done <<< "$CHANGED_FILES"
  if [ ${#DISALLOWED_FILES[@]} -gt 0 ]; then
    echo "REFUSE: --dependabot only permits changes to pnpm-lock.yaml, package.json," >&2
    echo "        pnpm-workspace.yaml, .github/workflows/**, and .github/dependabot.yml." >&2
    echo "        Out-of-allowlist file(s): ${DISALLOWED_FILES[*]}" >&2
    echo "        Anything else needs a human: $0 $PR --human" >&2
    exit 1
  fi
  echo "  PASS: dependabot-files: all changed files within the dependency-bump allowlist"
fi

# --- Run all 5 gates, collect statuses ---
# Per-gate bypass kind: "none" (never bypassable), "force" (--force), "admin" (--bypass-merge-requirements).
GATE_FAILURES=()

run_gate() {
  local name=$1 fn=$2 bypass_kind=$3
  local output rc=0
  output=$("$fn" "$PR") || rc=$?
  # Fail-closed visibility: if a gate exits non-zero without emitting a status
  # token (e.g. gh/jq/API failure under pipefail), surface a synthetic FAIL so
  # the structured-output contract isn't broken by a blank line.
  if [ -z "$output" ] && [ "$rc" -ne 0 ]; then
    echo "FAIL: $name: gate exited rc=$rc with no output (likely gh/jq/API failure — see stderr)"
  else
    echo "$output"
  fi
  if [ "$rc" -ne 0 ]; then
    local bypassed=false
    case "$bypass_kind" in
      force)
        if [ "$FORCE" = "true" ]; then
          echo "  (--force: $name gate non-pass, bypassed)"
          bypassed=true
        fi
        ;;
      admin)
        if [ "$BYPASS_REQS" = "true" ]; then
          echo "  (--bypass-merge-requirements: $name gate non-pass, bypassed)"
          bypassed=true
        fi
        ;;
      none) : ;;
    esac
    if [ "$bypassed" = "false" ]; then
      GATE_FAILURES+=("$name")
    fi
  fi
}

run_gate ci          check_ci                  admin
run_gate currency    check_copilot_currency    force
run_gate threads     check_unresolved_threads  force
run_gate reviewed    check_review_happened     force
run_gate no_conflict check_no_merge_conflict   none

# --- Decide ---
if [ ${#GATE_FAILURES[@]} -gt 0 ]; then
  echo "RESULT: ${#GATE_FAILURES[@]} gate(s) failed: ${GATE_FAILURES[*]}"
  if [ "$DRY_RUN" = "true" ]; then
    echo "DRY RUN: would remove ready-for-review label if present"
    exit 1
  fi
  # Remove label if present
  if [[ ",$PR_LABELS," == *",ready-for-review,"* ]]; then
    echo "Removing ready-for-review label..."
    gh pr edit "$PR" --remove-label ready-for-review 2>/dev/null || true
  fi
  exit 1
fi

echo "RESULT: all gates passed"

# Build merge args. --admin invokes admin-merge mode on GitHub, which overrides
# branch-protection rules (failed required checks, missing reviews, etc.).
# Branch deletion is handled by the repo's auto-delete setting — passing --delete-branch
# from a worktree fails the local cleanup step because main is held by the root checkout.
MERGE_ARGS=(--squash --match-head-commit="$PR_HEAD_SHA")
if [ "$BYPASS_REQS" = "true" ]; then
  MERGE_ARGS+=(--admin)
fi

if [ "$DRY_RUN" = "true" ]; then
  echo "DRY RUN: would run: gh pr merge $PR ${MERGE_ARGS[*]}"
  exit 0
fi

# --- Execute merge ---
# Reaching this line already required either --human, or --dependabot plus all three
# carve-out preconditions above (PP-c0uy). The block-direct-merge PreToolUse hook
# (Claude Code) refuses to let an agent invoke this script in any shape other than
# `--dependabot` without bypass flags — see the header comment. This `gh pr merge`
# runs as a subprocess of the script either way, so the hook does not see it
# directly; the flag checks above are the guard for that layer.
gh pr merge "$PR" "${MERGE_ARGS[@]}"
echo "MERGED: PR #$PR"

# --- Post huddle coordination notice (fail-open) ---
# The merge is already done — a huddle failure must NEVER propagate an error.
# shellcheck source=../hooks/huddle-lib.sh disable=SC1091
(
  set +e
  set +u
  set +o pipefail
  _HUDDLE_LIB="$(dirname "$0")/../hooks/huddle-lib.sh"
  if [[ ! -f "$_HUDDLE_LIB" ]]; then
    exit 0
  fi
  source "$_HUDDLE_LIB"
  _TODAY=$(huddle_today_bead_id 2>/dev/null) || exit 0
  [[ -n "$_TODAY" ]] || exit 0
  # Parse PinPoint bead ID from PR title (convention: trailing "(PP-xxx)").
  # Bead IDs may include dots (e.g. PP-yxw.9), so allow [a-z0-9.] in the capture.
  _BEAD_ID=$(printf '%s' "$PR_TITLE" | grep -oE '\(PP-[a-z0-9.]+\)' | tail -1 | tr -d '()' || echo "")
  # Compact changed-files hint for collision awareness (top-level dirs, first 5)
  _FILES=$(gh pr view "$PR" --json files --jq '[.files[].path | split("/")[0]] | unique | .[:5] | join(", ")' 2>/dev/null || echo "")
  _BEAD_PART=""
  [[ -n "$_BEAD_ID" ]] && _BEAD_PART=" ($_BEAD_ID)"
  _FILES_PART=""
  [[ -n "$_FILES" ]] && _FILES_PART=" [touched: $_FILES]"
  _SIGN="${HUDDLE_NAME:-huddle-auto}"
  _MSG="Merged PR #$PR$_BEAD_PART: $PR_TITLE$_FILES_PART. Sync main if you have active branches. —$_SIGN"
  bd comments add "$_TODAY" "$_MSG" >/dev/null 2>&1 || true
) || true

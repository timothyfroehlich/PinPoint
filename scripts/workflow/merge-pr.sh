#!/usr/bin/env bash
# merge-pr.sh — composite gate-then-merge enforcer.
# Re-evaluates all 4 PR gates at merge time (TOCTOU safety vs label-time gates),
# squash-merges with --match-head-commit if all pass, removes ready-for-review label on failure.
#
# Usage: merge-pr.sh <PR> --human [-a|--automerge] [--dry-run] [--force] [--bypass-merge-requirements]
#   --human                       REQUIRED to actually merge — this script refuses to
#                                 execute a merge without it. Not required for --dry-run.
#                                 An agent MAY invoke this script (e.g.
#                                 `bash scripts/workflow/merge-pr.sh <PR> --human`): inside
#                                 Claude Code, block-direct-merge.cjs turns the invocation
#                                 into a PreToolUse APPROVAL PROMPT, so Tim signs off before
#                                 it runs (PP-wi85 reversed for this script only, per Tim
#                                 2026-08-19). The merge decision is still Tim's — he
#                                 approves the prompt. --human stays as a same-tool guard
#                                 against scripted/non-interactive invocation and as
#                                 best-effort coverage in tools that don't wire the hook.
#   -a, --automerge               Poll the gates instead of evaluating them once, and merge
#                                 as soon as they all pass. Fire it while CI is still
#                                 running — that is what it is for. It does NOT wait out
#                                 an unreviewed head: `reviewed` never WAITs, because no
#                                 bot reviews this repo and so no answer is ever already
#                                 on its way. An unattested head hard-fails on the FIRST
#                                 poll and the run ends. So get Tim's review and
#                                 get a fresh Codex GitHub approval BEFORE
#                                 firing this. Terminates on exactly three outcomes, each
#                                 reported on exit:
#                                   MERGED      — gates went green, PR squash-merged
#                                   RED         — a gate hard-failed; no merge, label removed
#                                   TIMED OUT   — still waiting when the budget ran out
#                                 A WAIT (CI still running, mergeability still computing)
#                                 keeps polling; only a hard failure stops it. Tune with
#                                 AUTOMERGE_TIMEOUT (default 3600s) and
#                                 AUTOMERGE_POLL_INTERVAL (default 30s).
#   --dry-run                     Print would-do summary, take no action. Does not require --human.
#   --force                       Bypass threads + reviewed gates. This is the ONLY way to
#                                 merge a head no reviewer has seen, and it requires manual
#                                 permission approval each time.
#   --bypass-merge-requirements   Bypass ci gate AND pass --admin to gh pr merge
#                                 (overrides GitHub branch-protection rules).
#                                 Combine with --force to bypass threads + reviewed + ci together.
#
# Canonical human-run command: scripts/workflow/merge-pr.sh <PR> --human
# Fire-and-forget variant:     scripts/workflow/merge-pr.sh <PR> --human --automerge
#
# no_conflict gate is NEVER bypassable — GitHub rejects conflicting merges regardless of --admin.
# Authorship gate has no bypass; this script operates only on PRs you authored OR PRs authored
# by trusted dependency-bot identities (Dependabot or the hosted Renovate App).
# Both --force and --bypass-merge-requirements require manual permission approval
# (settings.json permissions.ask).
#
# Defense-in-depth note (PP-wi85, reversed for this script per Tim 2026-08-19): the
# --human flag is a same-tool guard against non-interactive/scripted invocation — it
# does not (and cannot) verify a human is actually typing the command. It stops
# accidental/scripted calls. The human-sign-off boundary is Claude Code's
# block-direct-merge.cjs PreToolUse hook: it no longer refuses an agent invocation of
# this script — it turns it into an APPROVAL PROMPT, so Tim approves before the merge
# runs, in ANY harness that wires the hook. (The raw channels — gh pr merge, gh api
# PUT .../merge, MCP merge — stay hard-blocked there, because they skip these gates.)
# Cross-tool (Codex/Gemini/Antigravity) coverage is best-effort only.

set -euo pipefail

PR=""
DRY_RUN=false
FORCE=false
BYPASS_REQS=false
HUMAN=false
AUTOMERGE=false

# Automerge polling budget. Defaults sized for this repo: the full E2E suite runs
# ~10-15 min, so an hour covers a normal PR with room for a CI re-run. It is not
# sized to wait out a review — the review must already be attested before this runs.
AUTOMERGE_TIMEOUT=${AUTOMERGE_TIMEOUT:-3600}
AUTOMERGE_POLL_INTERVAL=${AUTOMERGE_POLL_INTERVAL:-30}

for arg in "$@"; do
  case "$arg" in
    --dry-run)                   DRY_RUN=true ;;
    --force)                     FORCE=true ;;
    --bypass-merge-requirements) BYPASS_REQS=true ;;
    --human)                     HUMAN=true ;;
    -a|--automerge)              AUTOMERGE=true ;;
    *) if [ -z "$PR" ]; then PR="$arg"; else echo "Error: unexpected argument $arg" >&2; exit 1; fi ;;
  esac
done

if [ -z "$PR" ] || ! [[ "$PR" =~ ^[0-9]+$ ]]; then
  echo "Usage: $0 <PR> --human [-a|--automerge] [--dry-run] [--force] [--bypass-merge-requirements]" >&2
  exit 1
fi

# --automerge exists to merge unattended; previewing it would just be the one-shot
# path with extra steps, and silently ignoring one of the two flags is worse than
# refusing.
if [ "$AUTOMERGE" = "true" ] && [ "$DRY_RUN" = "true" ]; then
  echo "Error: --automerge and --dry-run are mutually exclusive." >&2
  echo "       Use --dry-run alone to preview gate status without merging." >&2
  exit 1
fi

# --human is required to actually merge (PP-wi85, reversed for this script per Tim
# 2026-08-19). --dry-run is exempt — it takes no action. An agent MAY invoke this
# script with --human: inside Claude Code the block-direct-merge.cjs PreToolUse hook
# turns the invocation into an approval prompt, so Tim signs off before the merge
# runs. --human stays as a same-tool guard against scripted/non-interactive calls.
if [ "$DRY_RUN" != "true" ] && [ "$HUMAN" != "true" ]; then
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

is_trusted_author() {
  local author="$1"
  [ "$author" = "$CURRENT_USER" ] && return 0
  case "$author" in
    "app/dependabot"|"dependabot[bot]"|"dependabot"|"app/renovate"|"renovate[bot]") return 0 ;;
  esac
  return 1
}

if ! is_trusted_author "$PR_AUTHOR"; then
  echo "REFUSE: merge-pr.sh only operates on your own PRs or trusted dependency-bot PRs (PR author: $PR_AUTHOR, you: $CURRENT_USER)" >&2
  exit 1
fi

echo "Target: PR #$PR — $PR_TITLE"
echo "URL: $PR_URL"
echo "Head SHA: $PR_HEAD_SHA"

# --- Run all 4 gates, collect statuses ---
# Per-gate bypass kind: "none" (never bypassable), "force" (--force), "admin" (--bypass-merge-requirements).
#
# run_all_gates accumulates into globals rather than printing, so the automerge loop can
# decide whether a given poll is worth showing. GATE_BLOCKED is the union in gate order —
# what the one-shot path reports, byte-identical to before automerge existed.
GATE_REPORT=""
GATE_FAILURES=()
GATE_WAITS=()
GATE_BLOCKED=()

run_gate() {
  local name=$1 fn=$2 bypass_kind=$3
  local output rc=0
  output=$("$fn" "$PR") || rc=$?
  # Fail-closed visibility: if a gate exits non-zero without emitting a status
  # token (e.g. gh/jq/API failure under pipefail), surface a synthetic FAIL so
  # the structured-output contract isn't broken by a blank line. Such a gate is
  # never treated as a transient WAIT — a broken gate must not be polled through.
  if [ -z "$output" ] && [ "$rc" -ne 0 ]; then
    GATE_REPORT+="FAIL: $name: gate exited rc=$rc with no output (likely gh/jq/API failure — see stderr)"$'\n'
    rc=1
  else
    GATE_REPORT+="$output"$'\n'
  fi

  if [ "$rc" -eq 0 ]; then
    return 0
  fi

  local bypassed=false
  case "$bypass_kind" in
    force)
      if [ "$FORCE" = "true" ]; then
        GATE_REPORT+="  (--force: $name gate non-pass, bypassed)"$'\n'
        bypassed=true
      fi
      ;;
    admin)
      if [ "$BYPASS_REQS" = "true" ]; then
        GATE_REPORT+="  (--bypass-merge-requirements: $name gate non-pass, bypassed)"$'\n'
        bypassed=true
      fi
      ;;
    none) : ;;
  esac
  if [ "$bypassed" = "true" ]; then
    return 0
  fi

  # rc=2 means a transient WAIT (CI still running, GitHub still computing
  # mergeability); anything else is a hard failure. Both block a one-shot
  # run exactly as before — the distinction only tells automerge whether to keep
  # waiting or to stop.
  if [ "$rc" -eq 2 ]; then
    GATE_WAITS+=("$name")
  else
    GATE_FAILURES+=("$name")
  fi
  GATE_BLOCKED+=("$name")
}

run_all_gates() {
  GATE_REPORT=""
  GATE_FAILURES=()
  GATE_WAITS=()
  GATE_BLOCKED=()
  # Head SHA as of the start of THIS evaluation. Each gate re-reads head itself, so
  # this is what "the commit the gates approved" means — and it is what
  # --match-head-commit must pin. Merging a head read *after* the loop would hand
  # GitHub a commit that inherited another commit's CI, review and thread state.
  POLL_HEAD_SHA=$(gh pr view "$PR" --json headRefOid --jq .headRefOid)
  run_gate ci          check_ci                  admin
  run_gate threads     check_unresolved_threads  force
  run_gate reviewed    check_review_happened     force
  run_gate no_conflict check_no_merge_conflict   none
}

drop_ready_label() {
  # Re-read rather than trusting the startup snapshot: --automerge can run for an
  # hour, and the label is often added by an agent minutes after Tim fires the
  # command. A stale snapshot would silently skip the removal and break the
  # documented RED contract.
  local labels
  labels=$(gh pr view "$PR" --json labels --jq '.labels | map(.name) | join(",")' 2>/dev/null || echo "$PR_LABELS")
  if [[ ",$labels," == *",ready-for-review,"* ]]; then
    echo "Removing ready-for-review label..."
    gh pr edit "$PR" --remove-label ready-for-review 2>/dev/null || true
  fi
}

# Signature of the current blocking picture, used to suppress identical repeat output.
# Built with explicit emptiness checks: `${arr[*]}` on an empty array trips `set -u`
# under bash 3.2, which is what macOS still ships as /bin/bash.
gate_signature() {
  local sig=""
  if [ ${#GATE_FAILURES[@]} -gt 0 ]; then sig="F=${GATE_FAILURES[*]}"; fi
  if [ ${#GATE_WAITS[@]} -gt 0 ]; then sig="$sig W=${GATE_WAITS[*]}"; fi
  printf '%s' "$sig"
}

# --- Decide ---
if [ "$AUTOMERGE" = "true" ]; then
  automerge_started=$(date -u +%s)
  automerge_deadline=$((automerge_started + AUTOMERGE_TIMEOUT))
  poll=0
  last_signature="__unset__"

  echo "AUTOMERGE: polling every ${AUTOMERGE_POLL_INTERVAL}s, giving up after ${AUTOMERGE_TIMEOUT}s"

  while true; do
    poll=$((poll + 1))
    run_all_gates

    # Print the gate block on the first poll and whenever the picture changes. A
    # 40-minute CI wait would otherwise scroll the same five lines 80 times.
    current_signature=$(gate_signature)
    if [ "$current_signature" != "$last_signature" ]; then
      printf '%s' "$GATE_REPORT"
      last_signature="$current_signature"
    fi

    if [ ${#GATE_FAILURES[@]} -gt 0 ]; then
      echo "RESULT: ${#GATE_FAILURES[@]} gate(s) failed: ${GATE_FAILURES[*]}"
      drop_ready_label
      echo "AUTOMERGE: RED after ${poll} poll(s), $(( $(date -u +%s) - automerge_started ))s — not merged."
      exit 1
    fi

    if [ ${#GATE_WAITS[@]} -eq 0 ]; then
      echo "RESULT: all gates passed"
      echo "AUTOMERGE: green after ${poll} poll(s), $(( $(date -u +%s) - automerge_started ))s — merging."
      break
    fi

    now=$(date -u +%s)
    if [ "$now" -ge "$automerge_deadline" ]; then
      echo "RESULT: still waiting on: ${GATE_WAITS[*]}"
      echo "AUTOMERGE: TIMED OUT after $((now - automerge_started))s — not merged, nothing failed."
      echo "  The PR is untouched and the label is intact. Re-run once the pending gate(s) settle,"
      echo "  or raise the budget: AUTOMERGE_TIMEOUT=7200 $0 $PR --human --automerge"
      exit 2
    fi
    sleep "$AUTOMERGE_POLL_INTERVAL"
  done

  # Merge the head the FINAL poll evaluated, not whatever is current now. Re-reading
  # here would defeat --match-head-commit: a push landing during the wait would be
  # merged carrying the previous commit's CI, review and thread state. Pinning the
  # polled SHA means such a push makes GitHub reject the merge instead — fail closed.
  PR_HEAD_SHA="$POLL_HEAD_SHA"
else
  run_all_gates
  printf '%s' "$GATE_REPORT"

  if [ ${#GATE_BLOCKED[@]} -gt 0 ]; then
    echo "RESULT: ${#GATE_BLOCKED[@]} gate(s) failed: ${GATE_BLOCKED[*]}"
    if [ "$DRY_RUN" = "true" ]; then
      echo "DRY RUN: would remove ready-for-review label if present"
      exit 1
    fi
    drop_ready_label
    exit 1
  fi

  echo "RESULT: all gates passed"
fi

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
# Reaching this line already required passing the --human gate above. When an
# agent invoked this script inside Claude Code, the block-direct-merge PreToolUse
# hook already prompted Tim for approval before the script ran — see the header
# comment. This `gh pr merge` runs as a subprocess of the script, so the hook does
# not see it directly; --human is the guard for that layer.
gh pr merge "$PR" "${MERGE_ARGS[@]}"
echo "MERGED: PR #$PR"

# --- Reap the merged PR's worktree (fail-open) ---
# The merge is already done, so this post-step must never propagate an error.
#
# worktree_reap.py re-derives the verdict itself rather than trusting "this PR
# just merged" — it reaps only when the worktree's HEAD *is* the merged SHA and
# the tree is clean, so a dirty worktree, or one that kept committing after the
# merge, survives as REVIEW. It also refuses any worktree containing the
# invoking process's cwd, which is what makes running this from inside the
# merged branch's own worktree safe.
(
  set +e
  set +u
  set +o pipefail
  _REAP_SCRIPT="$(dirname "$0")/../worktree_reap.py"
  [[ -f "$_REAP_SCRIPT" ]] || exit 0
  _HEAD_REF=$(gh pr view "$PR" --json headRefName --jq .headRefName 2>/dev/null)
  [[ -n "$_HEAD_REF" ]] || exit 0
  _REPO_DIR=$(cd "$(dirname "$0")/../.." && pwd)
  python3 "$_REAP_SCRIPT" --apply --quiet --branch "$_HEAD_REF" --repo-dir "$_REPO_DIR"
) || true

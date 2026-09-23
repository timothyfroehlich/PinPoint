#!/usr/bin/env bash
# merge-pr.sh — composite gate-then-merge enforcer.
# Re-evaluates all 4 PR gates at merge time (TOCTOU safety vs label-time gates),
# squash-merges with --match-head-commit if all pass, removes ready-for-review label on failure.
#
# Usage: merge-pr.sh <PR> --human [-a|--automerge] [--dry-run] [--force] [--bypass-merge-requirements]
#   --human                       REQUIRED to actually merge — this script refuses to
#                                 execute a merge without it. Not required for --dry-run.
#                                 An agent MAY invoke this script only after Tim directly
#                                 requests the unambiguous merge in the active task. That
#                                 request authorizes the owning agent in any harness to use
#                                 this gate-checked path. Claude Code additionally turns the
#                                 invocation into a PreToolUse approval prompt. --human is
#                                 a same-tool guard against accidental/scripted invocation;
#                                 it does not independently verify authorization.
#   -a, --automerge               Poll the gates instead of evaluating them once, and merge
#                                 as soon as they all pass. Fire it while CI is still
#                                 running — that is what it is for. It does NOT wait out
#                                 an unreviewed head: `reviewed` never WAITs. An unattested
#                                 head hard-fails on the FIRST poll and the run ends. Get
#                                 fresh exact-head review coverage BEFORE firing this.
#                                 Terminates on exactly three outcomes, each
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
# Defense-in-depth note (PP-wi85): Tim's direct, unambiguous merge request in
# the active task is the authorization boundary in every harness. The --human
# flag is a same-tool guard against accidental/scripted invocation; it does not
# independently verify that request. Claude Code additionally uses
# block-direct-merge.cjs to prompt for approval before running this script.
# Other harnesses must honor the active-task request without assuming that
# Claude's hook is present. Raw merge channels (gh pr merge, gh api PUT
# .../merge, MCP merge) remain prohibited for agents because they skip gates.

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

# --human is required to actually merge (PP-wi85). --dry-run is exempt.
# An agent may invoke this script after Tim directly requests the unambiguous
# merge in the active task. Claude Code additionally prompts through its
# block-direct-merge.cjs hook. --human is a same-tool guard against accidental
# or scripted calls, not an independent authorization check.
if [ "$DRY_RUN" != "true" ] && [ "$HUMAN" != "true" ]; then
  echo "REFUSE: merges are human-authorized only. Canonical command: scripts/workflow/merge-pr.sh $PR --human" >&2
  echo "        (forgot --human? add it to merge. --dry-run previews gate status without merging.)" >&2
  exit 1
fi

# shellcheck source=./_pr-gates.sh
# shellcheck disable=SC1091
source "$(dirname "$0")/_pr-gates.sh"

# --- PR info (one read, shared by the merged short-circuit and the gates) ---
PR_INFO=$(gh pr view "$PR" --json author,title,url,labels,headRefOid,mergeable,state,mergedAt,mergeCommit)
PR_AUTHOR=$(jq -r .author.login <<< "$PR_INFO")
PR_TITLE=$(jq -r .title <<< "$PR_INFO")
PR_URL=$(jq -r .url <<< "$PR_INFO")
PR_LABELS=$(jq -r '.labels | map(.name) | join(",")' <<< "$PR_INFO")
PR_HEAD_SHA=$(jq -r .headRefOid <<< "$PR_INFO")

# --- Already-merged short-circuit (PP-nii6) ---
# A merged PR has nothing left to gate. GitHub reports mergeable=UNKNOWN for a
# merged PR, which the no_conflict gate renders as "still computing" —
# indistinguishable from a genuinely-pending mergeability check, so the natural
# next action is to wait and retry a merge that already happened. Detect it up
# front and exit cleanly, before the authorship gate and all four merge gates.
# Applies in every mode (one-shot, --automerge, --dry-run).
PR_STATE=$(jq -r '.state // ""' <<< "$PR_INFO")
if [ "$PR_STATE" = "MERGED" ]; then
  PR_MERGED_AT=$(jq -r '.mergedAt // ""' <<< "$PR_INFO")
  PR_MERGE_COMMIT=$(jq -r '.mergeCommit.oid // ""' <<< "$PR_INFO")
  # A merged PR always carries both mergedAt and mergeCommit; fall back to a bare
  # message if either is somehow absent rather than print an empty "( )".
  suffix=""
  if [ -n "$PR_MERGED_AT" ] && [ -n "$PR_MERGE_COMMIT" ]; then
    suffix=" ($PR_MERGED_AT, commit ${PR_MERGE_COMMIT:0:8})"
  fi
  echo "PR #$PR is already MERGED$suffix. Nothing to do."
  exit 0
fi

# --- Authorship gate (no --force bypass) ---
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

# Poll only the transient gates from the last full evaluation. Head, CI Gate,
# and mergeability come from ONE response so the steady-state automerge wait
# costs one GitHub query per interval. Any terminal transition or head movement
# returns control to run_all_gates for a complete exact-head audit.
poll_waiting_gates() {
  local expected_head=$1 data current_head gate_name
  if ! data=$(gh pr view "$PR" --json headRefOid,statusCheckRollup,mergeable); then
    GATE_REPORT="FAIL: polling: could not read compact PR status snapshot"$'\n'
    GATE_FAILURES=("polling")
    GATE_WAITS=()
    return 1
  fi

  if ! current_head=$(jq -r '.headRefOid // empty' <<< "$data"); then
    GATE_REPORT="FAIL: polling: compact PR status was not valid JSON"$'\n'
    GATE_FAILURES=("polling")
    GATE_WAITS=()
    return 1
  fi
  if [ -z "$current_head" ]; then
    GATE_REPORT="FAIL: polling: compact PR status omitted headRefOid"$'\n'
    GATE_FAILURES=("polling")
    GATE_WAITS=()
    return 1
  fi
  if [ "$current_head" != "$expected_head" ]; then
    echo "AUTOMERGE: head moved ${expected_head:0:7} → ${current_head:0:7}; restarting full gate audit"
    return 3
  fi

  for gate_name in "${GATE_WAITS[@]}"; do
    case "$gate_name" in
      ci)
        # Same authoritative-run selection as check_ci (CI_GATE_SELECT_JQ from
        # _pr-gates.sh), so the re-poll cannot pick a different run than the audit.
        local ci_state
        if ! ci_state=$(jq -r "${CI_GATE_SELECT_JQ}"'
          | if . == null then "WAIT"
            elif .status != "COMPLETED" then "WAIT"
            else "TERMINAL"
            end' <<< "$data"); then
          GATE_REPORT="FAIL: polling: compact CI Gate state was malformed"$'\n'
          GATE_FAILURES=("polling")
          GATE_WAITS=()
          return 1
        fi
        [ "$ci_state" = "WAIT" ] && return 2
        ;;
      no_conflict)
        local compact_mergeable
        if ! compact_mergeable=$(jq -r '.mergeable // "UNKNOWN"' <<< "$data"); then
          GATE_REPORT="FAIL: polling: compact mergeability state was malformed"$'\n'
          GATE_FAILURES=("polling")
          GATE_WAITS=()
          return 1
        fi
        [ "$compact_mergeable" = "UNKNOWN" ] && return 2
        ;;
      *)
        GATE_REPORT="FAIL: polling: unsupported transient gate '$gate_name'"$'\n'
        GATE_FAILURES=("polling")
        GATE_WAITS=()
        return 1
        ;;
    esac
  done
  return 0
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

_automerge_now() {
  if [ -n "${EPOCHREALTIME:-}" ]; then
    printf '%s' "$EPOCHREALTIME"
  elif command -v perl >/dev/null 2>&1; then
    perl -MTime::HiRes=time -e 'printf "%.6f\n", time'
  else
    date -u +%s
  fi
}

# --- Decide ---
if [ "$AUTOMERGE" = "true" ]; then
  automerge_started=$(_automerge_now)
  automerge_deadline=$(awk -v s="$automerge_started" -v t="$AUTOMERGE_TIMEOUT" 'BEGIN { printf "%.6f\n", s + t }')
  poll=0
  last_signature="__unset__"
  final_audit_fresh=false

  echo "AUTOMERGE: polling every ${AUTOMERGE_POLL_INTERVAL}s, giving up after ${AUTOMERGE_TIMEOUT}s"

  # Full initial snapshot. The wait loop below does not re-read stable review
  # evidence, threads, or conflict state until a transient gate terminates.
  run_all_gates

  while true; do
    poll=$((poll + 1))

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
      elapsed=$(awk -v n="$(_automerge_now)" -v s="$automerge_started" 'BEGIN { d = n - s; if (d == int(d)) printf "%d", d; else if (d >= 10) printf "%d", int(d + 0.5); else printf "%.2f", d }')
      echo "AUTOMERGE: RED after ${poll} poll(s), ${elapsed}s — not merged."
      exit 1
    fi

    if [ ${#GATE_WAITS[@]} -eq 0 ]; then
      # The first green snapshot is not enough: run every gate once more
      # immediately before merge so changes made during the wait cannot inherit
      # stale review/thread/conflict evidence.
      if [ "$final_audit_fresh" != "true" ]; then
        run_all_gates
        final_audit_fresh=true
        if [ ${#GATE_FAILURES[@]} -gt 0 ] || [ ${#GATE_WAITS[@]} -gt 0 ]; then
          last_signature="__force_final_report__"
          continue
        fi
      fi
      echo "RESULT: all gates passed"
      elapsed=$(awk -v n="$(_automerge_now)" -v s="$automerge_started" 'BEGIN { d = n - s; if (d == int(d)) printf "%d", d; else if (d >= 10) printf "%d", int(d + 0.5); else printf "%.2f", d }')
      echo "AUTOMERGE: green after ${poll} poll(s), ${elapsed}s — merging."
      break
    fi

    now=$(_automerge_now)
    if awk -v n="$now" -v d="$automerge_deadline" 'BEGIN { exit !(n >= d) }'; then
      echo "RESULT: still waiting on: ${GATE_WAITS[*]}"
      elapsed=$(awk -v n="$now" -v s="$automerge_started" 'BEGIN { d = n - s; if (d == int(d)) printf "%d", d; else if (d >= 10) printf "%d", int(d + 0.5); else printf "%.2f", d }')
      echo "AUTOMERGE: TIMED OUT after ${elapsed}s — not merged, nothing failed."
      echo "  The PR is untouched and the label is intact. Re-run once the pending gate(s) settle,"
      echo "  or raise the budget: AUTOMERGE_TIMEOUT=7200 $0 $PR --human --automerge"
      exit 2
    fi
    sleep "$AUTOMERGE_POLL_INTERVAL"


    poll_rc=0
    poll_waiting_gates "$POLL_HEAD_SHA" || poll_rc=$?
    case "$poll_rc" in
      0|3)
        # A pending gate terminated, or the head moved. Re-evaluate every gate
        # and pin the next waiting phase to that complete snapshot.
        run_all_gates
        final_audit_fresh=true
        ;;
      2)
        # Still waiting. No stable gate reads this interval.
        ;;
      *)
        # poll_waiting_gates populated a fail-closed synthetic failure.
        ;;
    esac
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
# Reaching this line already required --human and all merge gates above. Tim's
# direct request in the active task authorizes the owning agent in any harness;
# Claude Code additionally prompts through block-direct-merge.cjs. This
# `gh pr merge` runs as a subprocess of the script, so the hook does not see
# it directly; --human is the same-tool guard for that layer.
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

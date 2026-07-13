#!/usr/bin/env bash
set -euo pipefail

# log-gha-flake.sh — append one raw GHA infra-flake sighting to the current
#                     ISO-week sighting bead.
#
# Records a GitHub Actions *infrastructure* flake (runner loss, pnpm-install
# network timeout, action/browser download 5xx, Supabase container-start failure
# after the 3-retry loop, etc.) as a signed comment on a rolling **weekly**
# sighting bead. Hybrid bead model (see docs/runbooks/gha-flake-log.md):
#
#   - permanent LEDGER ROOT (label gha-flake-log) — durable per-signature ledger
#     in its notes; the weekly chores triage pass curates it. Sightings do NOT
#     go here.
#   - rolling WEEKLY sighting beads (label gha-flake-week, one per ISO week,
#     children of the root) — raw sightings are comments on the current week's
#     bead. Triage closes them ~3 weeks after review to bound growth.
#
# This helper resolves the root by label, find-or-creates the current week's
# child bead, and appends the sighting comment to it.
#
# Log via this helper only when YOU have judged the failure to be infra, not a
# real code/test failure — the log is deliberately high-signal (no auto-capture).
#
# Usage:
#   bash scripts/workflow/log-gha-flake.sh <pr#> <run-id> <class> "<symptom>" [--rerun green|red]
#
# Args:
#   <pr#>      PR number the failed run belongs to (bare number, or 0 if none).
#   <run-id>   GitHub Actions run id (the number in the run URL).
#   <class>    Signature class — one of the taxonomy values (see usage()).
#   <symptom>  One-line human description of what was observed.
#   --rerun    Outcome of the rerun, if you reran: green (passed) or red (still failed).
#              Omit if you haven't rerun yet; the sighting records rerun=n/a.
#
# The ledger root is resolved BY LABEL (`gha-flake-log`), self-healing — never a
# hardcoded id. Failing job/step are best-effort derived via `gh run view`; the
# script still logs with what it has if `gh` is unavailable or the run is gone.
#
# Invoked via `bash …` — no executable bit required (committed mode 644).

REPO_SLUG="timothyfroehlich/PinPoint"
LOG_LABEL="gha-flake-log"
WEEK_LABEL="gha-flake-week"
VALID_CLASSES=(
  pnpm-install-network
  playwright-browser-download
  supabase-start
  checkout-download
  action-setup-download
  registry-5xx
  runner-lost
  other
)

usage() {
  {
    echo "usage: bash scripts/workflow/log-gha-flake.sh <pr#> <run-id> <class> \"<symptom>\" [--rerun green|red]"
    echo
    echo "valid <class> values (the infra-flake taxonomy):"
    printf '  %s\n' "${VALID_CLASSES[@]}"
    echo
    echo "See docs/runbooks/gha-flake-log.md for what each class means."
  } >&2
  exit 2
}

# --- Parse args -------------------------------------------------------------
rerun="n/a"
positionals=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --rerun)
      rerun="${2:-}"
      if [[ "$rerun" != "green" && "$rerun" != "red" ]]; then
        echo "error: --rerun takes 'green' or 'red' (got '${rerun:-<empty>}')" >&2
        usage
      fi
      shift 2
      ;;
    -h | --help)
      usage
      ;;
    --*)
      echo "error: unknown flag '$1'" >&2
      usage
      ;;
    *)
      positionals+=("$1")
      shift
      ;;
  esac
done

if [[ ${#positionals[@]} -ne 4 ]]; then
  echo "error: expected 4 positional args, got ${#positionals[@]}" >&2
  usage
fi

pr="${positionals[0]}"
run_id="${positionals[1]}"
class="${positionals[2]}"
symptom="${positionals[3]}"

if [[ ! "$pr" =~ ^[0-9]+$ ]]; then
  echo "error: <pr#> must be a number (got '$pr'); use 0 if there is no PR" >&2
  usage
fi
if [[ ! "$run_id" =~ ^[0-9]+$ ]]; then
  echo "error: <run-id> must be a number (got '$run_id')" >&2
  usage
fi

# Validate class against the taxonomy.
class_ok="false"
for c in "${VALID_CLASSES[@]}"; do
  if [[ "$class" == "$c" ]]; then
    class_ok="true"
    break
  fi
done
if [[ "$class_ok" != "true" ]]; then
  echo "error: unknown class '$class'" >&2
  usage
fi

if [[ -z "$symptom" ]]; then
  echo "error: <symptom> must not be empty" >&2
  usage
fi

# --- Resolve the ledger root by label (self-healing, never hardcoded) --------
log_bead=$(bd list --label "$LOG_LABEL" --json 2>/dev/null \
  | jq -r '.[0].id // empty')
if [[ -z "$log_bead" ]]; then
  echo "error: no bead found with label '$LOG_LABEL' — is the beads DB reachable?" >&2
  echo "       (the permanent ledger root must exist; see docs/runbooks/gha-flake-log.md)" >&2
  exit 1
fi

# --- Find-or-create the current ISO-week sighting bead ----------------------
# ISO year-week (e.g. 2026-W29). The year-week lives in the TITLE, not the id
# (bd assigns its own PP-xxxx id).
week=$(date -u +%G-W%V)
week_title="GHA flakes ${week}"

# Return the OLDEST open bead labeled gha-flake-week whose title matches exactly.
# Choosing the oldest is what makes concurrent creators converge on one bead.
find_week_bead() {
  bd list --label "$WEEK_LABEL" --status open --json 2>/dev/null \
    | jq -r --arg t "$week_title" \
        '[.[] | select(.title == $t)] | sort_by(.created_at) | .[0].id // empty'
}

week_bead=$(find_week_bead)
if [[ -z "$week_bead" ]]; then
  # No bead for this week yet — create one as a child of the ledger root.
  # Two agents may race here; after creating we re-query and take the oldest, so
  # racers converge. Any accidental duplicate week bead is merged by triage.
  bd create "$week_title" -t task \
    --parent "$log_bead" --no-inherit-labels -l "$WEEK_LABEL" \
    -d "Raw GHA infra-flake sightings for ISO week ${week}. Ledger root: ${log_bead}. Runbook: docs/runbooks/gha-flake-log.md" \
    >/dev/null 2>&1 || true
  week_bead=$(find_week_bead)
fi

if [[ -z "$week_bead" ]]; then
  echo "error: could not find or create the weekly sighting bead '$week_title'" >&2
  echo "       (is the beads DB reachable? see docs/runbooks/gha-flake-log.md)" >&2
  exit 1
fi

# --- Construct run URL + best-effort job/step -------------------------------
run_url="https://github.com/${REPO_SLUG}/actions/runs/${run_id}"

job="unknown"
step="unknown"
if command -v gh >/dev/null 2>&1; then
  # shellcheck disable=SC2016  # $f is a jq variable, deliberately not shell-expanded
  job_step=$(gh run view "$run_id" --json jobs --jq \
    '[.jobs[] | select(.conclusion=="failure")] as $f
     | ($f[0].name // "unknown") + "\t"
     + (([$f[0].steps[]? | select(.conclusion=="failure") | .name] | first) // "unknown")' \
    2>/dev/null || true)
  if [[ -n "$job_step" ]]; then
    job="${job_step%%$'\t'*}"
    step="${job_step#*$'\t'}"
    [[ -z "$job" ]] && job="unknown"
    [[ -z "$step" ]] && step="unknown"
  fi
fi

# --- Derive signing AgentName ----------------------------------------------
agent="${BEADS_ACTOR:-}"
if [[ -z "$agent" ]]; then
  agent=$(git config user.name 2>/dev/null || true)
fi
[[ -z "$agent" ]] && agent="Claude"

# --- Append the signed raw sighting (schema must match the runbook) ---------
comment="class=${class} pr=#${pr} run=${run_url} job=${job} step=${step} — ${symptom} [rerun=${rerun}] —${agent}"

bd comments add "$week_bead" "$comment"
echo "Logged infra-flake sighting to ${week_bead} (${week_title}): ${comment}"

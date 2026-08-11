#!/usr/bin/env bash
# evaluate-e2e-results.sh — turn a Playwright JSON report into a job verdict.
#
# The comprehensive post-merge E2E job runs its Playwright steps with
# `continue-on-error: true`, because Mobile Safari is non-gating and its
# failures must not fail the job. That makes THIS script the only thing that
# can turn a red suite into a red job — so it has to be loud about every way
# the suite can fail to produce a verdict, not just about failed specs.
#
# Two silent-failure paths it exists to close (PP-jxhy):
#
#   1. The run never finished. Playwright's JSON reporter writes the file once,
#      at the end. A step that hits its timeout leaves no file — and if a
#      previous step in the same job wrote to the same path, leaves a STALE
#      one. A stale green report read as this run's verdict is the worst
#      outcome available, so the caller passes a per-run path and this script
#      treats a missing or unparseable file as a hard failure.
#   2. Zero specs ran. A crash in global setup, a bad --project name, or a
#      grep that matches nothing all yield a well-formed report with an empty
#      spec list, which "no failures" would happily call green.
#
# Usage:
#   bash scripts/workflow/evaluate-e2e-results.sh <label> <results-json-path>
#
# Exit 0 = gating browsers green. Exit 1 = anything else.

set -euo pipefail

LABEL="${1:?usage: evaluate-e2e-results.sh <label> <results-json-path>}"
RESULTS="${2:?usage: evaluate-e2e-results.sh <label> <results-json-path>}"

# The browser whose failures are reported but do not fail the job. WebKit does
# not run on the crabbox runner (PP-jvow), so CI is its only home and its red is
# informational rather than blocking.
NON_GATING='Mobile Safari'

# `.suites[]` is only the top level; specs nest arbitrarily deep under
# `.suites[].suites[]`, so recurse rather than assuming a flat shape.
JQ_ALL_SPECS='[.. | objects | select(has("specs")) | .specs[]]'
JQ_FAILED="${JQ_ALL_SPECS} | map(select(.ok == false))"
JQ_GATING="${JQ_FAILED} | map(select(.tests[0].projectName != \$ng))"
JQ_NON_GATING="${JQ_FAILED} | map(select(.tests[0].projectName == \$ng))"
JQ_TITLES='.[] | "[\(.tests[0].projectName)] \(.title)"'

summary() {
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    cat >>"$GITHUB_STEP_SUMMARY"
  else
    cat
  fi
}

fail_no_verdict() {
  local reason="$1"
  echo "::error::E2E ${LABEL}: no verdict — ${reason}"
  {
    echo "## E2E ${LABEL}: no verdict"
    echo ''
    echo "${reason}"
    echo ''
    echo 'The run did not produce a usable report, so the suite cannot be'
    echo 'called green. Check the test step above for a timeout or a crash.'
  } | summary
  exit 1
}

if [ ! -s "$RESULTS" ]; then
  fail_no_verdict "\`${RESULTS}\` is missing or empty — the Playwright run did not complete."
fi

if ! jq -e . "$RESULTS" >/dev/null 2>&1; then
  fail_no_verdict "\`${RESULTS}\` is not valid JSON — the Playwright run was interrupted mid-write."
fi

TOTAL_SPECS=$(jq -r "${JQ_ALL_SPECS} | length" "$RESULTS")
if [ "$TOTAL_SPECS" -eq 0 ]; then
  fail_no_verdict "\`${RESULTS}\` reports 0 specs — nothing ran."
fi

GATING_FAILS=$(jq -r --arg ng "$NON_GATING" "${JQ_GATING} | length" "$RESULTS")
NON_GATING_FAILS=$(jq -r --arg ng "$NON_GATING" "${JQ_NON_GATING} | length" "$RESULTS")

if [ "$GATING_FAILS" -gt 0 ]; then
  GATING_TITLES=$(jq -r --arg ng "$NON_GATING" "${JQ_GATING} | ${JQ_TITLES}" "$RESULTS")
  echo "Gating browser failures (${LABEL}):"
  echo "$GATING_TITLES"
  echo "::error::E2E ${LABEL}: ${GATING_FAILS} gating browser failure(s) across ${TOTAL_SPECS} specs"
  {
    echo "## E2E ${LABEL}: ${GATING_FAILS} gating failure(s)"
    echo ''
    echo '```'
    echo "$GATING_TITLES"
    echo '```'
    if [ "$NON_GATING_FAILS" -gt 0 ]; then
      echo ''
      echo "Plus ${NON_GATING_FAILS} non-gating ${NON_GATING} failure(s)."
    fi
  } | summary
  exit 1
fi

echo "Gating browsers green (${LABEL}) across ${TOTAL_SPECS} specs."
echo "${NON_GATING} failures (non-gating): ${NON_GATING_FAILS}"
{
  echo "## E2E ${LABEL}: gating browsers green"
  echo ''
  echo "- ${TOTAL_SPECS} specs evaluated"
  echo "- ${NON_GATING_FAILS} non-gating ${NON_GATING} failure(s)"
} | summary

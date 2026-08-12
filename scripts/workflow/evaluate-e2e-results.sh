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
#   3. Everything was skipped. A committed `test.describe.skip`, or a
#      `test.skip(cond)` whose condition holds everywhere, yields a report full
#      of specs that are all `ok: true` — the spec count is healthy and no spec
#      failed, so a spec-shaped check calls it green while nothing ran at all.
#      Only `stats` can tell the difference, so the verdict is gated on at least
#      one test having actually executed.
#   4. The run failed outside any spec. A worker crash, an unhandled rejection
#      in a fixture teardown, or a reporter error lands in top-level `.errors`
#      while every spec that did run stays green.
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

# Flatten to one row per (spec, project) rather than per spec, and judge on
# `.tests[].status` rather than `.spec.ok`.
#
# This is not a style preference. Playwright's JSON reporter merges specs that
# share a title/file/line/column across projects, pushing every project's test
# into ONE spec's `.tests[]` while leaving `.ok` at the first-serialized
# project's value. PinPoint's layout happens to dodge the merge — `testDir` is
# `./e2e` while Playwright runs from the repo root, so the reporter's path
# comparison never matches — but that is an accident of configuration, not a
# guarantee. Under the merged shape, `.ok` and `.tests[0].projectName` would
# together hide a spec that passes on chromium and fails on Mobile Chrome:
# green `ok`, and a `projectName` naming the browser that passed.
#
# Reading each test's own status and project is correct under both shapes.
# shellcheck disable=SC2016  # `$s` is a jq binding; the shell must not expand it.
JQ_RESULTS='[.. | objects | select(has("specs")) | .specs[] as $s | $s.tests[]
  | {title: $s.title, file: $s.file, line: $s.line,
     project: .projectName, status: .status}]'
JQ_FAILED="${JQ_RESULTS} | map(select(.status == \"unexpected\"))"
JQ_GATING="${JQ_FAILED} | map(select(.project != \$ng))"
JQ_NON_GATING="${JQ_FAILED} | map(select(.project == \$ng))"
JQ_TITLES='.[] | "[\(.project)] \(.file):\(.line) \(.title)"'

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

# A skipped test is neither expected nor unexpected, so this sums to 0 exactly
# when every test in the report was skipped — the "healthy spec count, nothing
# executed" case. Checked against `stats` rather than the specs because a
# skipped spec is serialised with `ok: true` and is indistinguishable from a
# passing one by shape alone.
TESTS_RUN=$(jq -r '(.stats.expected // 0) + (.stats.unexpected // 0) + (.stats.flaky // 0)' "$RESULTS")
if [ "$TESTS_RUN" -eq 0 ]; then
  SKIPPED=$(jq -r '.stats.skipped // 0' "$RESULTS")
  fail_no_verdict "\`${RESULTS}\` reports ${TOTAL_SPECS} spec(s) but 0 executed tests (${SKIPPED} skipped) — the whole suite was skipped."
fi

# Failures that belong to no spec: a worker crash, an unhandled rejection in a
# fixture teardown, a reporter error. Every spec that ran can be green while
# this is non-empty.
RUN_ERRORS=$(jq -r '(.errors // []) | length' "$RESULTS")
if [ "$RUN_ERRORS" -gt 0 ]; then
  ERROR_TEXT=$(jq -r '(.errors // []) | .[] | (.message // (. | tostring))' "$RESULTS" | head -40)
  echo "Run-level errors (${LABEL}):"
  echo "$ERROR_TEXT"
  fail_no_verdict "\`${RESULTS}\` carries ${RUN_ERRORS} run-level error(s) outside any spec — see the step log above."
fi

GATING_FAILS=$(jq -r --arg ng "$NON_GATING" "${JQ_GATING} | length" "$RESULTS")
NON_GATING_FAILS=$(jq -r --arg ng "$NON_GATING" "${JQ_NON_GATING} | length" "$RESULTS")

# Cross-check the spec walk against the reporter's own tally. If Playwright
# counted failures that the walk did not find, the report shape changed under
# us and the walk is no longer trustworthy — that is a missing verdict, not a
# green run.
STATS_UNEXPECTED=$(jq -r '.stats.unexpected // 0' "$RESULTS")
WALK_FAILS=$((GATING_FAILS + NON_GATING_FAILS))
if [ "$STATS_UNEXPECTED" -gt 0 ] && [ "$WALK_FAILS" -eq 0 ]; then
  fail_no_verdict "\`${RESULTS}\` stats report ${STATS_UNEXPECTED} unexpected test(s) but the spec walk found none — the report shape is not what this script expects."
fi

# Non-gating failures never change the verdict, but they still have to be
# NAMED. This job is WebKit's only home — it does not run on the crabbox runner
# (PP-jvow) and no PR job covers it — so a bare count would mean identifying a
# Mobile Safari regression required downloading the HTML artifact.
if [ "$NON_GATING_FAILS" -gt 0 ]; then
  NON_GATING_TITLES=$(jq -r --arg ng "$NON_GATING" "${JQ_NON_GATING} | ${JQ_TITLES}" "$RESULTS")
else
  NON_GATING_TITLES=''
fi

emit_non_gating_summary() {
  [ "$NON_GATING_FAILS" -gt 0 ] || return 0
  echo ''
  echo "### ${NON_GATING} failures (non-gating): ${NON_GATING_FAILS}"
  echo ''
  echo '```'
  echo "$NON_GATING_TITLES"
  echo '```'
}

if [ "$NON_GATING_FAILS" -gt 0 ]; then
  echo "${NON_GATING} failures (non-gating, ${LABEL}):"
  echo "$NON_GATING_TITLES"
fi

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
    emit_non_gating_summary
  } | summary
  exit 1
fi

echo "Gating browsers green (${LABEL}) across ${TOTAL_SPECS} specs, ${TESTS_RUN} tests executed."
{
  echo "## E2E ${LABEL}: gating browsers green"
  echo ''
  echo "- ${TOTAL_SPECS} specs evaluated, ${TESTS_RUN} tests executed"
  echo "- ${NON_GATING_FAILS} non-gating ${NON_GATING} failure(s)"
  emit_non_gating_summary
} | summary

#!/usr/bin/env bash
# Print the /code-review level for this branch's changes (spec
# pr-lifecycle-monitoring §8.14–8.15), from the weighted diff size of HEAD against
# the base branch.
#
# Usage: claude-review-level.sh [<base-ref>]     (default: origin/main)
#
# stdout, line 1: low | medium | high | ask   — the word agents act on
# stdout, line 2: the weighted size and how it was counted
#
# Weighted size = added + deleted lines, leaving out the lockfile, migration
# snapshots, test fixtures, binary files and feature specs, with test code counted
# at half weight. Bands: low below 50, medium from 50 up to 1,500, high from 1,500
# through 3,000. Above 3,000 the answer is `ask`: stop and ask Tim before reviewing.
set -euo pipefail

if [[ $# -gt 1 ]]; then
  echo "Usage: $0 [<base-ref>]" >&2
  exit 2
fi
base_ref=${1:-origin/main}

merge_base=$(git merge-base "$base_ref" HEAD) || {
  echo "claude-review-level: no merge base between ${base_ref} and HEAD" >&2
  exit 2
}

# --no-renames keeps one plain path per line; binary files report "-" and drop out.
git diff --numstat --no-renames "$merge_base" HEAD | awk -F'\t' '
  $1 == "-" { next }
  {
    n = $1 + $2; p = $3
    if (p == "pnpm-lock.yaml" || p ~ /^drizzle\/meta\// || p ~ /(^|\/)(__)?fixtures(__)?\// \
        || p ~ /^docs\/feature-specs\//) { excluded += n; next }
    if (p ~ /\.(test|spec)\.[cm]?[jt]sx?$/ || p ~ /^(e2e|src\/test|scripts\/tests)\//) { tests += n; next }
    code += n
  }
  END {
    weighted = code + int(tests / 2)
    if (weighted < 50) level = "low"
    else if (weighted < 1500) level = "medium"
    else if (weighted <= 3000) level = "high"
    else level = "ask"
    print level
    printf "weighted %d lines: code %d, tests %d at half weight, %d left out\n", weighted, code, tests, excluded
  }'

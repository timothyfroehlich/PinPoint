#!/usr/bin/env bash
# Canonical PGlite integration entrypoint: prepare schema, then run Vitest.

set -euo pipefail

if [[ ${1:-} == "--require-target" ]]; then
  shift
  if [[ $# -eq 0 ]]; then
    echo "Usage: pnpm run test:integration:target -- <test-path> [more-test-paths…]" >&2
    exit 64
  fi
fi

pnpm run test:ensure-schema
exec bash scripts/workflow/heavy-run.sh \
  vitest run --project integration --max-workers=2 "$@"

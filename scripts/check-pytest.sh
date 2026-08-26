#!/usr/bin/env bash
# check-pytest.sh — Run pytest over scripts/tests/ with missing-tool install hint.
#
# AGENTS.md §4: pytest is required for running hook and script tests under
# `pnpm run check:python`. If absent, this script exits with code 1 and prints
# a clear install hint for the mise-selected Python runtime.

set -euo pipefail

if ! command -v python3 >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Error: python3 not found on PATH.

Install the locked PinPoint toolchain first:

  mise install --locked

EOF
  exit 1
fi

if ! python3 -c 'import pytest' >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Error: pytest is not installed for the selected Python runtime.

`pnpm run check:python` requires pytest to run hook and script tests.
Install the declared Python dependencies into the mise-selected runtime:

  mise exec -- python3 -m pip install -r scripts/requirements.txt

EOF
  exit 1
fi

exec python3 -m pytest "$@"

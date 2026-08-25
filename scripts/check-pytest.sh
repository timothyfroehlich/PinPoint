#!/usr/bin/env bash
# check-pytest.sh — Run pytest over scripts/tests/ with missing-tool install hint.
#
# AGENTS.md §4: pytest is required for running hook and script tests under
# `pnpm run check:python`. If absent, this script exits with code 1 and prints
# a clear install hint for macOS, Linux, pipx, and pip.

set -euo pipefail

if ! command -v pytest >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Error: pytest not found on PATH.

`pnpm run check:python` requires pytest to run hook and script tests.
Install it using your system package manager or Python toolchain:

  macOS (Homebrew):  brew install pytest
  Linux (apt):       sudo apt-get install -y python3-pytest
  Linux (dnf):       sudo dnf install -y python3-pytest
  pipx:              pipx install "pytest==9.0.3"
  pip:               pip install -r scripts/requirements.txt

EOF
  exit 1
fi

exec pytest "$@"

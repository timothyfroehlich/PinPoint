#!/usr/bin/env bash
# Status table for open PRs. Keep this shell entry point for CLI compatibility;
# Python owns the batched GraphQL parsing and fail-closed pagination.

set -euo pipefail

exec python3 "$(dirname "$0")/pr-dashboard.py" "$@"

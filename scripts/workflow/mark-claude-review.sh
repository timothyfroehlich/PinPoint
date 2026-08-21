#!/usr/bin/env bash
set -euo pipefail

# mark-claude-review.sh — compatibility entrypoint for existing Claude Code callers.
#
# New callers should use mark-review.sh directly. This wrapper writes the canonical
# generic marker while preserving the former positional Claude depth interface.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/mark-review.sh" "${1:-}" claude-code "${2:-}" "${3:-no serious findings}"

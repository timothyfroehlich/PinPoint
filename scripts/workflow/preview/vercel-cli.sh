#!/usr/bin/env bash
set -euo pipefail

# Pinned Vercel CLI wrapper (PP-h2ui.7).
# Invokes an exact release-age-eligible Vercel CLI version via npx without requiring
# a pnpm install or coupling deployments to mise.
#
# Usage:
#   scripts/workflow/preview/vercel-cli.sh <command> [args...]

VERCEL_CLI_VERSION="${VERCEL_CLI_VERSION:-57.0.0}"

exec npx --yes "vercel@${VERCEL_CLI_VERSION}" "$@"

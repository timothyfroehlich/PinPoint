#!/usr/bin/env bash
set -euo pipefail

# Single source of truth for the per-PR `pnpm audit` override signal.
#
# The override is recorded as a commit STATUS on the PR head SHA — deliberately
# not a label or a free-floating comment field — because:
#   * it is intrinsically bound to one commit, so pushing a new commit (a new
#     SHA) drops the override and re-requires it. A newly-introduced real
#     vulnerability can never be silently carried past the gate.
#   * the ci.yml `pnpm-audit` job can read it with nothing but the head SHA — no
#     PR-number resolution, no comment parsing.
#
# This file is called from BOTH sides so the context name lives in exactly one
# place: the Audit Override workflow `set`s it; the CI audit job `check`s it.
#
# Subcommands:
#   gate.sh set   <sha> <success|failure> [description]
#       Set the override commit status on <sha>. `success` arms the bypass;
#       `failure` (used by `/audit-override clear`) re-arms the gate.
#   gate.sh check <sha>
#       Exit 0 if an ACTIVE (success) override status is present on <sha>,
#       exit 1 otherwise.
#
# Environment:
#   GH_TOKEN          required by `gh`
#   GITHUB_REPOSITORY owner/repo (defaults to timothyfroehlich/PinPoint)

CONTEXT="pinpoint-audit-override"
REPO="${GITHUB_REPOSITORY:-timothyfroehlich/PinPoint}"

cmd="${1:-}"
sha="${2:-}"

if [[ -z "$cmd" || -z "$sha" ]]; then
  echo "usage: gate.sh <set|check> <sha> [state] [description]" >&2
  exit 2
fi

case "$cmd" in
  set)
    state="${3:?state required (success|failure)}"
    description="${4:-}"
    gh api --method POST \
      "repos/${REPO}/statuses/${sha}" \
      -f state="$state" \
      -f context="$CONTEXT" \
      -f description="$description" \
      --jq '.context' >/dev/null
    echo "Set ${CONTEXT}=${state} on ${sha}"
    ;;

  check)
    # /commits/{sha}/statuses lists statuses newest-first, so .[0] for our
    # context is the latest set/clear. Empty when no override was ever set.
    state="$(gh api \
      "repos/${REPO}/commits/${sha}/statuses" \
      --jq "map(select(.context == \"${CONTEXT}\")) | .[0].state // empty")"
    if [[ "$state" == "success" ]]; then
      echo "active"
      exit 0
    fi
    exit 1
    ;;

  *)
    echo "unknown command: $cmd" >&2
    exit 2
    ;;
esac

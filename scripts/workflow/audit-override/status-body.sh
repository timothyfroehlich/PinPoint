#!/usr/bin/env bash
# The message bodies use backticks as literal Markdown code spans inside
# single-quoted printf format strings; they are intentionally NOT shell
# expansions, so SC2016 is a false positive for this whole file.
# shellcheck disable=SC2016
set -euo pipefail

# Render the body of the sticky `/audit-override` status comment, to stdout.
# Centralising the message text here keeps backtick-laden printf format strings
# out of the YAML `run:` blocks (where they trip shellcheck SC2016). The marker
# line is NOT included — sticky-comment.sh prepends it on upsert.
#
# Usage:
#   status-body.sh active  <actor> <sha> <timestamp-iso> <reason>
#   status-body.sh cleared <actor> <sha> <timestamp-iso>

state="${1:-}"

footer='Pushing a new commit re-requires the override (it is bound to the commit). Comment `/audit-override clear` to re-arm the gate now.'

case "$state" in
  active)
    actor="${2:?actor required}"
    sha="${3:?sha required}"
    ts="${4:?timestamp required}"
    reason="${5:-(no reason given)}"
    printf '🟡 **pnpm audit gate overridden for this PR**\n\n'
    printf 'The `pnpm audit` CI failure is being bypassed for commit `%s`.\n\n' "${sha:0:12}"
    printf '| Field | Value |\n'
    printf '| --- | --- |\n'
    printf '| Invoked by | @%s |\n' "$actor"
    printf '| When (UTC) | %s |\n' "$ts"
    printf '| Reason | %s |\n\n' "$reason"
    printf '%s\n' "$footer"
    ;;

  cleared)
    actor="${2:?actor required}"
    sha="${3:?sha required}"
    ts="${4:?timestamp required}"
    printf '🔒 **pnpm audit gate re-armed for this PR**\n\n'
    printf 'The override on commit `%s` was cleared by @%s at %s (UTC). The `pnpm audit` gate is enforced again.\n\n' "${sha:0:12}" "$actor" "$ts"
    printf 'Comment `/audit-override <reason>` to bypass it again.\n'
    ;;

  *)
    echo "usage: status-body.sh <active|cleared> ..." >&2
    exit 2
    ;;
esac

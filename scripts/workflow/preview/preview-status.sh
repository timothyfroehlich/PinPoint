#!/usr/bin/env bash
# The message bodies use backticks as literal Markdown code spans inside
# single-quoted printf format strings; they are intentionally NOT shell
# expansions, so SC2016 is a false positive for this whole file.
# shellcheck disable=SC2016
set -euo pipefail

# Render the body of the sticky preview-status comment for a given state, to
# stdout. Centralising the message text here keeps it out of the YAML `run:`
# blocks (where backtick-laden printf format strings trip shellcheck SC2016)
# and DRYs up the four states that share the same footer.
#
# The marker line is NOT included — sticky-comment.sh prepends it on upsert.
#
# Usage:
#   preview-status.sh active   <git-branch> <preview-url> <expires-iso>
#   preview-status.sh extended <git-branch> <preview-url> <expires-iso>
#   preview-status.sh stopped  <git-branch>
#   preview-status.sh expired  <git-branch>
#   preview-status.sh none

state="${1:-}"

footer='Comment `/preview extend` for +48h · `/preview stop` to tear down.'

case "$state" in
  active)
    branch="${2:?branch required}"
    url="${3:?url required}"
    expires="${4:?expires required}"
    printf '🔮 Preview active — %s\n' "$url"
    printf 'DB: Supabase branch `%s` · Expires: %s\n' "$branch" "$expires"
    printf '%s\n' "$footer"
    ;;

  extended)
    branch="${2:?branch required}"
    url="${3:-}"
    expires="${4:?expires required}"
    if [[ -n "$url" ]]; then
      printf '🔮 Preview active — %s\n' "$url"
    else
      printf '🔮 Preview active\n'
    fi
    printf 'DB: Supabase branch `%s` · Expires: %s\n' "$branch" "$expires"
    printf '%s\n' "$footer"
    ;;

  stopped)
    branch="${2:?branch required}"
    printf '🛑 Preview stopped — the Supabase branch and Vercel preview were torn down.\n'
    printf 'DB: Supabase branch `%s` · was tied to this PR.\n' "$branch"
    printf 'Comment `/preview` to start a fresh one.\n'
    ;;

  expired)
    branch="${2:?branch required}"
    printf '🔮 Preview **expired** — the Supabase branch and Vercel preview were torn down.\n\n'
    printf 'Comment `/preview` to restart (a fresh branch is created, migrated, and seeded).\n'
    printf "DB: Supabase branch \`%s\` · was tied to this PR's preview.\n" "$branch"
    ;;

  none)
    printf '⚠️ No active preview to extend. Comment `/preview` to start one.\n'
    ;;

  *)
    echo "usage: preview-status.sh <active|extended|stopped|expired|none> ..." >&2
    exit 2
    ;;
esac

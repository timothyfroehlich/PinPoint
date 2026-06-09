#!/usr/bin/env bash
set -euo pipefail

# Sticky PR comment helper for the on-demand preview controller.
#
# A single bot comment per PR, keyed by an HTML marker, is the source of truth
# for preview TTL state. This script finds that comment and either creates it
# (if absent) or edits it in place (upsert), so there is never more than one.
#
# The marker line must be the FIRST line of the body so the reaper can grep it.
#
# Usage:
#   bash scripts/workflow/preview/sticky-comment.sh upsert <pr-number> <body-file>
#   bash scripts/workflow/preview/sticky-comment.sh find   <pr-number>
#
#   upsert  Create-or-edit the sticky comment. Body is read from <body-file>
#           (or stdin if <body-file> is "-"). The marker is prepended
#           automatically; do NOT include it in the body.
#   find    Print the existing sticky comment body to stdout (empty if none).
#
# Environment:
#   GH_TOKEN          required by `gh` for API calls
#   GITHUB_REPOSITORY owner/repo (defaults to timothyfroehlich/PinPoint)

MARKER="<!-- pinpoint-preview-status -->"
REPO="${GITHUB_REPOSITORY:-timothyfroehlich/PinPoint}"

# Print the id of the existing sticky comment, or empty string if none exists.
find_sticky_id() {
  local pr="$1"
  gh api \
    --paginate \
    "repos/${REPO}/issues/${pr}/comments" \
    --jq "map(select(.body | startswith(\"${MARKER}\"))) | .[0].id // empty"
}

# Print the body of the existing sticky comment (empty if none).
find_sticky_body() {
  local pr="$1"
  gh api \
    --paginate \
    "repos/${REPO}/issues/${pr}/comments" \
    --jq "map(select(.body | startswith(\"${MARKER}\"))) | .[0].body // empty"
}

cmd="${1:-}"
pr="${2:-}"

if [[ -z "$cmd" || -z "$pr" ]]; then
  echo "usage: sticky-comment.sh <upsert|find> <pr-number> [body-file]" >&2
  exit 2
fi

case "$cmd" in
  find)
    find_sticky_body "$pr"
    ;;

  upsert)
    body_file="${3:-}"
    if [[ -z "$body_file" ]]; then
      echo "upsert requires a body file (use '-' for stdin)" >&2
      exit 2
    fi

    if [[ "$body_file" == "-" ]]; then
      body_content="$(cat)"
    else
      body_content="$(cat "$body_file")"
    fi

    # Prepend the marker so the body always starts with it.
    full_body="${MARKER}"$'\n'"${body_content}"

    existing_id="$(find_sticky_id "$pr")"

    if [[ -n "$existing_id" ]]; then
      echo "Editing existing sticky comment (id=${existing_id}) on PR #${pr}"
      gh api \
        --method PATCH \
        "repos/${REPO}/issues/comments/${existing_id}" \
        -f body="$full_body" \
        --jq '.html_url'
    else
      echo "Creating sticky comment on PR #${pr}"
      gh api \
        --method POST \
        "repos/${REPO}/issues/${pr}/comments" \
        -f body="$full_body" \
        --jq '.html_url'
    fi
    ;;

  *)
    echo "unknown command: $cmd" >&2
    exit 2
    ;;
esac

#!/usr/bin/env bash
# Witness a clean Codex review transition and pin it to the triggering PR head.
#
# A GitHub reaction has no commit SHA. This script is therefore run only from the
# trusted pull_request_target workflow on main: it requires a fresh Codex `eyes`
# reaction created after that head's review-trigger event, observes the transition to
# `+1` without any head movement, then posts a SHA-pinned github-actions comment.

set -euo pipefail

readonly CODEX_REVIEW_BOT="chatgpt-codex-connector[bot]"
readonly GITHUB_ACTIONS_BOT="github-actions[bot]"
readonly GITHUB_ACTIONS_APP="github-actions"
readonly WITNESS_PREFIX="<!-- pinpoint-codex-reaction-witness:"

usage() {
  echo "Usage: $0 <PR_NUMBER> <EXPECTED_HEAD_SHA> <TRIGGERED_AT>" >&2
  exit 2
}

[[ $# -eq 3 ]] || usage
readonly PR_NUMBER=$1
readonly EXPECTED_HEAD=$2
readonly TRIGGERED_AT=$3

[[ "$PR_NUMBER" =~ ^[1-9][0-9]*$ ]] || usage
[[ "$EXPECTED_HEAD" =~ ^[0-9a-f]{40}$ ]] || usage
[[ "$TRIGGERED_AT" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] || usage

readonly INITIAL_DELAY_SECONDS=${CODEX_WITNESS_INITIAL_DELAY_SECONDS:-120}
readonly MAX_ATTEMPTS=${CODEX_WITNESS_MAX_ATTEMPTS:-36}
readonly POLL_SECONDS=${CODEX_WITNESS_POLL_SECONDS:-30}
[[ "$INITIAL_DELAY_SECONDS" =~ ^[0-9]+$ ]] || usage
[[ "$MAX_ATTEMPTS" =~ ^[1-9][0-9]*$ ]] || usage
[[ "$POLL_SECONDS" =~ ^[0-9]+$ ]] || usage

# Native SHA-pinned reviews usually arrive early. Spend that ordinary quiet
# window without touching the repository's 1,000-request/hour Actions token.
if ((INITIAL_DELAY_SECONDS > 0)); then
  sleep "$INITIAL_DELAY_SECONDS"
fi

OWNER_REPO=${GITHUB_REPOSITORY:-}
if [[ -z "$OWNER_REPO" ]]; then
  OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
fi
readonly OWNER_REPO

reaction_at() {
  local content=$1 lower_bound=$2
  gh api --paginate -H "Accept: application/vnd.github+json" \
    "repos/${OWNER_REPO}/issues/${PR_NUMBER}/reactions?per_page=100" \
    | jq -rs --arg bot "$CODEX_REVIEW_BOT" --arg content "$content" \
        --arg lower_bound "$lower_bound" '
        [ .[] | flatten | .[]
          | select(.user.login? == $bot and .content == $content)
          | (.created_at // "")
          | select(. >= $lower_bound)
        ] | sort | last // empty'
}

current_native_review_state() {
  gh api --paginate "repos/${OWNER_REPO}/pulls/${PR_NUMBER}/reviews?per_page=100" \
    | jq -rs --arg bot "$CODEX_REVIEW_BOT" --arg head "$EXPECTED_HEAD" '
        [ .[] | flatten | .[]
          | select(.user.login? == $bot and (.commit_id // "") == $head)
          | { state: (.state // "UNKNOWN"), at: (.submitted_at // "") }
        ] | sort_by(.at) | (last.state // empty)'
}

post_witness() {
  local eyes_at=$1 clean_at=$2 marker body comment_id
  marker="${WITNESS_PREFIX} ${EXPECTED_HEAD} -->"
  body=$(printf '%s\n%s\n%s\n\n%s\n' \
    "$marker" \
    "<!-- pinpoint-codex-eyes-at: ${eyes_at} -->" \
    "<!-- pinpoint-codex-clean-at: ${clean_at} -->" \
    "Codex clean-review reaction witnessed on commit \`${EXPECTED_HEAD:0:10}\`.")

  comment_id=$(gh api --paginate \
    "repos/${OWNER_REPO}/issues/${PR_NUMBER}/comments?per_page=100" \
    | jq -rs --arg bot "$GITHUB_ACTIONS_BOT" --arg app "$GITHUB_ACTIONS_APP" \
        --arg marker "$marker" '
        [ .[] | flatten | .[]
          | select(.user.login? == $bot
                   and .performed_via_github_app.slug? == $app
                   and ((.body // "") | startswith($marker)))
          | .id
        ] | last // empty')

  if [[ -n "$comment_id" ]]; then
    gh api --method PATCH "repos/${OWNER_REPO}/issues/comments/${comment_id}" \
      -f body="$body" >/dev/null
  else
    gh api --method POST "repos/${OWNER_REPO}/issues/${PR_NUMBER}/comments" \
      -f body="$body" >/dev/null
  fi
  echo "Witnessed clean Codex review for ${EXPECTED_HEAD}."
}

eyes_at=""
for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)); do
  current_head=$(gh pr view "$PR_NUMBER" --repo "$OWNER_REPO" \
    --json headRefOid --jq .headRefOid)
  if [[ "$current_head" != "$EXPECTED_HEAD" ]]; then
    echo "PR #${PR_NUMBER} moved to ${current_head}; witness for ${EXPECTED_HEAD} superseded."
    exit 0
  fi

  native_state=$(current_native_review_state)
  case "$native_state" in
    APPROVED|COMMENTED|CHANGES_REQUESTED)
      echo "Codex posted a SHA-pinned ${native_state} review; no reaction witness needed."
      exit 0
      ;;
  esac

  if [[ -z "$eyes_at" ]]; then
    eyes_at=$(reaction_at eyes "$TRIGGERED_AT")
    if [[ -n "$eyes_at" ]]; then
      echo "Observed fresh Codex eyes reaction at ${eyes_at}."
    fi
  fi

  if [[ -n "$eyes_at" ]]; then
    clean_at=$(reaction_at +1 "$eyes_at")
    if [[ -n "$clean_at" ]]; then
      post_witness "$eyes_at" "$clean_at"
      exit 0
    fi
  fi

  if ((attempt < MAX_ATTEMPTS)); then
    sleep "$POLL_SECONDS"
  fi
done

echo "::warning::No commit-safe Codex reaction transition was observed for ${EXPECTED_HEAD}."
exit 0

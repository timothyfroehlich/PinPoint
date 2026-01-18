#!/bin/bash
# .gemini/skills/jules-pr-manager/detail.sh
# Deep dive on a single PR - full timeline, body, CI details, Copilot comments.
# Use summary.sh for quick overview of all PRs.

if [ -z "$1" ]; then
  echo "Usage: ./detail.sh <PR_NUMBER>"
  echo "Example: ./detail.sh 796"
  exit 1
fi

NUMBER=$1

# Get Repo Info
REPO_INFO=$(gh repo view --json owner,name)
OWNER=$(echo "$REPO_INFO" | jq -r .owner.login)
NAME=$(echo "$REPO_INFO" | jq -r .name)

# Fetch the PR details (including body)
PR=$(gh pr view "$NUMBER" --json number,title,author,labels,updatedAt,mergeable,statusCheckRollup,isDraft,body,files,reviews)

# Fetch and filter the timeline
TIMELINE=$(gh api "repos/$OWNER/$NAME/issues/$NUMBER/timeline" --paginate)

# Filter timeline for efficiency
# Note: jq sub() needs double backslashes for literals in shell scripts
FILTERED_TIMELINE=$(echo "$TIMELINE" | jq -c '[.[] | select(.event | test("committed|reviewed|commented|labeled|unlabeled")) | {
  event: .event,
  actor: (.actor.login // .user.login // .author.name),
  timestamp: (.created_at // .submitted_at // .author.date),
  body: (.body | select(. != null) | sub("\\n---\\n\\*PR created automatically.*"; "") | sub("^@jules "; "") | .[0:500]),
  state: .state,
  label: .label.name,
  sha: (.sha // .commit_id),
  acknowledged: (if .reactions then (.reactions.eyes > 0) else false end)
}]')

# Determine if the LAST review/comment (non-Jules) was acknowledged
LAST_INSTRUCTION_ACK=$(echo "$FILTERED_TIMELINE" | jq -r 'map(select(.actor != "google-labs-jules[bot]" and .actor != "vercel[bot]" and .actor != "copilot-pull-request-reviewer" and (.event == "reviewed" or .event == "commented"))) | last | .acknowledged')

# Fetch Copilot PR comments (separate from reviews)
COPILOT_COMMENTS=$(gh api "repos/$OWNER/$NAME/issues/$NUMBER/comments" --jq '[.[] | select(.user.login == "Copilot") | {body: .body, created_at: .created_at}]')

# Combine everything into final output
echo "$PR" | jq --argjson timeline "$FILTERED_TIMELINE" \
                --arg ack "$LAST_INSTRUCTION_ACK" \
                --argjson copilotComments "$COPILOT_COMMENTS" \
  '. + {
    timeline: $timeline,
    lastInstructionAcknowledged: ($ack == "true"),
    copilotComments: $copilotComments,
    ciStatus: (
      if .statusCheckRollup == null or (.statusCheckRollup | length) == 0 then "NONE"
      elif (.statusCheckRollup | all(.conclusion == "SUCCESS")) then "SUCCESS"
      elif (.statusCheckRollup | any(.conclusion == "FAILURE")) then "FAILURE"
      else "PENDING" end
    ),
    copilotReviewStatus: (
      if (.reviews | any(.author.login == "copilot-pull-request-reviewer" and .state == "APPROVED")) then "APPROVED"
      elif (.reviews | any(.author.login == "copilot-pull-request-reviewer" and .state == "CHANGES_REQUESTED")) then "CHANGES_REQUESTED"
      elif (.reviews | any(.author.login == "copilot-pull-request-reviewer")) then "COMMENTED"
      else "NONE" end
    )
  }'

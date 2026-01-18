#!/bin/bash
# .gemini/skills/jules-pr-manager/summary.sh
# Compact overview of ALL open PRs with categorization signals for duplicate detection and workflow state.
# Use detail.sh <id> for deep dives on individual PRs.

gh pr list --state open \
  --json number,title,author,labels,isDraft,updatedAt,files,statusCheckRollup,reviews,mergeable \
  --jq '[.[] | {
    number,
    title,
    author: .author.login,
    labels: [.labels[].name],
    isDraft,
    updatedAt,
    files: [.files[].path],
    mergeable,
    ciStatus: (
      if .statusCheckRollup == null or (.statusCheckRollup | length) == 0 then "NONE"
      elif (.statusCheckRollup | all(.conclusion == "SUCCESS")) then "SUCCESS"
      elif (.statusCheckRollup | any(.conclusion == "FAILURE")) then "FAILURE"
      else "PENDING" end
    ),
    copilotStatus: (
      if (.reviews | any(.author.login == "copilot-pull-request-reviewer" and .state == "APPROVED")) then "APPROVED"
      elif (.reviews | any(.author.login == "copilot-pull-request-reviewer" and .state == "CHANGES_REQUESTED")) then "CHANGES_REQUESTED"
      elif (.reviews | any(.author.login == "copilot-pull-request-reviewer")) then "COMMENTED"
      else "NONE" end
    )
  }]'

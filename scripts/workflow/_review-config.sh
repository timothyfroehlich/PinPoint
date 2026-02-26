#!/bin/bash
# scripts/workflow/_review-config.sh
# Shared configuration for PR review workflow scripts.
#
# All AI reviewer bot logins are defined here. When adding a new reviewer
# (e.g., a new GitHub App), add its login to REVIEWER_BOTS_JSON and all
# scripts that source this file will pick it up automatically.
#
# Usage in other scripts:
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   source "$SCRIPT_DIR/_review-config.sh"

# shellcheck disable=SC2034  # Variables are used by scripts that source this file
OWNER="timothyfroehlich"
REPO="PinPoint"

# Known AI reviewer bot logins (JSON array — used in jq filters via --argjson)
# Add new reviewer bots here as they're enabled.
REVIEWER_BOTS_JSON='[
  "copilot-pull-request-reviewer",
  "copilot-pull-request-reviewer[bot]"
]'

# Display label for review comments (used in user-facing output)
REVIEWER_LABEL="AI Review"

#!/usr/bin/env bash
# claude-review-range.sh — decide what the Claude Review CI job reviews (PP-zxlq.1).
#
# Usage: claude-review-range.sh <PR> <HEAD_SHA>
#
# Environment:
#   GITHUB_REPOSITORY        owner/name (required)
#   GH_TOKEN                 read access to pull requests and checks
#   GITHUB_OUTPUT            when set, the outputs are appended to it
#   CLAUDE_REVIEW_MAIN_REF   the base branch ref (default: origin/main)
#
# Outputs, one key=value per line (stdout, and $GITHUB_OUTPUT when set):
#   mode           full | incremental | skip
#   base           the revision the review diffs from: `git diff <base> <head>`
#   last_reviewed  the newest earlier PR commit with a successful Claude Review run
#   level          /code-review effort: low | medium | high
#   detail         one line for the job summary
#
# A head counts as reviewed when a successful "Claude Review" check run exists on
# it. The job finds the newest such earlier commit on the PR and reviews only what
# the branch changed since then. To keep main's changes out of that diff, it diffs
# head against a synthetic merge of the last reviewed commit with the main commit
# head now contains (their merge base). When head's tree equals that clean merge,
# the new commits added nothing beyond main and the mode is skip: the same rule
# that lets a clean merge of main keep review coverage today. A conflicted
# synthetic merge falls back to a full review, and so does a PR whose earlier
# reviewed commits a force-push removed.
set -euo pipefail

CHECK_NAME="Claude Review"

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <PR> <HEAD_SHA>" >&2
  exit 2
fi
pr=$1
head=$2
repo=${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}
main_ref=${CLAUDE_REVIEW_MAIN_REF:-origin/main}
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

emit() {
  printf '%s=%s\n' "$1" "$2"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf '%s=%s\n' "$1" "$2" >> "$GITHUB_OUTPUT"
  fi
}

main_base=$(git merge-base "$main_ref" "$head")

# The PR's commits come oldest first; walk them newest first, leaving out head.
last_reviewed=""
pr_commits=$(gh api --paginate "repos/${repo}/pulls/${pr}/commits?per_page=100" --jq '.[].sha')
while read -r sha; do
  [[ -z "$sha" || "$sha" == "$head" ]] && continue
  passed=$(gh api "repos/${repo}/commits/${sha}/check-runs?check_name=${CHECK_NAME// /%20}&filter=all" \
    --jq '[.check_runs[] | select(.conclusion == "success" and .app.slug == "github-actions")] | length')
  if [[ "$passed" -gt 0 ]]; then
    last_reviewed=$sha
    break
  fi
done < <(awk '{ line[NR] = $0 } END { for (i = NR; i > 0; i--) print line[i] }' <<< "$pr_commits")

mode=full
base=$main_base
detail="full review: no earlier commit on this PR has a successful ${CHECK_NAME} run"

if [[ -n "$last_reviewed" ]]; then
  if git merge-base --is-ancestor "$main_base" "$last_reviewed"; then
    # No newer main merged in since the last review.
    synthetic=$last_reviewed
  elif tree=$(git merge-tree --write-tree "$last_reviewed" "$main_base" 2>/dev/null); then
    synthetic=$(GIT_AUTHOR_NAME="claude-review" GIT_AUTHOR_EMAIL="claude-review@localhost" \
      GIT_COMMITTER_NAME="claude-review" GIT_COMMITTER_EMAIL="claude-review@localhost" \
      git commit-tree "$tree" -p "$last_reviewed" -p "$main_base" \
      -m "claude-review: ${last_reviewed:0:7} merged with ${main_base:0:7}")
  else
    synthetic=""
    detail="full review: ${last_reviewed:0:7} does not merge cleanly with ${main_base:0:7}"
  fi

  if [[ -n "$synthetic" ]]; then
    if git diff --quiet "$synthetic" "$head"; then
      mode=skip
      base=""
      detail="skip: the commits since ${last_reviewed:0:7} add nothing beyond main"
    else
      mode=incremental
      base=$synthetic
      detail="incremental review: commits since ${last_reviewed:0:7}, main's changes excluded"
    fi
  fi
fi

level=low
if [[ "$mode" != "skip" ]]; then
  level=$(bash "${script_dir}/claude-review-level.sh" --from "$base" | head -1)
  # Above 3,000 weighted lines a local review asks Tim for xhigh or max. CI cannot
  # ask, so it reviews at high and says so.
  if [[ "$level" == "ask" ]]; then
    level=high
    detail="${detail}; over 3,000 weighted lines, reviewed at high"
  fi
fi

emit mode "$mode"
emit base "$base"
emit last_reviewed "$last_reviewed"
emit level "$level"
emit detail "$detail"

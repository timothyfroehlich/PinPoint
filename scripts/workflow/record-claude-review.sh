#!/usr/bin/env bash
# Post the review record for a clean local Claude Code review, then promote the PR
# out of draft (spec pr-lifecycle-monitoring §8.16–8.20). The merge gate counts the
# record as review coverage of exactly the head it names.
#
# Usage: record-claude-review.sh <PR> --level low|medium|high --findings <file> [--dry-run]
#
# <file> is a JSON array with one entry per finding from every review round:
#   { "round": 1, "file": "src/a.ts", "line": 12, "summary": "…",
#     "disposition": "fixed", "commit": "<sha that fixed it>" }
#   { "round": 2, "file": "src/b.ts", "line": 4, "summary": "…",
#     "disposition": "declined", "reason": "<one sentence>" }
# An empty array means the review found nothing.
#
# Run it only after a local review of the PR's current head raised nothing that is
# not already declined (§8.17), and only for a head that review actually covered
# (§8.19). --dry-run checks everything and prints the record without posting it.
set -euo pipefail

usage() {
  echo "Usage: $0 <PR> --level low|medium|high --findings <file> [--dry-run]" >&2
  exit 2
}

[[ $# -ge 1 && $1 =~ ^[0-9]+$ ]] || usage
readonly pr_number=$1
shift
level="" findings_file="" dry_run=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --level) level=${2:-}; shift 2 || usage ;;
    --findings) findings_file=${2:-}; shift 2 || usage ;;
    --dry-run) dry_run=true; shift ;;
    *) usage ;;
  esac
done
[[ $level =~ ^(low|medium|high)$ ]] || usage
[[ -n $findings_file ]] || usage

block() {
  echo "BLOCK: review record: $*" >&2
  exit 1
}

[[ -r $findings_file ]] || block "cannot read findings file ${findings_file}"
findings=$(jq -c . "$findings_file" 2> /dev/null) || block "findings file is not valid JSON"

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
readonly script_dir
# shellcheck source=scripts/workflow/_pr-gates.sh
source "${script_dir}/_pr-gates.sh"

# Every finding is fixed (with the commit) or declined (with a reason) — §8.16.
problems=$(jq -r '
  if type != "array" then "the findings file must hold a JSON array"
  else
    to_entries[]
    | .key as $i | .value as $f
    | if ($f | type) != "object" then "finding \($i + 1) is not an object"
      elif (($f.file // "") | type) != "string" or ($f.file // "") == "" then "finding \($i + 1) has no file"
      elif (($f.summary // "") | type) != "string" or ($f.summary // "") == "" then "finding \($i + 1) has no summary"
      elif ($f.round | type) != "number" or $f.round < 1 then "finding \($i + 1) has no round number"
      elif $f.disposition == "fixed" then
        (if ($f.commit | type) == "string" and ($f.commit | test("^[0-9a-f]{7,40}$")) then empty
         else "finding \($i + 1) is fixed but names no commit" end)
      elif $f.disposition == "declined" then
        (if ($f.reason | type) == "string" and ($f.reason | test("\\S")) then empty
         else "finding \($i + 1) is declined without a reason" end)
      else "finding \($i + 1) is neither fixed nor declined" end
  end' <<< "$findings")
[[ -z $problems ]] || block "${problems//$'\n'/; }"

head_sha=$(git rev-parse HEAD)
while IFS= read -r commit; do
  [[ -z $commit ]] && continue
  git merge-base --is-ancestor "$commit" HEAD 2> /dev/null \
    || block "fix commit ${commit} is not in HEAD ${head_sha:0:7}"
done < <(jq -r '.[] | select(.disposition == "fixed") | .commit' <<< "$findings")

# The record may only name a head the review covered: the local checkout, clean, and
# the PR's current head (§8.18–8.19).
if [[ -n $(git status --porcelain --untracked-files=no) ]]; then
  block "the working tree has uncommitted changes; the review would not match ${head_sha:0:7}"
fi

owner_repo=$(_repo_slug)
metadata=$(gh pr view "$pr_number" --json headRefOid,isDraft,state)
pr_head=$(jq -r .headRefOid <<< "$metadata")
[[ $(jq -r .state <<< "$metadata") == "OPEN" ]] || block "PR #${pr_number} is not open"
[[ $pr_head == "$head_sha" ]] \
  || block "PR #${pr_number} head is ${pr_head:0:7} but the local HEAD is ${head_sha:0:7}; push, or check out the PR head, and review it"

summary=$(_review_summary "$pr_number")
if [[ $(jq -r '.checkers.claude.verdict' <<< "$summary") == "covers" ]]; then
  block "head ${head_sha:0:7} already has a review record"
fi

counts=$(jq -r '
  (length) as $n
  | ([.[] | select(.disposition == "fixed")] | length) as $fixed
  | if $n == 0 then "No findings."
    else "\($n) finding\(if $n == 1 then "" else "s" end): \($fixed) fixed, \($n - $fixed) declined."
    end' <<< "$findings")
table=$(jq -r '
  def cell: tostring | gsub("\\|"; "\\|") | gsub("\n"; " ");
  if length == 0 then empty
  else
    "| Round | Finding | Disposition |",
    "| :-- | :-- | :-- |",
    (sort_by(.round)[]
     | "| \(.round) | `\(.file | cell)\(if .line then ":\(.line)" else "" end)` — \(.summary | cell) | "
       + (if .disposition == "fixed" then "Fixed in \(.commit[0:7])"
          else "Declined: \(.reason | cell)" end)
       + " |")
  end' <<< "$findings")

body=$(
  printf '<!-- pinpoint-claude-review: %s level=%s -->\n' "$head_sha" "$level"
  printf '## Claude Code review (%s)\n\n' "$level"
  # shellcheck disable=SC2016  # the backticks are Markdown, not command substitution
  printf 'Reviewed head `%s` with `/code-review %s`. %s\n' "${head_sha:0:7}" "$level" "$counts"
  if [[ -n $table ]]; then
    printf '\n%s\n' "$table"
  fi
  printf '\n—Claude\n'
)

if [[ $dry_run == true ]]; then
  printf '%s\n' "$body"
  echo "DRY RUN: would post the review record to PR #${pr_number} and mark it ready if draft" >&2
  exit 0
fi

owner=${owner_repo%%/*}
actor=$(gh api user --jq .login)
# The gate trusts only records posted from the owner's account (§8.3).
[[ $actor == "$owner" ]] || block "authenticated GitHub user ${actor} is not repository owner ${owner}"

url=$(gh api --method POST "repos/${owner_repo}/issues/${pr_number}/comments" -f "body=${body}" --jq .html_url)
echo "PASS: review record: posted for PR #${pr_number} head ${head_sha:0:7} (${level})"
echo "  ${url}"
if [[ $(jq -r .isDraft <<< "$metadata") == "true" ]]; then
  gh pr ready "$pr_number"
fi

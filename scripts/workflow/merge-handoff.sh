#!/usr/bin/env bash
set -euo pipefail

# merge-handoff.sh — the report an agent hands Tim when a PR is ready for him to merge.
#
# Every number here is COMPUTED, which is the whole point (PP-9onv). The handoff used to
# be prose an agent wrote from memory — "CI is green, you reviewed it a couple of commits
# back, mostly docs" — and each of those claims is one an agent can get wrong without
# noticing. `git` and `gh` already know all of them, so the agent's job is to run this
# and paste the block, not to narrate it.
#
# The report is a SNAPSHOT and says so: it is stale the moment CI re-runs, someone pushes,
# or main moves. That is why the last two lines are commands rather than conclusions — the
# first re-runs this report, the second merges. Both are `!`-prefixed because Tim types
# them into the Claude Code prompt, where `!` runs a command outside the agent tool-call
# path. An agent MAY also run `merge-pr.sh --human` itself, but the block-direct-merge hook
# turns that into an approval prompt Tim must accept (PP-wi85, reversed for the script per
# Tim 2026-08-19) — so the merge decision stays his either way. The raw channels (gh pr
# merge, gh api, MCP merge) stay hard-blocked for agents.
#
# The merge command is only printed when all four merge gates actually pass. Handing over a
# merge command while CI is still yellow invites a merge on a guess, and the gates would
# refuse it anyway — so an un-ready PR gets the blocking reasons instead.
#
# Usage:
#   bash scripts/workflow/merge-handoff.sh <PR>
#
# Environment:
#   gh must be authenticated; the repo slug is resolved dynamically.
#   Fetches from origin (the PR head and main) — read-only, touches no local branch.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_pr-gates.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/_pr-gates.sh"

SCREENSHOT_MARKER="<!-- pr-screenshots -->"

pr="${1:-}"
if [[ -z "$pr" || ! "$pr" =~ ^[0-9]+$ ]]; then
  echo "usage: merge-handoff.sh <PR>" >&2
  exit 2
fi

# ---------------------------------------------------------------------------------
# Facts from GitHub
# ---------------------------------------------------------------------------------

meta=$(gh pr view "$pr" --json number,title,url,headRefName,headRefOid,baseRefName,isDraft,state)
title=$(jq -r '.title' <<< "$meta")
url=$(jq -r '.url' <<< "$meta")
head_ref=$(jq -r '.headRefName' <<< "$meta")
head_sha=$(jq -r '.headRefOid' <<< "$meta")
base_ref=$(jq -r '.baseRefName' <<< "$meta")
is_draft=$(jq -r '.isDraft' <<< "$meta")
pr_state=$(jq -r '.state' <<< "$meta")
short_head="${head_sha:0:7}"

# Both sides are read back off FETCH_HEAD as bare SHAs, and `--refmap=` suppresses the
# opportunistic remote-tracking update that `git fetch origin main` would otherwise do
# through the configured `refs/heads/*:refs/remotes/origin/*` refspec. So this genuinely
# updates no ref of yours — not `origin/main`, not a local branch. It runs from whatever
# worktree Tim happens to be in, often while agents hold worktrees of the same repo, and
# a reporting command has no business moving refs those depend on.
#
# The PR head comes from its pull ref rather than its branch name: the branch may not exist
# locally, may be checked out in another worktree, or may live on a fork.
if ! git fetch -q --refmap= origin "$base_ref"; then
  echo "merge-handoff.sh: could not fetch ${base_ref} from origin" >&2
  exit 1
fi
base_sha=$(git rev-parse FETCH_HEAD)

fetch_pr_head() {
  if ! git fetch -q --refmap= origin "pull/${pr}/head"; then
    echo "merge-handoff.sh: could not fetch head of PR #${pr} from origin" >&2
    exit 1
  fi
  git rev-parse FETCH_HEAD
}
fetched_head=$(fetch_pr_head)

# `gh` and the pull ref disagreeing means a push landed mid-report (or GitHub has not
# propagated one to the other yet). ONE retry, because the pull ref catches up in seconds.
#
# Tested by SHA inequality, not by "is the object missing": the fetch brings down the new
# head's whole ancestry, and in the race being guarded against the SHA `gh` named IS an
# ancestor of what was fetched — so an existence check always passes and the guard never
# fires. That is the dangerous direction. The gate answers (review marker, CI, threads)
# come from `gh` at one SHA while the diff comes from git at another, and the report would
# then hand over a merge command for a head nobody reviewed, which is the exact false
# green this script exists to prevent.
head_raced=""
if [[ "$head_sha" != "$fetched_head" ]]; then
  fetched_head=$(fetch_pr_head)
fi
if [[ "$head_sha" != "$fetched_head" ]]; then
  head_raced="gh says ${short_head}, pull ref says ${fetched_head:0:7}"
  echo "merge-handoff.sh: warning — head moved during the report (${head_raced})." >&2
  echo "  Reporting on the fetched commit; re-run once the push settles." >&2
  head_sha=$fetched_head
  short_head="${head_sha:0:7}"
fi

merge_base=$(git merge-base "$head_sha" "$base_sha")

# ---------------------------------------------------------------------------------
# Gates (the same four merge-pr.sh evaluates, asked here for reporting only)
# ---------------------------------------------------------------------------------

# Each gate prints `TOKEN: <gate>: <state>` on its first line and may add remedy lines;
# `|| true` because a failing gate returns non-zero and this script is a reporter.
gate_line() { head -n1 <<< "$1"; }
gate_token() { cut -d: -f1 <<< "$(gate_line "$1")"; }

# Reported in the gate's own words — the gates are the authority on their own state, and a
# paraphrase here is one more thing that can drift out of step with what merge-pr.sh will
# say. Anything other than PASS is prefixed with its token, so a WAIT ("CI Gate check not
# reported yet") cannot be skimmed as a pass.
gate_state() {
  local token state
  token=$(gate_token "$1")
  state=$(gate_line "$1" | cut -d: -f3- | sed 's/^ *//')
  if [[ "$token" == "PASS" ]]; then
    printf '%s\n' "$state"
  else
    printf '[%s] %s\n' "$token" "$state"
  fi
}

ci_out=$(check_ci "$pr" 2>&1) || true
threads_out=$(check_unresolved_threads "$pr" 2>&1) || true
conflict_out=$(check_no_merge_conflict "$pr" 2>&1) || true

# ---------------------------------------------------------------------------------
# Review state: which review, how long ago, and what has landed since
# ---------------------------------------------------------------------------------

record=$(_marker_record "$pr" "$(_repo_slug)" "$head_sha")
rv_state=$(cut -f1 <<< "$record")
rv_sha=$(cut -f2 <<< "$record")
rv_reviewer=$(cut -f3 <<< "$record")
rv_detail=$(cut -f4 <<< "$record")
rv_at=$(cut -f5 <<< "$record")

# Review methods have distinct display names. In particular, the trivial exception must
# never render as a `/code-review` run, and a legacy marker without depth must remain an
# absence of metadata rather than a claim that a review never happened.
review_phrase() {
  case "$1:$2" in
    codex-plugin-cc:base-main) printf '/codex:review --base main\n' ;;
    claude-code:trivial) printf 'attested trivial (no /code-review run)\n' ;;
    claude-code:unrecorded) printf 'depth unrecorded (legacy marker predates PP-9onv)\n' ;;
    claude-code:*) printf '/code-review %s\n' "$2" ;;
    unrecorded:*) printf 'reviewer/detail unrecorded\n' ;;
    *) printf '%s %s\n' "$1" "$2" ;;
  esac
}

review_desc=""
since_review_from=""
since_review_note=""
case "$rv_state" in
  marker)
    review_desc="$(review_phrase "$rv_reviewer" "$rv_detail") · ${rv_at} · covers head ${short_head}"
    ;;
  stale_marker)
    # "How many revisions back" only has an answer when the reviewed commit is still an
    # ancestor of head. After a force-push it is not, and the honest report is that the
    # distance is unknowable — not a number computed from an unrelated commit.
    if git cat-file -e "${rv_sha}^{commit}" 2>/dev/null \
      && git merge-base --is-ancestor "$rv_sha" "$head_sha" 2>/dev/null; then
      behind=$(git rev-list --count "${rv_sha}..${head_sha}")
      review_desc="$(review_phrase "$rv_reviewer" "$rv_detail") · ${rv_at} · STALE: ${behind} commit(s) back, reviewed ${rv_sha:0:7}, head is ${short_head}"
      since_review_from=$rv_sha
    else
      review_desc="$(review_phrase "$rv_reviewer" "$rv_detail") · ${rv_at} · STALE: reviewed ${rv_sha:0:7}, not an ancestor of head (force-push?)"
      since_review_note="unknowable — the reviewed commit is not an ancestor of head"
    fi
    ;;
  *)
    review_desc="NONE — no review marker on this PR"
    ;;
esac

# ---------------------------------------------------------------------------------
# Diff shape
# ---------------------------------------------------------------------------------

# Buckets, in match order: a `src/**/*.test.ts` is a test, a `docs/**/*.md` is docs, and
# `content/**` is product MDX that ships as pages, so it counts as source rather than docs.
# Anything left over — config, CI, drizzle, scripts — is `other`, reported only when it is
# non-zero, because a silent bucket is how "mostly docs" hides a workflow edit.
diff_buckets() {
  local from=$1 to=$2
  git diff --numstat "$from" "$to" | awk '
    function bucket(p) {
      if (p ~ /(^|\/)e2e\// || p ~ /\.(test|spec)\.[jt]sx?$/ || p ~ /__tests__\// ||
          p ~ /^src\/test\// || p ~ /^scripts\/tests\//) return "tests"
      if (p ~ /^docs\// || p ~ /^\.agents\// ||
          (p ~ /\.mdx?$/ && p !~ /^content\//)) return "docs"
      if (p ~ /^src\// || p ~ /^content\//) return "src"
      return "other"
    }
    {
      files++
      path = $3
      for (i = 4; i <= NF; i++) path = path " " $i   # renames: `{a => b}/f.ts`
      b = bucket(path)
      if ($1 == "-") { binary++; next }              # binary: counted as a file, not lines
      add[b] += $1; del[b] += $2; ta += $1; td += $2
    }
    END {
      printf "%d %d %d %d", files + 0, binary + 0, ta + 0, td + 0
      split("src tests docs other", order, " ")
      for (i = 1; i <= 4; i++) { b = order[i]; printf " %d %d", add[b] + 0, del[b] + 0 }
      printf "\n"
    }'
}

format_buckets() {
  local -a f=("$@")
  local out
  out=$(printf '+%s -%s' "${f[2]}" "${f[3]}")
  out+=$(printf '   %s file(s)' "${f[0]}")
  if [[ "${f[1]}" -gt 0 ]]; then
    out+=$(printf ', %s binary' "${f[1]}")
  fi
  local -a names=(src tests docs other)
  local i sep="   "
  for i in 0 1 2 3; do
    local a=${f[$((4 + i * 2))]} d=${f[$((5 + i * 2))]}
    if [[ "$a" -ne 0 || "$d" -ne 0 ]]; then
      out+=$(printf '%s%s +%s -%s' "$sep" "${names[$i]}" "$a" "$d")
      sep=" · "
    fi
  done
  printf '%s\n' "$out"
}

read -r -a vs_main <<< "$(diff_buckets "$merge_base" "$head_sha")"
diff_vs_main=$(format_buckets "${vs_main[@]}")

if [[ -n "$since_review_from" ]]; then
  read -r -a since <<< "$(diff_buckets "$since_review_from" "$head_sha")"
  diff_since_review=$(format_buckets "${since[@]}")
elif [[ -n "$since_review_note" ]]; then
  # A review exists; it is the DISTANCE that has no answer. Saying "nothing reviewed to
  # compare against" here would contradict the review line two rows above, which names
  # the reviewed SHA.
  diff_since_review=$since_review_note
elif [[ "$rv_state" == "marker" ]]; then
  diff_since_review="none — the review covers head"
else
  diff_since_review="n/a — nothing reviewed to compare against"
fi

changed_paths=$(git diff --name-only "$merge_base" "$head_sha")

# ---------------------------------------------------------------------------------
# Merge-time-only risks
# ---------------------------------------------------------------------------------

# Migrations run against PROD on the merge build (`migrate:production`), so they are a
# different risk class from any other diff of the same size.
migrations=$(grep -E '^(drizzle/[^/]+\.sql|supabase/migrations/)' <<< "$changed_paths" || true)
if [[ -n "$migrations" ]]; then
  migration_line="$(wc -l <<< "$migrations" | tr -d ' ') — $(tr '\n' ' ' <<< "$migrations")"
  migration_line=${migration_line% }
else
  migration_line="none"
fi

# Vars added to the next.config.ts build registry must be set in Vercel BEFORE the merge
# (CORE-SEC-009) — the registry is a deploy gate, so a merge ahead of the Vercel setting
# fails the production build. Nothing else checks this, and merge is the last moment it
# can be checked.
#
# Names on removed lines are subtracted, so editing a registry line (or moving a var
# between the all-deployments and production-only groups) does not report vars that were
# already there as new. A false name here costs a trip to the Vercel dashboard to
# discover nothing needed doing, which is how a check earns being ignored.
env_names() {
  grep -E "$1" <<< "$env_diff" | grep -oE '"[A-Z][A-Z0-9_]+"' | tr -d '"' | sort -u || true
}
env_diff=$(git diff "$merge_base" "$head_sha" -- next.config.ts || true)
env_added=$(comm -23 <(env_names '^\+') <(env_names '^-') | grep -v '^$' | tr '\n' ' ' || true)
env_added=${env_added% }
if [[ -z "$env_added" ]]; then
  env_added="none"
fi

UI_PATHS='(^src/app/.*\.tsx$|^src/components/|\.css$)'
ui_changed=no
if grep -qE "$UI_PATHS" <<< "$changed_paths"; then
  ui_changed=yes
fi

shots=$(gh api --paginate "repos/$(_repo_slug)/issues/${pr}/comments" \
  | jq -rs --arg marker "$SCREENSHOT_MARKER" \
      '[ .[] | flatten | .[] | select((.body // "") | startswith($marker)) ] | last.updated_at // ""')

# "Screenshots exist" is not "screenshots of this" — the sticky comment survives every
# later push, so a UI commit landing after it leaves the report vouching for pictures of
# an older tree. Every other claim in this block is pinned to a commit; this was the one
# "trust me" field.
#
# Compared as UTC strings in GitHub's own format, which sorts lexicographically — date
# arithmetic would need GNU `date -d`, and this has to run on the Mac too. Commit dates
# can be rewritten, so this is a staleness signal, not proof.
last_ui_commit=""
if [[ "$ui_changed" == "yes" ]]; then
  ui_files=()
  while IFS= read -r ui_file; do
    ui_files+=("$ui_file")
  done < <(grep -E "$UI_PATHS" <<< "$changed_paths")
  last_ui_commit=$(TZ=UTC0 git log -1 --format='%cd' --date=format:'%Y-%m-%dT%H:%M:%SZ' \
    "${merge_base}..${head_sha}" -- "${ui_files[@]}" 2>/dev/null || true)
fi

if [[ -n "$shots" ]]; then
  ui_line="${ui_changed} · screenshots posted ${shots}"
  if [[ -n "$last_ui_commit" && "$last_ui_commit" > "$shots" ]]; then
    ui_line="${ui_line} · STALE: UI changed at ${last_ui_commit}, after the screenshots"
  fi
elif [[ "$ui_changed" == "yes" ]]; then
  ui_line="yes · NO screenshots posted"
else
  ui_line="no"
fi

# ---------------------------------------------------------------------------------
# Branch freshness
# ---------------------------------------------------------------------------------

behind_main=$(git rev-list --count "${head_sha}..${base_sha}")
branch_commits=$(git rev-list --count "${merge_base}..${head_sha}")

# The newest merge commit on the branch whose second parent is on main — i.e. the last
# time main was merged IN, as distinct from the merge-base moving on its own.
last_main_merge="never — branched $(git log -1 --format='%cI (%cr)' "$merge_base")"
while read -r sha _p1 p2 _rest; do
  if [[ -z "${p2:-}" ]]; then
    continue
  fi
  if git merge-base --is-ancestor "$p2" "$base_sha" 2>/dev/null; then
    ago=$(git rev-list --count "${sha}..${head_sha}")
    last_main_merge="$(git log -1 --format='%cI (%cr)' "$sha") — ${ago} commit(s) ago"
    break
  fi
done < <(git rev-list --merges --parents "${merge_base}..${head_sha}")

bead=$(grep -oE 'PP-[a-z0-9]+(\.[0-9]+)*' <<< "${title} ${head_ref}" | head -n1 || true)
if [[ -z "$bead" ]]; then
  bead="none in title or branch"
fi

# ---------------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------------

# Ruled sections rather than blank lines: the block is pasted into a chat transcript
# among prose, and a wall of aligned label/value pairs there reads as one undifferentiated
# paragraph. The three groups answer three different questions — may it merge, what is in
# it, what do I run — and the rules are what make that visible at a glance.
rule() { printf '  %s\n' "────────────────────────────────────────────────────────────────────────"; }

printf '\n'
printf 'PR #%s — %s\n' "$pr" "$title"
printf '  %s -> %s · bead %s\n' "$head_ref" "$base_ref" "$bead"
printf '  %s\n' "$url"
if [[ "$is_draft" == "true" ]]; then
  printf '  DRAFT — not ready for review\n'
fi
if [[ -n "$head_raced" ]]; then
  printf '  HEAD MOVED while this ran (%s) — re-run before acting on it\n' "$head_raced"
fi
rule
printf '  review        %s\n' "$review_desc"
printf '  ci            %s\n' "$(gate_state "$ci_out")"
printf '  threads       %s\n' "$(gate_state "$threads_out")"
printf '  mergeable     %s · %s commit(s) behind %s\n' "$(gate_state "$conflict_out")" "$behind_main" "$base_ref"
printf '  main merged   %s\n' "$last_main_merge"
rule
printf '  diff vs main  %s   (%s commit(s))\n' "$diff_vs_main" "$branch_commits"
printf '  since review  %s\n' "$diff_since_review"
printf '  migrations    %s\n' "$migration_line"
printf '  new env vars  %s\n' "$env_added"
printf '  ui            %s\n' "$ui_line"
rule

blocking=()
add_block() { blocking+=("$1"); }
if [[ "$(gate_token "$ci_out")" != "PASS" ]]; then add_block "ci: $(gate_state "$ci_out")"; fi
if [[ "$(gate_token "$threads_out")" != "PASS" ]]; then add_block "threads: $(gate_state "$threads_out")"; fi
if [[ "$(gate_token "$conflict_out")" != "PASS" ]]; then add_block "no_conflict: $(gate_state "$conflict_out")"; fi
if [[ "$rv_state" != "marker" ]]; then add_block "reviewed: ${rv_state} — Tim runs /codex:review --base main, then the agent attests"; fi
if [[ "$is_draft" == "true" ]]; then add_block "draft: flip to ready-for-review"; fi
if [[ "$pr_state" != "OPEN" ]]; then add_block "state: PR is ${pr_state}, not open"; fi
# The gate answers came from `gh` at one SHA and the diff from git at another, so no
# combination of them is a statement about a single tree. Nothing is merged on that.
if [[ -n "$head_raced" ]]; then add_block "head moved mid-report (${head_raced}) — re-run"; fi

if [[ ${#blocking[@]} -gt 0 ]]; then
  printf '  NOT MERGEABLE YET — %s gate(s) blocking:\n' "${#blocking[@]}"
  printf '    - %s\n' "${blocking[@]}"
  rule
fi

# The command lines are the only unindented lines in the block, and carry nothing after
# the command itself. Both properties are load-bearing for pasting: a trailing `(re-run —
# …)` parenthetical becomes shell arguments, and Claude Code's `!` passthrough wants the
# bang in column one. Anything explaining a command goes on the line above it.
printf '  re-run this report:\n'
printf '! bash scripts/workflow/merge-handoff.sh %s\n' "$pr"
if [[ ${#blocking[@]} -eq 0 ]]; then
  printf '  merge — all four gates pass:\n'
  printf '! scripts/workflow/merge-pr.sh %s --human\n' "$pr"
fi
rule
printf '\n'

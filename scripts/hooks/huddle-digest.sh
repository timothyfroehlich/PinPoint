#!/usr/bin/env bash
# shellcheck disable=SC2250  # unbraced $vars are consistent throughout this codebase
# huddle-digest.sh — "what we've been working on" digest for the last N days
#
# Prints a compact, skimmable block describing the *shape* of recent work:
# what merged to main grouped by work type, and which branches are currently
# alive. Called by huddle-session-start.sh on every session start, including
# after compaction.
#
# Why this exists (PP-llkj): session-start used to inject five daily-bead
# descriptions, which are written in a "Merged / In-flight / Discoveries /
# Blockers" shape. Read cold, that lands as a log of everything that recently
# broke. A session opening (or waking up post-compaction) needs the opposite
# framing first: what kind of work is this project doing right now, and what
# just landed. The dailies still follow — trimmed — for day-scale detail.
#
# Deterministic by design: everything here comes from the local git object
# store. No LLM, no network, no `bd` call, no `gh` call. It must be safe to run
# on every SessionStart in every worktree, so it never fetches — `origin/main`
# is read as-is and the block states which commit date it actually covers, so a
# stale remote ref reads as stale rather than as "nothing happened".
#
# Usage:
#   bash scripts/hooks/huddle-digest.sh [--days N] [--max-items N] [--no-branches]
#
# Exits 0 with no output when there is nothing to report (not a git repo, no
# commits in range, git missing). Callers can capture stdout and skip the
# section entirely when it comes back empty.

set -euo pipefail

DAYS=7
MAX_ITEMS=14
SHOW_BRANCHES=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --days) DAYS="${2:-7}"; shift 2 ;;
    --max-items) MAX_ITEMS="${2:-14}"; shift 2 ;;
    --no-branches) SHOW_BRANCHES=0; shift ;;
    *) shift ;;
  esac
done

[[ "$DAYS" =~ ^[0-9]+$ ]] || DAYS=7
[[ "$MAX_ITEMS" =~ ^[0-9]+$ ]] || MAX_ITEMS=14
(( DAYS >= 1 )) || DAYS=7
(( DAYS <= 90 )) || DAYS=90
(( MAX_ITEMS >= 1 )) || MAX_ITEMS=14
(( MAX_ITEMS <= 50 )) || MAX_ITEMS=50

command -v git >/dev/null 2>&1 || exit 0
command -v python3 >/dev/null 2>&1 || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

SINCE="${DAYS} days ago"

# Trunk ref: prefer the remote tip (what everyone else sees) but fall back to a
# local branch when the remote ref is absent — and when the local trunk is
# *ahead* (someone merged and hasn't pushed, or the remote ref is stale), use
# whichever is newer so the digest never under-reports.
TRUNK=""
BEST_EPOCH=0
for ref in origin/main origin/master main master; do
  git rev-parse --verify --quiet "$ref" >/dev/null 2>&1 || continue
  ref_epoch=$(git log -1 --format='%ct' "$ref" 2>/dev/null) || continue
  [[ "$ref_epoch" =~ ^[0-9]+$ ]] || continue
  if (( ref_epoch > BEST_EPOCH )); then
    BEST_EPOCH=$ref_epoch
    TRUNK=$ref
  fi
done
[[ -n "$TRUNK" ]] || exit 0

# %x1f (unit separator) between fields, %x1e (record separator) between commits:
# commit subjects routinely contain every other punctuation character, and a
# tab/pipe delimiter would split mid-title.
LOG_RAW=$(git log "$TRUNK" --no-merges --since="$SINCE" \
  --pretty=format:'%h%x1f%ad%x1f%s%x1e' --date=short 2>/dev/null) || LOG_RAW=""

BRANCH_RAW=""
if (( SHOW_BRANCHES )); then
  # Branches with a commit inside the window. `--sort=-committerdate` puts the
  # freshest first; the Python side filters out trunk itself, HEAD pointers,
  # dependabot, and the worktree-agent-* churn.
  #
  # Tab-delimited, one ref per line — unlike `git log`, for-each-ref has no
  # `%xNN` escape, so there is no way to emit a control character it cannot also
  # find in the data. `contents:subject` is single-line by definition, so the
  # line break is a safe record separator, and the Python side splits with
  # maxsplit=2 so a tab inside a subject lands harmlessly in the last field.
  BRANCH_RAW=$(git for-each-ref refs/remotes/origin \
    --sort=-committerdate \
    --format='%(refname:short)	%(committerdate:short)	%(contents:subject)' \
    2>/dev/null) || BRANCH_RAW=""
fi

CUTOFF=$(python3 -c "
import datetime, sys
print((datetime.date.today() - datetime.timedelta(days=int(sys.argv[1]))).isoformat())
" "$DAYS" 2>/dev/null) || exit 0

[[ -n "$LOG_RAW" ]] || exit 0

# Pass everything through the environment rather than argv: commit subjects and
# branch names are arbitrary text, and the branch blob can be tens of kilobytes.
export DIGEST_DAYS="$DAYS"
export DIGEST_MAX_ITEMS="$MAX_ITEMS"
export DIGEST_CUTOFF="$CUTOFF"
export DIGEST_TRUNK="$TRUNK"
export DIGEST_BRANCH_RAW="$BRANCH_RAW"

# shellcheck disable=SC2016  # the python program is deliberately unexpanded — it
# reads its inputs from DIGEST_* env vars and stdin, never from shell expansion.
printf '%s' "$LOG_RAW" | python3 -c '
import os
import re
import sys

days = int(os.environ["DIGEST_DAYS"])
max_items = int(os.environ["DIGEST_MAX_ITEMS"])
cutoff = os.environ["DIGEST_CUTOFF"]
trunk = os.environ["DIGEST_TRUNK"]
branch_raw = os.environ.get("DIGEST_BRANCH_RAW", "")

# Conventional-commit header: type(scope)!: subject
#
# `scopes` is a repeated group, not a single one: dependabot writes
# "chore(deps)(deps): bump ...", and a single-scope pattern rejects those
# outright — they then land in the "other" bucket instead of collapsing into the
# dependency-bump count, which is exactly the noise this digest exists to hide.
HEADER = re.compile(
    r"^(?P<type>[a-z]+)(?P<scopes>(?:\([^)]*\))*)!?:\s*(?P<rest>.*)$"
)
FIRST_SCOPE = re.compile(r"\(([^)]*)\)")
PR_NUM = re.compile(r"\s*\(#(\d+)\)\s*$")
BEAD = re.compile(r"\s*\((PP-[0-9a-z.]+)\)\s*$", re.IGNORECASE)

# Work-type buckets, in the order a reader cares about: what got built, what got
# fixed, what got reshaped, what got written down. Everything else (chore, ci,
# build, style, test, perf...) collapses into a single tail line — that traffic
# is real but it is not "what we are working on".
BUCKETS = [
    ("feat", "New capability"),
    ("fix", "Fixes"),
    ("refactor", "Refactors"),
    ("docs", "Docs & agent context"),
]
BUCKET_KEYS = {name for name, _ in BUCKETS}

records = []
for chunk in sys.stdin.read().split("\x1e"):
    chunk = chunk.strip("\n")
    if not chunk:
        continue
    parts = chunk.split("\x1f")
    if len(parts) < 3:
        continue
    _sha, date, subject = parts[0], parts[1], parts[2]
    records.append((date, subject))

if not records:
    sys.exit(0)


def parse(subject):
    """-> (type, scope, title, pr) with non-conventional subjects tolerated."""
    m = HEADER.match(subject)
    if m:
        ctype = m.group("type")
        first = FIRST_SCOPE.search(m.group("scopes") or "")
        scope = first.group(1).strip() if first else ""
        rest = m.group("rest").strip()
    else:
        ctype, scope, rest = "other", "", subject.strip()
    pr = ""
    m_pr = PR_NUM.search(rest)
    if m_pr:
        pr = m_pr.group(1)
        rest = rest[: m_pr.start()].rstrip()
    # Bead ids are already carried by the PR; dropping them keeps titles short.
    rest = BEAD.sub("", rest).rstrip()
    # dependabot lands as "chore(deps)(deps): bump ..." — normalise the scope so
    # the dep-bump collapse below catches every shape of it.
    if scope.startswith("deps"):
        scope = "deps"
    return ctype, scope, rest, pr


parsed = [parse(subject) for _date, subject in records]
newest_date = max(date for date, _s in records)

grouped = {name: [] for name, _ in BUCKETS}
tail = {}
dep_bumps = 0
for ctype, scope, title, pr in parsed:
    if scope == "deps":
        dep_bumps += 1
        continue
    if ctype in BUCKET_KEYS:
        grouped[ctype].append((scope, title, pr))
    else:
        tail[ctype] = tail.get(ctype, 0) + 1

total = len(parsed)
out = []
out.append(
    "**Merged to `main` — {n} commits in the last {d} days** "
    "(newest {date}, via `{trunk}`)".format(
        n=total, d=days, date=newest_date, trunk=trunk
    )
)
out.append("")

# Budget the bullet list across buckets proportionally, so a 30-fix week still
# shows the two features that landed. Every non-empty bucket gets at least one
# line, and each states its true count so a truncated list never reads complete.
non_empty = [(name, label) for name, label in BUCKETS if grouped[name]]
remaining = max_items
shown = {}
# Allocate smallest bucket first: a bucket that cannot spend its whole share
# hands the balance to the larger ones instead of stranding it, so the budget is
# actually spent. Rendering still follows BUCKETS order.
order = sorted(non_empty, key=lambda nl: len(grouped[nl[0]]))
for i, (name, _label) in enumerate(order):
    left_buckets = len(order) - i
    share = max(1, remaining // left_buckets)
    shown[name] = min(len(grouped[name]), share)
    remaining -= shown[name]

for name, label in non_empty:
    items = grouped[name]
    limit = shown[name]
    # Scope histogram answers "which parts of the app moved" in one line.
    scopes = {}
    for scope, _t, _p in items:
        key = scope or "unscoped"
        scopes[key] = scopes.get(key, 0) + 1
    hist = ", ".join(
        "{k} ({v})".format(k=k, v=v) if v > 1 else k
        for k, v in sorted(scopes.items(), key=lambda kv: (-kv[1], kv[0]))
    )
    out.append("_{label} ({n})_ — {hist}".format(label=label, n=len(items), hist=hist))
    for scope, title, pr in items[:limit]:
        suffix = " (#{pr})".format(pr=pr) if pr else ""
        out.append("- {title}{suffix}".format(title=title, suffix=suffix))
    if len(items) > limit:
        out.append("- …and {n} more".format(n=len(items) - limit))
    out.append("")

housekeeping = []
if dep_bumps:
    housekeeping.append("{n} dependency bumps".format(n=dep_bumps))
for ctype, count in sorted(tail.items(), key=lambda kv: (-kv[1], kv[0])):
    housekeeping.append("{n} {t}".format(n=count, t=ctype))
if housekeeping:
    out.append("_Housekeeping_ — " + ", ".join(housekeeping))
    out.append("")

# --- Active branches ---------------------------------------------------------
# "What is in flight right now" is the half of the picture that merged-to-main
# cannot show. Remote branches with a commit inside the window, minus trunk and
# the throwaway worktree-agent-* branches.
if branch_raw.strip():
    rows = []
    for line in branch_raw.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t", 2)
        if len(parts) < 3:
            continue
        ref, date, subject = parts[0], parts[1], parts[2]
        short = ref.split("/", 1)[1] if ref.startswith("origin/") else ref
        # `pr-screenshots` is the screenshot-upload branch — machine traffic
        # dressed as a feature branch, and its subjects ("PR #1762 @ 8d507d45")
        # carry no information about what anyone is working on.
        if short in ("main", "master", "HEAD", "pr-screenshots") or ref in (
            "origin",
            "origin/HEAD",
        ):
            continue
        if short.startswith(("worktree-agent-", "agent-", "dependabot/")):
            continue
        if date < cutoff:
            continue
        _t, _s, title, pr = parse(subject)
        rows.append((short, date, title, pr))

    if rows:
        out.append("**In flight — {n} branches touched in the last {d} days**".format(
            n=len(rows), d=days
        ))
        for short, date, title, pr in rows[:8]:
            suffix = " (#{pr})".format(pr=pr) if pr else ""
            out.append("- `{b}` — {t}{s} _{d}_".format(b=short, t=title, s=suffix, d=date))
        if len(rows) > 8:
            out.append("- …and {n} more".format(n=len(rows) - 8))
        out.append("")

sys.stdout.write("\n".join(out).rstrip() + "\n")
' || exit 0

exit 0

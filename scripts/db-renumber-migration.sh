#!/usr/bin/env bash
# Renumber this branch's Drizzle migration after the base branch's migrations,
# keeping its reviewed SQL (hand-written statements included) byte-for-byte.
#
# Run it mid-merge: `git merge origin/main` stopped on drizzle/ conflicts, and
# every conflict outside drizzle/ is resolved and staged (schema.ts especially).
#
#   bash scripts/db-renumber-migration.sh
#
# What it does:
#   1. Takes the base branch's drizzle/ folder and drops this branch's migration
#      files from the index.
#   2. Regenerates the migration under its old name (`drizzle-kit generate --name`), which
#      writes the next number, a fresh journal `when` and a snapshot that follows
#      the base branch's. A fresh `when` matters: production applies only
#      migrations newer than the newest one already applied
#      (scripts/check_migration_order.py explains).
#   3. Checks that every generated statement is already in the reviewed SQL
#      (scripts/migration_statements.py), then puts the reviewed SQL back
#      verbatim under the new number.
#   4. Runs scripts/check_migration_order.py against the base branch and stages
#      drizzle/. You conclude the merge with `git commit`.
#
# One migration per branch, and nothing else changed under drizzle/. Anything
# else needs the manual protocol in the pinpoint-deployment skill ("Migration
# Conflicts").
#
# Run it in an interactive terminal: drizzle-kit asks whether a changed column
# or table is a rename, and without a TTY that prompt fails.

set -euo pipefail

die() {
  printf 'db-renumber-migration: %s\n' "$*" >&2
  exit 1
}

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"
command -v jq >/dev/null || die "jq is required (brew install jq)."

git rev-parse -q --verify MERGE_HEAD >/dev/null ||
  die "no merge in progress. Run \`git merge origin/main\` first."

base_side=MERGE_HEAD
merge_base=$(git merge-base HEAD "$base_side")

unresolved_outside=$(git diff --name-only --diff-filter=U | grep -v '^drizzle/' || true)
if [[ -n "$unresolved_outside" ]]; then
  die "resolve and stage these conflicts first:
$unresolved_outside"
fi

if ! git diff --name-only --diff-filter=U | grep -q '^drizzle/'; then
  # No textual conflict, but a hand renumber that kept an old `when` would
  # still be skipped in production; the order check catches that.
  check_dir=$(mktemp -d)
  git archive "$base_side" drizzle | tar -x -C "$check_dir"
  if python3 scripts/check_migration_order.py --base-dir "$check_dir"; then
    rm -rf "$check_dir"
    printf 'No drizzle/ conflicts and the migration order checks out; nothing to renumber.\n'
    exit 0
  fi
  rm -rf "$check_dir"
  die "no drizzle/ conflicts, but the migration order check failed (above)."
fi

journal_tags() {
  git show "$1:drizzle/meta/_journal.json" | jq -r '.entries[].tag'
}

branch_tags=$(comm -13 <(journal_tags "$merge_base" | sort) <(journal_tags HEAD | sort))
branch_count=$(grep -c . <<< "$branch_tags" || true)
[[ "$branch_count" -eq 1 ]] ||
  die "expected one migration on this branch, found ${branch_count}:
${branch_tags}
Use the manual protocol in the pinpoint-deployment skill."

old_tag=$branch_tags
old_number=${old_tag%%_*}
name=${old_tag#*_}

# Taking the base branch's drizzle/ would silently drop any other branch edit
# under drizzle/, so refuse unless the branch only added its migration.
other_edits=$(git diff --name-only "$merge_base" HEAD -- drizzle/ |
  grep -Fxv -e "drizzle/meta/_journal.json" -e "drizzle/${old_tag}.sql" \
    -e "drizzle/meta/${old_number}_snapshot.json" || true)
if [[ -n "$other_edits" ]]; then
  die "this branch also changed these drizzle/ files, which renumbering would drop:
$other_edits
Use the manual protocol in the pinpoint-deployment skill."
fi

work_dir=$(mktemp -d)
index_file=$(git rev-parse --git-path index)
drizzle_touched=0
renumbered=0
untracked_before=""

# On any failure after drizzle/ is touched, put the merge back the way the
# script found it: restore the saved index (its drizzle/ conflicts unresolved,
# so `git commit` refuses rather than concluding the merge without this
# branch's migration), rewrite the conflicted files from it, and delete only
# the files drizzle-kit generated.
cleanup() {
  if [[ $drizzle_touched -eq 1 && $renumbered -eq 0 ]]; then
    cp "$work_dir/index" "$index_file"
    # Delete only untracked drizzle/ files that appeared during this run, which
    # covers a drizzle-kit run that wrote files and then failed.
    local path
    while IFS= read -r path; do
      [[ -n $path ]] && ! grep -Fxq -- "$path" <<< "$untracked_before" && rm -f -- "$path"
    done < <(git ls-files --others --exclude-standard -- drizzle/)
    if git checkout -m -- drizzle/ 2>/dev/null; then
      printf '\nThe merge is back where the script found it, drizzle/ conflicts unresolved.\n' >&2
      printf 'Run git merge --abort to start over, or finish by hand (pinpoint-deployment skill, "Migration Conflicts").\n' >&2
    else
      printf '\nCould not rebuild the drizzle/ conflict files; the working tree may not match the index.\n' >&2
      printf 'Run git merge --abort to start over.\n' >&2
    fi
  fi
  rm -rf "$work_dir"
}
trap cleanup EXIT
git show "HEAD:drizzle/${old_tag}.sql" > "$work_dir/reviewed.sql"
mkdir -p "$work_dir/base"
git archive "$base_side" drizzle | tar -x -C "$work_dir/base"

# Take the base branch's drizzle/ and drop this branch's files from the index.
cp "$index_file" "$work_dir/index"
untracked_before=$(git ls-files --others --exclude-standard -- drizzle/)
drizzle_touched=1
git checkout "$base_side" -- drizzle/
git rm -q -f --ignore-unmatch "drizzle/${old_tag}.sql"
if ! git cat-file -e "${base_side}:drizzle/meta/${old_number}_snapshot.json" 2>/dev/null; then
  git rm -q -f --ignore-unmatch "drizzle/meta/${old_number}_snapshot.json"
fi

latest_tag() {
  jq -r '.entries[-1].tag' drizzle/meta/_journal.json
}

before=$(latest_tag)
pnpm exec drizzle-kit generate --name "$name"
new_tag=$(latest_tag)
if [[ "$new_tag" == "$before" ]]; then
  # No schema changes: the reviewed migration was hand-written SQL only.
  pnpm exec drizzle-kit generate --custom --name "$name"
  new_tag=$(latest_tag)
fi
[[ "$new_tag" != "$before" ]] || die "drizzle-kit did not write a migration."

if ! python3 scripts/migration_statements.py "drizzle/${new_tag}.sql" "$work_dir/reviewed.sql"; then
  cat >&2 <<EOF

db-renumber-migration: the regenerated migration does more than the reviewed one.
Either the schema.ts merge resolution changed this branch's schema, or the base
branch carries schema drift that a later migration is meant to apply. Shipping
those statements would change what this migration does.
EOF
  exit 1
fi

cp "$work_dir/reviewed.sql" "drizzle/${new_tag}.sql"
python3 scripts/check_migration_order.py --base-dir "$work_dir/base"
git add drizzle/
renumbered=1

printf '\nRenumbered %s -> %s (SQL unchanged).\n' "$old_tag" "$new_tag"
printf 'Next: pnpm run db:reset (it fails if a kept statement repeats schema main\n'
printf 'already applies), then git commit to conclude the merge.\n'
printf 'Tell the merge orchestrator the new number: %s\n' "${new_tag%%_*}"

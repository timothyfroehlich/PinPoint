#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  bash scripts/workflow/codex-gh.sh pr-list [args...]
  bash scripts/workflow/codex-gh.sh pr-view [args...]
  bash scripts/workflow/codex-gh.sh pr-checks [args...]
  bash scripts/workflow/codex-gh.sh pr-diff [args...]
  bash scripts/workflow/codex-gh.sh run-list [args...]
  bash scripts/workflow/codex-gh.sh run-view [args...]
  bash scripts/workflow/codex-gh.sh merge-external <owner/repo> <PR-number> <merge|squash|rebase>
EOF
  exit 2
}

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
readonly script_dir
expected_root=$(cd "${script_dir}/../.." && pwd -P)
readonly expected_root
repository_root=$(git rev-parse --show-toplevel 2>/dev/null || true)
readonly repository_root

if [[ -z "$repository_root" || "$repository_root" != "$expected_root" ]]; then
  echo "BLOCK: codex-gh must run from its PinPoint worktree" >&2
  exit 1
fi

[[ $# -ge 1 ]] || usage
readonly operation=$1
shift

case "$operation" in
  pr-list) exec gh pr list "$@" ;;
  pr-view) exec gh pr view "$@" ;;
  pr-checks) exec gh pr checks "$@" ;;
  pr-diff) exec gh pr diff "$@" ;;
  run-list) exec gh run list "$@" ;;
  run-view) exec gh run view "$@" ;;
  merge-external) ;;
  *) usage ;;
esac

[[ $# -eq 3 ]] || usage
readonly target_repository=$1
readonly pr_number=$2
readonly strategy=$3

[[ "$target_repository" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || usage
[[ "$pr_number" =~ ^[0-9]+$ ]] || usage
case "$strategy" in
  merge | squash | rebase) ;;
  *) usage ;;
esac

normalized_repository=$(printf '%s' "$target_repository" | tr '[:upper:]' '[:lower:]')
readonly normalized_repository
if [[ "$normalized_repository" == "timothyfroehlich/pinpoint" ]]; then
  echo "BLOCK: use bash scripts/workflow/merge-pr.sh ${pr_number} --human for PinPoint" >&2
  exit 1
fi

exec gh pr merge "$pr_number" --repo "$target_repository" "--${strategy}"

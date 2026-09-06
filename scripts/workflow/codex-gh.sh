#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: bash scripts/workflow/codex-gh.sh merge-external <owner/repo> <PR-number> <merge|squash|rebase>" >&2
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

[[ $# -eq 4 && "$1" == "merge-external" ]] || usage
readonly target_repository=$2
readonly pr_number=$3
readonly strategy=$4

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

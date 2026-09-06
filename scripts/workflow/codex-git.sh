#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  bash scripts/workflow/codex-git.sh commit <message>
  bash scripts/workflow/codex-git.sh push
  bash scripts/workflow/codex-git.sh merge-main
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
  echo "BLOCK: codex-git must run from its PinPoint worktree" >&2
  exit 1
fi

development_branch() {
  local branch
  branch=$(git symbolic-ref --quiet --short HEAD) || {
    echo "BLOCK: codex-git requires a checked-out branch" >&2
    exit 1
  }
  if [[ "$branch" == "main" ]]; then
    echo "BLOCK: codex-git refuses main" >&2
    exit 1
  fi
  printf '%s\n' "$branch"
}

[[ $# -ge 1 ]] || usage

case "$1" in
  commit)
    [[ $# -eq 2 && -n "$2" ]] || usage
    development_branch >/dev/null
    exec git commit --message="$2" --
    ;;
  push)
    [[ $# -eq 1 ]] || usage
    branch=$(development_branch)
    exec git push --set-upstream origin "HEAD:refs/heads/${branch}"
    ;;
  merge-main)
    [[ $# -eq 1 ]] || usage
    development_branch >/dev/null
    exec git merge origin/main
    ;;
  *) usage ;;
esac

#!/usr/bin/env bash
# Block commits/checks while prototype mode or a disposable prototype route remains.
set -euo pipefail

repo_root="${1:-$(git rev-parse --show-toplevel)}"
marker="$repo_root/.prototype-mode"
prototype_root="$repo_root/src/app/(dev)/prototype"
failed=0

if [[ -e "$marker" ]]; then
  printf 'Prototype cleanup required: remove %s after repaying its debt ledger.\n' "$marker" >&2
  failed=1
fi

if [[ -d "$prototype_root" ]]; then
  disposable_path=$(
    find "$prototype_root" -mindepth 1 \
      ! -path "$prototype_root/layout.tsx" \
      -print -quit
  )
  if [[ -n "$disposable_path" ]]; then
    printf 'Prototype cleanup required: remove disposable content beneath %s.\n' "$prototype_root" >&2
    printf 'First remaining path: %s\n' "$disposable_path" >&2
    failed=1
  fi
fi

if [[ "$failed" -ne 0 ]]; then
  printf 'Prototype work is local-only and must be removed before check or commit.\n' >&2
  exit 1
fi

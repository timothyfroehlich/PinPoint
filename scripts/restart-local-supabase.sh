#!/usr/bin/env bash
set -euo pipefail

# db:reset is for an explicitly local stack. In remote mode its restart step
# would otherwise create a competing Mac stack before the destructive reset.
if [[ "${PINPOINT_SUPABASE_BACKEND:-local}" == remote && "${CI:-}" != 1 && "${CI:-}" != true ]]; then
  echo "db:reset is local-only. Use a deliberate local stack (PINPOINT_SUPABASE_BACKEND=local), or keep the remote database intact." >&2
  exit 1
fi

supabase stop
supabase start

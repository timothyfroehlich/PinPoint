#!/bin/bash
set -euo pipefail

# Make the Supabase CLI's staged secret files readable by its own containers on
# an SELinux-enforcing host (Bazzite / Fedora Atomic). No-op everywhere else --
# macOS, CI, and any Linux box without SELinux exit immediately.
#
# Why this exists (PP-9mg0):
#
# Older CLI versions wrote the pgsodium root key from *inside* the db container
# (`cat <<'EOF' > /etc/postgresql-custom/pgsodium_root.key` in the entrypoint).
# CLI 2.111.0 stages it on the host instead, at
#
#   supabase/.temp/start-secrets/<container>/secret-0
#
# and bind-mounts it read-only at /etc/postgresql-custom/pgsodium_root.key --
# with no `z`/`Z` SELinux relabel. The staged file inherits user_home_t from the
# repo; the container runs as container_t, so SELinux denies the stat. That
# makes pgsodium_getkey.sh's `[[ ! -f "$KEY_FILE" ]]` true (test -f is false on
# EACCES), so it tries to *create* the key -- writing through a read-only mount:
#
#   pgsodium_getkey.sh: .../pgsodium_root.key: Read-only file system
#   FATAL:  invalid secret key
#
# and the db container restart-loops without ever listening. Kong and pooler
# stage their secrets the same way; db just fails first.
#
# Labeling the directory once is enough, and it reaches a `supabase start` typed
# by hand (an env var like CONTAINERS_CONF_OVERRIDE would not): start-secrets/
# persists across starts -- the CLI only removes the per-container subdirectory
# inside it -- and new files inherit their parent directory's label. It is also
# narrower than disabling SELinux labeling for containers wholesale: only these
# staged secrets get a shared label, and the containers stay confined.

ROOT="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
TARGET="$ROOT/supabase/.temp/start-secrets"
WANT="container_file_t"

command -v selinuxenabled >/dev/null 2>&1 || exit 0
selinuxenabled || exit 0
command -v chcon >/dev/null 2>&1 || exit 0

mkdir -p "$TARGET"

# Already correct? `:Z` from a previous run leaves private MCS categories
# (container_file_t:s0:c1,c2), which only that one container could read -- so
# match the bare :s0 range, not just the type.
# shellcheck disable=SC2012  # one known directory, not a glob; ls -Z is the
# only context reader that is always present (secon/stat are not).
current=$(ls -Zd "$TARGET" 2>/dev/null | awk '{print $1}' || true)
if [ "${current##*:"${WANT}":}" = "s0" ]; then
  exit 0
fi

# -l s0 strips any stale categories; drop it if the policy has no MCS/MLS.
if ! chcon -R -t "$WANT" -l s0 "$TARGET" 2>/dev/null &&
  ! chcon -R -t "$WANT" "$TARGET" 2>/dev/null; then
  echo "warning: could not label $TARGET as $WANT." >&2
  echo "  \`supabase start\` will fail with \"FATAL: invalid secret key\" (PP-9mg0)." >&2
  echo "  Fix by hand: chcon -R -t $WANT -l s0 '$TARGET'" >&2
fi

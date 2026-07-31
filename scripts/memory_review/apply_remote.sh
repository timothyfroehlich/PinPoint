#!/usr/bin/env bash
#
# Ship an approved memory-review manifest to the other machine and have ITS OWN
# Claude apply it.
#
# Why an agent on the far side instead of writing the files over SSH: each
# machine's memories should be written by that machine's agent using whatever the
# sanctioned mechanism is at the time. Reaching over and hand-writing another
# machine's store would hard-code today's undocumented on-disk format - the exact
# fragility that ruled out git-backing the store. See
# docs/superpowers/specs/2026-07-28-memory-context-review-design.md.
#
# One round trip, no negotiation: the remote agent returns a result document and
# any item it disputes is left unapplied and escalated to Tim, never argued about
# between two agents.
#
# PERMISSION POSTURE (spiked 2026-07-31, PP-uoqg): Bazzite's ~/.claude/settings.json
# has defaultMode "auto" and no allow rules, and a headless `claude -p` writes
# files there unattended - verified end to end, exit 0, correct content. So the
# default path dispatches headlessly. `--stage-only` is the opt-in alternative
# Tim asked for: stage the manifest and hand him a prompt to run in an
# interactive session himself.
#
# The Python helper is piped over stdin rather than assumed present on the far
# side, because non-interactive SSH on Bazzite sources no shell config - brew and
# everything it provides are off the PATH. /usr/bin/python3 is not.

set -euo pipefail

HOST="bazzite"
MANIFEST=""
DRY_RUN=0
STAGE_ONLY=0

# Absolute paths: the remote shell is non-interactive and sources nothing. Single
# quotes on the $HOME ones so they expand on the far side, not here.
REMOTE_REPO="/var/home/froeht/Code/PinPoint"
# shellcheck disable=SC2016  # $HOME must survive to the far side, not expand here
REMOTE_CLAUDE='$HOME/.local/bin/claude'
# shellcheck disable=SC2016  # ditto - this is the remote's home, not ours
REMOTE_SNAPSHOT_ROOT='$HOME/.pinpoint/memory-snapshots'
REMOTE_MANIFEST="/tmp/memory-review-manifest.json"
REMOTE_RESULT="/tmp/memory-review-result.json"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat >&2 <<'EOF'
usage: apply_remote.sh --manifest <path> [--host <ssh-host>] [--dry-run|--stage-only]

  --manifest    approved manifest JSON (schema in the design spec)
  --host        ssh alias for the target machine (default: bazzite; use
                bazzite-lan when the tailnet itself is the suspect)
  --dry-run     snapshot the remote store and stop; ship nothing
  --stage-only  snapshot and ship the manifest, then print a prompt to run by
                hand in an interactive session on the far side
EOF
}

# `shift 2` with a single argument left returns nonzero, which under `set -e`
# kills the script before any usage message can print - so the value is checked
# explicitly rather than relying on the later required-argument check.
require_value() {
  if [[ $2 -lt 2 ]]; then
    echo "$1 requires a value" >&2
    usage
    exit 2
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest) require_value "$1" $#; MANIFEST="$2"; shift 2 ;;
    --host) require_value "$1" $#; HOST="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --stage-only) STAGE_ONLY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ "${DRY_RUN}" -eq 1 && "${STAGE_ONLY}" -eq 1 ]]; then
  echo "--dry-run and --stage-only are mutually exclusive" >&2
  usage
  exit 2
fi

# Validate everything BEFORE touching the remote, so a typo never spins up work
# on the other machine.
if [[ -z "${MANIFEST}" ]]; then
  echo "--manifest is required" >&2
  usage
  exit 2
fi
if [[ ! -f "${MANIFEST}" ]]; then
  echo "manifest not found: ${MANIFEST}" >&2
  exit 2
fi
if ! python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "${MANIFEST}" 2>/dev/null; then
  echo "manifest is not valid JSON: ${MANIFEST}" >&2
  exit 2
fi

# The undo comes first, unconditionally - including on a dry run, so the snapshot
# path is proven before a real pass ever depends on it.
echo "==> snapshotting ${HOST} memory stores" >&2
# shellcheck disable=SC2029  # intended: the constant expands here, the $HOME inside it there
ssh "${HOST}" "python3 - --dest-root ${REMOTE_SNAPSHOT_ROOT}" \
  < "${SCRIPT_DIR}/snapshot_stores.py" >&2

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "==> dry run: remote snapshot taken, manifest not shipped" >&2
  exit 0
fi

echo "==> shipping manifest to ${HOST}" >&2
scp -q "${MANIFEST}" "${HOST}:${REMOTE_MANIFEST}"

# The prompt deliberately grants the remote agent authority to DISPUTE. It is the
# only party that can check a claim against its own machine, and a wrongly
# deleted memory is far more expensive than a skipped one.
read -r -d '' PROMPT <<EOF || true
You are applying an approved memory-review manifest to THIS machine's Claude
memory store. Read ${REMOTE_MANIFEST}.

For each action, apply it to this machine's own memory store using your normal
memory-writing mechanism - create, rewrite, or delete the named memory and keep
MEMORY.md consistent with the result.

You may DISPUTE an action instead of applying it. Dispute when the action is
wrong for THIS machine: a memory it wants deleted is still true here, a rewrite
would drop machine-specific detail, or the stated reason does not hold locally.
A skipped action is cheap; a wrongly deleted memory is not. Do not negotiate and
do not improvise alternatives - apply or dispute.

Write a JSON result to ${REMOTE_RESULT} with exactly these keys:
  schema_version (1), machine, applied (list of action ids),
  disputed (list of {id, reason}), failed (list of {id, reason}).
Then stop.
EOF

if [[ "${STAGE_ONLY}" -eq 1 ]]; then
  cat <<EOF
==> staged, not dispatched.

Manifest is on ${HOST} at ${REMOTE_MANIFEST}.
Run a Claude session there (\`baz\`, or the Remote Control service) and paste:

${PROMPT}

Then retrieve the result with:
  ssh ${HOST} 'cat ${REMOTE_RESULT}'
EOF
  exit 0
fi

# Clear any previous run's result BEFORE dispatching. REMOTE_RESULT is a fixed
# path, so a run that exits 0 without writing one would otherwise return the
# last run's document - and the lead would report last week's ids as applied
# this week, believing the machines synced when they did not.
echo "==> clearing any stale result on ${HOST}" >&2
# shellcheck disable=SC2029  # intended: a fixed /tmp path, expanded here on purpose
ssh "${HOST}" "rm -f ${REMOTE_RESULT}"

echo "==> dispatching headless claude on ${HOST}" >&2
# The remote agent may have applied part of the manifest before failing, so its
# exit status must not abort us before we retrieve the record of what changed.
apply_status=0
# shellcheck disable=SC2029  # intended: paths resolve here, $HOME in REMOTE_CLAUDE resolves there
ssh "${HOST}" "cd ${REMOTE_REPO} && ${REMOTE_CLAUDE} -p $(printf '%q' "${PROMPT}")" >&2 \
  || apply_status=$?

if [[ "${apply_status}" -ne 0 ]]; then
  echo "==> remote agent exited ${apply_status}; retrieving result anyway" >&2
fi

echo "==> retrieving result" >&2
result=""
# shellcheck disable=SC2029  # intended: a fixed /tmp path, expanded here on purpose
result="$(ssh "${HOST}" "cat ${REMOTE_RESULT}" 2>/dev/null)" || result=""

if [[ -z "${result}" ]]; then
  echo "no result document at ${HOST}:${REMOTE_RESULT} - the remote agent wrote nothing." >&2
  echo "The remote store may still have been modified; check its snapshot." >&2
  exit 1
fi

if ! printf '%s' "${result}" | python3 -c '
import json, sys
doc = json.load(sys.stdin)
missing = [k for k in ("schema_version", "machine", "applied", "disputed", "failed") if k not in doc]
if missing:
    sys.exit("result document is missing keys: " + ", ".join(missing))
' >&2; then
  echo "refusing to report an unrecognised result document" >&2
  exit 1
fi

printf '%s\n' "${result}"
exit "${apply_status}"

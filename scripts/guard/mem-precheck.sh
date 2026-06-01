#!/usr/bin/env bash
# mem-precheck.sh — banded memory-pressure gate for heavy commands.
#
# Three zones based on current macOS host memory pressure:
#   GO          (free >= 2 GB):    proceed immediately, exit 0.
#   QUEUE/WARN  (800 MB–2 GB):     poll every 10 s for up to 5 min;
#                                   if pressure clears → GO;
#                                   if still tight at timeout → HARD-BLOCK.
#   HARD-BLOCK  (free < 800 MB
#                OR swap >= 6500 MB): exit non-zero immediately with a message.
#
# "Free RAM" = (pages free + pages inactive) × page size, which matches what
# macOS considers "available" (inactive pages are immediately reclaimable).
#
# Rationale for thresholds (see docs/memory-budget-investigation-2026-06.md):
#   - A 2-worker integration run peaks at ~3.3 GB.
#   - A measured single 4-worker run drove free RAM to 74–89 MB (the cliff).
#   - Baseline idle 5-session load ≈ 4.5 GB before any work starts.
#   - 2 GB free is a comfortable runway for one more heavy run.
#   - 800 MB is the minimum defensible floor (some run in flight already).
#   - Swap > 6500 MB indicates the machine is already swapping heavily; adding
#     a 3–6 GB peak will extend run times dramatically and risk OOM.
#
# CI passthrough: if $CI is set, exit 0 (runner provides isolation).
# Override:       if FORCE_MEM_PRECHECK=skip, exit 0 with a one-line notice.
#
# Usage (invoked via bash — no chmod needed):
#   bash scripts/guard/mem-precheck.sh

set -euo pipefail

# ── overrides ────────────────────────────────────────────────────────────────

if [ -n "${CI:-}" ]; then
  exit 0
fi

if [ "${FORCE_MEM_PRECHECK:-}" = "skip" ]; then
  echo "[mem-precheck] override: FORCE_MEM_PRECHECK=skip — skipping check." >&2
  exit 0
fi

# Non-Darwin fail-open. The gate's metrics (vm_stat, sysctl vm.swapusage) are
# macOS-only. On Linux/remote dev hosts vm_stat fails, _free_mb() reads 0, and
# the script would HARD-BLOCK — wedging build/integration. The gate only
# applies where its metrics are valid, so elsewhere we allow unconditionally.
if [ "$(uname)" != "Darwin" ]; then
  echo "[mem-precheck] non-Darwin host — skipping check (gate is macOS-only)." >&2
  exit 0
fi

# ── thresholds (MB) ──────────────────────────────────────────────────────────

THRESHOLD_GO=2048         # >= this: proceed immediately
THRESHOLD_QUEUE=800       # >= this (but < GO): enter polling band
THRESHOLD_SWAP=6500       # swap used above this: HARD-BLOCK regardless of free
POLL_INTERVAL_SECONDS=10  # how often to re-sample in the QUEUE band
POLL_TIMEOUT_SECONDS=300  # 5 minutes: give up and HARD-BLOCK if still tight

# ── helpers ──────────────────────────────────────────────────────────────────

# Returns: free RAM in MB = (pages_free + pages_inactive) × page_size / 1 MB
# vm_stat is authoritative for macOS free+reclaimable pages.
_free_mb() {
  local page_size
  page_size=$(pagesize 2>/dev/null || sysctl -n hw.pagesize 2>/dev/null || echo 16384)

  local raw_stats
  raw_stats=$(vm_stat 2>/dev/null) || { echo "0"; return; }

  local pages_free pages_inactive
  pages_free=$(echo "$raw_stats" \
    | awk '/^Pages free:/ { gsub(/\./, "", $3); print $3 + 0 }')
  pages_inactive=$(echo "$raw_stats" \
    | awk '/^Pages inactive:/ { gsub(/\./, "", $3); print $3 + 0 }')

  # Guard against empty/failed parses — treat as 0 so we fail-safe
  pages_free="${pages_free:-0}"
  pages_inactive="${pages_inactive:-0}"

  echo $(( (pages_free + pages_inactive) * page_size / 1024 / 1024 ))
}

# Returns: swap used in MB via sysctl vm.swapusage
_swap_used_mb() {
  local raw
  raw=$(sysctl -n vm.swapusage 2>/dev/null) || { echo "0"; return; }
  # Format: "total = NNN.NNM  used = NNN.NNM  free = NNN.NNM  (encrypted)"
  # The figure after "used =" is a single token with the unit suffixed, e.g.
  # "280.88M" or "6.50G". Grab that one token (two fields after "used").
  local used_token
  used_token=$(echo "$raw" \
    | awk '{ for (i=1;i<=NF;i++) if ($i=="used") { print $(i+2); break } }')

  if [ -z "$used_token" ]; then
    echo "0"
    return
  fi

  # Pull the trailing unit letter off the SAME token, then strip it from the
  # numeric value. Default to M if no recognizable unit suffix is present.
  local unit numeric
  unit=$(printf '%s' "$used_token" | sed -E 's/^[0-9.]+//; s/[^A-Za-z].*$//')
  numeric=$(printf '%s' "$used_token" | sed -E 's/[A-Za-z].*$//')

  if [ -z "$numeric" ]; then
    echo "0"
    return
  fi

  # Convert to integer MB. G → ×1024, anything else (M/empty) → as-is.
  case "${unit:-M}" in
    G | g) awk -v v="$numeric" 'BEGIN { printf "%.0f\n", v * 1024 }' ;;
    *)     awk -v v="$numeric" 'BEGIN { printf "%.0f\n", v }' ;;
  esac
}

# Print the HARD-BLOCK message and exit non-zero.
_hard_block() {
  local free_mb="$1"
  local swap_mb="$2"
  echo ""                                                >&2
  echo "╔══════════════════════════════════════════════╗" >&2
  echo "║  mem-precheck: HARD-BLOCK (memory pressure)  ║" >&2
  echo "╚══════════════════════════════════════════════╝" >&2
  echo ""                                                >&2
  echo "  Free RAM : ${free_mb} MB  (need >= ${THRESHOLD_QUEUE} MB to queue, >= ${THRESHOLD_GO} MB to run)" >&2
  echo "  Swap used: ${swap_mb} MB  (hard-block if >= ${THRESHOLD_SWAP} MB)" >&2
  echo ""                                                >&2
  echo "  Heavy command blocked. Options:" >&2
  echo "    • Wait for other sessions to finish, then retry." >&2
  echo "    • Skip this check:  FORCE_MEM_PRECHECK=skip <command>" >&2
  echo ""                                                >&2
  exit 1
}

# ── classify and act ─────────────────────────────────────────────────────────

_classify_and_act() {
  local free_mb swap_mb
  free_mb=$(_free_mb)
  swap_mb=$(_swap_used_mb)

  # Swap hard-block takes precedence regardless of free RAM reading.
  if [ "$swap_mb" -ge "$THRESHOLD_SWAP" ]; then
    echo "[mem-precheck] swap pressure: ${swap_mb} MB used (>= ${THRESHOLD_SWAP} MB limit)." >&2
    _hard_block "$free_mb" "$swap_mb"
  fi

  if [ "$free_mb" -ge "$THRESHOLD_GO" ]; then
    # GO: plenty of room
    return 0
  fi

  if [ "$free_mb" -lt "$THRESHOLD_QUEUE" ]; then
    # HARD-BLOCK immediately — not even worth queuing
    echo "[mem-precheck] insufficient RAM: ${free_mb} MB free (need >= ${THRESHOLD_QUEUE} MB)." >&2
    _hard_block "$free_mb" "$swap_mb"
  fi

  # QUEUE band: poll until free >= GO or timeout
  local elapsed=0
  echo "[mem-precheck] memory pressure: ${free_mb} MB free (queue band ${THRESHOLD_QUEUE}–${THRESHOLD_GO} MB)." >&2
  echo "[mem-precheck] waiting up to ${POLL_TIMEOUT_SECONDS}s for pressure to clear ..." >&2

  while [ "$elapsed" -lt "$POLL_TIMEOUT_SECONDS" ]; do
    sleep "$POLL_INTERVAL_SECONDS"
    elapsed=$(( elapsed + POLL_INTERVAL_SECONDS ))

    free_mb=$(_free_mb)
    swap_mb=$(_swap_used_mb)

    echo "[mem-precheck] ${elapsed}s elapsed — free: ${free_mb} MB, swap: ${swap_mb} MB" >&2

    # Swap may have crossed the line while waiting.
    if [ "$swap_mb" -ge "$THRESHOLD_SWAP" ]; then
      echo "[mem-precheck] swap pressure worsened during wait." >&2
      _hard_block "$free_mb" "$swap_mb"
    fi

    if [ "$free_mb" -ge "$THRESHOLD_GO" ]; then
      echo "[mem-precheck] pressure cleared — proceeding." >&2
      return 0
    fi
  done

  # Still in band after timeout → hard-block
  echo "[mem-precheck] timeout after ${POLL_TIMEOUT_SECONDS}s — memory pressure did not clear." >&2
  _hard_block "$free_mb" "$swap_mb"
}

_classify_and_act

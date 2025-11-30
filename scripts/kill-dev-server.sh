#!/usr/bin/env bash
#
# Kill Stale Dev Server
#
# Kills any Next.js dev servers that might be holding the port.
# Useful when E2E tests hang due to EADDRINUSE errors.
#
# Usage:
#   ./scripts/kill-dev-server.sh
#   PORT=3100 ./scripts/kill-dev-server.sh

set -euo pipefail

# Get port from .env.local or use argument/default
if [[ -f .env.local ]]; then
  PORT=$(grep '^PORT=' .env.local | cut -d'=' -f2 || echo "3000")
else
  PORT="${PORT:-3000}"
fi

echo "🔍 Checking for processes on port ${PORT}..."

# Find processes using the port (lsof returns exit code 1 if no processes found)
PIDS=$(lsof -ti ":${PORT}" 2>/dev/null || true)

if [[ -z "$PIDS" ]]; then
  echo "✅ No processes found on port ${PORT}"
  exit 0
fi

echo "⚠️  Found stale process(es) on port ${PORT}:"
echo "$PIDS" | while read -r pid; do
  if [[ -n "$pid" ]]; then
    echo "   PID ${pid}: $(ps -p "${pid}" -o comm= || echo 'unknown')"
  fi
done

echo ""
read -p "Kill these processes? [y/N] " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "$PIDS" | while read -r pid; do
    if [[ -n "$pid" ]]; then
      echo "   Killing PID ${pid}..."
      kill "${pid}" 2>/dev/null || true
    fi
  done
  echo "✅ Processes killed"
  echo "⏳ Waiting for ports to be released..."
  sleep 2
  echo "✅ Done"
else
  echo "❌ Aborted"
  exit 1
fi

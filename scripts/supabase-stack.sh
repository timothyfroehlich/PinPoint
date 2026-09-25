#!/bin/bash
set -euo pipefail

# Start, stop, or inspect this worktree's Supabase stack, on whichever backend
# .env.local selects (PINPOINT_SUPABASE_BACKEND, written by worktree_setup.py):
#
#   local   this machine's Docker, services on localhost (the default)
#   remote  another host's Docker, reached with DOCKER_HOST, services published
#           on that host's tailnet address. See docs/runbooks/remote-supabase.md.
#
# Remote settings come from the shell, never from .env.local:
#   PINPOINT_REMOTE_DOCKER_HOST      Docker endpoint, e.g. ssh://bazzite
#   PINPOINT_REMOTE_SUPABASE_HOST    hostname the services answer on, e.g. bazzite
#   PINPOINT_REMOTE_SUPABASE_NETWORK Docker network (default pinpoint-dev-tailnet)
#
# DOCKER_HOST is set only for this script's own supabase/docker children; the
# global Docker context is never changed.

usage() {
  cat >&2 <<'EOF'
Usage: bash scripts/supabase-stack.sh <command>

  start            start the stack (creates it on first run)
  stop [--no-backup]
                   stop the stack; --no-backup also deletes its data volumes
  restart          stop, then start (data kept)
  status           backend, URLs, health, and containers
  use local|remote stop the current stack (data kept) and switch this worktree
EOF
  exit 2
}

fail() {
  echo "supabase-stack: $1" >&2
  exit 1
}

[[ $# -ge 1 ]] || usage
command=$1
shift

repo_root=$(git rev-parse --show-toplevel) || fail "not inside a Git checkout"
cd "$repo_root"
[[ -f .env.local && -f supabase/config.toml ]] ||
  fail "no generated .env.local / supabase/config.toml here; run it from a PinPoint worktree"

env_value() {
  sed -n "s/^$1=//p" .env.local | tail -n 1
}

project_id=$(sed -n 's/^project_id = "\([^"]*\)"$/\1/p' supabase/config.toml | head -n 1)
[[ -n $project_id ]] || fail "supabase/config.toml has no project_id"
# Crabbox runner stacks live on the same remote daemon and are leased by
# Crabbox alone (see the dotfiles crabbox skill).
[[ $project_id != pinpoint-runner-crabbox* ]] ||
  fail "refusing to manage Crabbox runner project $project_id"

backend=$(env_value PINPOINT_SUPABASE_BACKEND)
backend=${backend:-local}
api_url=$(env_value NEXT_PUBLIC_SUPABASE_URL)
network=${PINPOINT_REMOTE_SUPABASE_NETWORK:-pinpoint-dev-tailnet}

# Prepare the environment for supabase/docker children of this backend.
select_backend() {
  case $1 in
    local)
      supabase_args=()
      ;;
    remote)
      [[ -n ${PINPOINT_REMOTE_DOCKER_HOST:-} && -n ${PINPOINT_REMOTE_SUPABASE_HOST:-} ]] ||
        fail "remote backend needs PINPOINT_REMOTE_DOCKER_HOST and PINPOINT_REMOTE_SUPABASE_HOST in the shell"
      export DOCKER_HOST=$PINPOINT_REMOTE_DOCKER_HOST
      export SUPABASE_SERVICES_HOSTNAME=$PINPOINT_REMOTE_SUPABASE_HOST
      unset DOCKER_CONTEXT
      supabase_args=(--network-id "$network")
      ;;
    *) fail "unknown backend '$1' in .env.local" ;;
  esac
}

# The remote network must publish ports on a routable, non-wildcard address:
# 0.0.0.0 would expose the database to the remote host's LAN, and loopback
# (Crabbox's runner networks) is unreachable from here.
check_remote_network() {
  local binding
  docker info --format '{{.ServerVersion}}' >/dev/null 2>&1 ||
    fail "cannot reach the remote Docker daemon at $DOCKER_HOST"
  binding=$(docker network inspect "$network" \
    --format '{{index .Options "com.docker.network.bridge.host_binding_ipv4"}}' 2>/dev/null) ||
    fail "remote Docker network $network is missing (see docs/runbooks/remote-supabase.md)"
  case $binding in
    "" | 0.0.0.0 | 127.* | "<no value>")
      fail "remote Docker network $network publishes on '${binding:-all addresses}'; it must bind the tailnet address"
      ;;
  esac
}

stack_start() {
  select_backend "$backend"
  [[ $backend == local ]] || check_remote_network
  echo "Starting $backend Supabase stack $project_id..."
  # ${a[@]+...}: macOS bash 3.2 treats an empty array as unbound under set -u.
  supabase start ${supabase_args[@]+"${supabase_args[@]}"} >/dev/null ||
    fail "supabase start failed; re-run 'supabase start' with the same environment for details"
  echo "Supabase is running at $api_url."
}

stack_stop() {
  select_backend "$1"
  shift
  supabase stop --project-id "$project_id" "$@"
}

stack_status() {
  select_backend "$backend"
  echo "backend:  $backend${DOCKER_HOST:+ (DOCKER_HOST=$DOCKER_HOST)}"
  echo "project:  $project_id"
  echo "api:      $api_url"
  if curl -fsS --max-time 10 "$api_url/auth/v1/health" >/dev/null 2>&1; then
    echo "health:   ok"
  else
    echo "health:   not responding"
  fi
  if ! containers=$(docker ps -a --filter "label=com.supabase.cli.project=$project_id" \
    --format '{{.Names}}  {{.Status}}' 2>/dev/null); then
    containers="(Docker daemon unreachable)"
  fi
  while IFS= read -r line; do
    echo "          $line"
  done <<<"${containers:-(no containers)}"
}

case $command in
  start) stack_start ;;
  stop) stack_stop "$backend" "$@" ;;
  restart)
    stack_stop "$backend"
    stack_start
    ;;
  status) stack_status ;;
  use)
    [[ $# -eq 1 ]] || usage
    target=$1
    [[ $target == local || $target == remote ]] || usage
    if [[ $target == "$backend" ]]; then
      echo "Already using the $backend backend."
      exit 0
    fi
    # worktree_setup.py leaves the main worktree's .env.local alone, so a
    # switch there would stop the stack and then change nothing.
    [[ $(git rev-parse --path-format=absolute --git-dir) != "$(git rev-parse --path-format=absolute --git-common-dir)" ]] ||
      fail "the main worktree always uses the local backend; switch backends in an additional worktree"
    # Validate the target's settings before touching the running stack.
    (select_backend "$target")
    stack_stop "$backend" || echo "supabase-stack: no running $backend stack to stop" >&2
    PINPOINT_SET_SUPABASE_BACKEND=$target python3 scripts/worktree_setup.py ||
      echo "supabase-stack: worktree_setup.py reported an incomplete setup" >&2
    [[ $(env_value PINPOINT_SUPABASE_BACKEND) == "$target" ]] ||
      fail "backend switch did not take effect; .env.local still selects '$(env_value PINPOINT_SUPABASE_BACKEND)'"
    echo "Switched to the $target backend. Data does not move between backends:"
    echo "run 'pnpm supabase:start' (and 'pnpm db:reset' for a new stack), then restart 'pnpm dev'."
    ;;
  *) usage ;;
esac

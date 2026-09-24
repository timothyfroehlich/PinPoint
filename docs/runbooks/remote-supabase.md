# Remote Supabase backend

A worktree's Supabase stack can run on another machine's Docker while the
repository, Next.js, the Supabase CLI, and the browser stay on this machine.
On Tim's Mac that machine is Bazzite, reached over Tailscale. Each worktree
keeps its own slot, ports, and `project_id`; only the Docker daemon and the
hostname in `.env.local` change.

## How it fits together

- **Backend choice.** `.env.local` carries `PINPOINT_SUPABASE_BACKEND=local|remote`,
  written by `scripts/worktree_setup.py` and kept across branch switches. A new
  worktree takes the shell's `PINPOINT_SUPABASE_BACKEND` as its default (Tim's
  Mac dotfiles set `remote`); without it, `local`.
- **URLs.** In remote mode `NEXT_PUBLIC_SUPABASE_URL`, `POSTGRES_URL*`, and
  `MAILPIT_HOST` use `PINPOINT_REMOTE_SUPABASE_HOST` (for example `bazzite`).
  `NEXT_PUBLIC_SITE_URL`, cookies, and the auth `site_url` stay on
  `localhost:<next port>`, because the browser and Next.js stay here.
- **Docker transport.** `scripts/supabase-stack.sh` sets
  `DOCKER_HOST=$PINPOINT_REMOTE_DOCKER_HOST` (for example `ssh://bazzite`) and
  `SUPABASE_SERVICES_HOSTNAME` only for its own `supabase`/`docker` children,
  and starts the stack with `--network-id $PINPOINT_REMOTE_SUPABASE_NETWORK`
  (default `pinpoint-dev-tailnet`). The global Docker context is untouched.
- **Exposure.** The remote network is created with
  `com.docker.network.bridge.host_binding_ipv4=<the host's tailnet IP>`, so
  every published port listens on the tailnet address only. The script refuses
  a network that binds all addresses or loopback.
- **Destructive-script guards.** `scripts/assert-local-db.mjs` accepts
  loopback plus the hosts in `PINPOINT_DEV_DB_HOSTS`, so `db:reset`, the seeds,
  and E2E global setup work against the remote stack. Managed cloud hosts are
  refused even when listed.

## Commands

```sh
pnpm supabase:start          # start (first run creates the stack)
pnpm supabase:status         # backend, API URL, health, containers
pnpm supabase:stop           # stop; data kept
pnpm run db:reset            # restart + drop + migrate + full seed, either backend
pnpm supabase:use local      # stop this stack (data kept), switch the worktree
pnpm supabase:use remote
```

Data does not move between backends. After `use`, start the new backend's
stack, run `pnpm run db:reset` if it is new, and restart `pnpm dev` so it reads
the rewritten `.env.local`.

Call `supabase` directly only with the same environment the script sets; a
bare `supabase start` or `supabase db reset` targets this machine's Docker.

## Latency and when to switch to local

Every query crosses the network. On the home LAN a remote stack feels local.
Over slower links, measured 2026-09-23 against Bazzite:

| Link          | Round trip         | Postgres connect | Page load (cold / warm) |
| ------------- | ------------------ | ---------------- | ----------------------- |
| Phone hotspot | ~170 ms            | —                | ~1.8 s warm             |
| Plane Wi-Fi   | ~850 ms, ~30% loss | 3–8 s            | 9.6 s / 2 s (dashboard) |

Readiness probes (`ensure-supabase.sh`, `dev-status.sh`, preflight readiness)
allow for links like the plane's. When a session needs tight interactive
latency, `pnpm supabase:use local` and work against a Mac-local stack; switch
back afterwards.

## Teardown

`python3 scripts/worktree_cleanup.py <worktree>` stops a remote worktree's
stack and removes its volumes on the remote daemon. It needs
`PINPOINT_REMOTE_DOCKER_HOST` in the environment; without it the script keeps
the worktree and slot and exits non-zero rather than strand the remote stack.

Every remote resource carries the `com.supabase.cli.project` label. Containers
also carry `com.supabase.cli.workdir` (the worktree path); volumes do not.

`python3 scripts/worktree_orphan_sweep.py` covers the remote daemon too when
`PINPOINT_REMOTE_DOCKER_HOST` is set. It only considers projects whose
container workdir is a path on this machine, skipping Crabbox runner projects
and the remote host's own paths. A project whose workdir is gone and whose
`project_id` has no live worktree is an orphan; `--apply` removes its
containers and volumes by name. An orphan slot is freed only once no remote
project still references its path, so a reused slot never collides with a
leftover stack's ports. When this machine uses the remote backend (a remote
setting in the shell, or a live worktree whose `.env.local` says `remote`) but
the remote daemon can't be queried, those slots are reported as UNKNOWN and
kept. A stopped remote stack has volumes only, so the sweep can't tell whose it
is: it lists those volumes and leaves them for a person to remove.

## Port slots and other stacks on the remote host

The remote Docker refuses a port number that is already published on that
host, even on a different address. Stacks the remote host runs outside this
machine's slot manifest (Crabbox's runner stacks on Bazzite use slots 3, 8,
and 9) must therefore be listed in `PINPOINT_RESERVED_SLOTS`, so new worktrees
skip them. An existing worktree on a reserved slot fails `supabase:start`
with "port is already allocated"; use the local backend for it or recreate the
worktree.

## One-time host setup

The host side (Docker daemon, SSH access, the tailnet-bound network) is
machine configuration outside this repository. For Bazzite it lives in Tim's
dotfiles: the `bazzite` skill's compute-offload section.

# Mac development with Bazzite-hosted Supabase

This is Tim's Mac-worktree development default. The repository, locked
Supabase CLI, migrations, seeds, Next.js, and browser remain on the Mac. Only
containers and database volumes live on Bazzite rootless Docker. The helper
forwards each worktree's generated `localhost` API, Postgres, Mailpit, and SMTP
ports over SSH; the Docker API uses a private Unix-socket forward, never TCP.
It does not change the global Docker context or touch Crabbox's projects.

## Start, inspect, stop

From the intended PinPoint worktree:

```sh
pnpm run dev:remote:start   # creates/reuses the remote stack, migrates, seeds once
pnpm run dev:remote:status  # project, slot, tunnel, containers, and failure class
pnpm run dev                # starts/reuses remote Supabase, then Next.js on the Mac
pnpm run dev:status         # checks the remote identity and local services
pnpm run dev:remote:stop    # stops only this project and its tunnel; keeps data
```

`start` verifies the generated project ID and ports, the locked CLI, Bazzite's
rootless Docker identity, its private slot lease, the dedicated network with
loopback host publishing, and the owned SSH process. It applies Drizzle migrations on every
successful start. It runs the complete development seed sequence only for a
new database; a bootstrap marker prevents later starts from wiping records.
`status` distinguishes unreachable SSH, unreachable Docker, identity mismatch,
unhealthy remote services, a missing tunnel, and a broken tunnel. A stopped or
failed tunnel does **not** select a Mac-local daemon. Re-run `start` to repair a
lost tunnel; it reconnects to the same remote volumes.

The helper's private state, runtime config, and tunnel log stay under
`.agent/tmp/remote-supabase-docker-pilot/` in the worktree. The `pilot` path
name is retained for compatibility with the two original worktrees; it does
not mean this workflow is limited to them. The remote lease is under
`/var/home/froeht/.local/state/pinpoint/remote-supabase-docker/<project_id>`.
Do not copy `.env.local` to Bazzite. Secrets are passed only to the local CLI
child process and are redacted from helper errors.

## Local option and existing data

Tim's Mac dotfiles export `PINPOINT_SUPABASE_BACKEND=remote`. Other hosts and
CI retain local behavior. For a faster interactive Mac session, explicitly
stop this worktree's remote stack, start its Mac-local stack with `supabase
start`, then use `pnpm run dev:local`. Set
`PINPOINT_SUPABASE_BACKEND=local` for any other local-only command, including
a deliberate local E2E run. Stop that local stack before returning to remote
mode because both use the same Mac localhost ports. Never stop another
session's stack merely to free ports; coordinate with its owner.

Existing Mac-local volumes are neither copied nor deleted when a remote stack
starts. Each worktree's first remote start creates a fresh database and seeds
it. If a worktree contains local-only development records that matter, migrate
them explicitly before switching; the helper does not silently merge two
stores. Destructive database commands (`db:reset`, `db:fast-reset`,
`db:reset-to-empty`, and seeding from a production dump) are local-only while
remote mode is selected. The remote helper has a one-time, narrowly scoped
bootstrap allowance for a new database. `preflight` and local E2E global setup
refuse remote mode because they reset data; use Crabbox for heavy verdicts.
Setting `CI=true` in a Mac shell does not bypass those destructive-data guards;
select `PINPOINT_SUPABASE_BACKEND=local` and a real local stack deliberately.

## Worktree teardown and recovery

`python3 scripts/worktree_cleanup.py <worktree-path>` is the normal, destructive
worktree teardown. When the worktree has remote state, it first verifies the
Mac-local volume inventory as well as the remote project, rootless Docker store,
network owner label, and lease, then stops only
that project, removes its labeled volumes and dedicated network, closes its
owned tunnel, and releases its remote slot. If Bazzite cannot be checked, the
worktree and Mac slot remain in place with a non-zero result. An unavailable
Mac Docker daemon also blocks remote teardown until it can account for older
local volumes belonging to the same worktree. `dev:remote:stop` is non-destructive;
it is the everyday way to pause resources without deleting data.

The automatic `worktree_orphan_sweep.py` covers Mac-local Docker only. It is
not evidence that a manually deleted remote worktree has no Bazzite volumes.
Do not bypass `worktree_cleanup.py`; if a remote worktree was already removed
outside it, inspect the Bazzite lease and project labels before manual
recovery rather than running broad Docker cleanup.

## Pilot evidence and limits

The original worktree used remote slot 13; the Machine View worktree used slot 15. Both reached the Mac browser through localhost tunnels, and the original
database retained its sentinel record after both tunnel and stack restarts.
The effective Docker publish bindings were `127.0.0.1` on Bazzite. The Mac's
tailnet connection to a loopback-published probe was refused; same-LAN access
was not conclusively measured while Tim was travelling. Across the hotspot,
the observed tailnet RTT averaged 173 ms and warmed machine-page HTTP
responses were around 1.7-1.9 s, so opt into local when tight interactive
latency matters. Discord generated an authorization redirect, but the full
external login/callback/session was not tested; do not claim that path is
proved. See [the research and measurement record](../research/remote-supabase-existing-solutions.md).

Rootless Docker 29.8.1 is installed as a Bazzite user service with its own
socket and data store. The static Docker binaries have a manual update
obligation; this workflow does not install, upgrade, or restart that service.
Automatic SSH reconnection and migration of existing worktree data are not
part of this rollout.

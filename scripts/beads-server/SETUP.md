# Beads shared-server setup (Bazzite) — Phase B runbook

This directory holds the templates for running the PinPoint beads database as a
single live `dolt sql-server` on the always-on Bazzite host, with DoltHub demoted
to an async bridge for off-tailnet cloud sessions. It is the target architecture
of **PP-0fwz**; the repo-side, mode-aware Phase A already merged (hooks no-op
their `bd dolt push/pull` when `dolt_mode: "server"`). This document is the
manual cutover.

> **Do not run this until a quiet window** — no live huddle sessions writing beads
> on either machine (see "Preflight" below). All commands run on Bazzite over the
> `bazzite` ssh alias unless noted.

## Architecture recap

```
Mac bd ──MySQL/Tailscale──┐
                          ├──► dolt sql-server @ 100.87.228.116:3306 (Bazzite)
Bazzite bd ──MySQL────────┘        systemd --user, DB "PP", user beads+password
                                     │  bridge timer (~15 min):
                                     │  bd dolt commit → pull → push (LOUD on conflict)
                                     ▼
                                DoltHub advacar/pinpoint-beads  ◄── cloud sessions
```

- The Mac needs **no dolt binary** — it speaks the MySQL wire protocol to the server.
- `bd dolt push/pull/commit` run as SQL procedures on the connected server, so the
  bridge is just those commands on a timer, run on Bazzite where the DoltHub JWK
  creds already live.
- Rollback at any point = flip `metadata.json` back to `embedded` on both machines
  (keep the old `embeddeddolt/` data dir until burn-in is done).

## Files in this directory (all TEMPLATES — edit paths before installing)

| File                           | Installs to                                           | Purpose                                          |
| ------------------------------ | ----------------------------------------------------- | ------------------------------------------------ |
| `server.yaml`                  | `~/.beads-server/server.yaml`                         | dolt sql-server config (bind IP, port, data_dir) |
| `dolt-sql-server.service`      | `~/.config/systemd/user/dolt-sql-server.service`      | runs the server headless                         |
| `beads-dolthub-bridge.sh`      | `~/.beads-server/beads-dolthub-bridge.sh`             | one commit/pull/push cycle (loud on conflict)    |
| `beads-dolthub-bridge.service` | `~/.config/systemd/user/beads-dolthub-bridge.service` | oneshot wrapper for the bridge script            |
| `beads-dolthub-bridge.timer`   | `~/.config/systemd/user/beads-dolthub-bridge.timer`   | fires the bridge every ~15 min                   |

> **chmod note (Claude Code sandbox):** the executable bit cannot be set from an
> agent session. After copying `beads-dolthub-bridge.sh` into place, **Tim must
> run** `chmod +x ~/.beads-server/beads-dolthub-bridge.sh` manually. The unit
> invokes it via `bash …/beads-dolthub-bridge.sh`, so the exec bit is belt-and-
> suspenders, but set it anyway.

## Preflight (BLOCKER-GRADE — do not skip)

1. `bd export` a JSONL snapshot on **both** machines; confirm `.beads/backup/` is
   fresh. Record the issue count and `dolt` HEAD hash on Mac, Bazzite, and DoltHub.
2. **Worktree drain.** Enumerate `git worktree list` on both machines and remove or
   rebuild any worktree whose checked-out tree predates the Phase A merge. Rationale:
   pre-Phase-A `huddle_sync` fires an unconditional `bd dolt push`+`pull` every ~180s;
   once `metadata.json` says `server`, those old copies would run real DoltHub
   pull/pushes against the live shared DB, mutating both machines' sessions at once.
   Only trees carrying the Phase A hook code (which no-op sync in server mode) may
   remain connected during cutover.
3. Final convergence: run push/pull rounds from Mac and Bazzite until all three
   (Mac, Bazzite, DoltHub) match on issue count + HEAD. This is the data-loss-risk
   step — verify, do not assume.

## Cutover steps

### 1. Install dolt on Bazzite

Bazzite is immutable Fedora Atomic; use Homebrew (linuxbrew):

```bash
brew install dolt
which dolt   # expect /home/linuxbrew/.linuxbrew/bin/dolt
```

The systemd `--user` units hardcode `/home/linuxbrew/.linuxbrew/bin` on `PATH`
because `--user` units do **not** inherit an interactive shell's PATH (same gotcha
as `claude-rc.service`).

### 2. Seed the data dir from DoltHub

```bash
mkdir -p ~/.beads-server && cd ~/.beads-server
dolt clone https://doltremoteapi.dolthub.com/advacar/pinpoint-beads PP
# → ~/.beads-server/dolt/PP with its `origin` remote already registered
```

Point `data_dir` in `server.yaml` at `~/.beads-server/dolt` (the parent that
contains the `PP` database directory).

### 3. First boot (localhost) to create the `beads` user

Boot once WITHOUT `--skip-root-user-initialization` so the passwordless root can
create the app user, bound to loopback only. (We use `127.0.0.1` rather than the
project-wide `localhost` convention on purpose here: this is a raw MySQL-protocol
admin connection to a TCP-listening server, and `127.0.0.1` forces TCP —
`localhost` can select a UNIX socket for MySQL clients. CORE-SEC-008's
`localhost`-only rule is about Supabase SSR cookie isolation, which doesn't apply
to a DB admin connection.)

```bash
cd ~/.beads-server/dolt
dolt sql-server --host 127.0.0.1 --port 3306 &
dolt sql --host 127.0.0.1 --port 3306 --user root --query \
  "CREATE USER 'beads'@'%' IDENTIFIED BY '<PASSWORD>'; GRANT ALL PRIVILEGES ON PP.* TO 'beads'@'%'; FLUSH PRIVILEGES;"
# stop the throwaway localhost server (kill the backgrounded PID)
```

Pick a strong `<PASSWORD>`; it goes ONLY into env (next steps), never into any
committed file.

### 4. Restart hardened via the unit

Copy the templates into place, edit paths, then:

```bash
cp server.yaml ~/.beads-server/server.yaml            # edit data_dir/privilege_file/host
cp beads-dolthub-bridge.sh ~/.beads-server/            # then: chmod +x (Tim, manual)
cp dolt-sql-server.service beads-dolthub-bridge.service beads-dolthub-bridge.timer \
   ~/.config/systemd/user/
loginctl enable-linger "$USER"     # already on for Tim; idempotent
systemctl --user daemon-reload
systemctl --user enable --now dolt-sql-server.service
```

`server.yaml` binds `100.87.228.116:3306` and the unit adds
`--skip-root-user-initialization`, so the hardened server never re-mints a
passwordless root. `privilege_file` persists the `beads` grant across restarts.

### 5. Repoint both machines to server mode

Per machine, edit `.beads/metadata.json` (gitignored, per-machine):

```json
{
  "database": "dolt",
  "backend": "dolt",
  "dolt_mode": "server",
  "dolt_server_host": "100.87.228.116",
  "dolt_server_port": 3306,
  "dolt_server_user": "beads",
  "dolt_database": "PP"
}
```

And in `.beads/config.yaml` set `dolt.auto-start: false` and pin
`dolt.auto-commit: on` (bd's default is OFF; the bridge chain assumes committed
working sets before it pulls — the server-side `server.yaml` also sets
`autocommit: true`).

Export `BEADS_DOLT_PASSWORD` (env only):

- **Mac:** dotfiles-managed `~/.zshenv` (private, not committed).
- **Bazzite:** interactive shell env **and** the bridge unit's `EnvironmentFile`
  at `~/.beads-server/bridge.env` (mode 600, outside git), e.g.
  `BEADS_DOLT_PASSWORD=<PASSWORD>`.

Verify on both machines:

```bash
bd doctor --server     # confirms the client is talking to the shared server, not embedded
bd show PP-0fwz        # a real read over the wire
```

`bd doctor --server` is the drift check — trust it over hand-parsing
`metadata.json` for anything beyond the mode string.

### 6. Register the DoltHub remote + enable the bridge

The cloned data dir arrives with `origin` set, but confirm from the server SQL:

```bash
bd dolt remote list          # expect advacar/pinpoint-beads; re-add if missing
chmod +x ~/.beads-server/beads-dolthub-bridge.sh   # Tim, manual (sandbox blocks chmod)
systemctl --user enable --now beads-dolthub-bridge.timer
journalctl --user -u beads-dolthub-bridge -f       # watch one full cycle land
```

### 7. Keep the rollback asset

Rename the old embedded data dir on both machines (do NOT delete until burn-in ≈ 1
week is clean):

```bash
mv .beads/embeddeddolt .beads/embeddeddolt.pre-server
```

## Bridge failure semantics (by design)

The bridge is deliberately **loud**, unlike the fail-open huddle hooks:

- Any step failing → `beads-dolthub-bridge.sh` exits nonzero → the oneshot unit is
  marked `failed`. Inspect `journalctl --user -u beads-dolthub-bridge`.
- On a **pull conflict** the script runs `CALL DOLT_MERGE('--abort')` against the
  live server FIRST — so neither machine is left reading/writing a conflicted
  working set — then exits nonzero and stops. A human resolves the DoltHub
  divergence, then `systemctl --user restart beads-dolthub-bridge.timer`.
- There is intentionally **no `|| true`** anywhere in the bridge (contrast PP-0b7p):
  silent bridge failure would let DoltHub and the live server drift apart unnoticed.

## Rollback

Flip `dolt_mode` back to `embedded` in `.beads/metadata.json` on the affected
machine and restore `dolt.auto-start: true`. The hooks immediately resume embedded
`bd dolt push/pull` (Phase A gating keys off the mode string). The
`embeddeddolt.pre-server` dir is the pre-cutover data floor if the server data is
suspect.

## Cloud re-bootstrap caveat

`scripts/agent-bootstrap.sh` is intentionally untouched: cloud Claude sessions can't
reach the tailnet, so they stay embedded + raw `dolt fetch/reset` against DoltHub
(the bridge-maintained remote). See `docs/runbooks/cloud-routines-beads-access.md`.
**Sharp edge:** `dolt reset --hard` during a cloud re-bootstrap discards any
unpushed cloud writes — always let the bridge (or a manual `bd dolt push`) land
cloud work before re-bootstrapping a cloud clone.

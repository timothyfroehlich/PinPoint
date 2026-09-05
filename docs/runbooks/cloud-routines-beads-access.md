# Cloud Routines: beads (DoltHub) read/write access

## Overview

PinPoint's scheduled Claude cloud routines (CCR — "routines" at
`claude.ai/code/routines`) run in ephemeral Ubuntu sandboxes with a fresh git
checkout. To let them record findings as **beads** (instead of only GitHub
issues/PRs), they must reach the beads database — a DoltHub-hosted Dolt DB
(`advacar/pinpoint-beads`) which is **not in git** (`.beads/` is gitignored, so
the cloud checkout has no beads data).

This runbook documents the cloud **environment** configuration that grants a
routine full read + write to that DB. Proven end-to-end on 2026-07-11 (PP-3x7s).

**Model:** hybrid — routines run unattended and may write beads; a local
"chores" session reviews and acts on them. Dolt merges independent rows and
tables, but it does not semantically merge two edits to the same issue row.
Concurrent cloud and live-server updates to one issue can therefore stop the
bridge with a conflict even when both edits are legitimate. The bridge fails
closed so an operator can preserve the intended fields from both sides; never
resolve these conflicts with a blanket newest-row, `--ours`, or `--theirs`
policy. The beads remote-migrate gate remains the schema-version backstop.

## The three things that make it work

A cloud routine touching beads needs all three. The first two are the silent
failure modes that defeat a naive attempt:

1. **Egress allowlist** — DoltHub's clone/push protocol redirects the actual
   data-blob transfer to a CloudFront CDN (reads) and S3 (writes). Those hosts
   are blocked by default, so `bd`'s DoltHub API auth succeeds but the blob
   fetch 403s. Both backend host families must be allowlisted.
2. **Credentials are materialized by the agent, not the setup script** —
   environment variables are **not** visible to the setup script
   ([Claude Code #63541](https://github.com/anthropics/claude-code/issues/63541));
   they only exist at agent runtime. So the setup script installs binaries; the
   agent writes the DoltHub credential.
3. **`bd` + `dolt` installed** in the sandbox (neither is preinstalled; `brew`
   is absent on the image).

## Environment configuration (`claude.ai/customize/environments`)

### Network access — Custom allowlist

The Custom base policy is minimal (anthropic.com + package registries + RFC1918
only). Add:

| Host                                   | Why                                                  |
| -------------------------------------- | ---------------------------------------------------- |
| `github.com`                           | download the exact pinned `bd`/`dolt` release assets |
| `release-assets.githubusercontent.com` | GitHub release-asset CDN (the binary blobs)          |
| `doltremoteapi.dolthub.com`            | DoltHub API — credential auth, signed-URL issuance   |
| `*.cloudfront.net`                     | DoltHub **clone/read** — CDN blob fetch              |
| `*.s3.amazonaws.com`                   | DoltHub **push/write** — S3 blob upload              |

If a push 403s, DoltHub may be using region-scoped upload hosts — widen to
`*.s3.<region>.amazonaws.com` (confirm the exact host from the proxy status log,
see Reproducing / debugging). Avoid the broad `*.amazonaws.com`.

Do **not** rely on `api.github.com` — it is rate-limited on shared cloud egress
IPs (returns 403) and may not be allowlisted. The setup script pins the `bd`
version and downloads the release asset from `github.com` directly (no API call,
no redirect resolution needed — see setup script).

### Environment variables

Values live in the claude.ai UI (never commit them). Names:

| Var                 | Contents                                                             |
| ------------------- | -------------------------------------------------------------------- |
| `DOLT_CREDS_JWK`    | the dedicated cloud DoltHub credential's private JWK (one-line JSON) |
| `DOLT_CREDS_PUB`    | the local **file-stem handle** for that cred (see credential note)   |
| `BEADS_SYNC_REMOTE` | `https://doltremoteapi.dolthub.com/advacar/pinpoint-beads`           |

Reminder: these are invisible to the setup script (#63541) — the agent consumes
them.

### Setup script (installs binaries; a checked-in shim)

The setup script's body lives in the repo at `scripts/beads-cloud-setup.sh`, so
it is reviewable and diffable. The claude.ai UI "Setup script" field holds only a
one-line shim that calls it — the repo is already cloned at container-provision
time, so the shim just locates the checkout and runs the script:

```bash
bash "$(ls -d ~/PinPoint /home/*/PinPoint /root/PinPoint 2>/dev/null | head -1)/scripts/beads-cloud-setup.sh"
```

**Why the locator, not a plain `~/PinPoint`** (verified 2026-08-17): the setup
script runs as `root` with `$HOME=/root`, but the checkout is at
`/home/user/PinPoint` and the setup cwd is `/home/user`. So `~/PinPoint` resolves
to `/root/PinPoint` and misses the checkout entirely — the plain form was tried
first and failed. The `ls -d … | head -1` form finds the checkout regardless of
whether `$HOME` is `/root` or the sandbox user's home, and regardless of the
sandbox username. It fails loud (setup errors) if none of the candidates exist.

That script installs `dolt` (pinned) and `bd` (pinned); the agent then runs
`scripts/beads-cloud-init.sh` (below) to materialize the credential and clone.

**The compatibility contract pins both `bd` and `dolt`.** The 2026-08-16
lockout was a `bd` schema migration — `bd` owns `schema_migrations` and the
additive migrations that broke it, while `dolt` is the storage engine. Pinning
both `bd` and `dolt` to exact versions in `scripts/beads-compatibility.json`
guarantees consistent schema handling, client-server wire compatibility, and
reproducibility across cloud sandboxes, Mac laptops, and Bazzite hosts.

**The toolchain pins are single-source.** `beads-cloud-setup.sh` reads both
`bd` and `dolt` versions from `scripts/beads-compatibility.json` and installs
exactly those by exact release tags — so installed binaries and runtime guards
cannot disagree, and the UI field carries no versions at all. Bumping the pins
is an edit to `scripts/beads-compatibility.json` (a weekly-chores item); the UI
shim never changes.

Why exact pins: on 2026-08-16 an accidental newer release (1.2.1) migrated the
shared DB to a schema no supported binary could read and locked every client out
for two days. An exact pin fails loud (a drifted binary makes the init script
refuse to run) rather than silent (a newer release migrating the shared DB before
anyone notices).

Caveat, now narrowed: only the one-line shim lives in the un-diffable UI — the
install logic it calls is in git. The reviewable, enforced backstop remains the
version guard in `scripts/beads-cloud-init.sh`, which refuses to touch the DB
unless both the installed `bd` and `dolt` equal their pins in
`scripts/beads-compatibility.json`.

## Credential setup (one-time)

Use a **dedicated** DoltHub credential for the cloud, not a personal machine key,
so it is independently revocable if the env var leaks.

```bash
dolt creds new          # prints a PUBLIC KEY; writes ~/.dolt/creds/<keyid>.jwk
```

- **Register the printed public key** on DoltHub (account → Settings →
  Credentials) with write access to `advacar/pinpoint-beads`. This is the actual
  access grant.
- `DOLT_CREDS_JWK` = the contents of the new `~/.dolt/creds/<keyid>.jwk`.
- `DOLT_CREDS_PUB` = the **file stem** (`<keyid>`), i.e. the filename without
  `.jwk`.

**Naming nuance:** `dolt` names cred files by an internal key-id that is
**distinct** from the printed public key. Locate the new file by modification
time: `ls -t ~/.dolt/creds/*.jwk | head -1`. The local `user.creds`/filename is
only a lookup handle — authentication binds the _private key_ to the _registered
public key_, so the handle can be any consistent value as long as the file is
named `<handle>.jwk` and `user.creds` matches it.

## Agent preamble (prepend to each beads-writing routine prompt)

The credential-materialization, version guard, and clone all live in a
checked-in script — `scripts/beads-cloud-init.sh`, present in the cloud
checkout — so a routine's preamble is one line:

```bash
bash scripts/beads-cloud-init.sh && cd ~/beads

# ... do work: bd ready / bd create / bd update ...
bd dolt push
```

The script reads `DOLT_CREDS_JWK`, `DOLT_CREDS_PUB`, and `BEADS_SYNC_REMOTE` from
the environment (agent-runtime only — see #55440 above), writes the DoltHub
credential and `~/.dolt/config_global.json`, checks `bd version` and
`dolt version` against `scripts/beads-compatibility.json`, then clones into
`~/beads`. It exits non-zero — refusing to touch the DB — on a version mismatch
or any missing env var, so a routine fails fast instead of running against a
wrong binary. The generated `user.name`/`user.email` are Dolt commit metadata
only (not authentication — the JWK handles that); override with `DOLT_USER_NAME`
/ `DOLT_USER_EMAIL` for a specific address.

After the clone (or re-sync pull), the script creates five tables the remote
never carries: `events`, `bd_events_journal`, `bd_events_seq`, `leases`, and
`wisps` are in bd's `dolt_ignore`, existing only in each machine's working set —
and bd 1.2.2 does not lazily create them in an embedded clone, so without this
step a routine's first write dies with `Error 1146: table not found: events`
(incident 2026-08-17, PP-esqi). The schemas live in
`scripts/beads-cloud-repair-tables.sql`; `dolt_ignore` keeps the created tables
out of `bd dolt push`, so the repair cannot leak them into the shared remote.
The SQL is a snapshot of the pinned bd version's schema — refresh it if a pin
bump changes those tables.

Why a script and not inline preamble prose: a prompt instruction ("stop if `bd`
isn't 1.2.2") is the weakest enforcement — a model can reason past it. A script
that exits non-zero cannot. Keeping the logic in git also makes it reviewable,
unlike the setup script in the claude.ai UI.

## Guardrails

- **Never** run `bd migrate` or set `BD_ALLOW_REMOTE_MIGRATE` from a cloud
  session. The designated migrator is Tim's machine only. If `bd` reports the DB
  needs migrating (cloud `bd` jumped ahead of the schema), **stop and report** —
  that is the safety gate working, not a bug to push through.
- `bd`'s telemetry endpoint (`gastownhall-eventsapi.com`) and `dolt`'s
  version self-check are blocked by the allowlist. Both are harmless
  (`metrics.disabled=true`); ignore their proxy-denial log lines.

## Reproducing / debugging

- **Test interactively:** `claude.ai/code` → New session → select the
  environment. Watch the setup script run; then paste the agent preamble.
- Editing the setup script forces a cache rebuild on the next session (the
  script's output layer is cached ~7 days otherwise).
- **Diagnose an egress denial** from inside a session:
  `curl "$HTTPS_PROXY/__agentproxy/status"` — it logs `connect_rejected` with the
  blocked host, distinguishing a policy denial from a DoltHub-side auth error.

## Routine inventory (trigger IDs)

`RemoteTrigger {action: "list"}` returns only the 20 most recent triggers and
**ignores the pagination cursor** — `cursor` is wired for `list_runs` and
`get_run_log` only, so `list` cannot page past the first 20. One-shot
`created_kind: "reminder"` triggers (a session telling itself to re-check a PR)
accumulate fast and bury the real routines, which is why the IDs are written
down here. Recovering one otherwise means opening `claude.ai/code/routines` in a
logged-in browser and clicking each row, since the ID appears only in the
address bar, never in the list DOM.

| Routine                           | Trigger ID                      | Cron            | Opens                              |
| --------------------------------- | ------------------------------- | --------------- | ---------------------------------- |
| Nightly Bead Session              | `trig_011UapxF7gznEG6nuXDpxctf` | `30 7 * * *`    | a PR per worked bead               |
| Biweekly Spec Conformance Audit   | `trig_01YHuiRgrSEe8krSgmjnZNrZ` | `0 10 1,15 * *` | beads only, never a PR             |
| Weekly Review Agent               | `trig_01Dp3rMq8LevE4P9gQ1mFSj4` | `0 10 * * 6`    | the changelog PR, plus beads       |
| Flaky test tracker (**disabled**) | `trig_015aQdBtdaWhpSJRPcBPRMyC` | `0 9 * * 6`     | superseded by Weekly Review Part C |

Every routine that opens a GitHub PR or issue labels it `ownerless` at creation
— see AGENTS.md §5 "The `ownerless` label". The Spec Conformance Audit is
exempt because it opens neither.

## Related

- **PP-3x7s** — the enabler this runbook documents.
- **PP-nlv6** — a future weekly-chores checklist item (stale Supabase CLI pin).
- **Consolidated Weekly Review routine** (`trig_01Dp3rMq8LevE4P9gQ1mFSj4`, cron
  `0 10 * * 6`, Beads env): the three former weekly routines (Security Review,
  Changelog, Flaky Test Tracker) were merged into one session on 2026-07-12
  (PP-ld0o.6). Output is "split by risk" — security findings and the flaky-test
  report are filed as beads (`security` / `flaky-test` labels); the changelog
  still opens a PR. The former standalone Changelog and Flaky routines are
  disabled (not deleted).

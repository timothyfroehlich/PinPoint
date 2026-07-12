# Cloud routines: beads DoltHub access

Scheduled Claude cloud routines (CCR) **can read and write** the PinPoint beads
database on DoltHub (`advacar/pinpoint-beads`) — proven 2026-07-11 (PP-3x7s).
Cloud sessions cannot reach Tim's tailnet, so they never touch the shared Bazzite
`dolt sql-server` directly; instead they clone from and push to DoltHub, and the
Bazzite-side bridge (`scripts/beads-server/beads-dolthub-bridge.*`, ~15-min timer)
reconciles those cloud writes into the live server on its next cycle.

> This runbook was previously only in beads kv-memory (`bd recall
cloud-routine-beads-access`); it lives here now as the canonical record.

## Environment

- Cloud env **"PinPoint/Beads"** = `env_01KrLCUzkAXXB7sjzezRhpHe`.
- Runtime: Ubuntu 24.04, **root sandbox, no Homebrew**.

## Key facts

1. **No beads data in the checkout.** `.beads/` is gitignored, so a cloud checkout
   has zero beads data — it must clone from DoltHub.
2. **Install dolt + bd from GitHub releases, not brew.** The setup script downloads
   the latest `dolt` and `bd` from the `github.com` release redirect — **not**
   `api.github.com`, which 403s on shared cloud IPs.
3. **Egress allowlist.** DoltHub clones read via `*.cloudfront.net` and write via
   `*.s3.amazonaws.com` — both must be on the env's Custom allowlist, alongside
   `github.com`, `release-assets.githubusercontent.com`, and
   `doltremoteapi.dolthub.com`.
4. **Creds are agent-written, not env-injected.** Env vars are invisible to the
   setup script (Claude Code #63541), so the **agent** writes
   `~/.dolt/creds/<DOLT_CREDS_PUB>.jwk` + `config_global.json` from the env vars
   `DOLT_CREDS_JWK` / `DOLT_CREDS_PUB`. This is a dedicated, revocable DoltHub
   credential; `DOLT_CREDS_PUB` is the local file-stem handle, distinct from the
   registered pubkey.
5. **Clone in one step:**
   ```bash
   bd init --remote "$BEADS_SYNC_REMOTE" --prefix PP --non-interactive
   ```
6. **NEVER migrate in cloud.** Do not run `bd migrate` or set
   `BD_ALLOW_REMOTE_MIGRATE` in a cloud session. The remote-migrate refusal gate is
   the schema-drift backstop; the designated migrator is Tim's Mac only.

## Sharp edge: re-bootstrap discards unpushed cloud writes

Re-bootstrapping a cloud clone does `dolt reset --hard` against DoltHub, which
**discards any local cloud writes that were not yet pushed**. Always let a
`bd dolt push` (or the Bazzite bridge cycle) land cloud work before
re-bootstrapping a cloud clone.

## Relationship to the shared-server model (PP-0fwz)

After the Bazzite shared-server cutover, DoltHub is the async bridge + off-machine
backup rather than the primary sync path for local work. Cloud routines are the one
remaining first-class DoltHub writer. Their cadence into the live server is the
bridge timer interval (~15 min): a cloud push lands on DoltHub, and the next bridge
`pull` ingests it into the server that Mac + Bazzite read.

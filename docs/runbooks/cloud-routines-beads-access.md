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
"chores" session reviews and acts on them. Concurrent writers are acceptable:
Dolt is merge-native, and the beads remote-migrate gate is the backstop.

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

| Host                                   | Why                                                        |
| -------------------------------------- | ---------------------------------------------------------- |
| `github.com`                           | resolve latest release tag + download `bd`/`dolt` binaries |
| `release-assets.githubusercontent.com` | GitHub release-asset CDN (the binary blobs)                |
| `doltremoteapi.dolthub.com`            | DoltHub API — credential auth, signed-URL issuance         |
| `*.cloudfront.net`                     | DoltHub **clone/read** — CDN blob fetch                    |
| `*.s3.amazonaws.com`                   | DoltHub **push/write** — S3 blob upload                    |

If a push 403s, DoltHub may be using region-scoped upload hosts — widen to
`*.s3.<region>.amazonaws.com` (confirm the exact host from the proxy status log,
see Reproducing / debugging). Avoid the broad `*.amazonaws.com`.

Do **not** rely on `api.github.com` — it is rate-limited on shared cloud egress
IPs (returns 403) and may not be allowlisted. Resolve the latest version off the
`github.com` `/releases/latest` redirect instead (see setup script).

### Environment variables

Values live in the claude.ai UI (never commit them). Names:

| Var                 | Contents                                                             |
| ------------------- | -------------------------------------------------------------------- |
| `DOLT_CREDS_JWK`    | the dedicated cloud DoltHub credential's private JWK (one-line JSON) |
| `DOLT_CREDS_PUB`    | the local **file-stem handle** for that cred (see credential note)   |
| `BEADS_SYNC_REMOTE` | `https://doltremoteapi.dolthub.com/advacar/pinpoint-beads`           |

Reminder: these are invisible to the setup script (#63541) — the agent consumes
them.

### Setup script (installs binaries; unpinned)

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== ENV DISCOVERY ==="
head -3 /etc/os-release 2>/dev/null || true
echo "user=$(whoami) $(id)"
for t in sudo apt-get brew curl tar jq go; do
  printf '%s: %s\n' "$t" "$(command -v "$t" || echo MISSING)"
done

BIN=/usr/local/bin
export PATH="$BIN:$PATH"

echo "=== INSTALL DOLT (version-agnostic asset, no api.github.com) ==="
curl -fsSL -o /tmp/dolt.tgz \
  "https://github.com/dolthub/dolt/releases/latest/download/dolt-linux-amd64.tar.gz"
tar xzf /tmp/dolt.tgz -C /tmp
install /tmp/dolt-linux-amd64/bin/dolt "$BIN/dolt"

echo "=== RESOLVE BEADS LATEST TAG (via github.com redirect) ==="
BD_TAG=$(curl -fsSL -o /dev/null -w '%{url_effective}\n' \
  https://github.com/steveyegge/beads/releases/latest | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+')
BD_VER="${BD_TAG#v}"
echo "=== INSTALL BEADS ${BD_TAG} ==="
curl -fsSL -o /tmp/bd.tgz \
  "https://github.com/steveyegge/beads/releases/download/${BD_TAG}/beads_${BD_VER}_linux_amd64.tar.gz"
tar xzf /tmp/bd.tgz -C /tmp
install /tmp/bd "$BIN/bd"

echo "=== VERSIONS ==="
dolt version
if ! bd version; then
  echo "bd failed to link — installing libicu"
  apt-get update -qq && apt-get install -y libicu-dev
  bd version
fi
```

`bd` is intentionally **unpinned** (both cloud and local track latest stable).
The drift risk — cloud `bd` schema-ahead of the DB — is handled by beads'
remote-migrate gate, which refuses to auto-migrate a remote-backed DB and prints
the fix rather than corrupting anything.

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

```bash
mkdir -p ~/.dolt/creds
printf '%s' "$DOLT_CREDS_JWK" > ~/.dolt/creds/"$DOLT_CREDS_PUB".jwk
chmod 600 ~/.dolt/creds/"$DOLT_CREDS_PUB".jwk
printf '{"user.creds":"%s","user.email":"<dolthub-account-email>","user.name":"advacar"}' \
  "$DOLT_CREDS_PUB" > ~/.dolt/config_global.json

# Clone + persist sync.remote in one step (no hand-seeded .beads/config.yaml):
mkdir -p ~/beads && cd ~/beads
bd init --remote "$BEADS_SYNC_REMOTE" --prefix PP --non-interactive

# ... do work: bd ready / bd create / bd update ...
bd dolt push
```

`user.email` is Dolt commit metadata only (not used for authentication — the JWK
handles that); use your DoltHub account email or any non-personal address.

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

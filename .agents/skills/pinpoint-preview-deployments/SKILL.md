---
name: pinpoint-preview-deployments
description: On-demand, TTL'd Supabase preview branches for PinPoint PRs — the /preview PR-comment control surface, sticky status comment, and hourly reaper. Use when setting up, debugging, or explaining Vercel preview deployments or the /preview command.
---

# PinPoint Preview Deployments

Native Supabase auto-branching is **disabled** — no PR gets a preview by default (zero branches, zero cost). Previews are created on demand via PR comment commands and torn down on a TTL.

- **Control surface = PR comments** (from authors with write access only):
  - `/preview` — create (or restart after expiry) a branch, migrate + seed it, wire creds into the Vercel preview, and post a sticky status comment with the live URL + 48h expiry.
  - `/preview extend` — push expiry +48h (no DB work). `/preview stop` — tear down now.
- **State**: one sticky bot comment per PR (keyed `<!-- pinpoint-preview-status -->`) holds the `Expires:` timestamp — the TTL source of truth.
- **Reaper**: `Preview Reaper` runs hourly; deletes branches past expiry or on closed/merged PRs, and flips the sticky comment to "expired — comment `/preview` to restart."
- **Implementation** (workflows, the Vercel git-integration wiring, and required secrets): `.github/workflows/preview-control.yaml`, `preview-reaper.yaml`, `scripts/workflow/preview/*.sh`.

Vercel preview migrations: preview deployments skip `migrate:production` (branch DB user lacks `CREATE SCHEMA`). The on-demand `Preview Controller` workflow migrates + seeds the branch DB before building the preview. Production deploys still migrate.

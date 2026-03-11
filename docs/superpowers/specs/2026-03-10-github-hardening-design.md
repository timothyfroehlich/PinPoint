# GitHub Repository & Actions Hardening

**Date**: 2026-03-10
**Status**: Approved
**Bead**: PinPoint-hpma

## Problem

PinPoint is a public GitHub repo. The CI pipeline uses ~70 unpinned action
references (`@v6` floating tags), has no top-level permissions restrictions,
and lacks static security analysis of workflow files. A compromised upstream
action could exfiltrate secrets or tamper with builds.

## Design

Single PR covering six hardening layers:

### 1. Workflow Permissions Lockdown

Add `permissions: read-all` at the workflow level for `ci.yml`,
`pr-screenshots.yml`, and `cleanup-screenshots.yml`. Jobs that need write
access declare it explicitly at job level (screenshots needs `contents: write`,
`pull-requests: write`).

Delete `claude.yml` (unused, had `id-token: write`).

### 2. Action SHA Pinning

Pin all `uses:` references to full commit SHAs with version comments:
`actions/checkout@<sha> # v6`. Dependabot (already configured for
`github-actions` ecosystem) keeps pinned SHAs current via weekly PRs.

### 3. Pinact Enforcement

Add `pinact run --verify` to both CI (Fast Linters job) and local
`pnpm run check`. Any future unpinned action reference fails CI.

### 4. Zizmor Static Analysis

Add `zizmor` (Trail of Bits) to CI and `pnpm run check`. Catches script
injection, excessive permissions, unpinned actions, and artifact poisoning
patterns. Runs on all workflow files excluding `*.lock.yml` (GitHub-managed).

### 5. Harden-Runner (Audit Mode)

Add `step-security/harden-runner` as the first step in every CI job.
Starts in `egress-policy: audit` (observe, don't block). Follow-up bead
(PinPoint-oa6b) to review logs and switch to block mode after one week.

### 6. CODEOWNERS

Sensitive paths require Tim's review:

- `.github/workflows/`, `.github/dependabot.yml`, `.github/CODEOWNERS`
- `supabase/`, `drizzle/`
- `src/middleware.ts`, `src/lib/permissions/`

Everything else auto-merges on CI green.

### 7. Stale package-lock.json Cleanup

Delete `package-lock.json` (17k lines, npm lockfile in a pnpm project) and
add it to `.gitignore`. This was causing 5 false-positive Dependabot alerts
(all dismissed).

## Not Included

- Harden-runner block mode (follow-up bead PinPoint-oa6b)
- SLSA provenance attestation (overkill for current scale)
- GitHub Enterprise required workflows (not on Enterprise plan)

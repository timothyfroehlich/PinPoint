---
name: pinpoint-audit-override
description: Per-PR /audit-override escape hatch for unrelated pnpm audit failures blocking CI Gate. Use when a PR's audit job goes red on a freshly-published advisory unrelated to the PR's own changes, or when explaining/debugging the /audit-override command.
---

# PinPoint Audit-Gate Override

When `pnpm audit --audit-level=high` goes RED on a freshly-published advisory **unrelated** to a PR's changes (a transitive dev-dep CVE, or a fix that's major-bump-only), the audit job cascades into CI Gate and blocks the PR. The proper fix is still a dependency-bump PR — but `/audit-override` is the escape hatch so an unrelated repo-wide advisory doesn't force an admin-merge.

- **Control surface = PR comments** (from authors with write access only):
  - `/audit-override <reason>` — bypass the `pnpm audit` gate for the PR's **current head commit**. Records a `pinpoint-audit-override` commit status + a sticky bot comment (who/when/why) and re-runs the failed CI so the gate re-evaluates immediately.
  - `/audit-override clear` — re-arm the gate.
- **Commit-bound, not PR-bound**: the override is a commit status on the head SHA. **Pushing a new commit drops it** — the gate re-fires and the override must be re-issued, so a newly-introduced real vulnerability is never silently masked. It only bypasses the audit gate; any other failing check stays red.
- **Scope**: single PR only; never changes repo-wide audit policy or any other PR. No secrets required (default `GITHUB_TOKEN`).
- **Implementation**: `.github/workflows/audit-override.yaml`, `scripts/workflow/audit-override/*.sh`; the consuming check is the `Run pnpm audit` step in `ci.yml` (`gate.sh check`).

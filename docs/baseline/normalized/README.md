# Normalized Baseline Artifacts

These files standardize the raw baseline inventories in `../` to the exact schemas promised in `docs/tasks/wave-0/lane-a-inventory-snapshots.md`.

## Purpose
- Provide stable, automation-friendly inputs for downstream lanes (ESLint rules, codemods, metrics gating).
- Decouple raw discovery scripts from canonical schema (allows script evolution without breaking tooling).

## Current Contents
- `validation-report.json`: Latest validation findings and remediation checklist.

## Pending Artifacts
Will be generated after remediation:
- `auth-functions.normalized.json`
- `server-fetchers.normalized.json`
- `role-conditionals.normalized.json`
- `org-scoped-functions.normalized.json`
- `metrics-initial.json` (baseline metrics snapshot)

## Next Steps
1. Implement normalization script (`scripts/baseline/normalize-inventories.ts`).
2. Generate normalized JSONs & update `progress.md` with hashes.
3. Gate future changes by diffing normalized artifacts.

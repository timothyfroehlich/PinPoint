# Permission Consolidation TODO

Context: Pre-beta cleanup of issue-related permissions.

## Goal
Merge legacy issue assignment and bulk management permissions into the simplified model:

- Keep: `issue:view`, `issue:edit`, `issue:delete`, `issue:create_basic`, `issue:create_full`.
- Deprecate: `issue:assign`, `issue:bulk_manage` (will be absorbed by `issue:edit`).

## Tasks
1. Replace all runtime checks for `ISSUE_ASSIGN` with `ISSUE_EDIT` (after verifying no unintended elevation).
2. Replace all runtime checks for `ISSUE_BULK_MANAGE` with `ISSUE_EDIT` (or introduce a feature flag if finer control required later).
3. Update UI components (buttons, bulk action toolbars) to require `issue:edit`.
4. Remove deprecated constants from `permissions.constants.ts` (post-cutover) and seed references.
5. Purge deprecated permission rows from seed data (safe pre-beta; no migration needed).
6. Update tests referencing deprecated permissions.
7. Remove any dependency mapping entries for deprecated permissions.
8. Announce removal in internal changelog.

## Validation
- Run full test suite after search-replace.
- Spot-check assignment workflow and bulk update flows under a role that now only has `issue:edit`.

## Rollback Plan
Keep branch with deprecated constants for quick revert until confidence gained.

---
Tracking created: (pre-beta)

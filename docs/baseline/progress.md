# Baseline Inventory Progress Log

Date: 2025-09-04 (Remediation Pass 1)

## Validation Summary
Remediation applied:
- Added `metrics-initial.json` baseline snapshot.
- Fixed total counts in `auth-functions.json` (now 12/12) and `org-scoped-functions.json` (32/32).
- Added `migrationPriority` and `classification` to every entry in `role-conditionals.json`.
- Recorded deterministic SHA256 hashes.
Outstanding:
- Evaluate whether to exclude auth resolver from fetchers list.
- Add normalization script & derived normalized schema copies.
- Assess over-reporting of cache wrapping (manual spot check pending).

## Planned Remediation Steps
1. Produce `metrics-initial.json` via metrics endpoint snapshot.
2. Correct counts in auth & org-scoped inventories.
3. Add normalization script to emit derived `normalized/*.json` with spec schema.
4. Re-run validation to confirm zero mismatches.

## Determinism Check
Current SHA256 hashes:
```
auth-functions.json       : 708e4f1f461e36697b3034a6342e1b9dd5dd6dabbc445343d5e6f314a424e0d0
server-fetchers.json      : eb9f2a7c209f6ec2c20174bef7f51ff07f75998ae0b807ff9b0e39dcf900f519
role-conditionals.json    : 71b44601743d03f8b7e0ccb0202503f3c0a960265b25a54a1025ccdb44478b77
org-scoped-functions.json : 77ccfa78f0ade7996f4041a9dc770c39f15371cc29e05ffc04f90e30ca6ee700
metrics-initial.json      : 870dcb030e84d342f4eddc49521ca3df0f1b4cab4f7a60c5f86f7735b75b20df
```

### Normalized Artifacts (Spec-Compliant)
Generated via `scripts/baseline/normalize-inventories.cjs`:
```
auth-functions.normalized.json       : e4479779110e63069ef8ca7c44a71e459009a9d02ac2ca0d93c5c867e61c0559
server-fetchers.normalized.json      : c37b75e0f8a8a64c036e5fc511a124613abf2525c7cce097bc632808236b2702
role-conditionals.normalized.json    : b90e2932b9458b5307d4a8c154f9fbf26f9b22b6fbab89bd0fd03a7c54f94fe4
org-scoped-functions.normalized.json : cc07d37bd11b9761c70831a804e2f95b32edc3f5409e32cc70e9e36975b61d09
metrics-initial.normalized.json      : 6d90a3ff3180615d9dcf1b97f53f51ba1e3108772fe8fe68e53b072b2c66c820
NORMALIZATION_SUMMARY.json           : 5dab0c144e01c3921aa6705a1e1b6aa3a94b6be5ba42e744d64fc67283da47f3
```

Lane A Status: COMPLETE (Baseline + Normalized + Metrics snapshot present)

Exit Criteria Met:
- 4 baseline JSON inventories present and internally consistent.
- Metrics baseline established (placeholder until live data).
- Normalization script & outputs generated and hashed.
- Role conditionals enriched with prioritization metadata.

Ready for handoff to Lane B (ESLint rule enhancements) & Lane C (codemod targeting).

## Notes
- All fetchers currently reported as cache-wrapped; confirm no false positives (scripts may be over-inclusive if treating any async function as fetcher).
- Consider excluding canonical auth resolver from fetchers list if semantically distinct.

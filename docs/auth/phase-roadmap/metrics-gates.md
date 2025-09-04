# Metrics & Gates Tracking

Record actual measured values at each wave exit. Update the table opportunistically.

## Table
| Wave | Metric | Target | Actual | Date | Notes |
|------|--------|--------|--------|------|-------|
| 0 | authContextCallsPerRequest (avg) | Baseline only | | | |
| 0 | duplicateServerFetchersPerRequest | Baseline only | | | |
| 0 | roleConditionalCount | Baseline only | | | |
| 1 | fetchersUsingRequestContext (%) | >=95% | | | |
| 1 | eligibleFetchersCached (%) | >=90% | | | |
| 1 | exportedAsyncWithReturnType (%) | 100% (touched) | | | |
| 2 | roleConditionalsMigratedOrShadowed (%) | 100% | | | |
| 2 | shadowMismatchCount (final) | 0 | | | |
| 3 | duplicateQueryReduction (%) | >=70% | | | |
| 3 | orgAssertionCoverage (%) | 100% | | | |
| 3 | cacheHitRateHighTraffic (%) | >=50% | | | |
| 4 | permissionMatrixCoverage (%) | 100% | | | |
| 4 | p95LatencyImprovement (%) | >=20% | | | |
| 4 | transitionalArtifactsRemaining | 0 | | | |

## Update Procedure
1. At wave completion run measurement scripts.
2. Fill "Actual" and stamp Date.
3. Add clarifying note if target missed + remediation plan.

## Source of Truth
All measurement scripts live under `scripts/metrics/` (to be authored).

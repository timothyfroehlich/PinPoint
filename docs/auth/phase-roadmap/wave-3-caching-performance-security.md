# Wave 3 – Caching, Performance & Security Hardening

Status: PLANNED
Target Duration: 2–5 days

## Objective & Rationale
Reduce duplicate queries and reinforce multi-tenant safety via org/RLS assertions while adding micro & negative caching primitives.

## Scope
**In:** Micro-cache module, negative cache, org assertion helper injection, fetch() caching directive codemod, duplication detector, RLS assertion utilities.
**Out:** Telemetry dashboards (Wave 4), final cleanup removal of shadow code (already done in Wave 2 exit).

## Parallel Lanes
| Lane | Focus | Notes |
|------|-------|------|
| A | Micro & Negative Cache Layer | `cache/micro.ts`, `cache/negative.ts` |
| B | Security & RLS Assertions | `security/assertions.ts`, DB helper wrappers |
| C | Codemods (org assert + caching directives) | Batch apply with logs |
| D | Performance Bench & Measurement | Pre/post comparison script |

## Deliverables
- `cache/micro.ts` (in-memory request-level TTL wrappers)
- `cache/negative.ts` (miss suppression with short TTL)
- `security/assertions.ts` with `assertOrg(ctx)` & `assertMembership(ctx, role?)`
- Codemod logs for added assertions & fetch caching directives
- Performance report `docs/wave-3/perf-report.md`

## Codemods & Automation
1. Insert `assertOrg(ctx)` into functions referencing `organizationId` but lacking guard.
2. Add `cache: 'force-cache'` or explicit `no-store` to raw fetch() calls.
3. Replace local module `const cache = new Map()` patterns with micro-cache API.
4. Duplicate query detector: run scripted navigation and diff query text set size vs baseline.

## Metrics & Gates
- Duplicate query reduction vs Wave 0 baseline (target >=70%)
- Org assertion coverage for org-scoped fetchers (target 100%)
- All fetch() calls have explicit caching directive
- Cache hit rate (sample) >50% for high-traffic fetchers

Exit Gate: Metrics met; assertions universal; perf report committed.

## Risks / Mitigations
| Risk | Mitigation |
|------|------------|
| Over-caching stale data | Short TTL defaults + denylist file |
| Negative cache masking real fixes | Include logging on suppression pathway |
| Assertion false positives | Provide `isGlobalContext(ctx)` branching helper |

## Validation Steps
1. Run perf script pre/post -> confirm reduction.
2. Induce missing orgId in test path -> assertion triggers expected error.
3. Spot-check sample fetchers for explicit directive.

## Branch / Rollback
- Branch: `wave3/caching-security`
- Rollback: Revert codemod; micro-cache modules detachable.

---
Proceed to Wave 4 after perf gates satisfied.

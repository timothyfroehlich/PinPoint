# Wave 1 – Request Context & Logging Spine

Status: PLANNED
Target Duration: 2–4 days

## Objective & Rationale
Establish a unified `RequestContext` (auth + org + tracing) and structured logging/error taxonomy; eliminate scattered auth/org resolution calls and ensure fetchers are cached + typed.

## Scope
**In:** AsyncLocalStorage (or fallback) context, logger with requestId + orgId, error base classes, codemod to inject context usage & cache wrappers, explicit return type annotation.
**Out:** Permission semantics (Wave 2), micro/negative caching (Wave 3), telemetry aggregation dashboards (Wave 4).

## Parallel Lanes
| Lane | Focus | Notes |
|------|-------|-------|
| A | Context Core Module | `src/server/context/request-context.ts` + tests |
| B | Logger & Error Taxonomy | `src/server/infra/logging/*`, `errors/registry.ts` |
| C | Codemods (context + cache + return types) | Dry-run -> apply in batches |
| D | Auth Integration Cleanup | Remove direct multi-call patterns; unify imports |
| E | Docs & Non-Negotiables updates | Add references to new context rules |

## Deliverables
- `request-context.ts` with `initRequestContext`, `getRequestContext`, `withRequestContext`.
- `logger.ts` providing structured log API `log.debug/info/warn/error({ event, ...context })` embedding requestId.
- `errors/base.ts` + `errors/registry.ts` enumerating error codes.
- Codemod outputs (file mutation summaries recorded in `docs/wave-1/codemod-log.jsonl`).
- Updated NON_NEGOTIABLES linking to RequestContext requirements.

## Codemods & Automation
1. Context Injection: Replace occurrences of `await getRequestAuthContext()` & separate org calls with `const ctx = getRequestContext()`.
2. Cache Wrapper: Wrap eligible async fetchers not already cached: heuristics (pure params, no side effects, name starts with get/list/fetch).
3. Return Type Annotation: Add inferred return types to exported functions >5 LOC lacking explicit annotation.
4. Logger Adoption: Insert `import { log } from '~/server/infra/logging/logger'` when none present and function matches server fetcher pattern; first line add `log.debug({ event: 'fetch.start', fn: 'name' })` if not existing.

## Metrics & Gates
- % server fetchers using `RequestContext` (target >=95%)
- % eligible fetchers wrapped in `cache()` (target >=90%)
- % exported async functions with explicit return type (target 100% for modified files)
- Log completeness: sample 20 requests -> all have requestId & auth status fields.

Exit Gate: Targets met + docs updated + zero remaining direct multi-call auth patterns.

## Risks / Mitigations
| Risk | Mitigation |
|------|------------|
| ALS not available (edge) | Provide fallback global Map keyed by requestId header |
| Over-wrapping functions reduces dynamic behavior | Maintain allowlist/denylist file for cache codemod |
| Return type inference drift | Commit generated types; manual adjust anomalies |

## Validation Steps
1. Unit test: nested function reads identical context reference.
2. Manual request logging spot-check includes requestId + organizationId.
3. Grep for `getRequestAuthContext(` returns only in context module.

## Branch / Rollback
- Branch: `wave1/request-context`
- Rollback: Revert codemod commits; context module additive and safe.

---
Proceed to Wave 2 after exit gate satisfaction.

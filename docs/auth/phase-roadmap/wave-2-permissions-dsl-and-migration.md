# Wave 2 – Permissions DSL & Migration

Status: PLANNED
Target Duration: 3–6 days

## Objective & Rationale
Introduce a declarative permission DSL and migrate all role-based conditionals via shadow comparison to ensure zero regression.

## Scope
**In:** DSL core (`can(ctx).perform(action).on(resource)`), action & resource enums, policy registry, shadow evaluator, codemod for conditional replacement, mismatch logger, matrix tests.
**Out:** Caching changes, micro-TTL (Wave 3), telemetry rollup (Wave 4).

## Parallel Lanes
| Lane | Focus | Notes |
|------|-------|------|
| A | DSL Core Implementation | `permissions/dsl.ts`, `permissions/actions.ts`, `permissions/resources.ts` |
| B | Codemod Role Conditionals | Replace & insert shadow assertions |
| C | Policy Registry & Tests | Table-driven policies + unit tests |
| D | Resource Adapters | Wrap issue/project operations with DSL enforcement |
| E | Shadow Monitor & Logs | Write mismatches -> JSONL, dashboard summary |

## Deliverables
- DSL modules & exported `can()` function.
- `permissions/actions.ts` enumerating actions.
- `permissions/policies.ts` with registry map.
- Codemod migration log.
- Shadow mismatch logs (should converge to empty).
- Permission matrix test harness generating report.

## Codemods & Automation
Patterns to replace:
1. `if (user.role === 'admin' || user.role === 'owner')` -> DSL check + shadow compare.
2. Switch statements on role -> resource action mapping.
3. Inline membership gating -> `requireOrgMember(ctx)` helper + DSL.

Shadow Snippet Example:
```ts
const legacy = /* boolean expression */
const decision = can(ctx).perform('issue.update').on(issue)
assertSameDecision('ISSUE_UPDATE', legacy, decision)
```

## Metrics & Gates
- % of legacy conditionals replaced or shadowed (target 100%)
- Shadow mismatch count over last 50 requests = 0
- Matrix coverage: every (role x core action) combination tested

Exit Gate: All conditionals migrated; mismatch log stable at zero; ESLint rule banning raw role conditionals active.

## Risks / Mitigations
| Risk | Mitigation |
|------|------------|
| Logical drift in translation | Shadow mode until mismatch=0 for 2 consecutive runs |
| Explosion of action names | Central enum review PR before codemod wide apply |
| Performance overhead | Single evaluation path + simple map lookup |

## Validation Steps
1. Run matrix tests – ensure deterministic decisions.
2. Force an intentional mismatch in temp branch -> verify detection.
3. Grep ensures absence of raw role conditional patterns.

## Branch / Rollback
- Branch: `wave2/permissions-dsl`
- Rollback: Revert codemod commit; DSL additive.

---
Proceed to Wave 3 after zero mismatches and ban rule merged.

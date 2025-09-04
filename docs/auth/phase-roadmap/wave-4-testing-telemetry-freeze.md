# Wave 4 – Testing, Telemetry & Freeze

Status: PLANNED
Target Duration: 2–4 days

## Objective & Rationale
Achieve full permission & scenario coverage, establish telemetry (latency, decisions, cache metrics), remove transitional artifacts, and freeze architecture.

## Scope
**In:** Permission/action matrix tests, scenario E2E flows, telemetry emitters, cleanup codemods (remove shadow scaffolds, legacy comments), final ESLint rule set, freeze doc.
**Out:** New feature development outside scope; schema changes (explicitly excluded).

## Parallel Lanes
| Lane | Focus | Notes |
|------|-------|------|
| A | Matrix & Scenario Tests | Harness + coverage report |
| B | Telemetry Emitters & Aggregation | `telemetry/emit.ts`, `telemetry/sink.ts` |
| C | Cleanup Codemods | Remove deprecated helpers/comments |
| D | Documentation & Freeze | `architecture-freeze.md` + Non‑Negotiables sync |
| E | ESLint Finalization | Enforce permanent bans |

## Deliverables
- Permission matrix report `docs/wave-4/permission-matrix.md`
- Scenario test suite additions
- Telemetry modules with pluggable sink (console + JSON)
- Cleanup codemod logs
- `docs/architecture-freeze.md` summarizing final state

## Codemods & Automation
1. Remove `assertSameDecision` (should be gone from Wave 2 cleanup; verify none).
2. Delete deprecated comments `// TODO PERMISSIONS` etc.
3. Enforce import boundary rule: no `~/server/**` from client components.
4. Generate matrix table from test harness automatically in CI.

## Metrics & Gates
- Permission matrix 100% (role x action) coverage
- p95 latency improvement vs Wave 0 (target >=20%)
- Zero transitional artifacts found by cleanup grep script
- ESLint passes with final strict profile

Exit Gate: All gates green + freeze doc merged + tag `auth-freeze-v1` created.

## Risks / Mitigations
| Risk | Mitigation |
|------|------------|
| Flaky scenario tests | Use deterministic seed data snapshot |
| Telemetry noise volume | Sample low-frequency metrics; aggregate counters |
| Over-restrictive ESLint blocks future patterns | Provide documented escape hatch comment pragma |

## Validation Steps
1. Run coverage script -> verify 100% action coverage.
2. Spot-check telemetry JSON contains latency + decision counts.
3. Attempt to reintroduce banned import -> lint error.

## Branch / Rollback
- Branch: `wave4/testing-telemetry-freeze`
- Rollback: Revert codemod commits; telemetry additive.

---
Architecture considered frozen after Wave 4 tag.

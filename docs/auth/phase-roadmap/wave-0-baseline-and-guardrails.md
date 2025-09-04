# Wave 0 – Baseline & Guard Rails

Status: PLANNED
Target Duration: 1–2 days

## Objective & Rationale
Create an immutable baseline (inventories + metrics) and erect enforcement so subsequent high‑volume codemods are safe, measurable, and reversible.

## Scope
**In:** Inventories (fetchers, role checks, org usage), ESLint guard expansions, codemod harness, baseline metrics capture, snapshot docs.
**Out:** Implementing request context (Wave 1), permissions logic changes (Wave 2), caching layers (Wave 3).

## Parallel Lanes
| Lane | Focus | Deliverer | Notes |
|------|-------|----------|-------|
| A | Inventory & Snapshots | Agent 1 | Gather lists -> JSON under `docs/baseline/` |
| B | Enforcement (ESLint/CI) | Agent 2 | Add/verify rules for deprecated imports, deep relative paths, missing cache(), duplicate auth patterns |
| C | Codemod Harness | Agent 3 | `scripts/codemods` structure + dry-run engine |
| D | Metrics Baseline | Agent 4 | Script to hit core routes -> record auth resolver calls, duplicate queries (if instrumentation present) |

## Deliverables
- `docs/baseline/fetchers.json`
- `docs/baseline/role-conditionals.json`
- `docs/baseline/org-scoped-functions.json`
- `docs/baseline/metrics-initial.json`
- ESLint rule additions (see below)
- Codemod runner script + sample transform placeholders.

## Codemods & Automation Plan
Initial harness only (no transformations applied):
1. Build TypeScript AST utilities using `ts-morph` wrappers.
2. Provide example dry-run listing which functions WOULD be wrapped in `cache()` later.
3. Provide pattern scanners (regex + AST) outputting JSON inventories.

## ESLint / Static Rules (Additions)
- Ban deep relative imports beyond one `../` (encourage `~/`).
- Ban direct `createClient` Supabase usage outside sanctioned wrapper.
- Ban new definitions of `getRequestAuthContext` (enforce singleton resolver).
- Warn when exported async server function lacks explicit return type (CORE-TS-006).

## Metrics & Gates
Record before any mutation:
- `authContextCallsPerRequest` (average over N=10 mixed routes)
- Count of duplicate server fetcher names invoked per request (if measurable)
- Total number of role conditionals.

Exit Gate: All baseline JSON files present + codemod harness merged + ESLint rules active (no TODO placeholders) + metrics snapshot committed.

## Risks / Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Inventory misses hidden dynamic imports | Incomplete scope | Grep + AST hybrid + manual review of summary counts |
| ESLint false positives | Dev friction | Start as warnings for first day; escalate to errors post verification |
| Overly broad codemod patterns later | Accidental breakage | Dry-run file diff summary + batch size cap (<=150 files) |

## Validation Steps
1. Run inventory script twice -> stable identical output.
2. Introduce a deliberate deep relative import in a temp branch -> lint should fail.
3. Dry-run codemod shows counts but does not modify files.

## Branch / Rollback Strategy
- Branch: `wave0/baseline`
- Rollback: Delete generated JSON + revert ESLint config changes; low risk.

---
Proceed to Wave 1 only after Wave 0 exit gate met.

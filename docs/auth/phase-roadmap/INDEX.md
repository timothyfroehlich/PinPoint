# Auth Modernization Waves (Fast Path)

This directory supersedes the prior "phase" roadmap. We collapsed work into 5 high‑velocity waves optimized for bulk automation, parallel lanes, and measurable gates. Each wave doc includes:
- Objective & Rationale
- Scope (In / Out)
- Parallel Lanes (who does what concurrently)
- Deliverables
- Codemods & Automation Plan
- Metrics & Acceptance Gates
- Risks / Mitigations
- Validation Steps
- Branching / Rollback Strategy

## Wave Summary

| Wave | Focus | Core Outcome | Parallelization Style |
|------|-------|--------------|-----------------------|
| 0 | Baseline & Guard Rails | Frozen baseline + inventories + codemod toolchain | 4 lanes (Inventory / Enforcement / Codemods / Metrics) |
| 1 | Request Context & Logging Spine | Unified `RequestContext` + structured logs + typed/cached fetchers | 5 lanes (Context / Logger+Errors / Codemods / Auth Integration / Docs) |
| 2 | Permissions DSL & Migration | Declarative permission engine w/ shadow validation | 5 lanes (DSL / Codemod / Registry Tests / Resource Adapters / Shadow Monitor) |
| 3 | Caching & Security Hardening | Micro/negative cache + org/RLS assertions + perf reduction of dup queries | 4 lanes (Cache Layer / Security+RLS / Codemods / Perf Bench) |
| 4 | Tests, Telemetry & Freeze | Full matrix, telemetry, remove transitional code, freeze | 5 lanes (Matrix Tests / Telemetry / Cleanup Codemod / Docs / ESLint Final) |

## Files
- `wave-0-baseline-and-guardrails.md`
- `wave-1-request-context-and-logging.md`
- `wave-2-permissions-dsl-and-migration.md`
- `wave-3-caching-performance-security.md`
- `wave-4-testing-telemetry-freeze.md`
- `codemod-toolkit.md`
- `metrics-gates.md`

`AUTHENTICATION_CRISIS_ANALYSIS.md` is retained as a historical + status reference.

## Transition Notes
- All old phase-* docs removed (see git history for reference).
- Non‑Negotiables remain the authoritative rule set; waves operationalize achieving continuous compliance.
- Use `metrics-gates.md` to record actual numbers at each wave exit.

## Quick Start (What to Do Right Now)
1. Read Wave 0 doc & run baseline inventory script (to be created).
2. Stand up codemod harness per `codemod-toolkit.md`.
3. Capture baseline metrics before modifying server fetchers.

## Change Control
- Each codemod batch -> dedicated branch with safety summary footer.
- Rollback instructions embedded in each wave doc.

## Sign‑Off Flow
Wave doc PR -> Metrics recorded -> Non‑Negotiables cross‑checked -> Tag wave completion commit.

---

See individual wave files for details.

---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "src/test/**"
  - "e2e/**"
  - "vitest.config.ts"
  - "playwright.config.ts"
---

# Writing or changing tests

Full statements, severity, and do/don't: `docs/NON_NEGOTIABLES.md`.

- **Worker-scoped PGlite** (CORE-TEST-001): no per-test DB instances (causes
  lockups).
- **Test at the cheapest layer** (CORE-TEST-005): E2E for multi-step journeys;
  integration (PGlite + direct action) for server-action wiring, permissions,
  query correctness; RTL unit for form-state and UI logic. Smoke E2E is for
  "renders without 500" only. Bug-class table: `pinpoint-testing` skill.
- **Test what we own** (CORE-TEST-006): mock third-party SDKs at their
  boundary; don't synthesize their internal state. Any production third-party
  hostname reachable from an E2E run is a class-J violation — delete the spec
  and add an SDK-boundary mock.

Which command to run for which change is `AGENTS.md` §5; Playwright technique
is the `pinpoint-e2e` skill; where the coverage for each bug class already
lives is `pinpoint-testing`.

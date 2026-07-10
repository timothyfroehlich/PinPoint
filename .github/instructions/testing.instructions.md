---
applyTo: "**/*.test.ts,**/*.test.tsx,**/*.spec.ts,e2e/**/*.ts,src/test/**/*.ts"
---

# Testing

## Test at the cheapest layer (CORE-TEST-005)

Flag a test written at the wrong layer:

- Multi-step user journey → E2E (Playwright).
- Server-action wiring, permission checks, query correctness → integration (PGlite + direct action call), not E2E.
- Pure form-state / UI logic → RTL unit.
- Smoke E2E is only "page renders without a 500" — flag business assertions crammed into a smoke spec.

## Worker-scoped PGlite (CORE-TEST-001)

- Integration tests share a worker-scoped PGlite instance. Flag any per-test `new PGlite()` / fresh DB creation — it causes lockups.

## Test what we own — class-J (CORE-TEST-006)

- E2E specs must not touch live external services. Flag any spec that reaches `discord.com`, `googleapis.com`, real OAuth providers, vendor email endpoints, or captcha verification. Owned local stack only: Mailpit, PGlite, local Supabase.
- Diagnostic: "If this ran against production with real credentials, would the same code pass?" If yes, it's hitting a real third party — replace with an SDK-boundary mock (`fetch` mocked in a `*.test.ts` next to the client module).

## E2E quality

- Flag hard-coded waits (`page.waitForTimeout`) — use web-first assertions / `expect(...).toBeVisible()`.
- Flag brittle selectors (deep CSS, nth-child); prefer roles / accessible names / test ids.
- Tests must be independent and not rely on another test's residual state within the run.
- A new page should be added to `e2e/smoke/responsive-overflow.spec.ts`.

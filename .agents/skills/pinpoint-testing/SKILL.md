---
name: pinpoint-testing
description: Which layer catches which class of bug, and where the coverage for each class already lives — the bug-class table AGENTS.md routes to, the canonical file per class so new tests extend rather than duplicate, and the "Test What We Own" boundary with its casework. Also the one mocking pattern worth knowing — forwarding `~/server/db` to the worker-scoped PGlite instance rather than handing a test canned rows. Use when deciding what layer a new test belongs at, before creating a new test file, when reaching for a mock of the database or an ORM, when tempted to synthesize a third party's internal state in a test, or when reviewing whether a PR picked the right layer. Playwright technique lives in `pinpoint-e2e`; the rules themselves are `CORE-TEST-*` in `docs/NON_NEGOTIABLES.md`; which commands to run is AGENTS.md §5.
---

# PinPoint Testing

## Bug Classes & Cheapest Catching Layer

There is no numeric target for test counts. Total-test-count is a vanity metric. The right question per test is:

> _What class of bug does this test catch, and is the chosen layer the cheapest one that catches that class?_

| Class | What it catches                                                | Cheapest catching layer                                                                                                                                                                                                                                                          |
| ----- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Auth redirect / route protection                               | Integration (middleware) or thin E2E set                                                                                                                                                                                                                                         |
| **B** | Server Action wiring (form → action → DB → response)           | **Integration** (PGlite + direct action call)                                                                                                                                                                                                                                    |
| **C** | Form-state lifecycle (reset / optimistic / rollback)           | **RTL unit**                                                                                                                                                                                                                                                                     |
| **D** | Layout / overflow / hydration regression                       | **Smoke E2E** ([responsive-overflow.spec.ts](../../../e2e/smoke/responsive-overflow.spec.ts) is canonical)                                                                                                                                                                       |
| **E** | Permission enforcement (role X can / cannot mutate)            | **Integration**                                                                                                                                                                                                                                                                  |
| **F** | Multi-step user journey (login → mutate → verify across pages) | **E2E** (the only class E2E genuinely owns)                                                                                                                                                                                                                                      |
| **G** | Pure logic (validators, formatters, dates)                     | Unit                                                                                                                                                                                                                                                                             |
| **H** | Pure UI state (open / close, focus, keyboard nav)              | RTL unit                                                                                                                                                                                                                                                                         |
| **I** | DB query correctness (filters, joins, ordering)                | Integration (PGlite)                                                                                                                                                                                                                                                             |
| **J** | Third-party integration                                        | **Boundary-mocked** unit/integration. NEVER live external services in E2E except our owned local stack (Mailpit, PGlite, local Supabase including local Storage). See CORE-TEST-006, "Test What We Own", in [docs/NON_NEGOTIABLES.md](../../../docs/NON_NEGOTIABLES.md#testing). |

E2E earns its slot when the test is genuinely class F. Most other classes have a cheaper home. The 2026-05 audit ([e2e-audit-2026-05.md](../../../docs/testing/e2e-audit-2026-05.md)) found that 36 of 48 specs were partially or fully misallocated — write the cheapest layer that catches the bug class, not the most thorough one (CORE-TEST-005).

## Where Existing Coverage Lives (Look Here First)

Before writing a new test, check the canonical location for that bug class. Most new tests should _extend an existing file_, not create a new one — the audit found agents creating duplicate coverage because they couldn't see what already existed.

| Testing…                                                  | Look first at…                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permission enforcement (role-gated UI / actions)          | [issue-detail-permissions.test.ts](../../../src/test/integration/issue-detail-permissions.test.ts), [issue-detail-permissions.test.tsx](../../../src/test/unit/components/issues/issue-detail-permissions.test.tsx)                                                                                                                                                        |
| Server Action wiring (action → DB write → response)       | [machine-owner-promotion.test.ts](../../../src/test/integration/machine-owner-promotion.test.ts), [user-management.test.ts](../../../src/test/integration/admin/user-management.test.ts), [issue-detail-permissions.test.ts](../../../src/test/integration/issue-detail-permissions.test.ts) — prefer integration tests over mocked unit tests for class B (CORE-TEST-004) |
| DB query correctness (filters / joins / order)            | [src/test/integration/supabase/](../../../src/test/integration/supabase/), [src/test/integration/](../../../src/test/integration/) (e.g., [database-queries.test.ts](../../../src/test/integration/database-queries.test.ts)), [filters-queries.test.ts](../../../src/test/unit/lib/machines/filters-queries.test.ts)                                                      |
| Middleware / route protection                             | [middleware.test.ts](../../../src/lib/supabase/middleware.test.ts) — the `publicRoutes` / `protectedRoutes` `it.each` arrays are the canonical place to add new routes (one line, not an E2E spec)                                                                                                                                                                         |
| Component UI state (open / close, focus, RTL)             | [src/components/](../../../src/components/) or [src/test/unit/components/](../../../src/test/unit/components/)                                                                                                                                                                                                                                                             |
| Form-state lifecycle (clear / reset / optimistic)         | [src/app/(app)/](<../../../src/app/(app)/>) or [src/components/](../../../src/components/) (e.g., [update-issue-forms-rollback.test.tsx](<../../../src/app/(app)/m/%5Binitials%5D/i/%5BissueNumber%5D/update-issue-forms-rollback.test.tsx>))                                                                                                                              |
| Comment audit trail (delete / edit)                       | [delete-comment-audit.test.ts](../../../src/test/unit/delete-comment-audit.test.ts)                                                                                                                                                                                                                                                                                        |
| Auth actions (signup / login / logout)                    | [auth-actions.test.ts](../../../src/test/integration/supabase/auth-actions.test.ts)                                                                                                                                                                                                                                                                                        |
| Notifications / Mailpit dispatch                          | [notifications.test.ts](../../../src/test/integration/notifications.test.ts), [notification-formatting.test.ts](../../../src/test/unit/notification-formatting.test.ts)                                                                                                                                                                                                    |
| External services (Discord, Vercel Blob, OAuth providers) | [client.test.ts](../../../src/lib/discord/client.test.ts) with the SDK mocked at the boundary — NEVER live in E2E (CORE-TEST-006)                                                                                                                                                                                                                                          |
| TipTap render / markdown serialization                    | [render.test.ts](../../../src/lib/tiptap/render.test.ts), [markdown.test.ts](../../../src/lib/markdown.test.ts)                                                                                                                                                                                                                                                            |

If the canonical location doesn't exist yet, that's a signal you may need to create a new test file at that layer — but check the table first.

General integration tests live in `src/test/integration/` (PGlite-based); tests
requiring a real Supabase live in `src/test/integration/supabase/`.

## Test What We Own

> See [docs/NON_NEGOTIABLES.md](../../../docs/NON_NEGOTIABLES.md#testing) (CORE-TEST-006) for the binding form.

Tests must verify PinPoint's code at the boundary of services we don't control, not simulate the service's internals. If your test setup is building scaffolding that synthesizes a third party's internal state — raw DB writes into `auth.identities`, OAuth handshake fakes, regex extraction from a vendor's email template — step back. You're testing their code, not yours. Cover PinPoint's contribution with unit tests; cover "the page renders without 500" with a smoke test; reserve integration/E2E for when the test exercises the contracted public API of a real running service.

**The diagnostic question** (apply to every test you're tempted to write):

> "If I ran this test against production-scale infrastructure with real credentials, would the same code pass?"

If yes → you're testing your code. If no → you're testing infrastructure scaffolding you wrote yourself, and the test will keep breaking as the third party evolves.

### Decision rule

```
Is the test setup synthesizing state that a third party owns?
  ├─ Yes → Cover with: unit tests of our code + page-renders smoke test
  └─ No  → Continue. Is it exercising the public contract of a real running service?
            ├─ Yes → Integration/E2E is appropriate
            └─ No  → It's a unit test by another name; keep it pure
```

### OK to E2E (clear contract surface, real service)

- Login form submits → real Supabase auth → `/dashboard` loads. Uses the public SDK; if it breaks, our wiring broke.
- Issue create form → real Drizzle → real Postgres → issue appears in list on RSC re-render.
- Trigger a notification → assert the email lands in real Mailpit via its public API. We verify our dispatch code fired without parsing the vendor's template internals (e.g. the notification-receipt tests in `e2e/full/email-and-notifications.spec.ts`).

### NOT OK to E2E (simulating third-party internals)

- Pre-seed an `auth.identities` row via raw SQL to test "Discord linked" UI state. Invalidates the GoTrue session on next middleware refresh. Casework: **PP-e20** (PR #1296 in flight — deletes the spec, replaces with a smoke render check).
- Regex-extract a password-reset link from a Supabase test-email. The format is GoTrue's, varies by version, breaks silently on upgrade. Casework: **PP-q9r** (PP-6px tracks the deletion).
- Mock OAuth provider endpoints to fake a redirect dance. The provider validates `redirect_uri` before our code ever sees the request.

### What to do when you're tempted

1. Identify PinPoint's actual contribution to the flow (usually 1-3 small functions or server actions).
2. Verify those have unit tests; add them if not.
3. Add a smoke test that the relevant page renders (no 500, key UI elements present).
4. **Delete** the E2E that tried to synthesize the third party's state. Cite "Test What We Own" in the PR.

The line you're walking is "synthesizing state inside a third party's domain." Real Supabase running locally with real auth flow → fine to E2E. Real DB writes verified through query results → fine to E2E. Real HTTP through middleware to a real route handler → fine to E2E. Faking what GoTrue / Discord would have returned → not fine.

## The one mocking pattern worth knowing

Mocking `~/server/db` with canned return values, or mocking `drizzle-orm` at all, means your assertions only prove the mock returned what you told it to.

The house pattern instead forwards the `db` singleton to worker-scoped PGlite, so the real SQL executes against real Postgres — `vi.mock("~/server/db", …)` returning `{ db: await getTestDb() }`. This is how you integration-test a service function that imports the singleton directly instead of accepting it as a parameter. `src/test/integration/transaction-tripwire.test.ts` is a representative example. It composes with CORE-TEST-001 rather than violating it: `getTestDb()` hands back the **worker-scoped** instance, so no per-test database is created.

## Elsewhere

- `pinpoint-e2e` — Playwright technique, selector strategy, worker isolation, environment defaults.
- [src/test/README.md](../../../src/test/README.md) — the mechanics: `setupTestDb()` / `getTestDb()` call contract, factories, and which command runs which project.
- AGENTS.md §5 "Which tests to run" — the decision tree and the commands.
- [NON_NEGOTIABLES.md](../../../docs/NON_NEGOTIABLES.md#testing) — the `CORE-TEST-*` rules themselves.
- [e2e-audit-2026-05.md](../../../docs/testing/e2e-audit-2026-05.md) — per-spec verdicts and the bug-class framework's history.

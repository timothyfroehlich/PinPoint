---
name: pinpoint-testing
description: Testing strategy, bug-class-driven layer selection, PGlite patterns, Playwright best practices. Use when writing tests, debugging test failures, or when user mentions testing/test/spec/E2E.
---

# PinPoint Testing Guide

## When to Use This Skill

Use this skill when:

- Writing new tests (unit, integration, or E2E)
- Debugging test failures
- Setting up test infrastructure
- Understanding test patterns and organization
- User mentions: "test", "testing", "spec", "E2E", "Playwright", "Vitest", "coverage"

## Bug Classes & Cheapest Catching Layer

There is no numeric target for test counts. Total-test-count is a vanity metric. The right question per test is:

> _What class of bug does this test catch, and is the chosen layer the cheapest one that catches that class?_

| Class | What it catches                                                | Cheapest catching layer                                                                                                                                                                                                        |
| ----- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A** | Auth redirect / route protection                               | Integration (middleware) or thin E2E set                                                                                                                                                                                       |
| **B** | Server Action wiring (form → action → DB → response)           | **Integration** (PGlite + direct action call)                                                                                                                                                                                  |
| **C** | Form-state lifecycle (reset / optimistic / rollback)           | **RTL unit**                                                                                                                                                                                                                   |
| **D** | Layout / overflow / hydration regression                       | **Smoke E2E** ([responsive-overflow.spec.ts](../../../e2e/smoke/responsive-overflow.spec.ts) is canonical)                                                                                                                     |
| **E** | Permission enforcement (role X can / cannot mutate)            | **Integration**                                                                                                                                                                                                                |
| **F** | Multi-step user journey (login → mutate → verify across pages) | **E2E** (the only class E2E genuinely owns)                                                                                                                                                                                    |
| **G** | Pure logic (validators, formatters, dates)                     | Unit                                                                                                                                                                                                                           |
| **H** | Pure UI state (open / close, focus, keyboard nav)              | RTL unit                                                                                                                                                                                                                       |
| **I** | DB query correctness (filters, joins, ordering)                | Integration (PGlite)                                                                                                                                                                                                           |
| **J** | Third-party integration                                        | **Boundary-mocked** unit/integration. NEVER live external services in E2E except our owned local stack (Mailpit, PGlite, local Supabase including local Storage). See [AGENTS.md](../../../AGENTS.md) §2.1 "Test What We Own". |

E2E earns its slot when the test is genuinely class F. Most other classes have a cheaper home. The 2026-05 audit ([e2e-audit-2026-05.md](../../../docs/testing/e2e-audit-2026-05.md)) found that 36 of 48 specs were partially or fully misallocated — write the cheapest layer that catches the bug class, not the most thorough one (CORE-TEST-005).

## Where Existing Coverage Lives (Look Here First)

Before writing a new test, check the canonical location for that bug class. Most new tests should _extend an existing file_, not create a new one — the audit found agents creating duplicate coverage because they couldn't see what already existed.

| Testing…                                                           | Look first at…                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permission enforcement (role-gated UI / actions)                   | [issue-detail-permissions.test.ts](../../../src/test/integration/issue-detail-permissions.test.ts), [issue-detail-permissions.test.tsx](../../../src/test/unit/components/issues/issue-detail-permissions.test.tsx)                                                                                                                                                        |
| Server Action wiring (action → DB write → response)                | [machine-owner-promotion.test.ts](../../../src/test/integration/machine-owner-promotion.test.ts), [user-management.test.ts](../../../src/test/integration/admin/user-management.test.ts), [issue-detail-permissions.test.ts](../../../src/test/integration/issue-detail-permissions.test.ts) — prefer integration tests over mocked unit tests for class B (CORE-TEST-004) |
| DB query correctness (filters / joins / order)                     | [src/test/integration/supabase/](../../../src/test/integration/supabase/), [src/test/integration/](../../../src/test/integration/) (e.g., [database-queries.test.ts](../../../src/test/integration/database-queries.test.ts)), [filters-queries.test.ts](../../../src/test/unit/lib/machines/filters-queries.test.ts)                                                      |
| Middleware / route protection                                      | [middleware.test.ts](../../../src/lib/supabase/middleware.test.ts) — the `publicRoutes` / `protectedRoutes` `it.each` arrays are the canonical place to add new routes (one line, not an E2E spec)                                                                                                                                                                         |
| Component UI state (open / close, focus, RTL)                      | [src/components/](../../../src/components/) or [src/test/unit/components/](../../../src/test/unit/components/)                                                                                                                                                                                                                                                             |
| Form-state lifecycle (clear / reset / optimistic)                  | [src/app/(app)/](<../../../src/app/(app)/>) or [src/components/](../../../src/components/) (e.g., [update-issue-forms-rollback.test.tsx](<../../../src/app/(app)/m/%5Binitials%5D/i/%5BissueNumber%5D/update-issue-forms-rollback.test.tsx>))                                                                                                                              |
| Comment audit trail (delete / edit)                                | [delete-comment-audit.test.ts](../../../src/test/unit/delete-comment-audit.test.ts)                                                                                                                                                                                                                                                                                        |
| Auth actions (signup / login / logout)                             | [auth-actions.test.ts](../../../src/test/integration/supabase/auth-actions.test.ts)                                                                                                                                                                                                                                                                                        |
| Notifications / Mailpit dispatch                                   | [notifications.test.ts](../../../src/test/integration/notifications.test.ts), [notification-formatting.test.ts](../../../src/test/unit/notification-formatting.test.ts)                                                                                                                                                                                                    |
| External services (Discord, Vercel Blob, OAuth providers, captcha) | [client.test.ts](../../../src/lib/discord/client.test.ts) with the SDK mocked at the boundary — NEVER live in E2E (CORE-TEST-006)                                                                                                                                                                                                                                          |
| TipTap render / markdown serialization                             | [render.test.ts](../../../src/lib/tiptap/render.test.ts), [markdown.test.ts](../../../src/lib/markdown.test.ts)                                                                                                                                                                                                                                                            |

If the canonical location doesn't exist yet, that's a signal you may need to create a new test file at that layer — but check the table first.

### Commands

```bash
pnpm run check                     # Quick check: types, lint, formatting, and unit tests
pnpm test                          # Run unit tests only
pnpm test -- path/to/file.test.ts  # Run targeted unit test
pnpm run test:integration          # Run PGlite integration tests (fast, no Supabase required)
pnpm run test:integration:supabase # Run Supabase integration tests (requires supabase start)
pnpm run smoke                     # Run E2E smoke tests (Playwright)
pnpm run preflight                 # Full pre-commit check (locked, caps concurrency)
pnpm run preflight:unlocked        # Full pre-commit check (unlocked, bypasses concurrency cap)
```

### Which Tests to Run (Decision Tree)

1. **Changed pure logic/utils?** → `pnpm run check` (unit tests, ~12s)
2. **Changed a single E2E-relevant file?** → `pnpm exec playwright test e2e/path/to/file.spec.ts --project=chromium` (~15-30s)
3. **Changed UI components/forms?** → `pnpm run smoke` (~60s)
4. **Changed auth/permissions/middleware?** → `pnpm run smoke` + targeted full specs
5. **Changed DB schema/migrations?** → `pnpm run preflight` (full suite)
6. **NEVER** run `e2e:full` locally unless explicitly asked — that's what CI is for

**Key rules for agents:**

- Always use `--project=chromium` for targeted runs (skip Mobile Chrome unless testing responsive)
- Use `--headed` for debugging visual issues
- `pnpm run check` catches 90% of issues — E2E is for integration verification, not iteration
- If a test is flaky locally, report it — don't retry in a loop

### Critical Rules

1. **Use correct test types** (CORE-TEST-001): Pure functions → unit tests; DB queries → integration with PGlite; Full flows → E2E. Do not spin per-test PGlite instances (which cause system lockups); use the shared worker instance via `getTestDb()` and `setupTestDb()`.
2. **No testing Server Components directly** (CORE-TEST-002): Use E2E instead.
3. **Test behavior, not implementation** (CORE-TEST-005): Focus on outcomes, exercise element handlers at the cheapest layer.
4. **Prefer Integration Tests for DB Logic** (CORE-TEST-004): Do not write unit tests with extensive mocking of Drizzle; use integration tests with PGlite instead.
5. **Test what we own** (CORE-TEST-006): Mock third-party SDKs at their boundary; no live external services in E2E (class-J).
6. **Integration tests location**: General integration tests live in `src/test/integration/` (PGlite-based). Tests requiring real Supabase live in `src/test/integration/supabase/`.

## Test What We Own

> See [AGENTS.md](../../../AGENTS.md) §2.1 and [docs/NON_NEGOTIABLES.md](../../../docs/NON_NEGOTIABLES.md#testing) (CORE-TEST-006) for the binding form.

Tests must verify PinPoint's code at the boundary of services we don't control, not simulate the service's internals. If your test setup is building scaffolding that synthesizes a third party's internal state — raw DB writes into `auth.identities`, captcha-bypass mocks, OAuth handshake fakes, regex extraction from a vendor's email template — step back. You're testing their code, not yours. Cover PinPoint's contribution with unit tests; cover "the page renders without 500" with a smoke test; reserve integration/E2E for when the test exercises the contracted public API of a real running service.

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
- Bypass Turnstile in test mode by patching the SDK to return success. The provider validates upstream of our code. Casework: **PP-uc8** (resolved in PR #1283 by writing the Turnstile keys commented-out in `.env.local`; existing fallbacks in `src/lib/security/turnstile.ts` treat absent keys as "skip" in non-prod, so the bypass is uniform across `next dev`, Playwright, Storybook, etc. — `.env.local` is auto-generated by `scripts/worktree_setup.py` and `chmod 444`; the proper place to change it is the generator).
- Regex-extract a password-reset link from a Supabase test-email. The format is GoTrue's, varies by version, breaks silently on upgrade. Casework: **PP-q9r** (PP-6px tracks the deletion).
- Mock OAuth provider endpoints to fake a redirect dance. The provider validates `redirect_uri` before our code ever sees the request.

### What to do when you're tempted

1. Identify PinPoint's actual contribution to the flow (usually 1-3 small functions or server actions).
2. Verify those have unit tests; add them if not.
3. Add a smoke test that the relevant page renders (no 500, key UI elements present).
4. **Delete** the E2E that tried to synthesize the third party's state. Cite "Test What We Own" in the PR.

The line you're walking is "synthesizing state inside a third party's domain." Real Supabase running locally with real auth flow → fine to E2E. Real DB writes verified through query results → fine to E2E. Real HTTP through middleware to a real route handler → fine to E2E. Faking what GoTrue / Cloudflare / Discord would have returned → not fine.

## Detailed Documentation

Read these files for comprehensive testing guidance:

- [E2E_BEST_PRACTICES.md](../../../docs/E2E_BEST_PRACTICES.md) — E2E-specific patterns with Playwright
- [NON_NEGOTIABLES.md](../../../docs/NON_NEGOTIABLES.md#testing) — Testing-related non-negotiables
- [e2e-audit-2026-05.md](../../../docs/testing/e2e-audit-2026-05.md) — 2026-05 E2E suite audit (per-spec verdicts and bug-class framework history)

## Code Examples

### Unit Test Pattern

```typescript
// Pure function testing
import { describe, it, expect } from "vitest";
import { calculateSeverityScore } from "~/lib/utils";

describe("calculateSeverityScore", () => {
  it("returns 10 for unplayable", () => {
    expect(calculateSeverityScore("unplayable")).toBe(10);
  });

  it("returns 5 for major", () => {
    expect(calculateSeverityScore("major")).toBe(5);
  });

  it("returns 1 for minor", () => {
    expect(calculateSeverityScore("minor")).toBe(1);
  });
});
```

### Integration Test with PGlite (Worker-Scoped)

```typescript
import { describe, it, expect } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { machines, issues } from "~/server/db/schema";
import { eq, asc } from "drizzle-orm";

describe("Database queries integration", () => {
  setupTestDb(); // Shared worker instance auto-setup and cleanup - CRITICAL (CORE-TEST-001)

  it("should query issues for the specified machine", async () => {
    const db = await getTestDb();

    // Seed test data using Drizzle
    // id auto-generated (defaultRandom()); omit it from inserts
    await db.insert(machines).values({
      name: "Test Machine",
      initials: "TM",
    });

    await db.insert(issues).values([
      {
        machineInitials: "TM",
        issueNumber: 1,
        title: "Broken flipper",
        severity: "minor", // must use a valid severity enum: cosmetic | minor | major | unplayable
      },
      {
        machineInitials: "TM",
        issueNumber: 2,
        title: "Dead display",
        severity: "unplayable",
      },
    ]);

    const result = await db.query.issues.findMany({
      where: eq(issues.machineInitials, "TM"),
      orderBy: asc(issues.issueNumber), // explicit ordering for deterministic assertions
    });

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Broken flipper");
  });
});
```

### E2E Test with Playwright

```typescript
import { test, expect } from "@playwright/test";

test.describe("Issue Creation Flow", () => {
  test("user can create a new issue", async ({ page }) => {
    // Navigate to machine page
    await page.goto("/machines/test-machine-id");

    // Click "New Issue" button
    await page.getByRole("button", { name: "New Issue" }).click();

    // Fill out form
    await page.getByLabel("Title").fill("Broken left flipper");
    await page.getByLabel("Description").fill("Not responding to button press");
    await page.getByLabel("Severity").selectOption("minor");

    // Submit form
    await page.getByRole("button", { name: "Create Issue" }).click();

    // Verify success
    await expect(page.getByText("Issue created successfully")).toBeVisible();
    await expect(page).toHaveURL(/\/issues\/[\w-]+/);
  });
});
```

## Test Organization

```
src/test/
├── unit/                    # Unit tests
│   ├── lib/
│   │   └── utils.test.ts
│   └── validation/
│       └── issue.test.ts
└── integration/
    └── supabase/            # Integration tests requiring Supabase
        ├── issues.test.ts
        └── auth.test.ts

e2e/
├── smoke/                   # Critical E2E flows (run in CI)
│   ├── auth.spec.ts
│   └── issues.spec.ts
└── full/                    # Comprehensive E2E (optional, slower)
    └── advanced-flows.spec.ts
```

## PGlite Best Practices

### ✅ Correct: Worker-Scoped Instance

```typescript
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

describe("Database operations", () => {
  setupTestDb(); // Auto-setup and cleanup the shared instance

  it("query works", async () => {
    const db = await getTestDb();
    const result = await db.query.issues.findMany();
    expect(result).toHaveLength(0);
  });
});
```

### ❌ Wrong: Per-Test Instance (Causes Lockups)

```typescript
// DON'T DO THIS - causes system lockups!
beforeEach(async () => {
  const db = new PGlite(); // Creates new instance every test (violates CORE-TEST-001)
});
```

## E2E Patterns from E2E_BEST_PRACTICES.md

### Selector Strategy

1. **Prefer**: Accessibility roles and labels (`getByRole`, `getByLabel`)
2. **Fallback**: Test IDs (`data-testid`) when roles aren't sufficient
3. **Avoid**: CSS selectors, text content that changes

### Test Organization

- **Smoke tests** (`e2e/smoke/`): Critical flows, run in CI
- **Full tests** (`e2e/full/`): Comprehensive coverage, run less frequently
- Keep tests independent (no shared state between tests)

### Common Patterns

```typescript
// Wait for real UI state, not arbitrary timeouts
await expect(page.getByText("Loading...")).toBeHidden();
await expect(page.getByText("Data loaded")).toBeVisible();

// Use locators for better error messages
const submitButton = page.getByRole("button", { name: "Submit" });
await expect(submitButton).toBeEnabled();
await submitButton.click();

// Handle auth state
test.beforeEach(async ({ page }) => {
  // Log in once before each test
  await page.goto("/login");
  await page.getByLabel("Email").fill("test@example.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Log In" }).click();
  await expect(page).toHaveURL("/dashboard");
});
```

## Test Anti-Patterns

### ❌ Don't Do These

**Testing Implementation Details**:

```typescript
// ❌ Bad: Testing internal state
expect(component.state.count).toBe(5);

// ✅ Good: Testing behavior
expect(screen.getByText("Count: 5")).toBeInTheDocument();
```

**Arbitrary Waits**:

```typescript
// ❌ Bad: Arbitrary timeout
await page.waitForTimeout(5000);

// ✅ Good: Wait for real UI state
await expect(page.getByText("Data loaded")).toBeVisible();
```

**Over-Mocking**:

```typescript
// ❌ Bad: Mocking everything (for DB logic)
vi.mock("~/server/db");
vi.mock("drizzle-orm");

// ✅ Good: Use PGlite integration test instead
// Integration tests with PGlite test real DB logic
```

**Testing Server Components Directly**:

```typescript
// ❌ Bad: Unit testing async Server Component
import { render } from "@testing-library/react";
const result = await render(<ServerComponent />); // Doesn't work well

// ✅ Good: E2E test for Server Component behavior
test("page displays issues", async ({ page }) => {
  await page.goto("/issues");
  await expect(page.getByText("Issue #1")).toBeVisible();
});
```

## Testing Checklist

Before committing tests:

- [ ] Test files in correct location (unit vs integration vs E2E)
- [ ] Integration tests use worker-scoped PGlite (`getTestDb()` and `setupTestDb()`)
- [ ] No per-test PGlite instances (violates CORE-TEST-001)
- [ ] E2E tests use roles/labels for selectors (CORE-TEST-005)
- [ ] No arbitrary `waitForTimeout()` in E2E tests (violates CORE-TEST-005)
- [ ] Tests are independent (no shared state)
- [ ] Testing behavior, not implementation (CORE-TEST-005)
- [ ] `pnpm run preflight` passes (includes all test suites)

## Additional Resources

- E2E best practices: [E2E_BEST_PRACTICES.md](../../../docs/E2E_BEST_PRACTICES.md)
- 2026-05 E2E suite audit: [e2e-audit-2026-05.md](../../../docs/testing/e2e-audit-2026-05.md)
- Non-negotiables: [NON_NEGOTIABLES.md](../../../docs/NON_NEGOTIABLES.md#testing) (CORE-TEST-\* rules)
- Playwright docs: Use the `context7` MCP server for current Playwright patterns and API references (resolve-library-id → get-library-docs)

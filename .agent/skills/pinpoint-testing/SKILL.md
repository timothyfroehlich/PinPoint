---
name: pinpoint-testing
description: Testing strategy, test pyramid (70% unit/25% integration/5% E2E), PGlite patterns, Playwright best practices. Use when writing tests, debugging test failures, or when user mentions testing/test/spec/E2E.
---

# PinPoint Testing Guide

## When to Use This Skill

Use this skill when:

- Writing new tests (unit, integration, or E2E)
- Debugging test failures
- Setting up test infrastructure
- Understanding test patterns and organization
- User mentions: "test", "testing", "spec", "E2E", "Playwright", "Vitest", "coverage"

## Quick Reference

### Test Distribution (100-150 tests total)

- **70% Unit (~70-100)**: Pure functions, utilities, validation
- **25% Integration (~25-35)**: DB queries with worker-scoped PGlite
- **5% E2E (~5-10)**: Critical flows (Playwright)

### Commands

```bash
pnpm run check          # Quick: types + lint + unit (~5s)
pnpm test               # Unit tests only
pnpm test -- path/to/file.test.ts  # Targeted unit test
pnpm run test:integration          # DB integration tests (requires supabase start)
pnpm run smoke                     # E2E smoke tests (Playwright)
pnpm run preflight                 # Full suite (~60s) - run before commit
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

1. **Worker-scoped PGlite only**: Per-test instances cause lockups
2. **No testing Server Components directly**: Use E2E instead
3. **Test behavior, not implementation**: Focus on outcomes
4. **Integration tests location**: `src/test/integration/supabase/*.test.ts`

## Test What We Own

> See AGENTS.md rule #17 for the binding form.

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
4. **Delete** the E2E that tried to synthesize the third party's state. Cite rule #17 in the PR.

The line you're walking is "synthesizing state inside a third party's domain." Real Supabase running locally with real auth flow → fine to E2E. Real DB writes verified through query results → fine to E2E. Real HTTP through middleware to a real route handler → fine to E2E. Faking what GoTrue / Cloudflare / Discord would have returned → not fine.

## Detailed Documentation

Read these files for comprehensive testing guidance:

```bash
# Full testing strategy and patterns
cat docs/TESTING_PLAN.md

# E2E-specific patterns with Playwright
cat docs/E2E_BEST_PRACTICES.md

# Testing-related non-negotiables
cat docs/NON_NEGOTIABLES.md | grep -A 10 "## Testing"
```

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

  it("returns 5 for playable", () => {
    expect(calculateSeverityScore("playable")).toBe(5);
  });

  it("returns 1 for minor", () => {
    expect(calculateSeverityScore("minor")).toBe(1);
  });
});
```

### Integration Test with PGlite (Worker-Scoped)

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { getPGlite } from "~/test/setup/pglite";
import { getIssuesForMachine } from "~/server/data-access/issues";

describe("getIssuesForMachine", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = getPGlite(); // Shared worker instance - CRITICAL!

    // Seed test data
    await db.exec(`
      INSERT INTO machines (id, name) VALUES ('machine-1', 'Test Machine');
      INSERT INTO issues (id, machine_id, title, severity)
      VALUES
        ('issue-1', 'machine-1', 'Broken flipper', 'playable'),
        ('issue-2', 'machine-1', 'Dead display', 'unplayable');
    `);
  });

  it("returns issues for the specified machine", async () => {
    const issues = await getIssuesForMachine("machine-1");
    expect(issues).toHaveLength(2);
    expect(issues[0].title).toBe("Broken flipper");
  });

  it("returns empty array for machine with no issues", async () => {
    const issues = await getIssuesForMachine("machine-2");
    expect(issues).toHaveLength(0);
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
    await page.getByLabel("Severity").selectOption("playable");

    // Submit form
    await page.getByRole("button", { name: "Create Issue" }).click();

    // Verify success
    await expect(page.getByText("Issue created successfully")).toBeVisible();
    await expect(page).toHaveURL(/\/issues\/[\w-]+/);
  });
});
```

## Testing Patterns from TESTING_PLAN.md

### What to Test at Each Level

**Unit Tests (70%)**:

- Pure functions and utilities
- Input validation (Zod schemas)
- Type guards and converters
- Business logic calculations
- Error handling in isolated functions

**Integration Tests (25%)**:

- Database queries (Drizzle with PGlite)
- Server Action data access layers
- Auth flows (Supabase SSR)
- API route handlers
- Multi-step workflows involving DB

**E2E Tests (5%)**:

- Critical user journeys (login, create issue, resolve issue)
- Form submissions with validation
- Navigation and routing
- Auth state persistence
- Mobile responsiveness (if critical)

### Test Organization

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
import { getPGlite } from "~/test/setup/pglite";

describe("Database operations", () => {
  beforeAll(async () => {
    const db = getPGlite(); // Shared worker instance
    await db.exec("INSERT INTO ...");
  });

  it("query works", async () => {
    const result = await db.query("SELECT * FROM ...");
    expect(result.rows).toHaveLength(1);
  });
});
```

### ❌ Wrong: Per-Test Instance (Causes Lockups)

```typescript
// DON'T DO THIS - causes system lockups!
beforeEach(async () => {
  const db = new PGlite(); // Creates new instance every test
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
- [ ] Integration tests use worker-scoped PGlite (`getPGlite()`)
- [ ] No per-test PGlite instances
- [ ] E2E tests use roles/labels for selectors
- [ ] No arbitrary `waitForTimeout()` in E2E tests
- [ ] Tests are independent (no shared state)
- [ ] Testing behavior, not implementation
- [ ] `pnpm run preflight` passes (includes all test suites)

## Additional Resources

- Full testing strategy: `docs/TESTING_PLAN.md`
- E2E best practices: `docs/E2E_BEST_PRACTICES.md`
- Non-negotiables: `docs/NON_NEGOTIABLES.md` (CORE-TEST-\* rules)
- Playwright docs: Use Context7 MCP for latest patterns

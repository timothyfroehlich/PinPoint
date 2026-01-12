# Testing Patterns

## Playwright E2E Tests

### Login Helper + Landmark-Scoped Locators

```typescript
// e2e/support/actions.ts
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL("/dashboard");
}
```

```typescript
// e2e/smoke/navigation.spec.ts
import { loginAs } from "../support/actions";
import { TEST_USERS } from "../support/constants";

test("authenticated navigation", async ({ page }) => {
  await loginAs(page, TEST_USERS.member.email, TEST_USERS.member.password);

  // Scope locators to landmarks to avoid strict-mode collisions
  const nav = page.getByRole("navigation");
  await expect(nav.getByRole("link", { name: /Machines/i })).toBeVisible();
  await expect(nav.getByText(TEST_USERS.member.name)).toBeVisible();
});
```

**Key points**:

- Keep reusable flows in `e2e/support/actions.ts`
- Scope locators to landmarks (`getByRole("navigation")`, `getByRole("main")`) to avoid collisions
- Use constants for test data in `e2e/support/constants.ts`
- When tests share state, use `test.describe.serial` for deterministic execution
- Prefer semantic locators (`getByRole`, `getByLabel`) over test IDs

## Integration Tests with PGlite

```typescript
// src/test/integration/machines.test.ts
import { describe, it, expect } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { machines } from "~/server/db/schema";

describe("Machine CRUD Operations (PGlite)", () => {
  // Set up worker-scoped PGlite and auto-cleanup after each test
  setupTestDb();

  it("should create a machine", async () => {
    const db = await getTestDb();

    const [machine] = await db
      .insert(machines)
      .values({ name: "Test Machine" })
      .returning();

    expect(machine).toBeDefined();
    expect(machine.name).toBe("Test Machine");
  });
});
```

**Key points**:

- Use worker-scoped PGlite (CORE-TEST-001)
- Never create per-test instances (causes system lockups)
- Use `setupTestDb()` helper for automatic cleanup
- Test database operations, not Server Components
- Integration tests in `src/test/integration/`

### Integration Tests with Module Mocking

For testing service layer functions that import `~/server/db`, use module mocking to redirect to PGlite:

```typescript
// src/test/integration/supabase/issue-services.test.ts
import { describe, it, expect, beforeEach, vi, beforeAll } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { updateIssueStatus } from "~/services/issues";

// Mock the database module to use PGlite instance
vi.mock("~/server/db", () => ({
  db: {
    insert: vi.fn((...args: any[]) =>
      (globalThis as any).testDb.insert(...args)
    ),
    update: vi.fn((...args: any[]) =>
      (globalThis as any).testDb.update(...args)
    ),
    query: {
      issues: {
        findFirst: vi.fn((...args: any[]) =>
          (globalThis as any).testDb.query.issues.findFirst(...args)
        ),
      },
    },
    transaction: vi.fn((cb: any) => cb((globalThis as any).testDb)),
  },
}));

describe("Issue Service Functions", () => {
  setupTestDb();

  let testIssue: any;

  beforeAll(async () => {
    (globalThis as any).testDb = await getTestDb();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    // Set up test data
    const [issue] = await db
      .insert(issues)
      .values({
        /*...*/
      })
      .returning();
    testIssue = issue;
  });

  it("should update status and create timeline event", async () => {
    await updateIssueStatus({
      issueId: testIssue.id,
      status: "in_progress",
      userId: "test-user",
    });

    const db = await getTestDb();
    const updated = await db.query.issues.findFirst({
      where: eq(issues.id, testIssue.id),
    });

    expect(updated?.status).toBe("in_progress");

    // Verify timeline event was created
    const events = await db.query.issueComments.findMany({
      where: eq(issueComments.issueId, testIssue.id),
    });
    expect(events.some((e) => e.content.includes("Status changed"))).toBe(true);
  });
});
```

**Key points**:

- Mock `~/server/db` module at file level with `vi.mock()`
- Forward all calls to `(globalThis as any).testDb`
- Set `globalThis.testDb` in `beforeAll`
- Allows testing actual service functions (not mocked logic)
- Verifies transactions and side effects (timeline events, notifications)
- **Use `any` types in mock setup** (acceptable for test infrastructure)

**When to use**:

✅ Testing service layer functions that import `db` from `~/server/db`
✅ Verifying transaction behavior
✅ Testing timeline events and notifications
✅ Integration tests that need full database interaction

❌ Don't mock individual database methods (prefer this full module mock)
❌ Don't use for unit tests (those should test pure functions)

## Unit Tests

```typescript
// src/lib/machines/status.test.ts
import { describe, it, expect } from "vitest";
import { deriveMachineStatus, type IssueForStatus } from "./status";

describe("deriveMachineStatus", () => {
  it("returns operational when no issues", () => {
    expect(deriveMachineStatus([])).toBe("operational");
  });

  it("returns unplayable when has unplayable issue", () => {
    const issues: IssueForStatus[] = [
      { status: "new", severity: "unplayable" },
    ];
    expect(deriveMachineStatus(issues)).toBe("unplayable");
  });

  it("ignores resolved issues", () => {
    const issues: IssueForStatus[] = [
      { status: "resolved", severity: "unplayable" },
    ];
    expect(deriveMachineStatus(issues)).toBe("operational");
  });
});
```

**Key points**:

- Test pure functions in unit tests
- Test edge cases (empty arrays, resolved issues, etc.)
- Keep tests focused and readable
- Unit tests in same directory as source (e.g., `status.test.ts` next to `status.ts`)

## Vitest Deep Mocks (vitest-mock-extended)

- Use `mockDeep` + `mockReset` for complex dependencies (e.g., Drizzle `db` object with chained builders).
- Centralize chain helpers (e.g., `mockInsertReturning`) inside the test file to keep call sites small and intention-revealing.
- Always call `mockReset` in `beforeEach` to avoid cross-test pollution.
- Prefer mocking at service boundaries rather than individual functions to keep assertions focused on behavior.

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

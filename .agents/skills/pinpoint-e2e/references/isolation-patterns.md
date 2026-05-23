# Isolation Patterns

## Unique Identifiers

Use `e2e/support/test-isolation.ts` to generate worker-specific identifiers.

- **`getTestPrefix()`**: Returns `w{workerIndex}_{randomSuffix}` (e.g., `w0_a1b2`).
- **`getTestEmail(base)`**: Returns `base+prefix@domain` (e.g., `admin+w0_a1b2@test.com`).
- **`getTestMachineInitials()`**: Returns `T{workerIndex}{RandomChar}` (e.g., `T0X`).
- **`getTestIssueTitle(base)`**: Returns `[{prefix}] {base}` (e.g., `[w0_a1b2] My Issue`).

## Creating Test Data

Use `e2e/support/supabase-admin.ts` to create data directly in Supabase (bypassing UI).

```typescript
import { createTestUser, createTestMachine } from "e2e/support/supabase-admin";
import { getTestEmail } from "e2e/support/test-isolation";

// Create unique admin
const email = getTestEmail("admin@test.com");
const user = await createTestUser(email, "password");
await updateUserRole(user.id, "admin");

// Create unique machine
const machine = await createTestMachine(user.id);
```

## Filtering in UI

When testing lists (like Dashboard or Recent Issues), filter by your worker's prefix.

```typescript
import { getTestPrefix } from "e2e/support/test-isolation";

const prefix = getTestPrefix();
// Only click cards belonging to this test run
const myCard = page
  .getByTestId("issue-card")
  .filter({ hasText: `[${prefix}]` })
  .first();
```

## Cleaning Up

Always clean up resources in `test.afterAll`.

```typescript
import { deleteTestUser, deleteTestMachine } from "e2e/support/supabase-admin";

const cleanupUserIds: string[] = [];
const cleanupMachineIds: string[] = [];

test.afterAll(async () => {
  for (const id of cleanupMachineIds)
    await deleteTestMachine(id).catch(() => {});
  for (const id of cleanupUserIds) await deleteTestUser(id).catch(() => {});
});
```

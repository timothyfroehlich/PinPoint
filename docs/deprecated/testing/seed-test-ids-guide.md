# SEED_TEST_IDS Usage Guide

## Standard Patterns by Test Type

### Unit Tests (Mock Data)

```typescript
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Use MOCK_PATTERNS for unit tests with mocked data
expect(result.organizationId).toBe(SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION);
expect(result.userId).toBe(SEED_TEST_IDS.MOCK_PATTERNS.USER);
expect(result.machineId).toBe(SEED_TEST_IDS.MOCK_PATTERNS.MACHINE);
```

### Integration Tests (Real Data)

```typescript
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Use specific constants for integration tests with seeded data
await withIsolatedTest(workerDb, async (db) => {
  const issue = await db.query.issues.findFirst({
    where: eq(issues.organizationId, SEED_TEST_IDS.ORGANIZATIONS.primary),
  });

  expect(issue.machineId).toBe(SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1);
});
```

### Service Tests (Business Logic)

```typescript
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Use primary org for most service logic tests
const result = await issueService.create({
  title: "Test Issue",
  organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
  machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
  createdBy: SEED_TEST_IDS.USERS.ADMIN,
});
```

### Cross-Organization Tests

```typescript
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Test organizational boundaries
const primaryData = await getDataForOrg(SEED_TEST_IDS.ORGANIZATIONS.primary);
const competitorData = await getDataForOrg(
  SEED_TEST_IDS.ORGANIZATIONS.competitor,
);

// Should be isolated
expect(primaryData).not.toContainEqual(competitorData[0]);
```

## Replacement Patterns

### Before (Inconsistent)

```typescript
const orgId = "test-org-1";
const userId = "user-123";
const machineId = "machine-mm-001";
const issueId = "issue-abc";
```

### After (Standardized)

```typescript
const orgId = SEED_TEST_IDS.ORGANIZATIONS.primary;
const userId = SEED_TEST_IDS.USERS.ADMIN;
const machineId = SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1;
const issueId = SEED_TEST_IDS.ISSUES.ISSUE_1;
```

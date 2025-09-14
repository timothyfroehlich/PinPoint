# Test Infrastructure Documentation

This directory contains test utilities, templates, and constants for PinPoint's testing infrastructure.

## Structure

```
src/test/
├── helpers/                    # Test utility functions and mocks
│   ├── service-test-helpers.ts # Service layer testing utilities
│   └── anonymous-test-helpers.ts # Anonymous user testing utilities
├── templates/                  # Test templates for consistent patterns
│   ├── service.test.template.ts # Service layer test template
│   └── anonymous-rls.test.template.ts # Anonymous user RLS test template
├── constants/                  # Test constants and seed data
│   └── seed-test-ids.ts       # Predictable test IDs
└── README.md                  # This documentation
```

## Test Types

PinPoint uses a structured approach with clear test types for different scenarios:

### 1. Service Layer Testing

**File**: `helpers/service-test-helpers.ts`
**Template**: `templates/service.test.template.ts`

For testing business logic services with mocked dependencies:

```typescript
import { serviceTestUtils } from "../helpers/service-test-helpers";

describe("MyService", () => {
  let context: ServiceTestContext;

  beforeEach(() => {
    context = serviceTestUtils.createContext();
  });

  it("should perform organization-scoped operations", async () => {
    const service = new MyService(context.mockDb);

    // Test with predictable organization IDs
    const result = await service.doSomething(context.organizationId);

    // Validate organization scoping
    serviceTestUtils.expectOrgScoping(
      context.mockDb.insert,
      context.organizationId,
    );
  });
});
```

### 2. Anonymous User RLS Testing

**File**: `helpers/anonymous-test-helpers.ts`
**Template**: `templates/anonymous-rls.test.template.ts`

For testing anonymous user scenarios with organization context from subdomain resolution:

```typescript
import { anonymousTestUtils } from "../helpers/anonymous-test-helpers";

describe("PublicRouter Anonymous Users", () => {
  let testContext: AnonymousTestContext;

  beforeEach(() => {
    testContext = anonymousTestUtils.createContext({
      organizationId: anonymousTestUtils.testIds.ORGANIZATIONS.primary,
      subdomain: "test-primary",
    });
  });

  it("should resolve organization from subdomain", async () => {
    expect(testContext.mockContext.user).toBeNull(); // Anonymous
    expect(testContext.mockContext.organization).toBeDefined();
  });
});
```

## Key Testing Patterns

### Organization Scoping Validation

All multi-tenant operations should be tested for proper organization scoping:

```typescript
// Service layer validation
serviceTestUtils.expectOrgScoping(mockCall, expectedOrgId);

// Anonymous user session variable validation
anonymousTestUtils.expectSessionVariable(mockDb, expectedOrgId);
```

### Cross-Organization Security Testing

Test that users cannot access data from other organizations:

```typescript
const { userContext, targetData } = anonymousTestUtils.crossOrgAccess();

// Test that user from primary org cannot access competitor org data
expect(await service.getData(targetData.organizationId)).toBeNull();
```

### RLS Policy Testing

Test that RLS policies properly scope data access:

```typescript
// Mock RLS behavior
testContext.mockDb.query.items.findMany.mockResolvedValue([
  { id: "item-1", organization_id: testContext.organization.id },
]);

const result = await caller.getAll();

// Verify only org-scoped data returned
expect(
  result.every((item) => item.organization_id === testContext.organization.id),
).toBe(true);
```

## Test Data Constants

Use predictable test IDs from `constants/seed-test-ids.ts`:

```typescript
import { SEED_TEST_IDS } from "../constants/seed-test-ids";

// Organizations
SEED_TEST_IDS.ORGANIZATIONS.primary; // "test-org-pinpoint"
SEED_TEST_IDS.ORGANIZATIONS.competitor; // "test-org-competitor"

// Users
SEED_TEST_IDS.USERS.ADMIN; // "test-user-tim"
SEED_TEST_IDS.USERS.MEMBER1; // "test-user-harry"

// Other entities...
```

## Anonymous User Testing

### Basic Anonymous Context

```typescript
const context = anonymousTestUtils.createContext({
  organizationId: "my-org-id",
  subdomain: "my-subdomain",
});

// Context includes:
// - mockContext: Partial<TRPCContext> with anonymous user (null)
// - organization: Resolved from subdomain
// - mockDb: Mocked database with organization lookup
// - headers: Request headers with x-subdomain
```

### Cross-Organization Testing

```typescript
const { primaryContext, competitorContext } =
  anonymousTestUtils.createCrossOrgContext();

// Test security boundaries between organizations
```

### QR Code Cross-Organization Testing

```typescript
const machine = anonymousTestUtils.mockMachines.competitorOrg;

// Test that QR codes work cross-org (for redirection)
const result = await caller.resolveQRCode({ qrCodeId: machine.qr_code_id });
expect(result.organization.subdomain).toBe("competitor-test");
```

## Best Practices

### 1. Use Predictable Test Data

Always use constants from `SEED_TEST_IDS` for consistent, debuggable tests:

```typescript
// ✅ Good: Predictable and debuggable
const orgId = SEED_TEST_IDS.ORGANIZATIONS.primary;

// ❌ Bad: Random and hard to debug
const orgId = generateRandomId();
```

### 2. Test Organization Scoping

Every multi-tenant operation should verify organization scoping:

```typescript
// Test that data operations are scoped to the correct organization
serviceTestUtils.expectOrgScoping(mockCall, expectedOrgId);
```

### 3. Test Security Boundaries

Always test that users cannot access other organizations' data:

```typescript
// Test cross-organization access is properly blocked
const { userContext, targetData } = anonymousTestUtils.crossOrgAccess();
expect(await service.getData(targetData.organizationId)).toBeNull();
```

### 4. Mock Database Responses Realistically

Structure mocks to match actual database responses:

```typescript
testContext.mockDb.query.items.findMany.mockResolvedValue([
  {
    id: "item-1",
    organization_id: testContext.organization.id, // Proper foreign key
    name: "Test Item",
    created_at: new Date(),
  },
]);
```

### 5. Test Error Scenarios

Include tests for missing context, invalid subdomains, etc:

```typescript
it("should handle missing organization context", async () => {
  const contextWithoutOrg = anonymousTestUtils.createContext();
  contextWithoutOrg.mockContext.organization = null;

  await expect(caller.getData()).rejects.toThrow(/organization not found/i);
});
```

## Common Test Scenarios

### Anonymous Issue Creation

```typescript
it("should create issue with anonymous user context", async () => {
  const context = anonymousTestUtils.createContext();
  const caller = createCaller(context.mockContext);

  const result = await caller.publicCreate({
    title: "Test Issue",
    machineId: "machine-id",
  });

  expect(result.organizationId).toBe(context.organization.id);
});
```

### Location Browsing

```typescript
it("should list locations for organization", async () => {
  const context = anonymousTestUtils.createContext();

  context.mockDb.query.locations.findMany.mockResolvedValue([
    { id: "loc-1", organization_id: context.organization.id },
  ]);

  const caller = createCaller(context.mockContext);
  const result = await caller.getPublicLocations();

  expect(result).toHaveLength(1);
  expect(result[0].organizationId).toBe(context.organization.id);
});
```

### Machine Discovery

```typescript
it("should discover machines for issue reporting", async () => {
  const context = anonymousTestUtils.createContext();
  const machines = anonymousTestUtils.mockMachines;

  context.mockDb.query.machines.findMany.mockResolvedValue([
    machines.primaryOrg,
  ]);

  const caller = createCaller(context.mockContext);
  const result = await caller.getAllForIssues();

  expect(result[0].organizationId).toBe(context.organization.id);
});
```

## Integration with RLS Policies

These test utilities work with the enhanced RLS policies that support session variables for anonymous users:

```sql
-- Example RLS policy structure
CREATE POLICY "items_organization_isolation" ON items
  FOR ALL TO authenticated, anon
  USING (
    -- Authenticated: JWT-based
    (auth.jwt() IS NOT NULL AND "organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text)
    OR
    -- Anonymous: Session variable-based
    (auth.jwt() IS NULL AND "organizationId" = current_setting('app.current_organization_id', true))
  );
```

The test utilities mock the session variable setup that would normally be handled by the tRPC context creation middleware.

## Migration from Legacy Tests

When updating tests to use these patterns:

1. Replace custom mock setups with `serviceTestUtils.createContext()`
2. Use `SEED_TEST_IDS` constants instead of hardcoded values
3. Add organization scoping validation with `expectOrgScoping()`
4. Use templates as starting points for new test files
5. Test both authenticated and anonymous user scenarios where applicable

## Future Enhancements

- Integration test utilities for full request/response cycles
- Performance testing utilities for RLS policy overhead
- Visual test reporting for organization scoping coverage
- Automated security boundary validation

# RLS Testing Patterns

## Overview

Testing Row Level Security is critical to ensure multi-tenant isolation works correctly. This guide covers patterns for validating RLS policies in development and CI/CD.

## Unit Testing RLS Policies

### SQL-Based Testing

```sql
-- tests/rls/test_issue_policies.sql
BEGIN;

-- Setup test data
INSERT INTO organizations (id, name) VALUES
  ('org1', 'Organization 1'),
  ('org2', 'Organization 2');

INSERT INTO users (id, email) VALUES
  ('user1', 'user1@org1.com'),
  ('user2', 'user2@org2.com');

INSERT INTO issues (id, title, organization_id, created_by_id) VALUES
  ('issue1', 'Org 1 Issue', 'org1', 'user1'),
  ('issue2', 'Org 2 Issue', 'org2', 'user2');

-- Test: User can only see their org's issues
SET LOCAL request.jwt.claims = '{
  "sub": "user1",
  "organizationId": "org1",
  "permissions": ["issue:view"]
}';

SELECT COUNT(*) = 1 AS test_passed
FROM issues
WHERE id IN ('issue1', 'issue2');
-- Should only see issue1

-- Test: Cannot see other org's issues
SET LOCAL request.jwt.claims = '{
  "sub": "user1",
  "organizationId": "org1",
  "permissions": ["issue:view"]
}';

SELECT COUNT(*) = 0 AS test_passed
FROM issues
WHERE organization_id = 'org2';
-- Should see 0 issues

ROLLBACK;
```

### pgTAP Testing Framework

```sql
-- Install pgTAP extension first
CREATE EXTENSION IF NOT EXISTS pgtap;

-- tests/rls/issue_policies.test.sql
BEGIN;
SELECT plan(5);

-- Test setup
INSERT INTO organizations (id, name) VALUES ('test_org', 'Test Org');
INSERT INTO users (id, email) VALUES ('test_user', 'test@example.com');

-- Test 1: RLS is enabled
SELECT has_table('public', 'issues', 'Issues table exists');
SELECT row_security_is_enabled('public', 'issues', 'RLS enabled on issues');

-- Test 2: User can create issue in their org
SET LOCAL request.jwt.claims = '{
  "sub": "test_user",
  "organizationId": "test_org",
  "permissions": ["issue:create"]
}';

PREPARE insert_issue AS
INSERT INTO issues (title, organization_id, created_by_id)
VALUES ('Test Issue', 'test_org', 'test_user')
RETURNING id;

SELECT lives_ok('insert_issue', 'Can create issue in own org');

-- Test 3: Cannot create in different org
PREPARE insert_wrong_org AS
INSERT INTO issues (title, organization_id, created_by_id)
VALUES ('Wrong Org Issue', 'different_org', 'test_user');

SELECT throws_ok(
  'insert_wrong_org',
  '42501', -- insufficient_privilege
  'new row violates row-level security policy',
  'Cannot create issue in different org'
);

-- Test 4: Anonymous users blocked without permission
RESET request.jwt.claims;

PREPARE anonymous_insert AS
INSERT INTO issues (title, organization_id)
VALUES ('Anonymous Issue', 'test_org');

SELECT throws_ok(
  'anonymous_insert',
  '42501',
  'new row violates row-level security policy',
  'Anonymous cannot create without permission'
);

SELECT * FROM finish();
ROLLBACK;
```

## Integration Testing

### TypeScript/Vitest Testing

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { faker } from "@faker-js/faker";

describe("RLS Issue Policies", () => {
  let org1Client: SupabaseClient;
  let org2Client: SupabaseClient;
  let org1Id: string;
  let org2Id: string;

  beforeEach(async () => {
    // Create test organizations
    const { data: org1 } = await supabaseAdmin
      .from("organizations")
      .insert({ name: "Test Org 1" })
      .select()
      .single();
    org1Id = org1.id;

    const { data: org2 } = await supabaseAdmin
      .from("organizations")
      .insert({ name: "Test Org 2" })
      .select()
      .single();
    org2Id = org2.id;

    // Create test users with different orgs
    const user1 = await createTestUser({
      email: faker.internet.email(),
      organizationId: org1Id,
      permissions: ["issue:create", "issue:view"],
    });

    const user2 = await createTestUser({
      email: faker.internet.email(),
      organizationId: org2Id,
      permissions: ["issue:create", "issue:view"],
    });

    // Create clients with user sessions
    org1Client = createAuthenticatedClient(user1.access_token);
    org2Client = createAuthenticatedClient(user2.access_token);
  });

  it("prevents cross-organization data access", async () => {
    // Create issue in org1
    const { data: issue1 } = await org1Client
      .from("issues")
      .insert({
        title: "Org 1 Issue",
        organization_id: org1Id,
      })
      .select()
      .single();

    // Create issue in org2
    const { data: issue2 } = await org2Client
      .from("issues")
      .insert({
        title: "Org 2 Issue",
        organization_id: org2Id,
      })
      .select()
      .single();

    // Org1 user should only see org1 issues
    const { data: org1Issues } = await org1Client.from("issues").select("*");

    expect(org1Issues).toHaveLength(1);
    expect(org1Issues[0].id).toBe(issue1.id);

    // Org2 user should only see org2 issues
    const { data: org2Issues } = await org2Client.from("issues").select("*");

    expect(org2Issues).toHaveLength(1);
    expect(org2Issues[0].id).toBe(issue2.id);
  });

  it("prevents updating other organization's issues", async () => {
    // Create issue in org1
    const { data: issue } = await org1Client
      .from("issues")
      .insert({
        title: "Original Title",
        organization_id: org1Id,
      })
      .select()
      .single();

    // Org2 user tries to update org1 issue
    const { error } = await org2Client
      .from("issues")
      .update({ title: "Hacked Title" })
      .eq("id", issue.id);

    // Should fail with RLS error
    expect(error?.code).toBe("42501");
    expect(error?.message).toContain("row-level security policy");

    // Verify issue unchanged
    const { data: unchanged } = await org1Client
      .from("issues")
      .select("title")
      .eq("id", issue.id)
      .single();

    expect(unchanged.title).toBe("Original Title");
  });
});
```

### Testing Different Permission Levels

```typescript
describe("Permission-based RLS", () => {
  it("enforces view permissions", async () => {
    const viewerClient = await createClientWithPermissions(["issue:view"]);

    const adminClient = await createClientWithPermissions([
      "issue:view",
      "issue:admin",
    ]);

    // Create internal issue as admin
    await adminClient.from("issues").insert({
      title: "Internal Issue",
      is_internal: true,
      organization_id: testOrgId,
    });

    // Viewer should not see internal issues
    const { data: viewerIssues } = await viewerClient
      .from("issues")
      .select("*")
      .eq("is_internal", true);

    expect(viewerIssues).toHaveLength(0);

    // Admin should see internal issues
    const { data: adminIssues } = await adminClient
      .from("issues")
      .select("*")
      .eq("is_internal", true);

    expect(adminIssues).toHaveLength(1);
  });
});
```

## E2E Testing

### Playwright RLS Tests

```typescript
import { test, expect } from "@playwright/test";

test.describe("RLS Security", () => {
  test("prevents URL manipulation attacks", async ({ page }) => {
    // Login as org1 user
    await loginAsOrg1User(page);

    // Navigate to valid issue
    await page.goto("/issues/org1-issue-id");
    await expect(page.locator("h1")).toContainText("Org 1 Issue");

    // Try to access org2 issue via URL
    await page.goto("/issues/org2-issue-id");

    // Should show error or redirect
    await expect(page.locator("text=Issue not found")).toBeVisible();
    // Or check redirect
    await expect(page).toHaveURL("/issues");
  });

  test("API endpoints respect RLS", async ({ request }) => {
    const org1Token = await getOrg1AuthToken();

    // Try to fetch org2 data
    const response = await request.get("/api/issues/org2-issue-id", {
      headers: {
        Authorization: `Bearer ${org1Token}`,
      },
    });

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("not found");
  });
});
```

## Testing Utilities

### Create Test Users with JWT Claims

```typescript
export async function createTestUser(config: {
  email: string;
  organizationId: string;
  permissions: string[];
  role?: "admin" | "member" | "viewer";
}) {
  const { data: user } = await supabaseAdmin.auth.admin.createUser({
    email: config.email,
    password: faker.internet.password(),
    email_confirm: true,
    app_metadata: {
      organizationId: config.organizationId,
      permissions: config.permissions,
      role: config.role ?? "member",
    },
  });

  // Get access token for this user
  const { data: session } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: config.email,
  });

  return {
    user,
    access_token: session.properties.access_token,
  };
}

export function createAuthenticatedClient(accessToken: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  );
}
```

### RLS Test Helpers

```typescript
export class RLSTestHelper {
  constructor(private supabaseAdmin: SupabaseClient) {}

  async setupMultiTenantTest() {
    // Create multiple organizations
    const orgs = await Promise.all([
      this.createOrganization("Org A"),
      this.createOrganization("Org B"),
      this.createOrganization("Org C"),
    ]);

    // Create users in each org
    const users = await Promise.all(
      orgs.map((org) =>
        this.createOrgUser(org.id, ["issue:create", "issue:view"]),
      ),
    );

    // Create test data in each org
    await Promise.all(
      orgs.map((org, idx) => this.createTestData(org.id, users[idx].id)),
    );

    return { orgs, users };
  }

  async verifyIsolation(userClient: SupabaseClient, expectedOrgId: string) {
    // Check all tenant tables
    const tables = ["issues", "machines", "locations", "members"];

    for (const table of tables) {
      const { data } = await userClient.from(table).select("*");

      // Every row should belong to expected org
      const wrongOrgData = data?.filter(
        (row: any) => row.organization_id !== expectedOrgId,
      );

      expect(wrongOrgData).toHaveLength(0);
    }
  }
}
```

## Performance Testing

### RLS Policy Performance

```typescript
describe("RLS Performance", () => {
  it("handles large datasets efficiently", async () => {
    // Create many issues across orgs
    const issuePromises = [];
    for (let i = 0; i < 10000; i++) {
      issuePromises.push(
        supabaseAdmin.from("issues").insert({
          title: `Issue ${i}`,
          organization_id: i % 2 === 0 ? org1Id : org2Id,
        }),
      );
    }
    await Promise.all(issuePromises);

    // Measure query time with RLS
    const start = performance.now();

    const { data: issues } = await org1Client
      .from("issues")
      .select("id, title")
      .limit(100);

    const elapsed = performance.now() - start;

    // Should complete quickly even with RLS
    expect(elapsed).toBeLessThan(100); // ms

    // Should only return org1 issues
    expect(issues).toHaveLength(100);
    expect(issues.every((i) => i.title.includes("Issue"))).toBe(true);
  });
});
```

## ⚠️ MIGRATION: Application-Level Security Tests

### Update Existing Tests

```typescript
// OLD: Test application-level filtering
it("filters by organization", async () => {
  const result = await caller.issue.getAll({
    organizationId: "org1", // Manually passing org
  });

  expect(result.every((i) => i.organizationId === "org1")).toBe(true);
});

// NEW: Test RLS filtering
it("automatically filters by organization", async () => {
  // No need to pass organizationId
  const result = await caller.issue.getAll();

  // RLS ensures only user's org data returned
  expect(result.every((i) => i.organizationId === userOrgId)).toBe(true);
});
```

### Remove Redundant Security Tests

```typescript
// OLD: Test manual security checks
describe("Security", () => {
  it("prevents accessing other org issues", async () => {
    const caller = createCaller({ organizationId: "org1" });

    await expect(
      caller.issue.getById({
        id: "issue-from-org2",
        organizationId: "org1", // Wrong org
      }),
    ).rejects.toThrow("Access denied");
  });
});

// NEW: Trust RLS
describe("RLS Security", () => {
  it("prevents accessing other org issues", async () => {
    const caller = createCaller({ organizationId: "org1" });

    // RLS prevents access, returns not found
    await expect(
      caller.issue.getById({ id: "issue-from-org2" }),
    ).rejects.toThrow("Issue not found");
  });
});
```

## CI/CD Integration

### GitHub Actions RLS Tests

```yaml
name: RLS Security Tests

on: [push, pull_request]

jobs:
  rls-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: supabase/postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Database
        run: |
          psql -h localhost -U postgres -d postgres -f ./supabase/migrations/*.sql
          psql -h localhost -U postgres -d postgres -f ./tests/rls/setup.sql

      - name: Run pgTAP Tests
        run: |
          psql -h localhost -U postgres -d postgres -f ./tests/rls/*.test.sql

      - name: Run Integration Tests
        run: |
          npm run test:rls
```

### Test Coverage Requirements

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      include: ["src/server/db/policies/**"],
      thresholds: {
        statements: 100, // RLS must be fully tested
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
```

## Best Practices

1. **Test every policy** with positive and negative cases
2. **Use realistic JWT claims** matching production structure
3. **Test edge cases** like null values and empty permissions
4. **Automate RLS tests** in CI/CD pipeline
5. **Performance test** policies with large datasets
6. **Document test scenarios** for team understanding
7. **Use transactions** to isolate test data
8. **Test policy interactions** when multiple policies exist

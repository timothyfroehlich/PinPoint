# Security Testing Archetype

**Agent**: `security-test-architect`  
**Purpose**: Security boundary testing, RLS policy validation, multi-tenant isolation  
**Characteristics**: Database-level security enforcement, cross-organizational boundaries  
**Focus**: Comprehensive security validation and compliance

---

## When to Use This Archetype

✅ **Perfect for**:
- RLS policy validation
- Cross-organizational data isolation
- Permission matrix verification
- Role-based access control testing
- Multi-tenant security boundaries
- Database-level policy enforcement
- Compliance validation (GDPR, data isolation)

❌ **Wrong archetype for**:
- Business logic testing → Use Unit Testing Archetype
- Database operations → Use Integration Testing Archetype
- UI behavior → Use Unit Testing Archetype
- Performance testing → Use Integration Testing Archetype

---

## Core Principles

1. **Database-Level Security**: Test RLS policies directly at the database layer
2. **Comprehensive Isolation**: Verify complete organizational boundary enforcement
3. **Policy Enforcement**: Validate security policies under edge case conditions
4. **Multi-Context Testing**: Test complex security scenarios across organizations
5. **Compliance Focus**: Ensure GDPR and regulatory requirement adherence

---

## Pattern 1: Direct RLS Policy Testing with SEED_TEST_IDS

### Two-Organization Security Architecture

**Use the hardcoded organizations** from seed data architecture for predictable security testing:

```typescript
// src/security/__tests__/rls-policies.test.ts
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { getSeededTestData } from "~/test/helpers/pglite-test-setup";
import { sql } from "drizzle-orm";

test("issues RLS policy blocks cross-org access", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create data in primary organization
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
    const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
    
    await db.insert(schema.issues).values({
      title: "Primary Org Confidential Issue",
      machineId: seededData.machine!,
      priorityId: seededData.priority!,
    });

    // Create data in competitor organization
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.competitor}`);
    const competitorSeededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.competitor);
    
    await db.insert(schema.issues).values({
      title: "Competitor Org Confidential Issue", 
      machineId: competitorSeededData.machine!,
      priorityId: competitorSeededData.priority!,
    });

    // Verify isolation - competitor context should only see competitor data
    const competitorIssues = await db.query.issues.findMany();
    expect(competitorIssues).toHaveLength(1);
    expect(competitorIssues[0].title).toBe("Competitor Org Confidential Issue");
    expect(competitorIssues[0].organizationId).toBe(SEED_TEST_IDS.ORGANIZATIONS.competitor);

    // Switch to primary org and verify isolation
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
    const primaryIssues = await db.query.issues.findMany();
    expect(primaryIssues).toHaveLength(1);
    expect(primaryIssues[0].title).toBe("Primary Org Confidential Issue");
    expect(primaryIssues[0].organizationId).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
  });
});

test("RLS policy INSERT enforcement", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Test INSERT policy with predictable organization context
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
    const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);

    // Should succeed - correct org context with seeded relationships
    await expect(
      db.insert(schema.issues).values({
        title: "Valid Issue",
        description: "Should be allowed",
        machineId: seededData.machine!,
        priorityId: seededData.priority!,
      }),
    ).resolves.not.toThrow();

    // Verify organizationId was automatically set by RLS
    const [createdIssue] = await db.query.issues.findMany();
    expect(createdIssue.organizationId).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
  });
});

test("RLS policy SELECT isolation", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create data in multiple orgs without switching context
    // This tests RLS INSERT and SELECT policies together
    
    // Set up primary org data
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
    await db.insert(schema.issues).values({ title: "Primary Org Secret" });

    // Set up competitor org data  
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.competitor}`);
    await db.insert(schema.issues).values({ title: "Competitor Org Secret" });

    // Test SELECT policy isolation
    const competitorIssues = await db.query.issues.findMany();
    expect(competitorIssues).toHaveLength(1);
    expect(competitorIssues[0].title).toBe("Competitor Org Secret");

    // Switch context and verify different results
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
    const primaryIssues = await db.query.issues.findMany();
    expect(primaryIssues).toHaveLength(1);
    expect(primaryIssues[0].title).toBe("Primary Org Secret");
  });
});
```

### Role-Based Policy Testing

```typescript
test("RLS policy respects role-based permissions", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
    await db.execute(sql`SET app.current_user_id = ${SEED_TEST_IDS.USERS.MEMBER1}`);
    await db.execute(sql`SET app.current_user_role = 'member'`);

    // Member should be able to create issues
    await expect(
      db.insert(schema.issues).values({ 
        title: "Member Issue",
        description: "Created by member",
      }),
    ).resolves.not.toThrow();

    // But not delete them (admin-only operation)
    const [issue] = await db.query.issues.findMany();
    await expect(
      db.delete(schema.issues).where(eq(schema.issues.id, issue.id)),
    ).rejects.toThrow(/permission denied|policy violation/);

    // Switch to admin role
    await db.execute(sql`SET app.current_user_role = 'admin'`);

    // Admin should be able to delete
    await expect(
      db.delete(schema.issues).where(eq(schema.issues.id, issue.id)),
    ).resolves.not.toThrow();
  });
});

test("role escalation prevention", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
    await db.execute(sql`SET app.current_user_role = 'member'`);

    // Member should not be able to access admin-only data
    await expect(
      db.query.adminAuditLogs.findMany(),
    ).rejects.toThrow(/permission denied/);

    // Member should not be able to modify user roles
    await expect(
      db.update(schema.users).set({ role: "admin" }),
    ).rejects.toThrow(/permission denied/);
  });
});
```

---

## Pattern 2: Permission Matrix Testing

### Comprehensive Permission Validation

```typescript
const permissionMatrix = [
  { role: "admin", action: "delete", table: "issues", allowed: true },
  { role: "member", action: "delete", table: "issues", allowed: false },
  { role: "member", action: "create", table: "issues", allowed: true },
  { role: "member", action: "view", table: "issues", allowed: true },
  { role: "guest", action: "view", table: "issues", allowed: false },
  { role: "guest", action: "create", table: "issues", allowed: false },
  { role: "admin", action: "manage", table: "users", allowed: true },
  { role: "member", action: "manage", table: "users", allowed: false },
];

describe("Role-based permission matrix", () => {
  permissionMatrix.forEach(({ role, action, table, allowed }) => {
    test(`${role} ${allowed ? "can" : "cannot"} ${action} ${table}`, async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
        await db.execute(sql`SET app.current_user_role = ${role}`);

        if (allowed) {
          await expect(performAction(db, action, table)).resolves.not.toThrow();
        } else {
          await expect(performAction(db, action, table)).rejects.toThrow(/permission denied/i);
        }
      });
    });
  });
});

// Helper function for action testing
async function performAction(db: any, action: string, table: string) {
  switch (`${action}:${table}`) {
    case "delete:issues":
      // Create issue first
      const [issue] = await db.insert(schema.issues)
        .values({ title: "Test Issue" })
        .returning();
      return await db.delete(schema.issues)
        .where(eq(schema.issues.id, issue.id));

    case "create:issues":
      return await db.insert(schema.issues)
        .values({ title: "Test Issue" });

    case "view:issues":
      return await db.query.issues.findMany();

    case "manage:users":
      return await db.query.users.findMany();

    default:
      throw new Error(`Unknown action: ${action}:${table}`);
  }
}
```

### Cross-Resource Permission Testing

```typescript
test("permission inheritance across related resources", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);

    // Create test data as admin
    await db.execute(sql`SET app.current_user_role = 'admin'`);
    
    const [location] = await db.insert(schema.locations)
      .values({ name: "Test Location" })
      .returning();

    const [machine] = await db.insert(schema.machines)
      .values({ 
        name: "Test Machine",
        locationId: location.id,
      })
      .returning();

    const [issue] = await db.insert(schema.issues)
      .values({
        title: "Test Issue",
        machineId: machine.id,
      })
      .returning();

    // Switch to member role
    await db.execute(sql`SET app.current_user_role = 'member'`);

    // Member should be able to view issue and related data
    const issueWithRelated = await db.query.issues.findFirst({
      where: eq(schema.issues.id, issue.id),
      with: {
        machine: {
          with: {
            location: true,
          },
        },
      },
    });

    expect(issueWithRelated).toBeDefined();
    expect(issueWithRelated?.machine.location.name).toBe("Test Location");

    // But member should not be able to delete location
    await expect(
      db.delete(schema.locations).where(eq(schema.locations.id, location.id)),
    ).rejects.toThrow(/permission denied/);
  });
});
```

---

## Pattern 3: Cross-Organizational Data Leakage Prevention

### Complex Query Isolation Testing

```typescript
test("prevents data leakage through joins and aggregations", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Set up data in multiple orgs
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
    await db.insert(schema.issues).values({
      title: "Primary Org Confidential Data",
      priority: "critical",
    });

    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.competitor}`);

    // Attempt complex queries that might bypass RLS
    const attemptedLeak = await db
      .select({ count: sql`count(*)` })
      .from(schema.issues);

    expect(attemptedLeak[0].count).toBe(0); // RLS should prevent access

    // Test aggregation isolation
    const attemptedAggregation = await db
      .select({ 
        totalPriority: sql`count(*) filter (where ${schema.issues.priority} = 'critical')`,
      })
      .from(schema.issues);

    expect(attemptedAggregation[0].totalPriority).toBe(0); // No cross-org aggregation

    // Test subquery isolation
    const attemptedSubquery = await db
      .select()
      .from(schema.issues)
      .where(
        exists(
          db.select()
            .from(schema.issues)
            .where(sql`${schema.issues.priority} = 'critical'`)
        )
      );

    expect(attemptedSubquery).toHaveLength(0); // Subqueries also isolated
  });
});

test("foreign key constraints respect organizational boundaries", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create machine in primary org
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
    const [machine] = await db.insert(schema.machines)
      .values({ name: "Primary Org Machine" })
      .returning();

    // Switch to competitor org and try to reference primary org machine
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.competitor}`);

    // Should fail - can't reference cross-org machine
    await expect(
      db.insert(schema.issues).values({
        title: "Issue for other org machine",
        machineId: machine.id, // References primary org machine from competitor context
      })
    ).rejects.toThrow(); // RLS + foreign key violation
  });
});
```

### Multi-Tenant Boundary Stress Testing

```typescript
test("stress test organizational boundaries with concurrent access", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create data in multiple test organizations rapidly
    const organizations = [
      SEED_TEST_IDS.ORGANIZATIONS.primary, 
      SEED_TEST_IDS.ORGANIZATIONS.competitor, 
      'stress-org-3', 'stress-org-4', 'stress-org-5'
    ];
    const issuesPerOrg = 10;

    // Create test data for each org
    for (const orgId of organizations) {
      await db.execute(sql`SET app.current_organization_id = ${orgId}`);
      
      const issueData = Array.from({ length: issuesPerOrg }, (_, i) => ({
        title: `${orgId} Issue ${i}`,
        priority: i % 2 === 0 ? "high" : "low",
      }));

      await db.insert(schema.issues).values(issueData);
    }

    // Verify complete isolation for each org
    for (const orgId of organizations) {
      await db.execute(sql`SET app.current_organization_id = ${orgId}`);
      
      const orgIssues = await db.query.issues.findMany();
      expect(orgIssues).toHaveLength(issuesPerOrg);
      
      // Verify all issues belong to correct org
      orgIssues.forEach(issue => {
        expect(issue.organizationId).toBe(orgId);
        expect(issue.title).toContain(orgId);
      });

      // Verify no cross-contamination
      const otherOrgTitles = orgIssues.filter(issue => 
        !issue.title.startsWith(orgId)
      );
      expect(otherOrgTitles).toHaveLength(0);
    }
  });
});
```

---

## Pattern 4: Security Edge Cases and Attack Scenarios

### SQL Injection Resistance

```typescript
test("RLS policies resist SQL injection attempts", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);

    // Create legitimate data
    await db.insert(schema.issues).values({
      title: "Legitimate Issue",
    });

    // Attempt injection through org context (should be parameterized)
    await db.execute(sql`SET app.current_organization_id = ${"'; DROP TABLE issues; --"}`);

    // Verify table still exists and data integrity maintained
    const issues = await db.query.issues.findMany();
    expect(issues).toHaveLength(0); // Empty due to invalid org context

    // Switch back to valid org
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
    const validOrgIssues = await db.query.issues.findMany();
    expect(validOrgIssues).toHaveLength(1); // Data should still exist
  });
});

test("privilege escalation resistance", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
    await db.execute(sql`SET app.current_user_role = 'member'`);

    // Attempt to escalate privileges through various means
    await expect(
      db.execute(sql`SET app.current_user_role = 'admin'`)
    ).rejects.toThrow(/permission denied/);

    // Attempt to bypass role checks
    await expect(
      db.execute(sql`SET ROLE admin`)
    ).rejects.toThrow(/permission denied/);

    // Verify role remains unchanged
    const roleCheck = await db.execute(sql`SELECT current_setting('app.current_user_role')`);
    expect(roleCheck).toContain('member');
  });
});
```

### Data Exfiltration Prevention

```typescript
test("prevents data exfiltration through information disclosure", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create sensitive data in primary org
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
    await db.insert(schema.issues).values({
      title: "TOP SECRET PROJECT ALPHA",
      description: "Classified information here",
    });

    // Switch to competitor org attacker context
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.competitor}`);

    // Attempt to gather information about primary org data
    
    // 1. Count-based attacks
    const countAttempt = await db
      .select({ count: sql`count(*)` })
      .from(schema.issues);
    expect(countAttempt[0].count).toBe(0);

    // 2. Existence-based attacks
    const existsAttempt = await db
      .select({ 
        exists: sql`exists(select 1 from ${schema.issues} where title ilike '%SECRET%')` 
      });
    expect(existsAttempt[0].exists).toBe(false);

    // 3. Error message information disclosure
    try {
      await db.insert(schema.issues).values({
        title: "Test",
        machineId: "machine-that-might-exist-in-org-1",
      });
    } catch (error) {
      // Error message should not reveal information about other orgs
      expect(error.message).not.toContain(SEED_TEST_IDS.ORGANIZATIONS.primary);
      expect(error.message).not.toContain("machine-that-might-exist");
    }
  });
});
```

---

## Pattern 5: Multi-Context Security Scenarios

### Complex Security Workflow Testing

```typescript
test("multi-step security workflow with context switching", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Scenario: Cross-organizational collaboration attempt
    
    // Primary org admin creates sensitive issue
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
    await db.execute(sql`SET app.current_user_role = 'admin'`);
    
    const [sensitiveIssue] = await db.insert(schema.issues)
      .values({
        title: "Sensitive Security Issue",
        isConfidential: true,
      })
      .returning();

    // Competitor org member attempts to access
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.competitor}`);
    await db.execute(sql`SET app.current_user_role = 'member'`);

    // Should not be able to see primary org issue
    const competitorIssues = await db.query.issues.findMany();
    expect(competitorIssues).toHaveLength(0);

    // Should not be able to access specific issue by ID
    const directAccess = await db.query.issues.findFirst({
      where: eq(schema.issues.id, sensitiveIssue.id),
    });
    expect(directAccess).toBeNull();

    // Competitor org admin also should not have access
    await db.execute(sql`SET app.current_user_role = 'admin'`);
    const adminAttempt = await db.query.issues.findFirst({
      where: eq(schema.issues.id, sensitiveIssue.id),
    });
    expect(adminAttempt).toBeNull();

    // Only primary org context should have access
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
    const validAccess = await db.query.issues.findFirst({
      where: eq(schema.issues.id, sensitiveIssue.id),
    });
    expect(validAccess).toBeDefined();
    expect(validAccess?.title).toBe("Sensitive Security Issue");
  });
});

test("permission inheritance with organizational boundaries", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create hierarchical data structure
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
    await db.execute(sql`SET app.current_user_role = 'admin'`);

    const [location] = await db.insert(schema.locations)
      .values({ name: "Primary Org Location" })
      .returning();

    const [machine] = await db.insert(schema.machines)
      .values({ 
        name: "Primary Org Machine",
        locationId: location.id,
      })
      .returning();

    // Different org admin should not inherit permissions
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.competitor}`);
    await db.execute(sql`SET app.current_user_role = 'admin'`);

    // Should not be able to access primary org resources
    const competitorOrgMachines = await db.query.machines.findMany();
    expect(competitorOrgMachines).toHaveLength(0);

    // Should not be able to create issues on primary org machines
    await expect(
      db.insert(schema.issues).values({
        title: "Cross-org issue",
        machineId: machine.id,
      })
    ).rejects.toThrow();
  });
});
```

---

## Pattern 6: pgTAP Native RLS Testing

### Direct PostgreSQL RLS Validation

**Purpose**: Test RLS policies directly at the database level using native PostgreSQL testing

**Key Benefits**:
- Native PostgreSQL execution (no application layer interference)
- JWT claim simulation for realistic auth context
- Fast execution with comprehensive policy coverage
- Perfect for systematic RLS policy validation

**Complete Guide**: [📖 pgtap-rls-testing.md](./pgtap-rls-testing.md)

```sql
-- supabase/tests/rls/issues.test.sql
BEGIN;

SELECT plan(4);

-- Setup test data using hardcoded IDs
INSERT INTO organizations (id, name) VALUES 
  (test_org_primary(), 'Austin Pinball Collective'),
  (test_org_competitor(), 'Competitor Arcade');

INSERT INTO issues (id, title, organization_id) VALUES
  (test_issue_primary(), 'Primary Org Issue', test_org_primary()),
  (test_issue_competitor(), 'Competitor Org Issue', test_org_competitor());

-- Test 1: RLS is enabled
SELECT row_security_is_enabled('public', 'issues', 'RLS enabled on issues');

-- Test 2: Organizational isolation
SET LOCAL role = 'authenticated';
SELECT set_jwt_claims_for_test(test_org_primary());

SELECT results_eq(
  'SELECT id FROM issues ORDER BY id',
  ARRAY[test_issue_primary()],
  'User only sees their org issues'
);

-- Test 3: Cross-org insert prevention
PREPARE cross_org_insert AS
  INSERT INTO issues (title, organization_id) VALUES ('Test', test_org_competitor());

SELECT throws_ok(
  'cross_org_insert',
  '42501',
  'new row violates row-level security policy',
  'Cannot insert into different org'
);

-- Test 4: Anonymous access blocked
SET LOCAL role = 'anon';
SELECT is_empty('SELECT * FROM issues', 'Anonymous users see no data');

SELECT * FROM finish();
ROLLBACK;
```

### Role-Based Permission Testing

```sql
-- Test admin vs member permissions
SET LOCAL role = 'authenticated';
SELECT set_jwt_claims_for_test(
  test_org_primary(), 
  test_user_admin(), 
  'admin',
  ARRAY['issue:view', 'issue:create', 'issue:delete']
);

-- Admin can delete
PREPARE admin_delete AS DELETE FROM issues WHERE id = 'test-issue';
SELECT lives_ok('admin_delete', 'Admin can delete issues');

-- Switch to member role
SELECT set_jwt_claims_for_test(
  test_org_primary(), 
  test_user_member1(), 
  'member',
  ARRAY['issue:view', 'issue:create']
);

-- Member cannot delete
PREPARE member_delete AS DELETE FROM issues WHERE id = 'test-issue';
SELECT throws_ok(
  'member_delete', 
  '42501',
  'permission denied',
  'Member cannot delete issues'
);
```

### Security Edge Case Testing

```sql
-- Test SQL injection resistance
SELECT set_jwt_claims_for_test('; DROP TABLE issues; --');

SELECT results_eq(
  'SELECT COUNT(*)::int FROM issues',
  $$VALUES (0)$$,
  'Malformed org context fails safely'
);

-- Test information disclosure prevention
SELECT set_jwt_claims_for_test('attacker-org');

-- Should not reveal information about other orgs through errors
PREPARE info_probe AS
  INSERT INTO issues (title, machine_id) VALUES ('Probe', 'secret-machine-id');

SELECT throws_like(
  'info_probe',
  '%violates%',
  'Errors do not disclose cross-org information'
);
```

### pgTAP Test Execution

**Local execution**:
```bash
# Run single RLS test
psql $DATABASE_URL -f supabase/tests/rls/issues.test.sql

# Run all RLS tests with pg_prove
pg_prove --ext .sql supabase/tests/rls/*.test.sql

# Use project runner
npm run test:rls
```

**CI/CD integration**:
```yaml
- name: Run pgTAP RLS tests
  run: |
    pg_prove --host localhost --username postgres --dbname postgres \
             --ext .sql supabase/tests/rls/*.test.sql
```

### Integration with Archetype Testing

**pgTAP complements Application Testing**:
- **pgTAP**: Validates RLS policies work correctly
- **PGlite with integration_tester**: Tests business logic without RLS overhead
- **Clear separation**: Security validation vs functionality testing

**When to use pgTAP in Security Archetype**:
✅ **Perfect for**: Direct RLS policy validation, database-level security
✅ **Use alongside**: Application-level security tests for complete coverage
✅ **Systematic validation**: All organizational boundaries and permission matrices

**Cross-reference**: [📖 dual-track-testing-strategy.md](./dual-track-testing-strategy.md) for complete dual-track approach

---

## Pattern 7: Compliance and Audit Testing

### GDPR Data Isolation Validation

```typescript
test("GDPR compliance: complete data isolation between organizations", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create EU organization data (using primary org as EU example)
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
    await db.insert(schema.users).values({
      email: "eu-user@gdpr-protected.eu",
      personalData: "EU citizen personal information",
    });

    await db.insert(schema.issues).values({
      title: "GDPR Protected Issue",
      description: "Contains EU citizen data",
    });

    // Create US organization data (using competitor org as US example)
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.competitor}`);
    await db.insert(schema.users).values({
      email: "us-user@company.com",
      personalData: "US citizen personal information",
    });

    // Verify complete isolation for data protection compliance
    const usOrgUsers = await db.query.users.findMany();
    expect(usOrgUsers).toHaveLength(1);
    expect(usOrgUsers[0].email).toBe("us-user@company.com");

    const usOrgIssues = await db.query.issues.findMany();
    expect(usOrgIssues).toHaveLength(0); // No EU data visible

    // Switch to EU org and verify inverse
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
    
    const euOrgUsers = await db.query.users.findMany();
    expect(euOrgUsers).toHaveLength(1);
    expect(euOrgUsers[0].email).toBe("eu-user@gdpr-protected.eu");

    const euOrgIssues = await db.query.issues.findMany();
    expect(euOrgIssues).toHaveLength(1);
    expect(euOrgIssues[0].title).toBe("GDPR Protected Issue");
  });
});

test("audit trail organizational scoping", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Generate audit events in multiple orgs
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
    await db.insert(schema.auditLogs).values({
      action: "SENSITIVE_OPERATION",
      details: "Primary org sensitive action performed",
      userId: SEED_TEST_IDS.USERS.ADMIN,
    });

    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.competitor}`);
    await db.insert(schema.auditLogs).values({
      action: "NORMAL_OPERATION", 
      details: "Competitor org normal action performed",
      userId: SEED_TEST_IDS.USERS.MEMBER1,
    });

    // Verify audit isolation
    const competitorAudits = await db.query.auditLogs.findMany();
    expect(competitorAudits).toHaveLength(1);
    expect(competitorAudits[0].details).toBe("Competitor org normal action performed");

    // Cross-org audit access should be impossible
    await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
    const primaryAudits = await db.query.auditLogs.findMany();
    expect(primaryAudits).toHaveLength(1);
    expect(primaryAudits[0].details).toBe("Primary org sensitive action performed");
  });
});
```

---

## Anti-Patterns to Avoid

### ❌ Client-Side Security Only

```typescript
// ❌ BAD: Client-side permission checks only
if (user.role === "admin") {
  // Unsafe - can be bypassed
  await deleteIssue(issueId);
}

// ✅ GOOD: Database-level enforcement
// RLS policies enforce security at database level
// Client checks are UX only, not security
```

### ❌ Manual Organizational Filtering

```typescript
// ❌ BAD: Manual filtering (can be forgotten)
const issues = await db.query.issues.findMany({
  where: eq(issues.organizationId, userOrgId), // Manual, error-prone
});

// ✅ GOOD: RLS automatic enforcement
const issues = await db.query.issues.findMany();
// RLS automatically filters by organization
```

### ❌ Incomplete Security Testing

```typescript
// ❌ BAD: Only testing happy path
test("admin can delete issues", async () => {
  // Only tests allowed operation
});

// ✅ GOOD: Test both allowed and denied
test("permission boundaries", async () => {
  // Test allowed operations
  await expect(adminAction()).resolves.not.toThrow();
  
  // Test denied operations  
  await expect(memberAction()).rejects.toThrow();
});
```

---

## Quality Guidelines

### Security Coverage Requirements
- **Complete boundary testing**: Every organizational boundary must be tested
- **Policy validation**: All RLS policies must have direct tests
- **Edge case coverage**: Test security under unusual conditions
- **Attack scenario simulation**: Test against common attack patterns

### Compliance Validation
- **Data isolation**: Verify complete organizational data separation
- **Audit integrity**: Ensure audit trails respect organizational boundaries
- **Role enforcement**: Validate role-based access at database level
- **Permission inheritance**: Test complex permission scenarios

### Performance Under Security Load
- **Policy efficiency**: RLS policies should not significantly impact performance
- **Isolation overhead**: Organizational filtering should be efficient
- **Concurrent access**: Security should maintain under concurrent multi-org access

---

## Agent Assignment

**This archetype is handled by**: `security-test-architect`

**Agent responsibilities**:
- Validate RLS policy enforcement under all conditions
- Test organizational boundary integrity comprehensively
- Verify permission matrix implementation
- Ensure compliance with data protection regulations
- Test security under edge cases and attack scenarios

**Quality validation**:
- All security boundaries are tested
- RLS policies have comprehensive coverage
- Permission matrices are validated
- Cross-organizational isolation is verified
- Compliance requirements are met

---

## When to Escalate to Other Archetypes

**Switch to Integration Testing Archetype when**:
- Primary focus is functionality rather than security
- Testing database operations without security focus
- Validating business logic with database state

**Switch to Unit Testing Archetype when**:
- Testing permission calculation logic only
- Validating security utilities without database
- Testing UI security component behavior

The security testing archetype ensures comprehensive validation of all security boundaries and policies, providing confidence that the multi-tenant system maintains proper isolation and access control under all conditions.
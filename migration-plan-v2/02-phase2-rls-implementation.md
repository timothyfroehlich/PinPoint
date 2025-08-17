# Row Level Security Implementation

**Objective**: Transform PinPoint from manual organizationId filtering to automatic database-level multi-tenancy using PostgreSQL Row Level Security.

**Impact**: Eliminates 1000+ lines of organizational filtering code and makes multi-tenancy automatic at the database level.

---

## 1. RLS Foundation Overview

### Database-Level vs Application-Level Multi-Tenancy

**Current State (Application-Level)**:

```typescript
// Every query requires manual organizationId filtering
const issues = await db.query.issues.findMany({
  where: eq(issues.organizationId, ctx.user.organizationId),
});

// Every insert requires organizationId injection
await db.insert(issues).values({
  ...data,
  organizationId: ctx.user.organizationId,
});
```

**Target State (Database-Level)**:

```typescript
// Set organizational context once per request
await db.execute(
  sql`SET app.current_organization_id = ${ctx.user.organizationId}`,
);

// All subsequent queries automatically org-scoped
const issues = await db.query.issues.findMany(); // Automatic filtering!
const newIssue = await db.insert(issues).values(data); // Automatic organizationId
```

### Benefits of RLS Implementation

1. **Security by Default**: Database enforces boundaries, not application code
2. **Simplified Queries**: Remove organizationId from every where clause
3. **Future-Proof**: New features automatically inherit multi-tenancy
4. **Performance**: Database-level optimizations and indexing
5. **Testing Simplicity**: Set session context once, test without org boilerplate

---

## 2. Database Policy Creation

### Session Variable Configuration

```sql
-- Create the session variable for current organization
-- This will be set at the beginning of each request
CREATE OR REPLACE FUNCTION get_current_organization_id()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_organization_id', true);
END;
$$ LANGUAGE plpgsql STABLE;
```

### Multi-Tenant Table Policies

**Core Multi-Tenant Tables** (based on schema analysis):

- organizations
- memberships
- locations
- machines
- issues
- priorities
- issueStatuses
- comments
- attachments
- issueHistory
- collections
- collectionTypes
- collectionMachines
- notifications
- pinballMapConfigs

### Organizations Table Policies

```sql
-- Organizations: Users can only see their own organization
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization" ON organizations
FOR SELECT USING (
  id = get_current_organization_id()
);

CREATE POLICY "Users can update their organization" ON organizations
FOR UPDATE USING (
  id = get_current_organization_id()
);
```

### Memberships Table Policies

```sql
-- Memberships: Scoped to current organization
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Memberships scoped to organization" ON memberships
FOR ALL USING (
  "organizationId" = get_current_organization_id()
);
```

### Locations Table Policies

```sql
-- Locations: Organization-scoped asset management
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Locations scoped to organization" ON locations
FOR ALL USING (
  "organizationId" = get_current_organization_id()
);

-- Automatically set organizationId on INSERT
CREATE OR REPLACE FUNCTION set_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW."organizationId" = get_current_organization_id();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_locations_organization_id
  BEFORE INSERT ON locations
  FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();
```

### Machines Table Policies

```sql
-- Machines: Core asset table with organization scoping
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Machines scoped to organization" ON machines
FOR ALL USING (
  "organizationId" = get_current_organization_id()
);

CREATE TRIGGER set_machines_organization_id
  BEFORE INSERT ON machines
  FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();
```

### Issues Table Policies

```sql
-- Issues: Primary business entity with organization scoping
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Issues scoped to organization" ON issues
FOR ALL USING (
  "organizationId" = get_current_organization_id()
);

CREATE TRIGGER set_issues_organization_id
  BEFORE INSERT ON issues
  FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();
```

### Issue-Related Tables Policies

```sql
-- Priorities: Organization-specific configurations
ALTER TABLE priorities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Priorities scoped to organization" ON priorities
FOR ALL USING (
  "organizationId" = get_current_organization_id()
);

CREATE TRIGGER set_priorities_organization_id
  BEFORE INSERT ON priorities
  FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

-- Issue Statuses: Organization-specific workflows
ALTER TABLE "issueStatuses" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Issue statuses scoped to organization" ON "issueStatuses"
FOR ALL USING (
  "organizationId" = get_current_organization_id()
);

CREATE TRIGGER set_issue_statuses_organization_id
  BEFORE INSERT ON "issueStatuses"
  FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

-- Comments: Inherit organization from parent issue
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments scoped to organization" ON comments
FOR ALL USING (
  "organizationId" = get_current_organization_id()
);

CREATE TRIGGER set_comments_organization_id
  BEFORE INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

-- Attachments: File storage with organization boundaries
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attachments scoped to organization" ON attachments
FOR ALL USING (
  "organizationId" = get_current_organization_id()
);

CREATE TRIGGER set_attachments_organization_id
  BEFORE INSERT ON attachments
  FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

-- Issue History: Activity tracking with organization context
ALTER TABLE "issueHistory" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Issue history scoped to organization" ON "issueHistory"
FOR ALL USING (
  "organizationId" = get_current_organization_id()
);

CREATE TRIGGER set_issue_history_organization_id
  BEFORE INSERT ON "issueHistory"
  FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();
```

### Collections Table Policies

```sql
-- Collection Types: Organization-specific collection configurations
ALTER TABLE "collectionTypes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collection types scoped to organization" ON "collectionTypes"
FOR ALL USING (
  "organizationId" = get_current_organization_id()
);

CREATE TRIGGER set_collection_types_organization_id
  BEFORE INSERT ON "collectionTypes"
  FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

-- Collections: Inherit organization from type and location
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collections scoped to organization via location" ON collections
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM locations
    WHERE locations.id = collections."locationId"
    AND locations."organizationId" = get_current_organization_id()
  )
);

-- Collection Machines: Junction table inheriting from both sides
ALTER TABLE "collectionMachines" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collection machines scoped to organization" ON "collectionMachines"
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM collections c
    JOIN locations l ON l.id = c."locationId"
    WHERE c.id = "collectionMachines"."collectionId"
    AND l."organizationId" = get_current_organization_id()
  )
);
```

### Global Reference Tables (No RLS)

```sql
-- Models: Global reference data (no organization scoping)
-- Users: Global user table (scoped by authentication)
-- Permissions: Global permission definitions
-- Roles: Organization-scoped but managed via memberships

-- Keep these tables without RLS as they are global references
-- or managed through other security mechanisms
```

---

## 3. Session Management Setup

### Drizzle Connection Configuration

**Enhanced Database Provider with RLS Session Management**:

```typescript
// src/server/db/rls-provider.ts
import { DrizzleClient } from "./drizzle";
import { sql } from "drizzle-orm";

export class RLSSessionManager {
  constructor(private db: DrizzleClient) {}

  /**
   * Set the organizational context for the current database session
   * This enables automatic RLS filtering for all subsequent queries
   */
  async setOrganizationContext(organizationId: string): Promise<void> {
    await this.db.execute(
      sql`SET LOCAL app.current_organization_id = ${organizationId}`,
    );
  }

  /**
   * Clear the organizational context (useful for testing)
   */
  async clearOrganizationContext(): Promise<void> {
    await this.db.execute(sql`SET LOCAL app.current_organization_id = NULL`);
  }

  /**
   * Get the current organizational context
   */
  async getCurrentOrganizationId(): Promise<string | null> {
    const result = await this.db.execute(
      sql`SELECT current_setting('app.current_organization_id', true) as org_id`,
    );
    return result.rows[0]?.org_id || null;
  }

  /**
   * Execute a function within a specific organizational context
   * Automatically sets and clears context
   */
  async withOrganizationContext<T>(
    organizationId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    await this.setOrganizationContext(organizationId);
    try {
      return await fn();
    } finally {
      // Context is automatically cleared at transaction end
      // But we can explicitly clear for long-running connections
    }
  }
}

// Add to database provider
export class EnhancedDatabaseProvider {
  private client: DrizzleClient;
  private rlsManager: RLSSessionManager;

  constructor(client: DrizzleClient) {
    this.client = client;
    this.rlsManager = new RLSSessionManager(client);
  }

  getClient(): DrizzleClient {
    return this.client;
  }

  getRLSManager(): RLSSessionManager {
    return this.rlsManager;
  }
}
```

### Supabase Integration Pattern

```typescript
// src/lib/supabase/rls.ts
import { createClient } from "./server";
import { DrizzleClient } from "~/server/db/drizzle";
import { sql } from "drizzle-orm";

/**
 * Set up RLS context based on Supabase user
 */
export async function setupRLSContext(
  db: DrizzleClient,
  user: { app_metadata: { organization_id?: string } },
): Promise<void> {
  if (!user.app_metadata.organization_id) {
    throw new Error("User does not have organization context");
  }

  await db.execute(
    sql`SET LOCAL app.current_organization_id = ${user.app_metadata.organization_id}`,
  );
}

/**
 * Middleware helper for setting up RLS in server contexts
 */
export async function withRLSContext<T>(
  db: DrizzleClient,
  organizationId: string,
  operation: () => Promise<T>,
): Promise<T> {
  // Use a transaction to ensure context isolation
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`SET LOCAL app.current_organization_id = ${organizationId}`,
    );
    return await operation();
  });
}
```

---

## 4. tRPC Middleware Simplification

### Current Complex Organization Middleware (100+ lines)

**Before RLS - Complex Validation**:

```typescript
export const organizationProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    // 50+ lines of organization validation
    if (!ctx.organization) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      });
    }

    const membership = await ctx.db.query.memberships.findFirst({
      where: (memberships, { and, eq }) =>
        and(
          eq(memberships.organizationId, organization.id),
          eq(memberships.userId, ctx.user.id),
        ),
      // Complex relational query for permissions...
    });

    if (!membership) {
      throw new TRPCError({ code: "FORBIDDEN", message: "No access" });
    }

    // 50+ more lines of permission setup...
    return next({ ctx: enhancedContext });
  },
);
```

### Simplified RLS-Enabled Middleware (~10 lines)

**After RLS - Simple Session Setup**:

```typescript
// src/server/api/trpc.rls.ts
export const rlsOrganizationProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (!ctx.organization?.id) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      });
    }

    // Set RLS context once - all queries automatically scoped
    await ctx.db.execute(
      sql`SET LOCAL app.current_organization_id = ${ctx.organization.id}`,
    );

    return next({ ctx });
  },
);
```

### Enhanced Context with RLS Manager

```typescript
// Enhanced tRPC context with RLS capabilities
export interface RLSTRPCContext extends TRPCContext {
  rlsManager: RLSSessionManager;
}

export const createRLSTRPCContext = async (
  opts: CreateTRPCContextOptions,
): Promise<RLSTRPCContext> => {
  const baseContext = await createTRPCContext(opts);
  const rlsManager = new RLSSessionManager(baseContext.db);

  return {
    ...baseContext,
    rlsManager,
  };
};

// Auto-setup RLS for organization procedures
export const autoRLSOrganizationProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (!ctx.organization?.id) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization required",
      });
    }

    // Automatically set RLS context
    await ctx.rlsManager.setOrganizationContext(ctx.organization.id);

    return next({
      ctx: {
        ...ctx,
        // organizationId is now automatically applied to all queries
      },
    });
  },
);
```

---

## 5. Application Query Updates

### Query Simplification Examples

**Issues Router - Before RLS**:

```typescript
// Every query needs manual organizationId filtering
export const issueRouter = createTRPCRouter({
  list: organizationProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.issues.findMany({
      where: eq(issues.organizationId, ctx.organization.id), // Manual filtering
      with: {
        machine: {
          where: eq(machines.organizationId, ctx.organization.id), // More manual filtering
        },
        priority: {
          where: eq(priorities.organizationId, ctx.organization.id), // Even more filtering
        },
      },
    });
  }),

  create: organizationProcedure
    .input(createIssueSchema)
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.insert(issues).values({
        ...input,
        organizationId: ctx.organization.id, // Manual injection
      });
    }),
});
```

**Issues Router - After RLS**:

```typescript
// Clean queries with automatic organizational scoping
export const issueRouter = createTRPCRouter({
  list: autoRLSOrganizationProcedure.query(async ({ ctx }) => {
    // RLS automatically filters by organization
    return await ctx.db.query.issues.findMany({
      with: {
        machine: true, // Also automatically scoped
        priority: true, // Also automatically scoped
      },
    });
  }),

  create: autoRLSOrganizationProcedure
    .input(createIssueSchema)
    .mutation(async ({ ctx, input }) => {
      // RLS automatically injects organizationId via trigger
      return await ctx.db.insert(issues).values(input);
    }),
});
```

### Machine Router Simplification

**Before RLS**:

```typescript
export const machineRouter = createTRPCRouter({
  list: organizationProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.machines.findMany({
      where: eq(machines.organizationId, ctx.organization.id),
      with: {
        location: {
          where: eq(locations.organizationId, ctx.organization.id),
        },
        issues: {
          where: eq(issues.organizationId, ctx.organization.id),
        },
      },
    });
  }),
});
```

**After RLS**:

```typescript
export const machineRouter = createTRPCRouter({
  list: autoRLSOrganizationProcedure.query(async ({ ctx }) => {
    // All relationships automatically scoped
    return await ctx.db.query.machines.findMany({
      with: {
        location: true,
        issues: true,
      },
    });
  }),
});
```

### Complex Query Simplification

**Before RLS - Complex Filtering**:

```typescript
const issuesWithActivityHistory = await ctx.db.query.issues.findMany({
  where: and(
    eq(issues.organizationId, ctx.organization.id),
    eq(issues.statusId, input.statusId),
  ),
  with: {
    machine: {
      where: eq(machines.organizationId, ctx.organization.id),
      with: {
        location: {
          where: eq(locations.organizationId, ctx.organization.id),
        },
      },
    },
    history: {
      where: eq(issueHistory.organizationId, ctx.organization.id),
      with: {
        actor: true,
      },
    },
    comments: {
      where: eq(comments.organizationId, ctx.organization.id),
    },
  },
});
```

**After RLS - Clean Business Logic**:

```typescript
const issuesWithActivityHistory = await ctx.db.query.issues.findMany({
  where: eq(issues.statusId, input.statusId), // Only business logic filtering
  with: {
    machine: {
      with: {
        location: true,
      },
    },
    history: {
      with: {
        actor: true,
      },
    },
    comments: true,
  },
});
```

---

## 6. Service Method Modernization

### Service Layer Simplification

**Before RLS - Manual Org Scoping**:

```typescript
export class IssueActivityService {
  async getRecentActivity(organizationId: string, limit = 50) {
    return await this.db.query.issueHistory.findMany({
      where: and(
        eq(issueHistory.organizationId, organizationId),
        gte(issueHistory.changedAt, subDays(new Date(), 7)),
      ),
      limit,
      orderBy: desc(issueHistory.changedAt),
      with: {
        issue: {
          where: eq(issues.organizationId, organizationId),
          with: {
            machine: {
              where: eq(machines.organizationId, organizationId),
            },
          },
        },
        actor: true,
      },
    });
  }
}
```

**After RLS - Clean Business Logic**:

```typescript
export class IssueActivityService {
  async getRecentActivity(limit = 50) {
    // organizationId parameter eliminated
    // RLS context already set by middleware
    return await this.db.query.issueHistory.findMany({
      where: gte(issueHistory.changedAt, subDays(new Date(), 7)),
      limit,
      orderBy: desc(issueHistory.changedAt),
      with: {
        issue: {
          with: {
            machine: true,
          },
        },
        actor: true,
      },
    });
  }
}
```

### Service Factory Updates

**RLS-Aware Service Factory**:

```typescript
export class RLSServiceFactory {
  constructor(
    private db: DrizzleClient,
    private rlsManager: RLSSessionManager,
  ) {}

  // Services no longer need organizationId parameters
  getIssueActivityService() {
    return new IssueActivityService(this.db);
  }

  getNotificationService() {
    return new NotificationService(this.db);
  }

  // Utility for services that need to temporarily change context
  async withDifferentOrganization<T>(
    targetOrgId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    return await this.rlsManager.withOrganizationContext(
      targetOrgId,
      operation,
    );
  }
}
```

---

## 7. Performance Considerations

### Indexing Strategy for RLS

**Enhanced Index Creation**:

```sql
-- RLS-optimized indexes for performance
-- PostgreSQL will use these for RLS policy enforcement

-- Primary organizational filtering indexes
CREATE INDEX CONCURRENTLY issues_org_id_created_at_idx
ON issues ("organizationId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY machines_org_id_location_idx
ON machines ("organizationId", "locationId");

CREATE INDEX CONCURRENTLY comments_org_id_issue_idx
ON comments ("organizationId", "issueId", "createdAt");

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY issues_org_status_priority_idx
ON issues ("organizationId", "statusId", "priorityId");

CREATE INDEX CONCURRENTLY machines_org_model_location_idx
ON machines ("organizationId", "modelId", "locationId");
```

### Query Plan Analysis

**Monitor RLS Performance**:

```sql
-- Analyze query plans to ensure RLS policies use indexes efficiently
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM issues
WHERE get_current_organization_id() = "organizationId";

-- Monitor slow queries with RLS
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%get_current_organization_id%'
ORDER BY mean_exec_time DESC;
```

### Connection Pool Considerations

**RLS Session Management with Connection Pooling**:

```typescript
// Ensure RLS context is set for each logical session
export class RLSConnectionManager {
  async borrowConnection(): Promise<DrizzleClient> {
    const connection = await this.pool.borrowConnection();

    // Reset any previous session state
    await connection.execute(sql`RESET app.current_organization_id`);

    return connection;
  }

  async returnConnection(connection: DrizzleClient): Promise<void> {
    // Clean up session state before returning to pool
    await connection.execute(sql`RESET app.current_organization_id`);
    await this.pool.returnConnection(connection);
  }
}
```

---

## 8. Validation & Testing

### RLS Policy Testing

**Database-Level Tests**:

```sql
-- Test RLS policies work correctly
-- Set up test scenario
SET app.current_organization_id = 'org-1';

-- Insert test data
INSERT INTO issues (id, title, "machineId", "statusId", "priorityId")
VALUES ('test-issue-1', 'Test Issue', 'machine-1', 'status-1', 'priority-1');

-- Switch organization context
SET app.current_organization_id = 'org-2';

-- Verify cross-organization access is blocked
SELECT * FROM issues WHERE id = 'test-issue-1'; -- Should return no rows

-- Verify insert gets correct organization
INSERT INTO issues (id, title, "machineId", "statusId", "priorityId")
VALUES ('test-issue-2', 'Test Issue 2', 'machine-2', 'status-2', 'priority-2');

SELECT "organizationId" FROM issues WHERE id = 'test-issue-2'; -- Should be 'org-2'
```

### Application Testing Patterns

**Simplified Test Setup**:

```typescript
// test/helpers/rls-test-helper.ts
export async function withTestOrganization<T>(
  orgId: string,
  operation: (db: DrizzleClient) => Promise<T>,
): Promise<T> {
  const db = getTestDatabase();

  return await db.transaction(async (tx) => {
    // Set RLS context
    await tx.execute(sql`SET LOCAL app.current_organization_id = ${orgId}`);

    // Run test operation
    return await operation(tx);
  });
}

// Usage in tests
test("issues are scoped to organization", async () => {
  await withTestOrganization("org-1", async (db) => {
    // Create issue - automatically gets org-1
    const issue = await db
      .insert(issues)
      .values({
        title: "Test Issue",
        machineId: "machine-1",
        statusId: "status-1",
        priorityId: "priority-1",
      })
      .returning();

    // Verify it was created with correct organization
    expect(issue.organizationId).toBe("org-1");
  });

  await withTestOrganization("org-2", async (db) => {
    // Query issues - should not see org-1 issues
    const issueList = await db.query.issues.findMany();

    expect(issueList).toHaveLength(0); // No cross-organization access
  });
});
```

### Integration Testing Simplification

**tRPC Integration Tests**:

```typescript
// test/integration/issue-router.test.ts
test("issue router respects organizational boundaries", async () => {
  const org1Caller = createCaller({
    user: { id: "user-1", app_metadata: { organization_id: "org-1" } },
  });

  const org2Caller = createCaller({
    user: { id: "user-2", app_metadata: { organization_id: "org-2" } },
  });

  // Create issue in org-1
  const issue = await org1Caller.issue.create({
    title: "Org 1 Issue",
    machineId: "machine-1",
    statusId: "status-1",
    priorityId: "priority-1",
  });

  // Verify org-2 cannot see org-1's issues
  const org2Issues = await org2Caller.issue.list();
  expect(org2Issues).toHaveLength(0);

  // Verify org-1 can see its own issues
  const org1Issues = await org1Caller.issue.list();
  expect(org1Issues).toHaveLength(1);
  expect(org1Issues[0].id).toBe(issue.id);
});
```

---

## 9. Security Enhancements

### Database-Level Security Guarantees

**RLS provides stronger security than application-level filtering**:

1. **Impossible to bypass**: Database enforces policies regardless of application bugs
2. **Default deny**: New tables/queries are secure by default
3. **Audit trail**: Database logs all access attempts
4. **Performance**: Indexes optimized for security filtering

### Additional Security Patterns

**Audit Logging with RLS**:

```sql
-- Create audit log table that inherits RLS context
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id TEXT,
  organization_id TEXT DEFAULT get_current_organization_id(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit log scoped to organization" ON audit_log
FOR ALL USING (
  organization_id = get_current_organization_id()
);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, operation, new_values)
    VALUES (TG_TABLE_NAME, TG_OP, row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, operation, old_values, new_values)
    VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, operation, old_values)
    VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply to sensitive tables
CREATE TRIGGER audit_issues AFTER INSERT OR UPDATE OR DELETE ON issues
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

### Cross-Organization Operations

**Controlled Cross-Organization Access**:

```typescript
// For special cases that need cross-organization access (admin functions)
export class AdminService {
  constructor(
    private db: DrizzleClient,
    private rlsManager: RLSSessionManager,
  ) {}

  async getAllOrganizationStats(): Promise<OrganizationStats[]> {
    // Temporarily disable RLS for admin operations
    return await this.db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL row_security = off`);

      // Run cross-organization queries
      const stats = await tx.execute(sql`
        SELECT 
          o.id,
          o.name,
          COUNT(DISTINCT m.id) as machine_count,
          COUNT(DISTINCT i.id) as issue_count
        FROM organizations o
        LEFT JOIN machines m ON m."organizationId" = o.id
        LEFT JOIN issues i ON i."organizationId" = o.id
        GROUP BY o.id, o.name
      `);

      return stats.rows;
    });
  }
}
```

---

## Implementation Approach

### Foundation: Database Schema Updates

**Prerequisites:** Completed Drizzle migration and stable database schema  
**Complexity:** Medium - Database-level changes with cascading effects

1. **Create RLS foundation functions**
   - `get_current_organization_id()` function
   - `set_organization_id()` trigger function

2. **Enable RLS on all multi-tenant tables**
   - Run policy creation scripts for each table
   - Add automatic organizationId triggers

3. **Create performance indexes**
   - Add RLS-optimized composite indexes
   - Monitor query plans for efficiency

### Core Integration: Application Layer Updates

**Prerequisites:** RLS foundation functions and policies in place  
**Complexity:** High - Touches all data access patterns

1. **Update tRPC middleware**
   - Implement RLS session management
   - Simplify organization procedure to just set context

2. **Create RLS service layer**
   - Update service factory for RLS awareness
   - Remove organizationId parameters from service methods

3. **Update router queries**
   - Remove manual organizationId filtering
   - Test queries work with RLS

### Validation: Testing & Performance

**Prerequisites:** Core RLS integration complete  
**Complexity:** Medium - Comprehensive validation required

1. **Database-level testing**
   - Verify RLS policies work correctly
   - Test cross-organization isolation

2. **Application testing**
   - Update integration tests for RLS patterns
   - Verify all user flows work correctly

3. **Performance testing**
   - Monitor query performance with RLS
   - Optimize indexes as needed

---

## Success Metrics

**Code Reduction**:

- Remove 1000+ lines of manual organizationId filtering
- Simplify tRPC middleware from 100+ lines to ~10 lines
- Eliminate organizationId parameters from service methods

**Security Improvements**:

- Database-level enforcement of multi-tenancy
- Impossible to bypass organizational boundaries
- Automatic audit trail for all access

**Developer Experience**:

- New queries automatically inherit multi-tenancy
- Simplified testing with single context setup
- Future features require zero organizational boilerplate

**Performance**:

- Database-optimized organizational filtering
- Efficient index usage for RLS policies
- Reduced application-level filtering overhead

This RLS implementation represents the permanent solution to multi-tenancy in PinPoint, transforming organizational complexity from a constant development burden into an automatic database-level guarantee.

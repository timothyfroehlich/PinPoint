# Row Level Security Implementation (Hybrid Approach)

**Objective**: Add database-level multi-tenancy isolation while preserving PinPoint's flexible role system.

**Approach**: Hybrid 3-layer security model that optimizes common access patterns with RLS while keeping custom role flexibility.

---

## 1. Hybrid Security Architecture

### 3-Layer Security Model

**Layer 1: RLS Organization Isolation**
- Database enforces organization boundaries automatically
- Uses JWT claims for fast organization context
- Impossible to bypass organizational isolation

**Layer 2: RLS Security Levels** 
- Fixed security levels (admin/member/guest) for major access patterns
- JWT-based for optimal performance
- Handles 80% of access control decisions

**Layer 3: Application Role System**
- Existing flexible role/permission system unchanged
- Handles complex business logic and fine-grained permissions
- Custom role creation continues to work exactly as now

### Current vs Target State

**Current State (Application-Only)**:
```typescript
// Manual organizationId filtering everywhere
const issues = await db.query.issues.findMany({
  where: eq(issues.organizationId, ctx.user.organizationId),
});

// Permission checks in application logic
if (!hasPermission(user, org, "issue:edit")) throw new Error("Forbidden");
```

**Target State (Hybrid)**:
```typescript
// RLS handles organization isolation automatically 
const issues = await db.query.issues.findMany(); // Auto-filtered by organization

// Application handles fine-grained permissions (unchanged)
if (!hasPermission(user, "issue:edit")) throw new Error("Forbidden");
```

### Benefits of Hybrid Approach

1. **Performance**: Fast JWT-based checks for common patterns
2. **Flexibility**: Keep existing custom role system
3. **Security**: Impossible to bypass organization boundaries  
4. **Compatibility**: Minimal changes to existing role creation logic
5. **Gradual**: Can implement incrementally

---

## 2. JWT Claims Structure

### Enhanced Supabase Auth Metadata

**JWT Claims for Hybrid Security**:
```typescript
{
  "app_metadata": {
    "organization_id": "org_123",           // For RLS organization isolation
    "security_level": "member",             // For RLS security level policies  
    "role_id": "role_456"                  // For application-level permissions
  }
}
```

**Security Level Determination**:
```typescript
function determineSecurityLevel(permissions: string[]): SecurityLevel {
  // Admin: Has any admin-level permission
  if (permissions.some(p => p.includes(':admin') || p === 'user:manage')) {
    return 'admin';
  }
  
  // Member: Has write permissions
  if (permissions.some(p => p.includes(':edit') || p.includes(':create'))) {
    return 'member'; 
  }
  
  // Guest: Read-only
  return 'guest';
}
```

## 3. RLS Foundation Setup

### Hybrid RLS Functions

```sql
-- Organization context from JWT
CREATE OR REPLACE FUNCTION get_current_organization_id()
RETURNS TEXT AS $$
BEGIN
  RETURN (auth.jwt() ->> 'organization_id');
END;
$$ LANGUAGE plpgsql STABLE;

-- Security level from JWT
CREATE OR REPLACE FUNCTION get_current_security_level()
RETURNS TEXT AS $$
BEGIN
  RETURN (auth.jwt() ->> 'security_level');
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

### Layer 1: Organization Isolation Policies

```sql
-- Organizations: Users can only see their own organization
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization isolation" ON organizations
FOR ALL USING (
  id = get_current_organization_id()
);

-- Memberships: Organization boundary enforcement
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Memberships organization isolation" ON memberships
FOR ALL USING (
  "organizationId" = get_current_organization_id()
);

-- Locations: Organization-scoped asset management
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Locations organization isolation" ON locations
FOR ALL USING (
  "organizationId" = get_current_organization_id()
);
```

### Layer 2: Security Level Policies 

```sql
-- Roles: Admin-only management
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin role management" ON roles
FOR INSERT, UPDATE, DELETE USING (
  get_current_security_level() = 'admin' AND
  "organizationId" = get_current_organization_id()
);

CREATE POLICY "All users can view roles" ON roles
FOR SELECT USING (
  "organizationId" = get_current_organization_id()
);

-- User management: Admin operations
CREATE POLICY "Admin user management" ON memberships
FOR UPDATE, DELETE USING (
  get_current_security_level() = 'admin' AND
  "organizationId" = get_current_organization_id()
);
```

### Automatic Organization ID Injection

```sql
-- Simple trigger for organizationId injection  
CREATE OR REPLACE FUNCTION set_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW."organizationId" = get_current_organization_id();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to core tables
CREATE TRIGGER set_locations_organization_id
  BEFORE INSERT ON locations FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_machines_organization_id
  BEFORE INSERT ON machines FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_issues_organization_id
  BEFORE INSERT ON issues FOR EACH ROW
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

## 4. tRPC Integration with Hybrid Security

### Enhanced Context with JWT Claims

**Updated tRPC Context**:

```typescript
// src/server/api/trpc.ts
export async function createTRPCContext({ req }: { req: NextRequest }) {
  const supabase = createServerClient(/* ... */);
  const { data: { user } } = await supabase.auth.getUser();
  
  // Extract hybrid security info from JWT
  const organizationId = user?.app_metadata?.organization_id;
  const securityLevel = user?.app_metadata?.security_level;
  const roleId = user?.app_metadata?.role_id;
  
  return {
    user,
    organizationId,
    securityLevel, 
    roleId,
    db,
    supabase,
  };
}
```

### Hybrid Organization Procedure

**Combines RLS + Role System**:

```typescript
// Simplified organization procedure leveraging RLS
export const hybridOrgProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (!ctx.organizationId) {
      throw new TRPCError({
        code: "FORBIDDEN", 
        message: "No organization context"
      });
    }

    // RLS handles organization isolation automatically via JWT
    // Role system handles fine-grained permissions as before
    
    return next({ 
      ctx: {
        ...ctx,
        // organizationId filtering now automatic via RLS
        // but role-based permissions still checked in procedures
      }
    });
  },
);
```

### Role Permission Integration

**Preserves Current Role System**:

```typescript
// Permission checks continue to work with role system
export const requirePermission = (permission: string) =>
  hybridOrgProcedure.use(async ({ ctx, next }) => {
    // Use existing role service - unchanged
    const roleService = new RoleService(ctx.db, ctx.organizationId);
    const hasPermission = await roleService.userHasPermission(
      ctx.user.id, 
      permission
    );
    
    if (!hasPermission) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    
    return next({ ctx });
  });
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

## 5. Hybrid Query Patterns

### Query Simplification with Role Preservation

**Issues Router - Before (Manual Everything)**:

```typescript
export const issueRouter = createTRPCRouter({
  list: organizationProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.issues.findMany({
      where: eq(issues.organizationId, ctx.organization.id), // Manual org filtering
      with: {
        machine: {
          where: eq(machines.organizationId, ctx.organization.id), // Manual org filtering
        },
        priority: {
          where: eq(priorities.organizationId, ctx.organization.id), // Manual org filtering  
        },
      },
    });
  }),

  create: requirePermission("issue:create")
    .input(createIssueSchema)
    .mutation(async ({ ctx, input }) => {
      // Manual permission check + manual org injection
      return await ctx.db.insert(issues).values({
        ...input,
        organizationId: ctx.organization.id,
      });
    }),
});
```

**Issues Router - After (Hybrid)**:

```typescript
export const issueRouter = createTRPCRouter({
  list: hybridOrgProcedure.query(async ({ ctx }) => {
    // RLS automatically filters by organization
    return await ctx.db.query.issues.findMany({
      with: {
        machine: true,    // Automatically org-scoped by RLS
        priority: true,   // Automatically org-scoped by RLS
      },
    });
  }),

  create: requirePermission("issue:create") // Role system unchanged
    .input(createIssueSchema)
    .mutation(async ({ ctx, input }) => {
      // RLS automatically injects organizationId via trigger
      // Permission check still handled by role system
      return await ctx.db.insert(issues).values(input);
    }),

  edit: requirePermission("issue:edit")
    .input(editIssueSchema)
    .mutation(async ({ ctx, input }) => {
      // RLS ensures you can only edit your org's issues
      // Role system ensures you have edit permission
      return await ctx.db.update(issues)
        .set(input)
        .where(eq(issues.id, input.id));
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

### Phase 1: JWT Claims and RLS Foundation

**Prerequisites:** Completed Drizzle migration and stable Supabase auth
**Complexity:** Medium - Database and auth integration

1. **Update Supabase JWT claims structure**
   - Add `organization_id`, `security_level`, `role_id` to app_metadata
   - Update role assignment logic to set security levels
   - Test JWT claim propagation

2. **Create hybrid RLS functions**
   - `get_current_organization_id()` from JWT
   - `get_current_security_level()` from JWT
   - `set_organization_id()` trigger function

3. **Enable core RLS policies**
   - Organization isolation on all multi-tenant tables
   - Basic security level policies for admin operations
   - Add automatic organizationId triggers

### Phase 2: tRPC Hybrid Integration

**Prerequisites:** RLS foundation and JWT claims working
**Complexity:** Medium - Minimal changes to existing role system

1. **Update tRPC context**
   - Extract JWT claims in context creation
   - Preserve existing role service integration
   - Add security level to context

2. **Create hybrid procedures**
   - `hybridOrgProcedure` for automatic org isolation
   - `requirePermission()` unchanged - uses existing role system
   - Test organization isolation + permission checks

3. **Update select routers**
   - Remove manual `organizationId` filtering from queries
   - Keep existing permission checks unchanged
   - Verify RLS + role system work together

### Phase 3: Role System Integration

**Prerequisites:** Hybrid tRPC working with existing role system
**Complexity:** Low - Mostly additive changes

1. **Update role assignment workflow**
   - Modify role assignment to update JWT claims
   - Add security level calculation from permissions
   - Test custom role creation still works

2. **Service layer updates (minimal)**
   - Keep existing role service methods
   - Remove organizationId parameters where RLS handles it
   - Preserve all permission logic

3. **Testing and validation**
   - Verify custom role creation workflow
   - Test organization isolation is enforced
   - Confirm permission system works as before

---

## Success Metrics

**Security Improvements (Primary Goal)**:
- Database-level enforcement of organization isolation
- Impossible to bypass organizational boundaries via bugs
- JWT-based fast path for common access patterns

**Code Simplification (Secondary Goal)**:
- Remove ~500+ lines of manual organizationId filtering
- Simplify query patterns while preserving permission logic
- Eliminate organizationId injection in most insert operations

**Role System Preservation**:
- ✅ Custom role creation continues to work unchanged
- ✅ Fine-grained permission checks preserved
- ✅ Complex permission dependencies preserved
- ✅ Role templates and business logic unchanged

**Developer Experience**:
- New queries automatically inherit organization isolation
- Permission checks continue to work as expected
- Testing simplified for organization isolation scenarios

**Performance**:
- JWT-based organization filtering (faster than DB queries)
- Database-optimized RLS policies with proper indexing
- Reduced application-level organization validation overhead

## Files Requiring Changes

**Database/Migration** (~3 files):
- Migration script for RLS policies
- Index creation for RLS performance
- Trigger functions for organizationId injection

**Auth/JWT Integration** (~5 files):
- `utils/supabase/server.ts` - JWT claim handling
- `src/server/api/trpc.ts` - Enhanced context
- `src/server/services/membershipService.ts` - JWT claim updates
- `src/server/services/roleService.ts` - Security level calculation

**tRPC Layer** (~8 files):
- Core procedure definitions for hybrid approach
- Router updates to remove manual org filtering (gradual)
- Permission middleware integration

**Role System** (~2 files):
- Role assignment workflow to update JWT claims
- Security level determination logic

**Total Impact**: ~18 files with **preservation** of existing role creation and permission systems.

This hybrid implementation enhances security through RLS while maintaining the flexibility and functionality of PinPoint's custom role system.

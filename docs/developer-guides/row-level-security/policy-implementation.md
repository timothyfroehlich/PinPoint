# RLS Policy Implementation

## Overview

Row Level Security (RLS) policies define which rows a user can access in a table. PostgreSQL evaluates these policies for every query, automatically filtering results based on the user's context.

## Basic RLS Setup

### Enable RLS on Tables

```sql
-- Enable RLS (required for policies to work)
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- IMPORTANT: Without this, tables are accessible to all!
```

### Force RLS for Table Owners

```sql
-- Even table owners must follow RLS policies
ALTER TABLE issues FORCE ROW LEVEL SECURITY;
```

## Policy Types

### SELECT Policies (Read Access)

```sql
-- Users can only see issues from their organization
CREATE POLICY "Organization members can view issues"
  ON issues
  FOR SELECT
  USING (
    organization_id = auth.jwt()->>'organizationId'
  );

-- Public users can see non-sensitive issue data
CREATE POLICY "Public can view issue summaries"
  ON issues
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = issues.organization_id
      AND organizations.is_public = true
    )
  );
```

### INSERT Policies (Create Access)

```sql
-- Members can create issues in their organization
CREATE POLICY "Members can create issues"
  ON issues
  FOR INSERT
  WITH CHECK (
    organization_id = auth.jwt()->>'organizationId'
    AND auth.jwt()->>'permissions' @> '["issue:create"]'
  );

-- Anonymous users can create issues (via QR codes)
CREATE POLICY "Anonymous can create public issues"
  ON issues
  FOR INSERT
  WITH CHECK (
    created_by_id IS NULL
    AND EXISTS (
      SELECT 1 FROM machines
      WHERE machines.id = issues.machine_id
      AND machines.allow_anonymous_reports = true
    )
  );
```

### UPDATE Policies (Modify Access)

```sql
-- Users can update issues they created
CREATE POLICY "Users can update own issues"
  ON issues
  FOR UPDATE
  USING (
    created_by_id = auth.uid()
  )
  WITH CHECK (
    created_by_id = auth.uid()
  );

-- Admins can update any issue in their org
CREATE POLICY "Admins can update organization issues"
  ON issues
  FOR UPDATE
  USING (
    organization_id = auth.jwt()->>'organizationId'
    AND auth.jwt()->>'permissions' @> '["issue:admin"]'
  )
  WITH CHECK (
    organization_id = auth.jwt()->>'organizationId'
  );
```

### DELETE Policies

```sql
-- Only admins can delete (soft delete pattern preferred)
CREATE POLICY "Admins can delete issues"
  ON issues
  FOR DELETE
  USING (
    organization_id = auth.jwt()->>'organizationId'
    AND auth.jwt()->>'permissions' @> '["admin"]'
  );
```

## Multi-Tenant Patterns

### Organization Isolation

```sql
-- Base policy for all tenant tables
CREATE POLICY "Tenant isolation"
  ON tenant_table
  FOR ALL
  USING (organization_id = auth.jwt()->>'organizationId')
  WITH CHECK (organization_id = auth.jwt()->>'organizationId');
```

### Cross-Organization Access

```sql
-- Some resources need controlled cross-org access
CREATE POLICY "Users can view public machine models"
  ON models
  FOR SELECT
  USING (
    -- Own organization's models
    organization_id = auth.jwt()->>'organizationId'
    OR
    -- Global models (OPDB)
    organization_id IS NULL
    OR
    -- Explicitly shared models
    is_public = true
  );
```

### Hierarchical Access

```sql
-- Access based on related tables
CREATE POLICY "Access issues through machine ownership"
  ON issues
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM machines
      WHERE machines.id = issues.machine_id
      AND machines.owner_id = auth.uid()
    )
  );
```

## Performance Optimization

### Index Support for Policies

```sql
-- Policies need supporting indexes
CREATE INDEX idx_issues_org_id ON issues(organization_id);
CREATE INDEX idx_issues_created_by ON issues(created_by_id);
CREATE INDEX idx_machines_owner ON machines(owner_id);

-- Composite indexes for complex policies
CREATE INDEX idx_issues_org_status
  ON issues(organization_id, status_id);
```

### Policy Ordering

```sql
-- Most restrictive policies first
CREATE POLICY "01_superadmin_all"
  ON issues FOR ALL
  USING (auth.jwt()->>'role' = 'superadmin');

CREATE POLICY "02_org_admin_all"
  ON issues FOR ALL
  USING (
    organization_id = auth.jwt()->>'organizationId'
    AND auth.jwt()->>'permissions' @> '["admin"]'
  );

CREATE POLICY "03_member_read"
  ON issues FOR SELECT
  USING (organization_id = auth.jwt()->>'organizationId');
```

### Optimized JWT Access

```sql
-- Create function to cache JWT parsing
CREATE OR REPLACE FUNCTION auth.organization_id()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'organizationId',
    auth.jwt()->>'organizationId'
  )::TEXT;
$$ LANGUAGE SQL STABLE;

-- Use in policies
CREATE POLICY "Optimized org check"
  ON issues FOR SELECT
  USING (organization_id = auth.organization_id());
```

## Complex Policies

### Permission-Based Access

```sql
-- Different access levels based on permissions
CREATE POLICY "Granular issue access"
  ON issues
  FOR ALL
  USING (
    CASE
      -- Admins see everything in org
      WHEN auth.jwt()->>'permissions' @> '["issue:admin"]'
        THEN organization_id = auth.jwt()->>'organizationId'

      -- Assignees see assigned issues
      WHEN auth.jwt()->>'permissions' @> '["issue:assigned"]'
        THEN assigned_to_id = auth.uid()

      -- Members see public issues
      WHEN auth.jwt()->>'permissions' @> '["issue:view"]'
        THEN organization_id = auth.jwt()->>'organizationId'
          AND is_internal = false

      -- No access
      ELSE false
    END
  );
```

### Time-Based Access

```sql
-- Access expires after certain time
CREATE POLICY "Time-limited access"
  ON sensitive_data
  FOR SELECT
  USING (
    created_by_id = auth.uid()
    AND created_at > NOW() - INTERVAL '30 days'
  );
```

### Audit Trail Preservation

```sql
-- Can view but not modify historical data
CREATE POLICY "Audit trail read-only"
  ON activity_logs
  FOR SELECT
  USING (organization_id = auth.jwt()->>'organizationId');

-- No INSERT/UPDATE/DELETE policies = read-only
```

## Supabase Integration

### JWT Structure for RLS

```typescript
// Supabase JWT app_metadata used in policies
interface AppMetadata {
  organizationId: string;
  permissions: string[];
  role: "admin" | "member" | "viewer";
}

// Set during user creation/update
await supabase.auth.admin.updateUserById(userId, {
  app_metadata: {
    organizationId: "org_123",
    permissions: ["issue:create", "issue:view"],
    role: "member",
  },
});
```

### RLS with Supabase Client

```typescript
// RLS automatically applied to all queries
const { data: issues } = await supabase.from("issues").select("*"); // Only returns user's organization issues

// No need for manual filtering!
// This would be redundant:
// .eq('organization_id', user.organizationId)
```

### Service Role Bypass

```typescript
// Service role bypasses RLS (use carefully!)
const supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Can access all data (for admin operations)
const { data: allIssues } = await supabaseAdmin.from("issues").select("*"); // Returns ALL issues
```

## Testing RLS Policies

### SQL Testing

```sql
-- Test as specific user
SET LOCAL request.jwt.claims = '{
  "sub": "user_123",
  "organizationId": "org_123",
  "permissions": ["issue:view"]
}';

-- Should only see org_123 issues
SELECT * FROM issues;

-- Reset
RESET request.jwt.claims;
```

### Integration Testing

```typescript
// Test different user contexts
describe("RLS Policies", () => {
  it("prevents cross-organization access", async () => {
    // User from org1
    const { data: org1Issues } = await supabaseOrg1.from("issues").select("*");

    // Should not contain org2 data
    expect(org1Issues.every((i) => i.organization_id === "org1")).toBe(true);
  });
});
```

## ⚠️ MIGRATION: Application-Level Filtering

### Remove Manual Filters

```typescript
// OLD: Application-level filtering
const issues = await db
  .select()
  .from(issues)
  .where(
    and(
      eq(issues.organizationId, ctx.organization.id), // Manual filter
      eq(issues.statusId, statusId),
    ),
  );

// NEW: RLS handles organization filtering
const issues = await db
  .select()
  .from(issues)
  .where(eq(issues.statusId, statusId)); // Only status filter needed
```

### Trust Database Security

```typescript
// OLD: Defensive programming
export async function getIssue(issueId: string, organizationId: string) {
  const issue = await db.query.issues.findFirst({
    where: and(
      eq(issues.id, issueId),
      eq(issues.organizationId, organizationId), // Paranoid check
    ),
  });

  if (!issue || issue.organizationId !== organizationId) {
    throw new Error("Access denied"); // Double-check
  }

  return issue;
}

// NEW: Trust RLS
export async function getIssue(issueId: string) {
  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, issueId),
  });

  if (!issue) {
    throw new Error("Issue not found"); // RLS already checked access
  }

  return issue;
}
```

### Simplify Queries

```typescript
// OLD: Complex permission checks
if (hasPermission(user, "issue:view:all")) {
  query = db.select().from(issues);
} else if (hasPermission(user, "issue:view:assigned")) {
  query = db.select().from(issues).where(eq(issues.assignedToId, user.id));
} else {
  throw new Error("No permission");
}

// NEW: RLS handles permissions
const issues = await db.select().from(issues);
// RLS policy automatically applies correct filter
```

## Common Pitfalls

### 1. Forgetting to Enable RLS

```sql
-- BAD: Table is wide open!
CREATE TABLE sensitive_data (...);

-- GOOD: Enable RLS immediately
CREATE TABLE sensitive_data (...);
ALTER TABLE sensitive_data ENABLE ROW LEVEL SECURITY;
```

### 2. Incorrect JWT Claims

```sql
-- BAD: Using wrong claim name
CREATE POLICY "..." USING (
  organization_id = auth.jwt()->>'org_id' -- Wrong key!
);

-- GOOD: Match your JWT structure
CREATE POLICY "..." USING (
  organization_id = auth.jwt()->>'organizationId'
);
```

### 3. Missing WITH CHECK

```sql
-- BAD: Can insert with any org_id
CREATE POLICY "Insert policy"
  ON issues FOR INSERT
  USING (true); -- No check!

-- GOOD: Enforce on INSERT too
CREATE POLICY "Insert policy"
  ON issues FOR INSERT
  WITH CHECK (
    organization_id = auth.jwt()->>'organizationId'
  );
```

### 4. Performance Issues

```sql
-- BAD: No index support
CREATE POLICY "Complex check"
  ON issues FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM machines m
      JOIN locations l ON m.location_id = l.id
      WHERE m.id = issues.machine_id
      AND l.manager_id = auth.uid()
    )
  );

-- GOOD: Direct indexed column
CREATE POLICY "Simple check"
  ON issues FOR SELECT
  USING (
    organization_id = auth.jwt()->>'organizationId'
  );
```

## Best Practices

1. **Enable RLS immediately** when creating tables
2. **Use simple policies** based on indexed columns
3. **Test policies thoroughly** with different user contexts
4. **Monitor performance** with EXPLAIN ANALYZE
5. **Document policy logic** for team understanding
6. **Avoid complex JOINs** in policies
7. **Use database functions** for reusable logic
8. **Keep JWT claims minimal** for performance

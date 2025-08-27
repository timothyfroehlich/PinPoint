# Phase 2A: Data Access Layer Foundation

**Goal**: Establish server-side Data Access Layer with React 19 cache() API for direct database queries in Server Components

**Success Criteria**: 
- DAL functions for issues, organizations, users with organization scoping
- React 19 cache() integration for request-level memoization  
- Authentication context utilities for server-side queries
- Zero duplicate database queries within single request

---

## Core Infrastructure Files

### Authentication Context (`src/lib/dal/auth-context.ts`)

**Purpose**: Server-side authentication utilities for DAL functions

```typescript
import { cache } from "react";
import { createClient } from "~/lib/supabase/server";
import { redirect } from "next/navigation";

// Request-level authentication caching
export const getServerAuthContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) return null;
  
  const organizationId = user.user_metadata?.organizationId;
  return {
    user,
    userId: user.id,
    organizationId,
    supabase
  };
});

export const requireAuthContext = cache(async () => {
  const context = await getServerAuthContext();
  if (!context) redirect("/auth/sign-in");
  if (!context.organizationId) throw new Error("No organization selected");
  
  return context;
});
```

### Issues DAL (`src/lib/dal/issues.ts`)

**Purpose**: Organization-scoped issue queries with React 19 cache() memoization

```typescript
import { cache } from "react";
import { eq, desc, and } from "drizzle-orm";
import { db } from "~/db";
import { issues, machines, users } from "~/db/schema";
import { requireAuthContext } from "./auth-context";

export const getIssuesForOrg = cache(async (organizationId: string) => {
  console.log("🔍 DB Query: Issues for org", organizationId);
  
  return await db.query.issues.findMany({
    where: eq(issues.organizationId, organizationId),
    with: {
      machine: {
        columns: { id: true, name: true, model: true }
      },
      assignee: {
        columns: { id: true, name: true, email: true }
      }
    },
    orderBy: [desc(issues.createdAt)],
    columns: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      createdAt: true,
      machineId: true,
      assigneeId: true
    }
  });
});

export const getIssueById = cache(async (issueId: string) => {
  const { organizationId } = await requireAuthContext();
  
  const issue = await db.query.issues.findFirst({
    where: and(
      eq(issues.id, issueId),
      eq(issues.organizationId, organizationId)
    ),
    with: {
      machine: true,
      assignee: true,
      comments: {
        with: {
          user: {
            columns: { id: true, name: true, email: true }
          }
        },
        orderBy: [desc(issues.createdAt)]
      }
    }
  });
  
  if (!issue) {
    throw new Error("Issue not found or access denied");
  }
  
  return issue;
});

export const getOpenIssuesCount = cache(async (organizationId: string) => {
  const result = await db.select({ count: count() })
    .from(issues)
    .where(and(
      eq(issues.organizationId, organizationId),
      eq(issues.status, 'open')
    ));
  
  return result[0]?.count ?? 0;
});
```

### Organizations DAL (`src/lib/dal/organizations.ts`)

**Purpose**: Organization context and statistics queries

```typescript
import { cache } from "react";
import { eq, count } from "drizzle-orm";
import { db } from "~/db";
import { organizations, issues, machines } from "~/db/schema";

export const getOrganizationById = cache(async (organizationId: string) => {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: {
      id: true,
      name: true,
      subdomain: true,
      createdAt: true
    }
  });
  
  if (!org) {
    throw new Error("Organization not found");
  }
  
  return org;
});

export const getOrgStats = cache(async (organizationId: string) => {
  console.log("🔍 DB Query: Org stats for", organizationId);
  
  const [issueStats, machineCount] = await Promise.all([
    db.select({
      totalIssues: count(),
      openIssues: count(eq(issues.status, 'open')),
      closedIssues: count(eq(issues.status, 'closed'))
    }).from(issues).where(eq(issues.organizationId, organizationId)),
    
    db.select({ count: count() })
      .from(machines)
      .where(eq(machines.organizationId, organizationId))
  ]);
  
  return {
    totalIssues: issueStats[0]?.totalIssues ?? 0,
    openIssues: issueStats[0]?.openIssues ?? 0,
    closedIssues: issueStats[0]?.closedIssues ?? 0,
    totalMachines: machineCount[0]?.count ?? 0
  };
});
```

---

## Implementation Steps

### 1. Authentication Context Setup
**Files**: `src/lib/dal/auth-context.ts`
- [ ] Create server-side auth utilities with React 19 cache()
- [ ] Implement `getServerAuthContext()` for optional auth
- [ ] Implement `requireAuthContext()` for protected queries  
- [ ] Add organization context extraction from user metadata

### 2. Issues DAL Implementation  
**Files**: `src/lib/dal/issues.ts`
- [ ] Create organization-scoped issue queries
- [ ] Add React 19 cache() wrapper for all functions
- [ ] Implement relational loading with machines and users
- [ ] Add explicit column selection for performance
- [ ] Create issue statistics queries

### 3. Organizations DAL Implementation
**Files**: `src/lib/dal/organizations.ts`
- [ ] Create organization lookup functions
- [ ] Add organization statistics queries
- [ ] Implement parallel query execution with Promise.all()
- [ ] Add request-level caching for org data

### 4. Database Query Optimization
- [ ] Add database indexes for organization_id columns
- [ ] Verify N+1 query prevention through relational loading
- [ ] Test request-level cache deduplication
- [ ] Monitor query performance with logging

---

## Architectural Alignment

### Target Architecture Compliance
- ✅ **Server-First**: Direct database queries in Server Components
- ✅ **React 19 cache()**: Request-level memoization prevents duplicate queries
- ✅ **Organization Scoping**: All queries enforced by organizationId
- ✅ **Type Safety**: Full TypeScript integration with Drizzle schema
- ✅ **Performance**: Explicit column selection and strategic JOINs

### Migration Strategy Alignment
- ✅ **Bang-Bang Conversion**: New DAL replaces client tRPC calls entirely
- ✅ **Foundation First**: DAL enables all subsequent Server Components
- ✅ **Security First**: Organization scoping enforced at query level
- ✅ **Performance Optimized**: React 19 cache() eliminates duplicate queries

---

## Dependencies & Prerequisites

### Complete Before Starting
- [x] Phase 1A: shadcn/ui + Tailwind setup (nearly complete)
- [x] Database schema locked and stable
- [x] Supabase SSR authentication working

### Required for Next Phase
- [ ] DAL functions operational and tested
- [ ] Authentication context utilities working
- [ ] Request-level caching validated
- [ ] Organization scoping enforced

---

## Success Validation

### Functional Tests
- [ ] `getIssuesForOrg()` returns organization-scoped issues
- [ ] React cache() prevents duplicate queries in single request
- [ ] `requireAuthContext()` redirects unauthenticated users
- [ ] Organization context extracted from user metadata
- [ ] Cross-organization access properly denied

### Performance Tests
- [ ] Single request = single DB query per cached function
- [ ] Query execution under 100ms for typical datasets
- [ ] Memory usage stable during request processing
- [ ] N+1 queries eliminated through relational loading

### Security Tests  
- [ ] Cross-organization data access denied
- [ ] Unauthenticated access properly redirected
- [ ] SQL injection impossible through Drizzle parameterization
- [ ] Organization scoping enforced on all multi-tenant queries

---

**Next Phase**: [Phase 2B: Server Actions Infrastructure](./PHASE_2B_SERVER_ACTIONS.md)

**User Goal Progress**: DAL foundation enables Server Components to fetch data directly from database, setting stage for authenticated dashboard with issue list.
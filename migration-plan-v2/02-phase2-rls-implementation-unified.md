# Phase 2: Row-Level Security Implementation (Supabase-Native)

**Context**: Post-Prisma removal, implementing database-level multi-tenancy with Supabase RLS  
**Approach**: Supabase-native RLS using `auth.jwt()` app_metadata for maximum simplicity and reliability

---

## 🎯 **Executive Summary**

**Goal**: Transform from manual `organizationId` filtering to automatic database-level multi-tenancy using **Supabase RLS + Auth integration**.

**Impact**: 
- Remove ~200+ manual `organizationId` filtering queries across codebase
- Simplify tRPC middleware from 100+ lines to ~15 lines  
- Automatic organizational scoping for all new features
- Database-level security guarantees with **Supabase Auth context**
- Zero application-level filtering - **PostgreSQL + Supabase Auth handle everything**

**Architecture Decision**: Supabase-native RLS policies using `auth.jwt() ->> 'app_metadata' ->> 'organizationId'` for tenant context, avoiding complex session management or hybrid approaches.

---

## 🏗️ **Technical Architecture**

### Supabase RLS Foundation

**User Context Storage**:
- Store `organizationId` in Supabase user `app_metadata` (secure, non-tamperable)
- Automatic filtering via RLS policies reading `auth.jwt() ->> 'app_metadata' ->> 'organizationId'`
- Your existing `@supabase/ssr` auth setup becomes the multi-tenant security boundary

**RLS Policy Pattern**:
```sql
-- Standard organizational isolation policy
CREATE POLICY "organization_isolation" ON table_name
  FOR ALL TO authenticated
  USING (organization_id = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);
```

**Automatic Organization Injection**:
```sql
-- Trigger function for INSERT operations
CREATE OR REPLACE FUNCTION set_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.organization_id = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Multi-Tenant Tables (Schema Analysis)

**Core Tables**: organizations, memberships, roles, rolePermissions
**Assets**: locations, machines, models  
**Workflow**: issues, priorities, issueStatuses
**Activity**: comments, attachments, issueHistory, upvotes
**Features**: collections, collectionTypes, collectionMachines, notifications

**Global Tables (No RLS)**: users, models, permissions (global reference data)

---

## 📊 **Parallel Work Streams**

### 🔧 **Stream 1: RLS Setup Script** (Independent)
**Dependencies**: None | **Files**: 2 files, ~680 lines

**Files to Create**:
- `scripts/setup-rls.ts` (~60 lines) - Executes RLS SQL setup
- `scripts/setup-rls.sql` (~620 lines) - Complete RLS policy definitions

**Integration**: Enhanced database reset workflow
```bash
npm run db:reset:local:sb  # Now includes RLS setup + type regeneration
```

**Multi-Tenant RLS Policies**:

```sql
-- Enable RLS on all multi-tenant tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issueStatuses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issueHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collectionTypes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collectionMachines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Organization isolation policies using auth.jwt()
CREATE POLICY "organization_isolation" ON organizations
  FOR ALL TO authenticated
  USING (id = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

CREATE POLICY "memberships_organization_isolation" ON memberships
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

CREATE POLICY "roles_organization_isolation" ON roles
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

CREATE POLICY "locations_organization_isolation" ON locations
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

CREATE POLICY "machines_organization_isolation" ON machines
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

CREATE POLICY "issues_organization_isolation" ON issues
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

CREATE POLICY "priorities_organization_isolation" ON priorities
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

CREATE POLICY "issue_statuses_organization_isolation" ON "issueStatuses"
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

CREATE POLICY "comments_organization_isolation" ON comments
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

CREATE POLICY "attachments_organization_isolation" ON attachments
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

CREATE POLICY "issue_history_organization_isolation" ON "issueHistory"
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

CREATE POLICY "collection_types_organization_isolation" ON "collectionTypes"
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

-- Collections inherit organization from location
CREATE POLICY "collections_organization_isolation" ON collections
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM locations
      WHERE locations.id = collections."locationId"
      AND locations."organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text
    )
  );

-- Collection machines inherit from collection -> location
CREATE POLICY "collection_machines_organization_isolation" ON "collectionMachines"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      JOIN locations l ON l.id = c."locationId"
      WHERE c.id = "collectionMachines"."collectionId"
      AND l."organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text
    )
  );

CREATE POLICY "notifications_organization_isolation" ON notifications
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

-- Automatic organization injection triggers
CREATE OR REPLACE FUNCTION set_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW."organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to core tables
CREATE TRIGGER set_locations_organization_id
  BEFORE INSERT ON locations FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_machines_organization_id
  BEFORE INSERT ON machines FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_issues_organization_id
  BEFORE INSERT ON issues FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_priorities_organization_id
  BEFORE INSERT ON priorities FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_issue_statuses_organization_id
  BEFORE INSERT ON "issueStatuses" FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_comments_organization_id
  BEFORE INSERT ON comments FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_attachments_organization_id
  BEFORE INSERT ON attachments FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_issue_history_organization_id
  BEFORE INSERT ON "issueHistory" FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_collection_types_organization_id
  BEFORE INSERT ON "collectionTypes" FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_notifications_organization_id
  BEFORE INSERT ON notifications FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

-- Performance indexes optimized for RLS
CREATE INDEX CONCURRENTLY IF NOT EXISTS issues_org_id_created_at_idx
  ON issues ("organizationId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS machines_org_id_location_idx
  ON machines ("organizationId", "locationId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS comments_org_id_issue_idx
  ON comments ("organizationId", "issueId", "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS issues_org_status_priority_idx
  ON issues ("organizationId", "statusId", "priorityId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS machines_org_model_location_idx
  ON machines ("organizationId", "modelId", "locationId");
```

---

### 🏗️ **Stream 2: Supabase Auth Integration** (Independent)  
**Dependencies**: None | **Files**: 4 files, ~220 lines

**Files to Create**:
```typescript
src/lib/supabase/
├── rls-helpers.ts                  # ~80 lines - RLS utility functions
└── multi-tenant-client.ts          # ~60 lines - organization-aware client wrapper

src/test/helpers/
├── rls-test-context.ts             # ~100 lines - test organization context
└── supabase-test-helpers.ts        # ~80 lines - RLS testing utilities
```

**Files to Modify**:
- `src/lib/supabase/server.ts` - **~25 changes** (add organization context helpers)

**Supabase Auth + RLS Integration Patterns**:

```typescript
// src/lib/supabase/rls-helpers.ts
import { SupabaseClient } from '@supabase/supabase-js';

export async function updateUserOrganization(
  supabaseAdmin: SupabaseClient,
  userId: string, 
  organizationId: string
) {
  // Store organization in user app_metadata (secure, non-tamperable)
  await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: {
      organizationId, // RLS policies will read this automatically
    }
  });
}

export async function getUserOrganizationId(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.app_metadata?.organizationId || null;
}

// src/lib/supabase/multi-tenant-client.ts
import { createClient } from './server';

export async function createOrganizationAwareClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user?.app_metadata?.organizationId) {
    throw new Error('User does not have organization context');
  }
  
  return {
    supabase,
    organizationId: user.app_metadata.organizationId,
  };
}
```

---

### 📡 **Stream 3: tRPC Context Integration** (Depends on Stream 2)
**Dependencies**: Stream 2 Supabase integration | **Files**: 3 files, ~53 changes

**Files to Modify**:
```typescript
src/server/api/
├── trpc.base.ts                    # ~30 changes - integrate Supabase RLS context
├── trpc.ts                         # ~8 changes - export updated procedures
└── trpc.permission.ts              # ~15 changes - permission middleware updates
```

**Simplified tRPC Context Pattern**:

```typescript
// Before: Complex organization middleware (100+ lines)
export const organizationProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // 50+ lines of organization validation
  // 50+ lines of permission setup
});

// After: Zero middleware needed! RLS handles everything
export const orgScopedProcedure = protectedProcedure; // That's it!
// RLS policies automatically read organizationId from auth.jwt() -> 'app_metadata'
// Database filtering happens automatically - no application code needed!
```

**Enhanced tRPC Context**:
```typescript
export async function createTRPCContext({ req }: { req: NextRequest }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  return {
    user,
    organizationId: user?.app_metadata?.organizationId,
    db,
    supabase,
  };
}
```

---

### 🛣️ **Stream 4: Router Conversion** (Depends on Stream 3)
**Dependencies**: tRPC Supabase RLS context ready | **Files**: 24 files, ~285 changes

**Conversion Priority & Effort**:

**🔥 High-Impact Routers**: issue.core.ts (~30), machine.core.ts (~25), location.ts (~20), user.ts (~15), collection.ts (~25)
**🔶 Medium-Impact Routers**: issue.status.ts (~15), issue.timeline.ts (~12), issue.attachment.ts (~10), comment.ts (~12), machine.location.ts (~8), machine.owner.ts (~8), admin.ts (~10), role.ts (~10)  
**🔷 Low-Impact Routers**: issue.comment.ts (~6), model.core.ts (~5), model.opdb.ts (~5), organization.ts (~8), notification.ts (~6), qrCode.ts (~4), pinballMap.ts (~5), issue.ts (~8), issue.admin.ts (~6)

**Conversion Pattern**:
```typescript
// Before RLS: Manual organizationId filtering
const issues = await ctx.db.query.issues.findMany({
  where: and(
    eq(issues.organizationId, ctx.organization.id), // ❌ Remove this
    eq(issues.statusId, input.statusId),
  ),
  with: {
    machine: {
      where: eq(machines.organizationId, ctx.organization.id), // ❌ Remove this
    },
  },
});

// After RLS: Clean business logic only
const issues = await ctx.db.query.issues.findMany({
  where: eq(issues.statusId, input.statusId), // ✅ Only business logic
  with: {
    machine: true, // ✅ Automatic organizational scoping via RLS
  },
});
```

**Example: Issue Comment Router Conversion**:
```typescript
// Before: issue.comment.ts (~505 lines with manual org filtering)
// Lines 44-56: Manual issue organization verification
const [existingIssue] = await ctx.db
  .select({ id: issues.id, organizationId: issues.organizationId })
  .from(issues)
  .where(and(
    eq(issues.id, input.issueId),
    eq(issues.organizationId, ctx.organization.id), // ❌ Manual filtering
  ));

// After: RLS handles organization scoping automatically
const [existingIssue] = await ctx.db
  .select({ id: issues.id })
  .from(issues)
  .where(eq(issues.id, input.issueId)); // ✅ RLS ensures org boundary
```

---

### 🏢 **Stream 5: Service Layer Updates** (Depends on Stream 2)
**Dependencies**: Stream 2 Supabase integration | **Files**: 9 files, ~109 changes

**Files to Modify**:
```typescript
src/server/services/
├── factory.ts                      # ~25 changes - RLS-aware service factory
├── roleService.ts                  # ~20 changes - remove organizationId params
├── collectionService.ts            # ~15 changes - simplify org scoping  
├── issueActivityService.ts         # ~12 changes - clean business logic
├── notificationService.ts          # ~10 changes - automatic scoping
├── qrCodeService.ts               # ~8 changes - minimal updates
├── pinballmapService.ts           # ~8 changes - external API service
├── permissionService.ts           # ~6 changes - context-aware permissions
└── commentCleanupService.ts       # ~5 changes - background jobs
```

**Service Conversion Pattern**:
```typescript
// Before RLS: organizationId parameters everywhere
export class IssueActivityService {
  async getRecentActivity(organizationId: string, limit = 50) {
    return await this.db.query.issueHistory.findMany({
      where: and(
        eq(issueHistory.organizationId, organizationId), // ❌ Remove parameter
        gte(issueHistory.changedAt, subDays(new Date(), 7)),
      ),
    });
  }
}

// After RLS: clean business logic
export class IssueActivityService {
  async getRecentActivity(limit = 50) {
    // ✅ RLS context already set by middleware
    return await this.db.query.issueHistory.findMany({
      where: gte(issueHistory.changedAt, subDays(new Date(), 7)),
    });
  }
}
```

---

### 🧪 **Stream 6: Testing Infrastructure** (Independent)
**Dependencies**: None | **Files**: 5 files, ~440 lines

**Files to Create**:
```typescript
src/test/helpers/
├── rls-test-context.ts             # ~100 lines - Supabase RLS session management
├── organization-context.ts         # ~80 lines - org test utilities
└── multi-tenant-test-helpers.ts    # ~60 lines - isolation testing

src/test/validation/  
├── rls-policy-tests.sql            # ~120 lines - database-level RLS validation
└── cross-org-isolation.test.ts     # ~80 lines - integration validation
```

**Testing Pattern with Supabase Auth + RLS**:
```typescript
// Mock Supabase auth for different organizations
export async function withTestUser<T>(
  userId: string,
  organizationId: string,
  operation: () => Promise<T>,
): Promise<T> {
  // Mock your existing createClient() to return specific user
  vi.mocked(createClient).mockImplementation(() => ({
    auth: {
      getUser: () => Promise.resolve({
        data: { 
          user: { 
            id: userId,
            app_metadata: { organizationId } // RLS reads this automatically
          }
        }
      })
    }
  }));
  
  return await operation();
}

// Usage in tests - works with your existing Drizzle queries
test("issues are organization-scoped via Supabase Auth + RLS", async () => {
  await withTestUser("user-1", "org-1", async () => {
    // Your existing Drizzle query - RLS filters automatically
    const issues = await db.query.issues.findMany();
    // All issues automatically filtered to org-1 by RLS + auth
    expect(issues.every(issue => issue.organizationId === "org-1")).toBe(true);
  });
});
```

---

## 🔗 **Stream Dependencies & Critical Path**

```
Stream 1 (RLS Setup) ──┐
                     ├─► Stream 3 (tRPC) ──► Stream 4 (Routers)
Stream 2 (Auth Integration) ──┘          └─► Stream 5 (Services)

Stream 6 (Testing) ────────────► Validation (All Streams)
```

**Maximum Parallelization**:
- **Independent**: Streams 1, 2, 6 (start immediately)
- **Stream 2 → Stream 3**: Supabase client integration ready
- **Stream 3 → Streams 4,5**: tRPC procedures updated  
- **Router Parallel**: Within Stream 4 (high parallelizability)

---

## 🚀 **Enhanced Database Reset Workflow**

**Updated Package.json Scripts** (already in place):
```json
{
  "scripts": {
    "db:setup-rls": "tsx scripts/setup-rls.ts",
    "db:reset:local:sb": "supabase db reset && npm run db:push:local && npm run db:setup-rls && npm run db:seed:local:sb && npx drizzle-kit pull",
    "db:reset:preview": "supabase db reset --linked && npm run db:push:preview && npm run db:setup-rls && npm run db:seed:preview && npx drizzle-kit pull"
  }
}
```

**Complete Reset Sequence**:
```bash
# Full reset with RLS + type regeneration
npm run db:reset:local:sb
```

**Internal Workflow**:
1. `supabase db reset` - Clear all data and schema
2. `npm run db:push:local` - Create tables from Drizzle schema
3. `npm run db:setup-rls` - Apply RLS policies to all tables
4. `npm run db:seed:local:sb` - Insert test data (automatically filtered by RLS)
5. `npx drizzle-kit pull` - Generate TypeScript schema with `.enableRLS()`

**Required Files to Create**:

**scripts/setup-rls.ts**:
```typescript
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function setupRLS() {
  const sql = postgres(process.env.DATABASE_URL!);
  
  try {
    console.log('🔒 Setting up Row Level Security policies...');
    
    const rlsSQL = readFileSync(join(__dirname, 'setup-rls.sql'), 'utf-8');
    await sql.unsafe(rlsSQL);
    
    console.log('✅ RLS policies applied successfully');
  } catch (error) {
    console.error('❌ Failed to setup RLS:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

setupRLS();
```

---

## 📊 **Total Phase 2 Scope**

**Files to Create**: 11 files, ~1,340 lines total
- RLS setup script: 2 files, ~680 lines
- Integration helpers: 4 files, ~220 lines  
- Testing infrastructure: 5 files, ~440 lines

**Files to Modify**: 40 files, ~467 total changes
- tRPC Context: 3 files, ~53 changes
- Routers: 24 files, ~285 changes  
- Services: 9 files, ~109 changes
- Supabase integration: 1 file, ~25 changes

**Core Change Pattern**: Remove ~200+ manual `organizationId` filtering instances, replace with Supabase RLS automation

---

## 📋 **Success Metrics & Validation**

**Technical Completion**:
- [ ] Zero manual `organizationId` filtering in queries
- [ ] tRPC middleware simplified to basic auth checking
- [ ] All services remove organizationId parameters  
- [ ] Supabase RLS enforces organizational boundaries
- [ ] Cross-organization isolation verified with testing tools

**Quality Gates**:
- [ ] TypeScript compilation passes
- [ ] All existing functionality preserved  
- [ ] Performance acceptable with RLS
- [ ] Test suite passes with new patterns
- [ ] Manual user flows work correctly

**Implementation Commands**:

```bash
# Start Stream 1 (RLS Setup)
touch scripts/setup-rls.sql scripts/setup-rls.ts
npm run db:reset:local:sb

# Start Stream 2 (Supabase Integration)
mkdir -p src/lib/supabase src/test/helpers
touch src/lib/supabase/rls-helpers.ts src/lib/supabase/multi-tenant-client.ts

# Start Stream 6 (Testing)
mkdir -p src/test/validation
touch src/test/helpers/rls-test-context.ts src/test/validation/rls-policy-tests.sql

# Monitor Progress
rg "organizationId.*eq\(" src/ --count  # Track manual filtering removal
npm run typecheck:brief                  # Validate TypeScript compilation
```

---

**Key Success Factor**: This Supabase-native approach leverages battle-tested RLS while maximizing parallel development velocity. Your existing `@supabase/ssr` auth setup becomes the automatic multi-tenant security boundary with zero workflow changes required.
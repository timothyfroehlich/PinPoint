# Phase 2: RLS Implementation - Detailed Workflow Plan

**Context**: Post-Prisma removal, ready for Row-Level Security implementation  
**Approach**: Supabase-native RLS using existing migration workflow for maximum velocity

---

## 🎯 **Phase 2 Overview: Database-Level Multi-Tenancy**

**Goal**: Transform from manual `organizationId` filtering to automatic database-level multi-tenancy using **Supabase RLS + Auth integration**.

**Impact**: 
- Remove ~200+ manual `organizationId` filtering queries across codebase
- Simplify tRPC middleware from 100+ lines to ~15 lines  
- Automatic organizational scoping for all new features
- Database-level security guarantees with **Supabase Auth context**
- Zero application-level filtering - **let PostgreSQL + Supabase Auth handle everything**

---

## 📊 **Parallel Work Streams (Supabase-Native)**

### 🔧 **Stream 1: RLS Setup Script** (Independent)
**Dependencies**: None | **Approach**: Single RLS setup script integrated with reset workflow

**Files to Create** (RLS Setup Scripts for Reset Workflow):
```bash
scripts/
└── setup-rls.sql                          # ~620 lines - complete RLS setup
    ├── Auth foundation functions           # ~80 lines
    ├── Organization policies + auth        # ~120 lines  
    ├── Asset policies + auth integration   # ~140 lines
    ├── Workflow policies + auth            # ~160 lines
    ├── Activity policies + auth            # ~120 lines
    └── Performance indexes                 # ~100 lines
```

**RLS Setup Integration with Reset Workflow:**
- Extends your current `npm run db:reset:local:sb` workflow  
- Leverages your existing `@supabase/ssr` auth setup
- Single RLS setup script runs after schema push
- Perfect integration: `supabase db reset` → `drizzle push` → `npm run db:setup-rls` → `seed`
- **Enhanced reset command**: `npm run db:reset:local:sb && npm run db:setup-rls`
- **Your existing auth flow becomes the automatic multi-tenant security boundary**

**Key Supabase Auth + RLS Integration Strategy:**
- **User Context**: Store `organizationId` in Supabase user `app_metadata` (secure, non-tamperable)
- **Automatic Filtering**: RLS policies use `auth.jwt() -> 'app_metadata' ->> 'organizationId'` for tenant context
- **Auth Flow Integration**: Your existing `@supabase/ssr` patterns work seamlessly
- **Performance**: Compound indexes on `(organization_id, [business_field])` optimized for RLS
- **Security**: Database-level enforcement - impossible to bypass even with application bugs
- **Zero Code Changes**: Your existing Drizzle queries work unchanged - database filters automatically

**Multi-Tenant Tables (from schema analysis):**
- **Core**: organizations, memberships, roles, rolePermissions
- **Assets**: locations, machines, models  
- **Workflow**: issues, priorities, issueStatuses
- **Activity**: comments, attachments, issueHistory, upvotes
- **Features**: collections, collectionTypes, collectionMachines, notifications

**Stream 1 Output**: Single script creates complete RLS setup - database automatically enforces organizational boundaries

---

### 🏗️ **Stream 2: Supabase Client Integration** (Independent)  
**Dependencies**: None | **Approach**: Leverage Supabase's built-in RLS integration

**Files to Create:**
```typescript
src/lib/supabase/
├── rls-helpers.ts                  # ~80 lines - RLS utility functions
└── multi-tenant-client.ts          # ~60 lines - organization-aware client wrapper

src/test/helpers/
├── rls-test-context.ts             # ~100 lines - test organization context
└── supabase-test-helpers.ts        # ~80 lines - RLS testing utilities
```

**Files to Modify:**
- `src/lib/supabase/server.ts` - **~25 changes** (add organization context helpers)
- `src/server/db/provider.ts` - **~20 changes** (integrate Supabase RLS patterns)

**Key Supabase Auth + RLS Integration:**
```typescript
// Supabase Auth Integration - leverages your existing SSR setup
export async function updateUserOrganization(
  supabaseAdmin: SupabaseClient,
  userId: string, 
  organizationId: string
) {
  // Store organization in user app_metadata (secure, non-tamperable)
  await supabaseAdmin.auth.updateUser(userId, {
    app_metadata: {
      organizationId, // RLS policies will read this automatically
      role: 'member'  // Can also store role for additional security
    }
  });
}

// Your existing createClient() from @supabase/ssr works unchanged
// RLS policies automatically read from auth.jwt() -> 'app_metadata'
```

**Stream 2 Output**: Your existing Supabase SSR auth system becomes the multi-tenant security boundary

---

### 📡 **Stream 3: tRPC Context Integration** (Depends on Stream 2)
**Dependencies**: Stream 2 Supabase integration | **Approach**: Update tRPC to use Supabase RLS

**Files to Modify:**
```typescript
src/server/api/
├── trpc.base.ts                    # ~30 changes - integrate Supabase RLS context
├── trpc.ts                         # ~8 changes - export updated procedures
└── trpc.permission.ts              # ~15 changes - permission middleware updates
```

**Key Supabase Auth + RLS Integration:**
```typescript
// Before: Complex organization middleware (100+ lines)
export const organizationProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // 50+ lines of organization validation
  // 50+ lines of permission setup
});

// After: Zero middleware needed! (~0 lines)  
// Your existing protectedProcedure already handles auth
// RLS policies automatically read organizationId from auth.jwt() -> 'app_metadata'
// Database filtering happens automatically - no application code needed!

export const orgScopedProcedure = protectedProcedure; // That's it!
```

**Stream 3 Output**: Zero middleware changes needed - RLS reads from your existing Supabase auth automatically

---

### 🛣️ **Stream 4: Router Conversion** (Depends on Stream 3)
**Dependencies**: tRPC Supabase RLS context ready | **Parallelizable**: High - can work on multiple routers simultaneously

**Conversion Priority & Effort:**

**🔥 High-Impact Routers**:
```bash
src/server/api/routers/
├── issue.core.ts                   # ~30 changes - core business logic
├── machine.core.ts                 # ~25 changes - asset management  
├── location.ts                     # ~20 changes - multi-tenant assets
├── user.ts                         # ~15 changes - user management
└── collection.ts                   # ~25 changes - complex relationships
```

**🔶 Medium-Impact Routers**:
```bash
├── issue.status.ts                 # ~15 changes
├── issue.timeline.ts               # ~12 changes  
├── issue.attachment.ts             # ~10 changes
├── comment.ts                      # ~12 changes
├── machine.location.ts             # ~8 changes
├── machine.owner.ts                # ~8 changes
├── admin.ts                        # ~10 changes
└── role.ts                         # ~10 changes
```

**🔷 Low-Impact Routers**:
```bash
├── issue.comment.ts                # ~6 changes
├── model.core.ts                   # ~5 changes
├── model.opdb.ts                   # ~5 changes  
├── organization.ts                 # ~8 changes
├── notification.ts                 # ~6 changes
├── qrCode.ts                       # ~4 changes
├── pinballMap.ts                   # ~5 changes
├── issue.ts                        # ~8 changes
└── issue.admin.ts                  # ~6 changes
```

**Conversion Pattern:**
```typescript
// Before RLS: Manual organizationId filtering
const issues = await ctx.db.query.issues.findMany({
  where: and(
    eq(issues.organizationId, ctx.organization.id), // Remove this
    eq(issues.statusId, input.statusId),
  ),
  with: {
    machine: {
      where: eq(machines.organizationId, ctx.organization.id), // Remove this
    },
  },
});

// After RLS: Clean business logic only
const issues = await ctx.db.query.issues.findMany({
  where: eq(issues.statusId, input.statusId), // Only business logic
  with: {
    machine: true, // Automatic organizational scoping via Supabase RLS
  },
});
```

**Stream 4 Output**: All routers use automatic Supabase RLS organizational scoping

---

### 🏢 **Stream 5: Service Layer Updates** (Depends on Stream 2)
**Dependencies**: Stream 2 Supabase integration | **Approach**: Update services to use Supabase RLS

**Files to Modify:**
```typescript
src/server/services/
├── factory.ts                      # ~25 changes - Supabase RLS-aware service factory
├── roleService.ts                  # ~20 changes - remove organizationId params
├── collectionService.ts            # ~15 changes - simplify org scoping  
├── issueActivityService.ts         # ~12 changes - clean business logic
├── notificationService.ts          # ~10 changes - automatic scoping
├── qrCodeService.ts               # ~8 changes - minimal updates
├── pinballmapService.ts           # ~8 changes - external API service
├── permissionService.ts           # ~6 changes - context-aware permissions
└── commentCleanupService.ts       # ~5 changes - background jobs
```

**Service Conversion Pattern:**
```typescript
// Before RLS: organizationId parameters everywhere
export class IssueActivityService {
  async getRecentActivity(organizationId: string, limit = 50) {
    return await this.db.query.issueHistory.findMany({
      where: and(
        eq(issueHistory.organizationId, organizationId), // Remove this
        gte(issueHistory.changedAt, subDays(new Date(), 7)),
      ),
    });
  }
}

// After Supabase RLS: clean business logic
export class IssueActivityService {
  async getRecentActivity(limit = 50) {
    // Supabase RLS context already set by middleware
    return await this.db.query.issueHistory.findMany({
      where: gte(issueHistory.changedAt, subDays(new Date(), 7)),
    });
  }
}
```

**Stream 5 Output**: Service layer eliminates organizational complexity with Supabase RLS

---

### 🧪 **Stream 6: Testing Infrastructure** (Independent)
**Dependencies**: None | **Approach**: Use Supabase testing tools and RLS test helpers

**Files to Create:**
```typescript
src/test/helpers/
├── rls-test-context.ts             # ~100 lines - Supabase RLS session management
├── organization-context.ts         # ~80 lines - org test utilities
└── multi-tenant-test-helpers.ts    # ~60 lines - isolation testing

src/test/validation/  
├── rls-policy-tests.sql            # ~120 lines - database-level RLS validation
└── cross-org-isolation.test.ts     # ~80 lines - integration validation
```

**Files to Modify:**
- `src/test/helpers/pglite-test-setup.ts` - **~20 changes** (RLS context setup)
- `src/test/database-test-helpers.ts` - **~15 changes** (session management)

**Testing Pattern with Supabase Auth + RLS:**
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

**Stream 6 Output**: Testing infrastructure leverages your existing auth mocks with automatic RLS filtering

---

## 🔗 **Stream Dependencies & Parallelization**

### **Critical Path:**
```
Stream 1 (RLS Setup) ──┐
                     ├─► Stream 3 (tRPC) ──► Stream 4 (Routers)
Stream 2 (Auth Integration) ──┘          └─► Stream 5 (Services)

Stream 6 (Testing) ────────────► Validation (All Streams)
```

### **Maximum Parallelization:**
- **Independent**: Streams 1, 2, 6 (can start immediately)
- **Stream 2 → Stream 3**: Supabase client integration ready
- **Stream 3 → Streams 4,5**: tRPC procedures updated  
- **Router Parallel**: Within Stream 4 (high parallelizability)

---

## 📊 **Total Phase 2 Scope (Supabase-Native)**

**Files to Create:** 6 files, ~920 lines total
- RLS setup script: 1 file, ~620 lines
- Integration helpers: 3 files, ~220 lines  
- Testing infrastructure: 5 files, ~440 lines

**Files to Modify:** 40 files, ~486 total changes
- tRPC Context: 3 files, ~53 changes
- Routers: 24 files, ~285 changes  
- Services: 9 files, ~109 changes
- Supabase integration: 4 files, ~80 changes

**Core Change Pattern:** Remove ~200+ manual `organizationId` filtering instances, replace with Supabase RLS automation

---

## 📋 **Success Metrics & Validation**

### **Technical Completion:**
- [ ] Zero manual `organizationId` filtering in queries
- [ ] tRPC middleware simplified to Supabase RLS context setup
- [ ] All services remove organizationId parameters  
- [ ] Supabase RLS enforces organizational boundaries
- [ ] Cross-organization isolation verified with Supabase testing tools

### **Quality Gates:**
- [ ] TypeScript compilation passes
- [ ] All existing functionality preserved  
- [ ] Performance acceptable with Supabase RLS
- [ ] Test suite passes with new patterns
- [ ] Manual user flows work correctly

### **Supabase RLS Complete When:**
- [ ] Database-level multi-tenancy functional via Supabase
- [ ] Application queries automatically scoped by RLS
- [ ] Testing infrastructure supports Supabase RLS patterns
- [ ] Manual testing of key workflows successful
- [ ] Ready for Phase 3 (systematic test conversion)

---

## 🚀 **Implementation Commands**

### **Enhanced Database Reset Workflow**

**Updated Package.json Scripts:**
```json
{
  "scripts": {
    "db:setup-rls": "tsx scripts/setup-rls.ts",
    "db:reset:local:sb": "supabase db reset && npm run db:push:local && npm run db:setup-rls && npm run db:seed:local:sb && npx drizzle-kit pull",
    "db:reset:preview": "supabase db reset --linked && npm run db:push:preview && npm run db:setup-rls && npm run db:seed:preview && npx drizzle-kit pull"
  }
}
```

**Complete Reset Sequence (Single Command):**
```bash
# Full reset with RLS + type regeneration
npm run db:reset:local:sb
```

**What happens internally:**
```bash
# 1. Supabase Reset
supabase db reset
# ↳ Clears all data and schema
# ↳ Reapplies any migrations in supabase/migrations/ (if any)

# 2. Schema Push  
npm run db:push:local
# ↳ Executes: drizzle-kit push --config=drizzle.config.dev.ts
# ↳ Creates tables based on your Drizzle schema
# ↳ Tables exist but have NO RLS policies yet

# 3. RLS Setup
npm run db:setup-rls  
# ↳ Executes: tsx scripts/setup-rls.ts
# ↳ Reads scripts/setup-rls.sql
# ↳ Applies RLS policies to all tables
# ↳ Database now has full multi-tenant security

# 4. Seed Data
npm run db:seed:local:sb
# ↳ Executes: tsx scripts/seed/index.ts local:sb  
# ↳ Inserts test data
# ↳ Data is automatically filtered by RLS policies

# 5. Type Regeneration
npx drizzle-kit pull
# ↳ Introspects database with RLS enabled
# ↳ Generates TypeScript schema with .enableRLS()
# ↳ Full type safety for RLS-enabled tables
```

**Required Files to Create:**

**scripts/setup-rls.ts** (~60 lines):
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
    
    // Read and execute RLS SQL file
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

**scripts/setup-rls.sql** (~620 lines):
```sql
-- Enable RLS on all multi-tenant tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Core organization policies using auth.jwt() app_metadata
CREATE POLICY "organization_members_only" ON organizations
  FOR ALL TO authenticated
  USING (id = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

-- [Additional policies for all multi-tenant tables...]
-- [Performance indexes optimized for RLS...]
```

### **Development Workflow Commands:**

**Quick Development Reset:**
```bash
npm run db:reset:local:sb  # Full reset with RLS + seed + types
```

**Schema-only Changes (faster):**
```bash
npm run db:push:local      # Just push schema changes
```

**RLS Policy Updates:**
```bash
npm run db:setup-rls       # Reapply RLS policies only
```

**Type Regeneration:**
```bash
npx drizzle-kit pull       # Update TypeScript types after DB changes
```

**Validation:**
```bash
npm run db:validate:minimal  # Verify everything works
```

### **Start Stream 1 (RLS Setup):**
```bash
# Create RLS setup files
touch scripts/setup-rls.sql
touch scripts/setup-rls.ts

# Test enhanced reset workflow
npm run db:reset:local:sb
```

### **Start Stream 2 (Supabase Integration):**
```bash
# Create Supabase RLS helpers
# Update Supabase client integration
npm run typecheck:brief    # Validate integration
```

### **Start Stream 6 (Testing):**
```bash
# Create Supabase RLS test helpers
npm run test:brief         # Validate test infrastructure
```

### **Monitor Progress:**
```bash
# Track manual organizationId filtering removal
rg "organizationId.*eq\(" src/ --count

# Track Supabase RLS context adoption  
rg "set_current_organization" src/ --count

# Validate TypeScript compilation
npm run typecheck:brief

# Verify RLS is working
psql $DATABASE_URL -c "SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE rowsecurity = true;"
```

---

`★ Insight ─────────────────────────────────────`
**Supabase-Native Advantage**: This approach leverages Supabase's battle-tested RLS system instead of building custom session management. Supabase RLS policies are visible in the dashboard, have built-in testing tools, and integrate seamlessly with your existing migration workflow.

**Zero Workflow Changes**: Your current `db:reset → drizzle push → seed` workflow already handles Supabase migrations perfectly. No additional tooling or setup required.

**Performance & Security**: Supabase RLS includes optimized query planning and provides stronger security guarantees than application-level filtering.
`─────────────────────────────────────────────────`

**Key Success Factor**: This workflow maximizes parallel development while leveraging Supabase's strengths. The solo development context allows aggressive parallelization within streams (especially router conversion) for maximum velocity with enterprise-grade RLS security.
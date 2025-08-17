# Phase 1: Complete Prisma Removal - Execution Plan

**Context:** Final 15% of Prisma-to-Drizzle migration - converting service layer and cleaning infrastructure  
**Status:** Router layer 85% complete, service layer conversion in progress  
**Dependency Chain:** This phase MUST complete before RLS implementation (technical impossibility with dual ORMs)  
**Complexity:** Intensive focus phase requiring systematic service layer modernization

---

## Phase Objective & Dependencies

### **Why This Phase Must Complete First**

**Technical Impossibility:** Row-Level Security cannot function with dual ORM patterns:

- RLS policies operate at database session level
- Multiple ORM clients create conflicting session contexts
- Prisma client bypass patterns invalidate RLS enforcement
- Service layer dependency injection requires single client architecture

**Dependency Chain Requirements:**

1. **Phase 1 Foundation:** 100% Prisma removal → Clean Drizzle-only architecture
2. **Prerequisite for Phase 2:** RLS implementation with proper session management
3. **Prerequisite for Phase 3:** Advanced security patterns and permission systems

**Breaking this chain = project failure** due to unresolvable technical conflicts.

---

## Current State Assessment

Based on codebase analysis:

### **✅ Already Drizzle-Only**

- **tRPC Context:** `src/server/api/trpc.base.ts` - Clean Drizzle implementation
- **Service Factory:** `src/server/services/factory.ts` - Pure Drizzle dependency injection
- **Core Services:** `collectionService.ts`, `permissionService.ts` - Modern Drizzle patterns
- **Package Dependencies:** Zero Prisma packages remaining

### **🔍 Requires Inspection**

- **Service Files:** Some may have Prisma compatibility interfaces
- **Test Mocks:** May have outdated Prisma mock patterns
- **Type Definitions:** May have legacy Prisma type references
- **Comments/Documentation:** May reference Prisma patterns

---

## Service Layer Conversion

### **Service Constructor Modernization**

**Current Pattern Analysis:**
Most services already use clean Drizzle-only constructors:

```typescript
// ✅ Modern pattern (already implemented)
export class CollectionService {
  constructor(private db: DrizzleClient) {}
}

export class PermissionService {
  constructor(private db: DrizzleClient) {}
}
```

**Action Required:** Audit all service files for any remaining dual-ORM patterns.

### **Service Files to Audit**

**Complexity-Based Priority Order:**

1. **High Complexity (Security-Critical):**
   - `src/server/services/permissionService.ts` ✅ **VERIFIED CLEAN**
   - `src/server/services/drizzleRoleService.ts` - Check for Prisma compatibility interfaces
   - `src/server/api/routers/role.ts` - Verify service instantiation patterns

2. **Medium Complexity (Business Logic):**
   - `src/server/services/collectionService.ts` ✅ **VERIFIED CLEAN**
   - `src/server/services/issueActivityService.ts`
   - `src/server/services/notificationService.ts`

3. **Low Complexity (Utilities):**
   - `src/server/services/pinballmapService.ts`
   - `src/server/services/commentCleanupService.ts`
   - `src/server/services/qrCodeService.ts`

### **Conversion Process for Each Service**

**Step 1: Read and Analyze**

```bash
# Examine service for Prisma patterns
rg -i "prisma" src/server/services/SERVICE_NAME.ts
rg "PrismaClient|@prisma" src/server/services/SERVICE_NAME.ts
```

**Step 2: Modern Drizzle Patterns**

**Generated Columns Implementation:**

```typescript
// ✅ Move computed logic to database level
export const users = pgTable("users", {
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),

  // Generated column for full name
  fullName: text("full_name").generatedAlwaysAs(
    sql`${users.firstName} || ' ' || ${users.lastName}`,
    { mode: "stored" },
  ),

  // Full-text search vector
  searchVector: tsvector("search_vector").generatedAlwaysAs(
    sql`setweight(to_tsvector('english', ${users.firstName}), 'A') || 
        setweight(to_tsvector('english', ${users.lastName}), 'B')`,
    { mode: "stored" },
  ),
});
```

**Enhanced Index Patterns:**

```typescript
// ✅ Modern index API with column modifiers
export const issues = pgTable(
  "issues",
  {
    title: text("title").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    organizationId: text("organization_id").notNull(),
  },
  (table) => ({
    // Modern column-specific sorting
    titleIndex: index().on(table.title.asc()),
    dateIndex: index().on(table.createdAt.desc()),
    compoundIndex: index().on(
      table.organizationId.asc(),
      table.createdAt.desc(),
    ),
  }),
);
```

**Prepared Statements for Performance:**

```typescript
// ✅ High-frequency query optimization
const getIssuesByStatusPrepared = db
  .select({
    id: issues.id,
    title: issues.title,
    fullDescription: issues.fullDescription, // Generated column
  })
  .from(issues)
  .where(
    and(
      eq(issues.organizationId, placeholder("orgId")),
      eq(issues.statusId, placeholder("statusId")),
    ),
  )
  .prepare();
```

**Step 3: Remove Legacy Interfaces**

Remove any Prisma compatibility interfaces:

```typescript
// ❌ Remove these patterns
interface PrismaLikeWhereConditions {
  // Legacy compatibility code
}

interface PrismaLikeIncludeConditions {
  // Legacy compatibility code
}
```

---

## tRPC Context Migration

### **Current State: Already Modern**

The tRPC context in `src/server/api/trpc.base.ts` is already using clean Drizzle-only patterns:

```typescript
// ✅ Current implementation is correct
export interface TRPCContext {
  db: DrizzleClient; // Single Drizzle client
  user: PinPointSupabaseUser | null;
  supabase: SupabaseServerClient;
  organization: Organization | null;
  services: ServiceFactory;
  // No Prisma client present
}
```

**Verification Required:** Ensure no router files attempt to access `ctx.prisma` or similar patterns.

---

## Infrastructure Cleanup

### **Database Provider Verification**

Check `src/server/db/provider.ts` for any Prisma client initialization:

```typescript
// ✅ Should only have Drizzle patterns
export const getGlobalDatabaseProvider = () => {
  return {
    getClient: () => DrizzleClient,
    // No Prisma initialization
  };
};
```

### **Environment Variables**

**Optional Cleanup (Low Priority):**

- Remove Prisma-specific environment variables from `.env.example`
- Clean up any Prisma connection strings if no longer needed
- Verify Supabase connection strings are properly configured

### **Configuration Files**

**Verify Removal:**

- No `prisma/` directory should exist
- No `prisma.schema` files
- No Prisma scripts in `package.json`

---

## Test Infrastructure Updates

### **Mock Pattern Migration**

**Current Issue:** Test mocks may still reference Prisma patterns.

**Modern Vitest Mocking (August 2025):**

```typescript
// ✅ Modern mock patterns with type safety
import { vi } from "vitest";

// Partial mocking with vi.importActual
vi.mock("@/server/db/index", async (importOriginal) => {
  const actual = await vi.importActual("@/server/db/index");
  return {
    ...actual,
    db: mockDb, // Mock only what you need
  };
});

// Hoisted variables for shared mock state
const mockDb = vi.hoisted(() => ({
  query: {
    users: { findMany: vi.fn(), findFirst: vi.fn() },
    issues: { findMany: vi.fn() },
  },
  insert: vi.fn().mockReturnValue({ returning: vi.fn() }),
  update: vi.fn().mockReturnValue({ where: vi.fn() }),
}));
```

**PGlite Integration Testing:**

```typescript
// ✅ Modern in-memory testing for integration tests
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

export const createTestDatabase = async () => {
  const client = new PGlite();
  const testDb = drizzle(client, { schema });

  // Apply all migrations
  await migrate(testDb, { migrationsFolder: "./drizzle" });

  return testDb;
};
```

### **Test Files to Audit**

**Search for Legacy Patterns:**

```bash
# Find tests with Prisma references
rg -i "prisma" src/ --type ts --type tsx
rg "PrismaClient" src/test/ src/integration-tests/
rg "mockPrisma" src/test/ src/integration-tests/
```

**Common Patterns to Replace:**

```typescript
// ❌ Old patterns
const mockPrisma = {
  user: { findMany: vi.fn() },
  post: { create: vi.fn() },
};

// ✅ New patterns
const mockDb = vi.hoisted(() => ({
  query: {
    users: { findMany: vi.fn(), findFirst: vi.fn() },
    posts: { create: vi.fn() },
  },
}));
```

---

## Validation Procedures

### **Compilation Validation**

**TypeScript Safety Net:**

```bash
# Primary validation - must pass
npm run typecheck

# Verify no Prisma imports remain
npm run typecheck:verbose | grep -i prisma
```

**Build Validation:**

```bash
# Ensure production build succeeds
npm run build
```

### **Runtime Validation**

**Database Connectivity:**

```bash
# Verify Drizzle-only database operations
npm run db:validate
```

**Service Layer Testing:**

```bash
# Run service-specific tests
npm run test -- src/server/services/
npm run test -- src/server/api/routers/
```

### **Manual Validation Workflow**

**Critical User Flows:**

1. **Authentication:** Login/logout with Supabase SSR
2. **Data Access:** View issues, machines, locations
3. **Data Modification:** Create/update/delete operations
4. **Permissions:** Role-based access control
5. **Multi-tenancy:** Organization scoping

**Validation Commands:**

```bash
# Start development server
npm run dev

# Test key endpoints manually
curl http://localhost:3000/api/health
```

---

## Common Pitfalls

### **❌ DO NOT DO These Things**

**1. Parallel Validation Anti-Pattern:**

```typescript
// ❌ Never create dual-ORM validation
const drizzleResult = await drizzle.query.users.findMany();
const prismaResult = await prisma.user.findMany();
// DON'T compare results
```

**2. Gradual Migration Anti-Pattern:**

```typescript
// ❌ Never use "feature flags" for ORM selection
const useNewORM = process.env.USE_DRIZZLE === "true";
const result = useNewORM ? drizzleQuery() : prismaQuery();
```

**3. Prisma Dependency Retention:**

```typescript
// ❌ Never keep "just in case" Prisma code
// if (fallbackToPrisma) { ... }
```

**4. Test Shortcuts:**

```typescript
// ❌ Never skip test updates "temporarily"
// TODO: Update mocks later
const mockPrisma = {
  /* old patterns */
};
```

### **✅ DO These Things**

**1. Complete Removal:**

- Remove ALL Prisma references completely
- Update ALL test mocks to Drizzle patterns
- Clean ALL documentation references

**2. Modern Drizzle Patterns:**

- Use generated columns for computed fields
- Implement prepared statements for frequent queries
- Leverage relational queries over manual joins

**3. Type Safety First:**

- Ensure TypeScript compilation passes after each change
- Use Drizzle's inference types (`$inferSelect`, `$inferInsert`)
- Maintain strict type checking throughout

**4. Performance Optimization:**

- Use column-specific index modifiers
- Implement batch operations for bulk data
- Leverage database-level computations

---

## Success Criteria

### **Phase 1 Complete When:**

**Technical Metrics:**

- [ ] TypeScript compilation passes with zero warnings
- [ ] Zero Prisma imports/references in codebase
- [ ] All services use Drizzle-only dependency injection
- [ ] All test mocks updated to Drizzle patterns
- [ ] PGlite integration tests pass

**Functional Metrics:**

- [ ] Authentication flows work (Supabase SSR)
- [ ] Data CRUD operations function correctly
- [ ] Multi-tenant organizational scoping maintained
- [ ] Permission system operates properly
- [ ] Performance meets or exceeds previous levels

**Architecture Metrics:**

- [ ] Single database client throughout system
- [ ] Modern Drizzle patterns implemented (generated columns, enhanced indexes)
- [ ] Prepared statements for high-frequency operations
- [ ] Clean service layer with proper dependency injection

### **Quality Gates**

**Automated Validation:**

```bash
# Must pass before proceeding
npm run typecheck           # TypeScript safety
npm run lint               # Code quality
npm run test:brief         # Core functionality
npm run db:validate        # Database operations
```

**Manual Validation:**

- Key user flows work correctly
- No performance degradation observed
- Error handling maintains previous behavior
- Multi-tenancy boundaries preserved

---

## Risk Mitigation

### **Rollback Strategy**

**Per-Service Rollback:**

```bash
# Immediate rollback for individual service
git checkout HEAD~1 -- src/server/services/SERVICE_NAME.ts
npm run typecheck  # Verify rollback success
```

**Full Phase Rollback:**

```bash
# Complete phase rollback if needed
git stash  # Save current work
git reset --hard PHASE_START_COMMIT
```

### **Incremental Safety**

**Single Service Conversion Workflow:**

1. Convert single service
2. Run full test suite
3. Verify functionality
4. Commit changes
5. Move to next service

**Commit Strategy:**

```bash
# Clear, atomic commits
git add src/server/services/SERVICE_NAME.ts
git commit -m "convert SERVICE_NAME to Drizzle-only pattern

- Remove Prisma compatibility interfaces
- Implement modern Drizzle query patterns
- Update dependency injection to single client
- Verified: TypeScript compilation passes"
```

---

## Execution Workflow

### **Service Layer Conversion Phase**

**Scope:** Systematic audit and modernization of service files

- Audit all service files for Prisma patterns
- Convert security-critical services (high complexity)
- Verify TypeScript compilation and basic functionality

### **Infrastructure & Testing Phase**

**Scope:** Comprehensive testing infrastructure modernization

- Update test mocks and integration patterns
- Clean infrastructure and configuration files
- Run comprehensive validation suite

### **Final Validation & Documentation Phase**

**Scope:** Complete system verification and documentation updates

- Manual testing of critical user flows
- Performance validation and optimization
- Update documentation and commit final changes

---

## Next Phase Preparation

### **Phase 2 Prerequisites**

Upon Phase 1 completion, verify readiness for RLS implementation:

**Architecture Verification:**

- [ ] Single Drizzle client architecture confirmed
- [ ] Supabase SSR authentication patterns operational
- [ ] Database session management clean and consistent
- [ ] Multi-tenant scoping patterns established

**Technical Foundation:**

- [ ] Generated columns operational for computed fields
- [ ] Enhanced index patterns improve query performance
- [ ] Prepared statements optimize frequent operations
- [ ] Modern testing infrastructure validates database behavior

**Documentation Updates:**

- [ ] Service layer patterns documented
- [ ] Testing approaches clearly described
- [ ] Migration decisions recorded for future reference
- [ ] Architecture diagrams reflect current state

---

**Status:** Ready for execution - comprehensive plan with clear success criteria and risk mitigation strategies.

# Phase 4: Integration Tests Conversion

**Timeline**: 2-3 days  
**Impact**: Medium - Test coverage and memory management  
**Approach**: Manual updates with focus on memory-safe patterns  

## 🎯 Overview

Update integration test files to use Drizzle-only patterns and implement memory-safe testing approaches. These tests validate end-to-end functionality with real database operations.

**Why Phase 4**: Integration tests provide critical coverage for complex business flows and must use proper database patterns to avoid memory issues and system instability.

## 📋 Tasks

### **Priority 1: Location Integration Tests**

- [ ] **Update `location.aggregation.integration.test.ts`**
  - Current: Uses Prisma for location data aggregation tests
  - Target: Use Drizzle queries for location aggregation validation
  - Focus: Aggregation query patterns, organizational scoping

- [ ] **Update `location.crud.integration.test.ts`** 
  - Current: CRUD operations using Prisma patterns
  - Target: CRUD operations using Drizzle insert/update/delete
  - Focus: Location creation, updates, and deletion workflows

- [ ] **Update `location.services.integration.test.ts`**
  - Current: Service layer tests with Prisma
  - Target: Service layer tests with converted Drizzle services
  - Focus: Service integration after Phase 1 conversions

- [ ] **Update `location.integration.test.ts`**
  - Current: General location functionality with Prisma
  - Target: Location functionality with Drizzle patterns
  - Focus: End-to-end location workflows

### **Priority 2: Machine Integration Tests**

- [ ] **Update `machine.location.integration.test.ts`**
  - Current: Machine-location relationships using Prisma includes
  - Target: Machine-location relationships using Drizzle relational queries  
  - Focus: Relational query patterns, join optimization

- [ ] **Update `machine.owner.integration.test.ts`**
  - Current: Machine ownership operations with Prisma
  - Target: Machine ownership operations with Drizzle
  - Focus: Ownership transfer workflows, permission validation

### **Priority 3: Issue & Comment Integration Tests**

- [ ] **Update `issue.timeline.integration.test.ts`**
  - Current: Issue timeline construction with Prisma
  - Target: Issue timeline with converted issueActivityService  
  - Focus: Timeline accuracy, chronological ordering

- [ ] **Update `comment.integration.test.ts`**
  - Current: Comment operations using Prisma patterns
  - Target: Comment operations with converted commentService
  - Focus: Comment workflows, moderation integration

### **Priority 4: Admin & Role Integration Tests**  

- [ ] **Update `admin.integration.test.ts`**
  - Current: Administrative operations using Prisma
  - Target: Administrative operations with converted admin services
  - Focus: Bulk operations, admin permissions

- [ ] **Update `role.integration.test.ts`**
  - Current: Role system testing with mixed Prisma/Drizzle patterns
  - Target: Role system with converted roleService (DrizzleRoleService)
  - Focus: Role hierarchy, permission inheritance

### **Priority 5: Schema & Data Validation Tests**

- [ ] **Update `schema-data-integrity.integration.test.ts`**
  - Current: Data integrity validation using Prisma
  - Target: Data integrity validation using Drizzle
  - Focus: Foreign key constraints, data consistency

- [ ] **Update `schema-migration-validation.integration.test.ts`**
  - Current: Migration validation patterns
  - Target: Drizzle schema validation patterns
  - Focus: Migration accuracy, schema consistency

- [ ] **Update `multi-tenant-isolation.integration.test.ts`**
  - Current: Multi-tenant testing with Prisma scoping
  - Target: Multi-tenant testing with Drizzle organizational scoping
  - Focus: Tenant isolation, security boundaries

- [ ] **Update `notification.schema.test.ts`**
  - Current: Notification schema validation
  - Target: Notification patterns with converted notificationService
  - Focus: Notification delivery, schema validation

## 🚨 Critical Memory Management

### **Implement Memory-Safe Patterns**

**REQUIRED PATTERN for all integration tests:**
```typescript
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

test("integration test description", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Test implementation with automatic cleanup
    const result = await db.query.users.findMany({
      where: eq(users.organizationId, "test-org")
    });
    
    expect(result).toHaveLength(expectedCount);
  });
});
```

**DANGEROUS PATTERNS to remove:**
```typescript
// ❌ CAUSES MEMORY BLOWOUTS
beforeEach(async () => {
  const { db } = await createSeededTestDatabase();
});

// ❌ CAUSES SYSTEM LOCKUPS  
const client = new PGlite(); // Multiple instances
```

## 🔧 Conversion Strategy

### **Step-by-Step Process for Each Test File:**

**1. Import Updates**
```typescript
// Remove Prisma imports
// import { prisma } from "~/test/prisma-setup"

// Add Drizzle imports  
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db"
import { eq, and } from "drizzle-orm"
```

**2. Query Pattern Updates**
```typescript
// Old Prisma patterns:
const users = await prisma.user.findMany({
  where: { organizationId: "test-org" },
  include: { posts: true }
})

// New Drizzle patterns:
const users = await db.query.users.findMany({
  where: eq(users.organizationId, "test-org"),
  with: { posts: true }
})
```

**3. Test Structure Updates**
```typescript
// Replace beforeEach database creation with worker-scoped pattern
// Update assertions to match Drizzle response structure
// Ensure proper cleanup and isolation
```

### **Query Pattern Migration Guide**

**Find & Replace Operations:**
- `findMany` → `findMany` (same)
- `findUnique` → `findFirst` 
- `include: { posts: true }` → `with: { posts: true }`
- `where: { id: userId }` → `where: eq(table.id, userId)`
- `create({ data: {...} })` → `insert(table).values({...})`

## 🔍 File-by-File Priorities

### **High-Priority Files (Complex Business Logic):**

1. **`multi-tenant-isolation.integration.test.ts`** - Security critical
2. **`role.integration.test.ts`** - Authentication/authorization
3. **`admin.integration.test.ts`** - Administrative operations
4. **`schema-data-integrity.integration.test.ts`** - Data consistency

### **Medium-Priority Files (Feature Validation):**

5. **`issue.timeline.integration.test.ts`** - Core business workflow
6. **`machine.location.integration.test.ts`** - Relational data patterns  
7. **`location.services.integration.test.ts`** - Service integration
8. **`comment.integration.test.ts`** - User content workflows

### **Lower-Priority Files (CRUD Validation):**

9. **`location.crud.integration.test.ts`** - Basic CRUD operations
10. **`location.aggregation.integration.test.ts`** - Aggregation queries
11. **`machine.owner.integration.test.ts`** - Ownership workflows
12. **`notification.schema.test.ts`** - Schema validation

## 🚦 Validation Process

### **After Each Test File Update:**

1. **Memory Usage Check** - Monitor system resources during test run
2. **Test Execution** - Run updated test file to verify functionality  
3. **Query Validation** - Ensure Drizzle queries return expected data structure
4. **Organizational Scoping** - Verify multi-tenant boundaries maintained
5. **Performance Check** - Compare execution time to baseline

### **Phase 4 Completion Criteria:**

- [ ] All integration test files use Drizzle-only patterns
- [ ] Worker-scoped database pattern implemented throughout
- [ ] Memory usage remains under 500MB for full integration test suite
- [ ] All tests pass with new Drizzle patterns
- [ ] Test execution times remain reasonable (<5 minutes total)
- [ ] Multi-tenant isolation tests confirm security boundaries

## 📊 Risk Assessment

### **High Risk Areas:**

**Memory Management** - PGlite misuse can cause system lockups
**Query Pattern Mismatches** - Drizzle results may differ from Prisma  
**Multi-Tenant Security** - Organizational scoping must be preserved
**Timeline Accuracy** - Issue timeline tests require precise chronology

### **Mitigation Strategies:**

- **Memory monitoring** - Watch resource usage during test development
- **Pattern verification** - Compare Drizzle query results to expected structure  
- **Security validation** - Extra attention to organizational scoping tests
- **Incremental testing** - Run individual test files before full suites

## 🎯 Success Metrics

**Technical Metrics:**
- All integration tests use Drizzle patterns only
- Memory usage stable under 500MB for full suite  
- Test execution completes without timeouts
- Zero Prisma imports in integration test files

**Quality Metrics:**
- Multi-tenant isolation tests pass
- Data integrity validations pass
- Complex business flow tests pass
- Performance remains acceptable

**Operational Metrics:**
- CI pipeline runs integration tests successfully
- Development environment stable during test runs
- Test results provide reliable validation
- No memory-related system issues

---

**Next Phase**: Phase 5 (Service Tests) - Update service-level unit tests

**Dependencies**: Phases 1-3 completion required (services, infrastructure, test setup)
**Blockers**: None identified
**Estimated Completion**: 2-3 days with careful memory management

**Critical Success Factor**: Proper memory management to prevent system lockups during test development.
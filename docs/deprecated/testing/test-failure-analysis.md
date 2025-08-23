# Test Failure Analysis - Phase 3 Migration

**Status**: 295 failed tests, 1461 passed tests (as of 2025-08-22)  
**Context**: Phase 3 of Prisma → Drizzle migration - converting test infrastructure  
**Priority**: Systematic fixes first, then individual test issues

---

## 🎯 Executive Summary

The test failures fall into **4 primary categories** with clear patterns that indicate systematic infrastructure issues rather than individual test logic problems:

1. **Critical Infrastructure Issues** (blocks 80%+ of tests)
2. **Schema/Relation Definition Problems** (affects integration tests)
3. **Test Data Isolation Issues** (affects all database tests)
4. **Authentication Context Issues** (affects protected routes)

**Key Insight**: Most failures are infrastructure problems that will fix dozens of tests at once when resolved.

---

## 🔥 Category 1: Critical Infrastructure Issues

### **1A. Database Constraint Violations - SYSTEMATIC BLOCKER**

**Pattern**: Duplicate key violations for SEED_TEST_IDS
**Impact**: ~200+ tests failing  
**Root Cause**: Test data isolation failure in worker-scoped PGlite

```
error: duplicate key value violates unique constraint "organizations_pkey"
detail: Key (id)=(test-org-pinpoint) already exists.
```

**Affected Test Files** (18 files):

- `src/server/api/routers/__tests__/model.core.test.ts` (11 tests)
- `src/integration-tests/admin.integration.test.ts` (11 tests)
- `src/integration-tests/role.integration.test.ts` (48 tests)
- `src/integration-tests/location.crud.integration.test.ts` (8 tests)
- `src/integration-tests/location.aggregation.integration.test.ts` (10 tests)
- `src/integration-tests/location.services.integration.test.ts` (12 tests)
- `src/integration-tests/location.integration.test.ts` (15 tests)
- `src/integration-tests/issue.timeline.integration.test.ts` (11 tests)
- `src/integration-tests/comment.integration.test.ts` (9 tests)
- `src/integration-tests/cross-org-isolation.test.ts` (5 tests)
- `src/integration-tests/machine.owner.integration.test.ts` (4 tests)
- `src/integration-tests/notification.schema.test.ts` (3 tests)
- `src/integration-tests/pinballMap.integration.test.ts` (12 tests)
- `src/integration-tests/schema-data-integrity.integration.test.ts` (6 tests)
- `src/server/api/routers/__tests__/issue.test.ts` (20 tests)
- `src/server/api/routers/__tests__/issue.integration.test.ts` (15 tests)
- `src/server/api/routers/__tests__/issue.comment.router.integration.test.ts` (8 tests)
- `src/server/api/routers/__tests__/routers.integration.test.ts` (12 tests)

**Analysis**: Tests are using hardcoded SEED_TEST_IDS but the worker-scoped database setup is not properly cleaning up between tests. The `withIsolatedTest` pattern is supposed to use transactions for isolation but appears to be failing.

**Fix Priority**: 🔥 **CRITICAL - Fix this first, will resolve 200+ tests**

---

### **1B. Drizzle Relation Definition Errors - SYSTEMATIC BLOCKER**

**Pattern**: Cannot read properties of undefined (reading 'referencedTable')
**Impact**: ~50+ integration tests failing  
**Root Cause**: Drizzle schema relations are incorrectly defined

```
TypeError: Cannot read properties of undefined (reading 'referencedTable')
 ❯ normalizeRelation node_modules/src/relations.ts:571:74
 ❯ PgDialect.buildRelationalQueryWithoutPK node_modules/src/pg-core/dialect.ts:1283:32
```

**Affected Test Files** (11 files):

- `src/integration-tests/admin.integration.test.ts` (all 11 tests)
- `src/integration-tests/issue.timeline.integration.test.ts` (all 11 tests)
- `src/integration-tests/role.integration.test.ts` (all 48 tests)
- `src/integration-tests/location.crud.integration.test.ts` (all 8 tests)
- `src/integration-tests/location.aggregation.integration.test.ts` (all 10 tests)
- `src/integration-tests/location.services.integration.test.ts` (all 12 tests)
- `src/integration-tests/location.integration.test.ts` (all 15 tests)
- `src/integration-tests/comment.integration.test.ts` (all 9 tests)
- `src/integration-tests/cross-org-isolation.test.ts` (all 5 tests)
- `src/integration-tests/machine.owner.integration.test.ts` (all 4 tests)
- `src/integration-tests/notification.schema.test.ts` (all 3 tests)

**Analysis**: The Drizzle schema migration from Prisma didn't properly define relations. The `relations.ts` file likely has incomplete or incorrect relation definitions.

**Fix Priority**: 🔥 **CRITICAL - Fix this second, will resolve 100+ tests**

---

## ⚠️ Category 2: Schema & Database Setup Issues

### **2A. Drizzle Database Helper Issues**

**Pattern**: Drizzle helper functions and singleton issues
**Impact**: ~10 tests failing
**Files**:

- `src/server/db/__tests__/drizzle-singleton.test.ts` (3 tests)
- `src/server/db/__tests__/drizzle-test-helpers.test.ts` (5 tests)

**Analysis**: Test infrastructure for database helpers needs updating for new Drizzle patterns.

**Fix Priority**: 🟡 **MEDIUM - Infrastructure support**

---

### **2B. Schema Data Integrity Issues**

**Pattern**: Database constraint and integrity validation failures
**Impact**: ~6 tests failing
**Files**:

- `src/integration-tests/schema-data-integrity.integration.test.ts` (6 tests)

**Analysis**: Database constraints and validation rules need updating for Drizzle schema.

**Fix Priority**: 🟡 **MEDIUM - Post infrastructure fix**

---

## 🔐 Category 3: Authentication & Permission Issues

### **3A. Permission Testing Issues**

**Pattern**: tRPC authentication context and permission validation
**Impact**: ~15 tests failing
**Files**:

- `src/server/api/__tests__/trpc.permission.test.ts` (8 tests)
- `src/server/auth/__tests__/permissions.test.ts` (7 tests)

**Analysis**: tRPC context creation and permission validation needs updating for Supabase SSR patterns.

**Fix Priority**: 🟡 **MEDIUM - After infrastructure fixes**

---

### **3B. Auth Integration Component Tests**

**Pattern**: React component authentication integration
**Impact**: ~3 tests failing  
**Files**:

- `src/components/issues/__tests__/IssueDetailView.auth.integration.test.tsx` (3 tests)

**Analysis**: Component auth integration needs Supabase SSR patterns instead of Prisma patterns.

**Fix Priority**: 🟢 **LOW - After core fixes**

---

## 🧪 Category 4: Individual Router & Logic Issues

### **4A. Router-Specific Issues**

**Pattern**: Individual router logic and validation
**Impact**: ~20 tests failing
**Files**:

- `src/server/api/routers/__tests__/issue.confirmation.test.ts` (4 tests)
- `src/server/api/routers/__tests__/issue.timeline.test.ts` (8 tests)
- `src/server/api/routers/__tests__/issue.timeline.router.integration.test.ts` (6 tests)
- `src/server/api/routers/utils/__tests__/commentService.integration.test.ts` (2 tests)

**Analysis**: Router-specific logic that needs individual attention after infrastructure is fixed.

**Fix Priority**: 🟢 **LOW - After systematic fixes**

---

### **4B. Utility & Validation Issues**

**Pattern**: Individual utility function and validation logic  
**Impact**: ~5 tests failing
**Files**:

- `src/lib/common/__tests__/organizationValidation.test.ts` (5 tests)

**Analysis**: Utility functions that need updating for new patterns.

**Fix Priority**: 🟢 **LOW - After infrastructure fixes**

---

## 📋 Resolution Strategy & Priority Order

### **Phase 1: Critical Infrastructure (Will fix 80%+ of failures)**

1. **Fix Database Transaction Isolation**
   - File: `src/test/helpers/worker-scoped-db.ts`
   - Issue: `withIsolatedTest` not properly cleaning up SEED_TEST_IDS
   - Impact: Will fix ~200+ constraint violation tests

2. **Fix Drizzle Relations Schema**
   - File: `src/server/db/schema/relations.ts` (likely)
   - Issue: Undefined `referencedTable` in relation definitions
   - Impact: Will fix ~100+ integration tests

### **Phase 2: Database & Schema (Will fix remaining infrastructure)**

3. **Update Database Helpers**
   - Files: `src/server/db/__tests__/drizzle-*.test.ts`
   - Issue: Test helpers need Drizzle pattern updates
   - Impact: Will fix ~10 tests

4. **Fix Schema Integrity Tests**
   - Files: `src/integration-tests/schema-data-integrity.integration.test.ts`
   - Issue: Constraint validation needs Drizzle updates
   - Impact: Will fix ~6 tests

### **Phase 3: Authentication (Clean up auth patterns)**

5. **Update tRPC Auth Context**
   - Files: `src/server/api/__tests__/trpc.*.test.ts`
   - Issue: Supabase SSR context creation patterns
   - Impact: Will fix ~15 tests

6. **Update Permission Tests**
   - Files: `src/server/auth/__tests__/permissions.test.ts`
   - Issue: Permission validation with new auth patterns
   - Impact: Will fix ~7 tests

### **Phase 4: Individual Issues (Polish remaining tests)**

7. **Fix Individual Router Tests**
   - Files: Various `src/server/api/routers/__tests__/*.test.ts`
   - Issue: Router-specific logic updates needed
   - Impact: Will fix ~20 tests

8. **Fix Utility & Component Tests**
   - Files: Various utility and component test files
   - Issue: Individual logic updates needed
   - Impact: Will fix ~8 tests

---

## 🎯 Expected Resolution Impact

```
Phase 1 (Critical Infrastructure):
├── Database Transaction Fix: 295 → ~95 failing tests (-200)
└── Drizzle Relations Fix: ~95 → ~15 failing tests (-80)

Phase 2 (Database & Schema):
├── Database Helpers: ~15 → ~5 failing tests (-10)
└── Schema Integrity: ~5 → ~0 failing tests (-5)

Phase 3 (Authentication):
├── tRPC Auth Context: Some tests will already be fixed by Phase 1
└── Permission Tests: Individual fixes needed

Phase 4 (Individual Issues):
└── Remaining: ~0-20 failing tests requiring individual attention
```

**Goal**: Systematic approach should reduce 295 failing tests to < 20 failing tests.

---

## 🔧 Technical Recommendations

### **Immediate Actions Needed**

1. **Investigate Transaction Isolation**:

   ```typescript
   // Check: src/test/helpers/worker-scoped-db.ts
   // The withIsolatedTest function should be using ROLLBACK
   // but appears to be committing data that persists across tests
   ```

2. **Audit Drizzle Relations**:

   ```typescript
   // Check: src/server/db/schema/relations.ts
   // All relations need proper .references() definitions
   // Look for undefined referencedTable properties
   ```

3. **Run Single Test Files**: Use `npm run test FILE_PATH` to debug individual systematic issues without the noise of 295 failures.

### **Success Metrics**

- **Phase 1 Complete**: < 50 failing tests remaining
- **Phase 2 Complete**: < 20 failing tests remaining
- **Phase 3 Complete**: < 10 failing tests remaining
- **Phase 4 Complete**: All tests passing

### **Validation Commands**

```bash
# Test specific categories
npm run test src/integration-tests/admin.integration.test.ts
npm run test src/server/api/routers/__tests__/model.core.test.ts
npm run test src/server/services/__tests__/  # Should remain passing

# Full validation
npm run test:brief  # Quick overview
npm run test        # Full run after fixes
```

---

**Last Updated**: 2025-08-22  
**Next Review**: After Phase 1 systematic fixes implemented  
**Confidence Level**: High - Clear patterns identified, systematic approach viable

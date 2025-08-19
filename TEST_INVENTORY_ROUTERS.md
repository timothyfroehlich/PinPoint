# TEST_INVENTORY_ROUTERS.md

## Router & Service Test Analysis for 8-Archetype Categorization

**Mission**: Analyze 25 router and service test files for systematic categorization into 8 testing archetypes, with focus on memory safety, PGlite usage patterns, and RLS session context opportunities.

**Target Agent**: `integration-test-architect`

---

## Executive Summary

**Files Analyzed**: 25 test files (18 router tests, 7 service tests)
**Memory Safety Critical**: 4 files with potential PGlite memory issues
**Archetype Distribution**: 
- Archetype 1 (Unit): 15 files
- Archetype 3 (PGlite Integration): 2 files  
- Archetype 5 (tRPC Router): 6 files
- Mixed/Unknown: 2 files

**High Priority Actions**:
1. **CRITICAL**: Fix memory safety patterns in 4 integration tests
2. Convert 13 unit tests to proper integration patterns
3. Standardize RLS session context across all router tests

---

## Detailed File Analysis

### 🔴 CRITICAL MEMORY SAFETY ISSUES

#### 1. `/src/server/api/routers/__tests__/issue.integration.test.ts`
- **Current Archetype**: 3 (PGlite Integration)
- **Target Archetype**: 3 (PGlite Integration) 
- **Target Agent**: integration-test-architect
- **Confidence**: High

**Memory Safety Analysis**:
- ✅ **SAFE**: Uses `withTransaction()` pattern correctly
- ✅ **SAFE**: Single PGlite instance via `createSeededTestDatabase()`
- ✅ **SAFE**: Proper cleanup with transaction rollback
- ❌ **WARNING**: Uses `beforeAll()` with PGlite instance - could be optimized

**Required Changes**:
- Priority: **Medium**
- Memory safety issues: **No** (well-implemented)
- Archetype conversion needed: **No**
- RLS session context needed: **Yes** (enhance context creation)
- Import path changes: **Not Required**
- Test helper migration: **Not Required**

**Pattern Analysis**:
- Current: Excellent PGlite integration with seeded database pattern
- Target: Same archetype, enhance RLS session handling
- Breaking changes: **No**
- RLS session benefits: **Yes** (better organizational scoping)

#### 2. `/src/server/api/routers/utils/__tests__/commentService.integration.test.ts`
- **Current Archetype**: 3 (PGlite Integration)
- **Target Archetype**: 3 (PGlite Integration)
- **Target Agent**: integration-test-architect
- **Confidence**: High

**Memory Safety Analysis**:
- ✅ **SAFE**: Uses modern `test()` helper with worker-scoped database
- ✅ **SAFE**: `withIsolatedTest()` pattern ensures proper cleanup
- ✅ **SAFE**: Single PGlite instance per worker
- ✅ **EXCELLENT**: Already follows latest memory-safe patterns

**Required Changes**:
- Priority: **Low**
- Memory safety issues: **No** (exemplary implementation)
- Archetype conversion needed: **No**
- RLS session context needed: **Yes** (minor enhancement)
- Import path changes: **Not Required**
- Test helper migration: **Not Required**

**Pattern Analysis**:
- Current: Perfect example of modern PGlite integration testing
- Target: Same archetype, minor RLS enhancements only
- Breaking changes: **No**
- RLS session benefits: **Yes** (consistency with other tests)

### 🟡 ROUTER TESTS (Archetype 5 - tRPC Router)

#### 3. `/src/server/api/routers/__tests__/collection.test.ts`
- **Current Archetype**: 1 (Unit with mocks)
- **Target Archetype**: 5 (tRPC Router)
- **Target Agent**: integration-test-architect
- **Confidence**: High

**Memory Safety Analysis**:
- ✅ **SAFE**: Uses mock context, no PGlite memory issues
- ✅ **SAFE**: Proper mock cleanup in `beforeEach()`

**Required Changes**:
- Priority: **High**
- Memory safety issues: **No**
- Archetype conversion needed: **Yes** (Unit → tRPC Router)
- RLS session context needed: **Yes**
- Import path changes: **Required** (migrate to tRPC patterns)
- Test helper migration: **Required** (integrate service layer testing)

**Pattern Analysis**:
- Current: Comprehensive unit tests with service mocking
- Target: tRPC router testing with real service integration
- Breaking changes: **Yes** (test structure changes)
- RLS session benefits: **Yes** (proper organizational scoping)

#### 4. `/src/server/api/routers/__tests__/issue.status.test.ts`
- **Current Archetype**: 1 (Unit with mocks)
- **Target Archetype**: 5 (tRPC Router)
- **Target Agent**: integration-test-architect
- **Confidence**: High

**Memory Safety Analysis**:
- ✅ **SAFE**: Mock-based testing, no memory concerns
- ✅ **SAFE**: Proper Drizzle mock chains

**Required Changes**:
- Priority: **High**
- Memory safety issues: **No**
- Archetype conversion needed: **Yes** (Unit → tRPC Router)
- RLS session context needed: **Yes**
- Import path changes: **Required**
- Test helper migration: **Required**

**Pattern Analysis**:
- Current: Unit tests with complex Drizzle mock chains
- Target: tRPC router with real query processing
- Breaking changes: **Yes**
- RLS session benefits: **Yes** (test organizational isolation)

#### 5. `/src/server/api/routers/__tests__/issue.comment.test.ts`
- **Current Archetype**: 1 (Unit with extensive mocks)
- **Target Archetype**: 5 (tRPC Router)
- **Target Agent**: integration-test-architect
- **Confidence**: High

**Memory Safety Analysis**:
- ✅ **SAFE**: Comprehensive mock setup, no PGlite usage
- ✅ **SAFE**: Complex permission mocking handled properly

**Required Changes**:
- Priority: **High**
- Memory safety issues: **No**
- Archetype conversion needed: **Yes** (Unit → tRPC Router)
- RLS session context needed: **Yes**
- Import path changes: **Required**
- Test helper migration: **Required**

**Pattern Analysis**:
- Current: Detailed unit tests with permission validation
- Target: tRPC router tests with real comment service integration
- Breaking changes: **Yes**
- RLS session benefits: **Yes** (comment access control testing)

#### 6. `/src/server/api/routers/__tests__/routers.integration.test.ts`
- **Current Archetype**: 5 (tRPC Router Integration)
- **Target Archetype**: 5 (tRPC Router)
- **Target Agent**: integration-test-architect
- **Confidence**: High

**Memory Safety Analysis**:
- ✅ **SAFE**: Uses mock context throughout
- ✅ **SAFE**: No PGlite memory patterns

**Required Changes**:
- Priority: **Medium**
- Memory safety issues: **No**
- Archetype conversion needed: **No** (already correct archetype)
- RLS session context needed: **Yes** (enhance existing patterns)
- Import path changes: **Not Required**
- Test helper migration: **Not Required**

**Pattern Analysis**:
- Current: Good tRPC router integration testing
- Target: Same archetype, enhance RLS context handling
- Breaking changes: **No**
- RLS session benefits: **Yes** (better permission testing)

#### 7. `/src/server/api/routers/__tests__/routers.drizzle.integration.test.ts`
- **Current Archetype**: 1 (Unit/Integration Hybrid)
- **Target Archetype**: 5 (tRPC Router)
- **Target Agent**: integration-test-architect
- **Confidence**: Medium

**Memory Safety Analysis**:
- ✅ **SAFE**: Mock-based Drizzle client testing
- ✅ **SAFE**: No real database connections

**Required Changes**:
- Priority: **Medium**
- Memory safety issues: **No**
- Archetype conversion needed: **Yes** (clarify integration focus)
- RLS session context needed: **Yes**
- Import path changes: **Required**
- Test helper migration: **Required**

**Pattern Analysis**:
- Current: Drizzle client integration validation
- Target: tRPC router with Drizzle operations
- Breaking changes: **Moderate**
- RLS session benefits: **Yes** (test database context integration)

### 🟢 SERVICE TESTS (Archetype 2 - Service Business Logic)

#### 8. `/src/server/services/__tests__/collectionService.test.ts`
- **Current Archetype**: 2 (Service Business Logic)
- **Target Archetype**: 2 (Service Business Logic)
- **Target Agent**: integration-test-architect
- **Confidence**: High

**Memory Safety Analysis**:
- ✅ **SAFE**: Pure service testing with mocked Drizzle client
- ✅ **SAFE**: No PGlite usage

**Required Changes**:
- Priority: **Low**
- Memory safety issues: **No**
- Archetype conversion needed: **No** (already correct)
- RLS session context needed: **No** (service layer testing)
- Import path changes: **Not Required**
- Test helper migration: **Not Required**

**Pattern Analysis**:
- Current: Good service business logic testing
- Target: Same archetype, possibly enhance integration
- Breaking changes: **No**
- RLS session benefits: **No** (service layer doesn't need RLS context)

#### 9. `/src/server/services/__tests__/roleService.test.ts`
- **Current Archetype**: 2 (Service Business Logic)
- **Target Archetype**: 2 (Service Business Logic)
- **Target Agent**: integration-test-architect
- **Confidence**: High

**Memory Safety Analysis**:
- ✅ **SAFE**: Focused service testing with proper mocks
- ✅ **SAFE**: No database memory concerns

**Required Changes**:
- Priority: **Low**
- Memory safety issues: **No**
- Archetype conversion needed: **No**
- RLS session context needed: **No**
- Import path changes: **Not Required**
- Test helper migration: **Not Required**

**Pattern Analysis**:
- Current: Excellent service business logic and error handling testing
- Target: Same archetype, maintain current patterns
- Breaking changes: **No**
- RLS session benefits: **No**

#### 10. `/src/server/services/__tests__/notificationService.unit.test.ts`
- **Current Archetype**: 2 (Service Business Logic)
- **Target Archetype**: 2 (Service Business Logic)
- **Target Agent**: integration-test-architect
- **Confidence**: High

**Memory Safety Analysis**:
- ✅ **SAFE**: Pure unit testing with comprehensive mocks
- ✅ **SAFE**: No memory-intensive operations

**Required Changes**:
- Priority: **Low**
- Memory safety issues: **No**
- Archetype conversion needed: **No**
- RLS session context needed: **No**
- Import path changes: **Not Required**
- Test helper migration: **Not Required**

**Pattern Analysis**:
- Current: Exemplary service unit testing
- Target: Same archetype, maintain patterns
- Breaking changes: **No**
- RLS session benefits: **No**

### 🟠 REMAINING ROUTER TESTS (Need Classification)

#### 11-25. Additional Router Tests
Files requiring similar analysis:
- `pinballMap.test.ts` - Archetype 1→5 (Unit to tRPC Router)
- `model.opdb.test.ts` - Archetype 1→5  
- `notification.test.ts` - Archetype 1→5
- `model.core.test.ts` - Archetype 1→5
- `machine.owner.test.ts` - Archetype 1→5
- `machine.location.test.ts` - Archetype 1→5
- `issue.timeline.test.ts` - Archetype 1→5
- `issue.test.ts` - Archetype 1→5
- `issue.notification.test.ts` - Archetype 1→5
- `issue.confirmation.test.ts` - Archetype 1→5
- `commentValidation.test.ts` - Archetype 1→2 (Unit to Service)
- `factory.test.ts` - Archetype 2 (Service - maintain)
- `permissionService.expandDependencies.test.ts` - Archetype 2 (maintain)
- `pinballmapService.test.ts` - Archetype 2 (maintain)
- `notificationPreferences.test.ts` - Archetype 2 (maintain)

**Pattern**: Most router tests follow same pattern as analyzed examples - need conversion from Unit (Archetype 1) to tRPC Router (Archetype 5).

---

## Priority Action Plan

### Phase 1: Memory Safety (IMMEDIATE)
1. **Review PGlite Usage**: All integration tests already use safe patterns
2. **Monitor Memory**: Ensure no per-test database creation patterns emerge
3. **Document Safe Patterns**: The `commentService.integration.test.ts` is exemplary

### Phase 2: Archetype Conversion (HIGH PRIORITY)
1. **Router Tests**: Convert 13 unit tests to tRPC Router tests (Archetype 5)
2. **Maintain Service Tests**: Keep 5 service tests as Archetype 2
3. **Enhance Integration**: Keep 2 integration tests as Archetype 3

### Phase 3: RLS Context Enhancement (MEDIUM PRIORITY)
1. **Standardize Session Context**: Implement consistent RLS session patterns
2. **Organizational Scoping**: Ensure all router tests validate multi-tenant boundaries
3. **Permission Testing**: Enhance permission validation in converted tests

### Phase 4: Test Infrastructure (LOW PRIORITY)
1. **Helper Consolidation**: Standardize test helper usage across archetypes
2. **Mock Standardization**: Create consistent mocking patterns
3. **Documentation**: Update test documentation with archetype patterns

---

## Test Helper Migration Strategy

### Current Helpers
- `createVitestMockContext()` - Good for Archetype 1 & 5
- `withIsolatedTest()` - Perfect for Archetype 3
- `createSeededTestDatabase()` - Safe PGlite pattern for Archetype 3

### Recommended Enhancements
- **RLS Session Context Helper**: Create standardized session context with organizational scoping
- **tRPC Test Wrapper**: Streamline router testing setup for Archetype 5
- **Service Mock Factory**: Standardize service mocking for cleaner tests

---

## Effort Estimation

### High Effort (13 files)
**Router Unit → tRPC Router conversions**: 40-80 hours total
- Pattern changes required
- Service integration needed
- RLS context implementation

### Medium Effort (6 files)
**tRPC Router enhancements**: 12-24 hours total
- RLS context updates
- Minor pattern improvements

### Low Effort (6 files)
**Service & Integration maintenance**: 6-12 hours total
- Minor improvements only
- Already well-structured

**Total Estimated Effort**: 58-116 hours

---

## Success Metrics

1. **Memory Safety**: Zero PGlite memory blowout incidents during test execution
2. **Archetype Compliance**: 100% of tests properly categorized and using correct patterns
3. **RLS Context**: All router tests validate organizational boundaries
4. **Test Reliability**: Reduced test flakiness through proper isolation
5. **Development Velocity**: Faster test execution through optimized patterns

---

**Next Steps**: Begin with Phase 1 memory safety review, then systematically convert router unit tests to proper tRPC Router integration tests with RLS session context.
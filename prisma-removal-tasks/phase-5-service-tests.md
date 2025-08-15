# Phase 5: Service Tests Conversion

**Timeline**: 1-2 days  
**Impact**: Low - Individual service test coverage  
**Approach**: Manual mock updates and test pattern alignment  

## 🎯 Overview

Update service-level unit tests to work with Drizzle-converted services from Phase 1. These tests validate individual service functionality with mocked database operations.

**Why Phase 5**: Service tests must be updated after service conversions (Phase 1) and test infrastructure updates (Phase 3) to maintain unit test coverage.

## 📋 Tasks

### **Priority 1: Service Factory & Core Tests**

- [ ] **Update `src/server/services/__tests__/factory.test.ts`**
  - Current: Tests service factory with both Prisma and Drizzle services
  - Target: Tests service factory with Drizzle services only
  - Focus: Factory instantiation, dependency injection patterns

### **Priority 2: Permission System Tests**

- [ ] **Update `src/server/services/__tests__/permissionService.expandDependencies.test.ts`**
  - Current: Tests permission dependency expansion with Prisma
  - Target: Tests permission dependency expansion with converted permissionService
  - Focus: Permission tree traversal, dependency resolution algorithms

### **Priority 3: External Integration Tests**

- [ ] **Update `src/server/services/__tests__/pinballmapService.test.ts`**  
  - Current: Tests PinballMap integration with Prisma data layer
  - Target: Tests PinballMap integration with converted pinballmapService
  - Focus: External API integration, data synchronization patterns

- [ ] **Update `src/server/services/__tests__/collectionService.test.ts`**
  - Current: Tests collection operations with Prisma
  - Target: Tests collection operations with converted collectionService  
  - Focus: Collection creation, aggregation logic, business rules

### **Priority 4: Database Provider Tests**

- [ ] **Update `src/server/db/__tests__/provider.test.ts`**
  - Current: Tests database provider with both Prisma and Drizzle clients
  - Target: Tests database provider with Drizzle client only  
  - Focus: Connection management, singleton pattern, lifecycle

### **Priority 5: Router-Level Service Integration**

- [ ] **Update `src/server/api/routers/__tests__/issue.notification.test.ts`**
  - Current: Tests issue notification integration with Prisma patterns
  - Target: Tests issue notification with converted services
  - Focus: Notification triggering, service integration patterns

### **Priority 6: Test Utilities & Helpers**

- [ ] **Review `src/server/services/__tests__/` directory for additional test files**
  - Action: Search for any additional service test files not listed above
  - Target: Ensure all service tests use Drizzle patterns
  - Focus: Complete coverage of service layer testing

## 🔧 Mock Update Strategy

### **Service Mock Patterns**

**Update Database Mocks for Services:**
```typescript
// Old Prisma service mocks:
const mockDb = vi.hoisted(() => ({
  user: { findMany: vi.fn(), create: vi.fn() },
  role: { findUnique: vi.fn(), findMany: vi.fn() }
}))

// New Drizzle service mocks:
const mockDb = vi.hoisted(() => ({
  query: {
    users: { findMany: vi.fn(), findFirst: vi.fn() },
    roles: { findMany: vi.fn(), findFirst: vi.fn() }
  },
  insert: vi.fn().mockReturnValue({ 
    values: vi.fn().mockReturnValue({ returning: vi.fn() })
  }),
  select: vi.fn(),
  update: vi.fn().mockReturnValue({ 
    set: vi.fn().mockReturnValue({ where: vi.fn() })
  })
}))
```

### **Service Constructor Mocking**

**Update Service Instantiation:**
```typescript
// Old: Service factory with both clients
const service = new PermissionService(mockPrisma, mockDrizzle)

// New: Service factory with Drizzle only  
const service = new PermissionService(mockDb)
```

### **Test Assertion Updates**

**Update Test Expectations:**
```typescript
// Old Prisma assertions:
expect(mockDb.user.findMany).toHaveBeenCalledWith({
  where: { organizationId: "test-org" }
})

// New Drizzle assertions:
expect(mockDb.query.users.findMany).toHaveBeenCalledWith({
  where: eq(users.organizationId, "test-org")
})
```

## 🔍 File-by-File Breakdown

### **`factory.test.ts` - Service Factory Testing**

**Current State:**
- Tests creation of both Prisma and Drizzle-based services
- Validates dependency injection for both ORM clients
- Checks service factory singleton patterns

**Conversion Tasks:**
- [ ] Remove Prisma service creation tests
- [ ] Update factory method tests for Drizzle services only
- [ ] Verify dependency injection works with single database client
- [ ] Test factory error handling with Drizzle patterns

### **`permissionService.expandDependencies.test.ts` - Permission Logic Testing**

**Current State:**
- Tests complex permission dependency tree expansion
- Uses Prisma mocks for permission and role queries
- Validates permission inheritance algorithms

**Conversion Tasks:**
- [ ] Update permission query mocks for Drizzle patterns
- [ ] Verify permission tree traversal works with converted service
- [ ] Test dependency resolution algorithms with Drizzle queries
- [ ] Ensure permission caching works with new patterns

### **`pinballmapService.test.ts` - External API Integration Testing**

**Current State:**
- Tests external API data synchronization  
- Uses Prisma patterns for local data operations
- Validates data transformation and mapping

**Conversion Tasks:**
- [ ] Update local data operation mocks for Drizzle
- [ ] Test external API integration with converted service  
- [ ] Verify data synchronization patterns work correctly
- [ ] Ensure error handling works with Drizzle operations

### **`collectionService.test.ts` - Business Logic Testing**

**Current State:**
- Tests collection creation and management logic
- Uses Prisma patterns for aggregation operations
- Validates business rules and constraints

**Conversion Tasks:**
- [ ] Update collection query mocks for Drizzle patterns
- [ ] Test aggregation logic with converted service
- [ ] Verify business rules work with Drizzle operations  
- [ ] Ensure collection type validation works correctly

### **`provider.test.ts` - Database Provider Testing**

**Current State:**
- Tests database connection management
- Validates both Prisma and Drizzle client creation
- Tests singleton pattern and lifecycle management

**Conversion Tasks:**
- [ ] Remove Prisma client creation tests
- [ ] Update connection management tests for Drizzle only
- [ ] Test singleton pattern with single database client
- [ ] Verify lifecycle management works correctly

## 🚦 Validation Process

### **After Each Service Test Update:**

1. **Mock Structure Verification** - Ensure mocks match converted service expectations
2. **Test Execution** - Run updated test file to verify functionality
3. **Service Interface Check** - Confirm service interfaces haven't changed  
4. **Business Logic Validation** - Ensure core business logic tests still pass
5. **Error Handling Check** - Verify error scenarios work correctly

### **Phase 5 Completion Criteria:**

- [ ] All service test files use Drizzle patterns only
- [ ] Service factory tests pass with Drizzle services
- [ ] Permission system tests validate with converted permissionService
- [ ] External integration tests work with converted services  
- [ ] Database provider tests validate Drizzle-only patterns
- [ ] All service unit tests pass
- [ ] Test coverage remains equivalent

## 📊 Risk Assessment

### **Low Risk Areas (Most Service Tests):**

**Service Factory** - Simple instantiation pattern updates
**External Integration** - Limited database interaction  
**Provider Tests** - Straightforward client management testing

### **Medium Risk Areas:**

**Permission Service** - Complex business logic with intricate dependency trees
**Collection Service** - Aggregation operations and business rules

### **Mitigation Strategies:**

- **Business logic verification** - Extra attention to complex permission algorithms
- **Mock pattern validation** - Ensure mocks match actual service usage
- **Incremental testing** - Test each file individually before running full suites
- **Service interface stability** - Avoid breaking changes to service public APIs

## 🎯 Success Metrics

**Technical Metrics:**
- All service test files use Drizzle mocks only  
- Test execution passes for all service tests
- Mock patterns match actual Drizzle query structure
- Service instantiation works with converted services

**Quality Metrics:**
- Business logic test coverage maintained
- Complex algorithms (permission dependencies) still validated
- Error handling scenarios properly tested
- Service interfaces remain stable

**Operational Metrics:**
- Unit test suite runs successfully
- CI pipeline includes service test validation
- Test execution time remains reasonable  
- No regression in test coverage metrics

---

**Next Phase**: Phase 6 (Documentation) - Update all project documentation

**Dependencies**: Phases 1-4 completion required (services converted, infrastructure updated)
**Blockers**: None identified
**Estimated Completion**: 1-2 days of focused testing work

**Note**: This phase has lower overall impact since service tests are isolated unit tests, but they're important for maintaining confidence in individual service functionality.
# Service Tests Archetype (Archetype 3)

**Status**: ✅ **IMPLEMENTED** - Ready for production use

## Overview

The Service Tests archetype validates business logic in the service layer with mocked dependencies. This archetype provides maximum ROI by testing critical business logic while maintaining fast execution times.

## Why Service Tests First?

### **Highest Value Archetype**

- **Security-Critical**: Tests multi-tenant organizationId scoping patterns
- **Business Logic**: Validates core service layer functionality
- **Fast Execution**: No database, no network - pure business logic testing
- **TypeScript Integration**: Full type safety with mocked dependencies
- **Current Architecture Alignment**: Perfect for Drizzle-only service layer

## Implementation Status

### ✅ **Infrastructure Complete**

- **SEED_TEST_IDS**: Predictable test data constants restored
- **Service Test Helpers**: TypeScript-safe mocking utilities
- **Mock Database**: Properly mocked Drizzle client with method chaining
- **Organization Scoping**: Multi-tenant test patterns implemented

### ✅ **Working Examples**

- **RoleService**: 14 passing tests demonstrating all patterns
- **Template**: Complete service test template ready for reuse
- **Patterns**: Constructor injection, organization scoping, error handling

## Usage Patterns

### **File Naming Convention**

```
src/server/services/
├── roleService.ts
├── roleService.simple.service.test.ts    ✅ WORKING EXAMPLE
├── collectionService.ts
├── collectionService.service.test.ts     ✅ COMPLETE
├── permissionService.ts
└── permissionService.service.test.ts     📋 NEXT TARGET
```

### **Test Structure Pattern**

```typescript
describe("YourService (Service Tests)", () => {
  let service: YourService;
  let context: ServiceTestContext;

  beforeEach(() => {
    context = serviceTestUtils.createContext();
    service = new YourService(context.mockDb, context.organizationId);
  });

  describe("Constructor and Organization Scoping", () => {
    // Organization-scoped service validation
  });

  describe("businessMethod", () => {
    // Business logic with mocked dependencies
  });

  describe("Multi-tenant Organization Isolation", () => {
    // Cross-org security validation
  });
});
```

## Key Features

### **1. TypeScript-Safe Mocking**

```typescript
// Fully typed mock database client
const mockDb = serviceTestUtils.mockDatabase();
context.mockDb.query.roles.findFirst.mockResolvedValue(mockRole);
```

### **2. Organization Scoping Validation**

```typescript
// Test multi-tenant isolation
const primaryService = new RoleService(mockDb, primaryOrgId);
const competitorService = new RoleService(mockDb, competitorOrgId);
// Verify separate organization contexts
```

### **3. Business Logic Focus**

```typescript
// Test business rules, not database operations
it("should apply business rules correctly", async () => {
  // Arrange: Mock dependencies
  // Act: Call business logic
  // Assert: Verify business rule application
});
```

### **4. Predictable Test Data**

```typescript
// Use consistent, predictable IDs
const orgId = SEED_TEST_IDS.ORGANIZATIONS.primary;
const userId = SEED_TEST_IDS.USERS.ADMIN;
```

## Testing Targets (Priority Order)

### **Phase 1: Security-Critical Services** ✅

1. **RoleService** - ✅ COMPLETE (14 tests passing)
   - System role creation and management
   - Permission assignment validation
   - Multi-tenant organization scoping

### **Phase 2: Core Business Logic** ✅

2. **CollectionService** - ✅ COMPLETE (21 tests passing in 12ms)
   - Collection creation and management
   - Auto-collection generation
   - Location-based filtering

3. **PermissionService** - 📋 NEXT TARGET
   - Permission dependency resolution
   - Role-permission assignment validation

### **Phase 3: Supporting Services**

4. **NotificationService** - 📋 PLANNED
   - Notification routing logic
   - Multi-tenant message scoping

5. **IssueActivityService** - 📋 PLANNED
   - Activity tracking business logic
   - Timeline generation

## Infrastructure Components

### **Test Helpers** (`src/test/helpers/service-test-helpers.ts`)

- `createServiceTestContext()`: Standard test setup
- `createMockDatabase()`: TypeScript-safe Drizzle mocking
- `expectOrganizationScoping()`: Multi-tenant validation
- `mockResponses`: Predefined mock data structures

### **Test Constants** (`src/test/constants/seed-test-ids.ts`)

- Predictable organization IDs for multi-tenant testing
- Consistent user, role, and entity IDs
- Mock patterns optimized for service layer testing

### **Test Template** (`src/test/templates/service.test.template.ts`)

- Complete template for new service tests
- All standard patterns included
- Copy-paste ready for new services

## Execution Performance

```bash
npm test -- roleService.simple.service.test.ts
# ✅ 14 tests passed in 7ms (ultra-fast)
```

**Performance Characteristics**:

- **Ultra-fast**: No database, no network, pure business logic
- **Reliable**: No flaky tests from external dependencies
- **Scalable**: Can run hundreds of service tests in seconds
- **CI-Friendly**: Consistent, predictable execution

## Next Steps

### **Immediate: Expand Coverage**

1. **CollectionService Tests**: Use template to create comprehensive tests
2. **PermissionService Tests**: Security-critical permission logic
3. **Additional Business Services**: Apply pattern to remaining services

### **Future: Advanced Patterns**

- **Integration with tRPC Router Tests**: Service layer feeds into tRPC procedures
- **Database Integration Tests**: When database schema stabilizes
- **E2E Validation**: Critical user journeys after UI stabilizes

## Integration with Test System Reboot Plan

**Current Position in 9-Archetype System**:

- **Archetype 1** (Unit Tests): ✅ Active (205 pure function tests)
- **Archetype 3** (Service Tests): ✅ **IMPLEMENTED** (This archetype)
- **Archetype 8** (RLS Tests): ✅ Active (pgTAP policy validation)
- **Archetype 9** (Smoke Tests): ✅ Active (Playwright essential flows)

**Service Tests bridges the gap between pure functions and full integration testing while maintaining the velocity focus needed for pre-beta development.**

## Success Metrics

✅ **Technical Metrics**:

- 14/14 tests passing for RoleService example
- <10ms execution time per service test suite
- 100% TypeScript type safety maintained
- Zero flaky tests (no external dependencies)

✅ **Business Value Metrics**:

- Security-critical organizationId scoping validated
- Core business logic protected by tests
- Multi-tenant isolation patterns verified
- Service layer architecture confidence established

**The Service Tests archetype successfully provides maximum confidence in critical business logic with minimal setup complexity - perfect for pre-beta velocity while ensuring security and data integrity.**

# Phase 1: Service Layer Conversion

**Timeline**: 2-3 days  
**Impact**: High - Core business logic and security  
**Approach**: Use drizzle-migration agent for complex conversions  

## 🎯 Overview

Convert the remaining service layer files from Prisma to Drizzle. These services contain critical business logic, security operations, and data access patterns that power the application.

**Why Phase 1**: Service layer contains the most complex business logic and security-critical operations. Converting these first ensures the core functionality uses clean Drizzle patterns.

## 📋 Tasks

### **Priority 1: Security & Auth Services**

- [ ] **Convert `roleService.ts`** - Authentication/authorization core
  - Current: Mixed pattern (DrizzleRoleService in tests, RoleService with Prisma in production)
  - Target: Use DrizzleRoleService everywhere
  - Agent: drizzle-migration for complex role hierarchy queries
  
- [ ] **Convert `permissionService.ts`** - Core security operations  
  - Current: Prisma-based permission checking
  - Target: Drizzle relational queries for permission trees
  - Agent: drizzle-migration for complex permission dependency logic

- [ ] **Update `server/auth/permissions.ts`** - Permission system integration
  - Current: Mixed service usage
  - Target: Call Drizzle-based services only
  - Manual: Service interface updates

### **Priority 2: Core Business Logic**

- [ ] **Convert `collectionService.ts`** - Collection management business logic
  - Current: Prisma-based collection operations  
  - Target: Drizzle with generated columns for computed fields
  - Agent: drizzle-migration for complex collection aggregations

- [ ] **Convert `issueActivityService.ts`** - Activity tracking and timeline
  - Current: Prisma-based activity logging
  - Target: Drizzle with optimized activity queries
  - Agent: drizzle-migration for complex timeline operations

- [ ] **Convert `commentCleanupService.ts`** - Comment moderation and cleanup
  - Current: Prisma-based bulk operations
  - Target: Drizzle batch operations with proper scoping
  - Agent: drizzle-migration for bulk update patterns

### **Priority 3: Integration Services**

- [ ] **Convert `pinballmapService.ts`** - External API integration with data sync
  - Current: Prisma for local data operations
  - Target: Drizzle for data synchronization operations  
  - Agent: drizzle-migration for sync logic patterns

### **Priority 4: Infrastructure Services**

- [ ] **Update `services/factory.ts`** - Service instantiation and dependency injection
  - Current: Creates both Prisma and Drizzle service instances
  - Target: Drizzle-only service creation
  - Manual: Update factory methods, remove Prisma client injection

## 🔧 Conversion Strategy

### **Use drizzle-migration Agent for Complex Services**

**Services requiring agent assistance:**
- `roleService.ts` - Complex role hierarchy and permission resolution
- `permissionService.ts` - Permission dependency trees and validation
- `collectionService.ts` - Collection aggregations and computed fields  
- `issueActivityService.ts` - Timeline construction and activity queries
- `commentCleanupService.ts` - Bulk operations with organizational scoping
- `pinballmapService.ts` - Data synchronization patterns

**Agent Instructions:**
```
Context: Final Prisma removal phase - service layer conversion
Approach: Direct conversion to clean Drizzle patterns
Focus: Preserve business logic, optimize for Drizzle capabilities  
Quality: TypeScript safety, organizational scoping, proper error handling
```

### **Manual Updates for Simple Services**

**Services for manual update:**
- `server/auth/permissions.ts` - Service interface calls only
- `services/factory.ts` - Constructor and injection updates

## 🔍 Quality Checklist

### **For Each Converted Service:**

**Business Logic Preservation:**
- [ ] All business rules maintained
- [ ] Error handling approaches preserved
- [ ] Organizational scoping enforced
- [ ] Input validation patterns maintained

**Drizzle Optimization:**
- [ ] Use relational queries instead of manual joins
- [ ] Leverage generated columns for computed fields
- [ ] Implement proper batch operations
- [ ] Optimize query patterns for performance

**TypeScript Safety:**
- [ ] Proper type annotations
- [ ] Null safety with optional chaining
- [ ] Discriminated unions for complex types
- [ ] No `any` types or unsafe assertions

**Testing Readiness:**
- [ ] Service interface unchanged (for existing tests)
- [ ] Mock-friendly patterns
- [ ] Clear error messages for test assertions

## 🚦 Validation Process

### **After Each Service Conversion:**

1. **TypeScript Compilation** - Must pass without errors
2. **Service Interface Check** - No breaking changes to public methods  
3. **Manual Testing** - Test key flows using converted service
4. **Organizational Scoping** - Verify multi-tenant boundaries maintained
5. **Error Handling** - Ensure appropriate error messages

### **Phase 1 Completion Criteria:**

- [ ] All 8 service files converted to Drizzle-only
- [ ] TypeScript build passes 
- [ ] No Prisma imports in service layer
- [ ] Service factory creates Drizzle-only instances
- [ ] Manual testing of auth flows works
- [ ] Manual testing of business operations works

## 📊 Risk Assessment

### **High Risk Areas:**

**Role & Permission Services** - Core security, test thoroughly
**Collection Service** - Complex aggregations, verify data integrity
**Issue Activity** - Timeline accuracy, check chronological ordering

### **Mitigation Strategies:**

- **Incremental approach** - Convert one service at a time
- **Git checkpoints** - Commit after each successful conversion  
- **Immediate testing** - Validate conversion before moving to next service
- **Rollback plan** - Easy revert using `git checkout filename.ts`

## 🎯 Success Metrics

**Technical Metrics:**
- Zero Prisma imports in service layer
- TypeScript compilation passes
- Service tests pass (with updated mocks in later phases)
- Manual user flows function correctly

**Quality Metrics:**
- Clean, readable Drizzle code
- Proper error handling maintained
- Organizational scoping preserved
- Performance equivalent or better

**Operational Metrics:**
- No breaking changes to service interfaces
- Development environment remains stable
- Clear conversion decisions documented

---

**Next Phase**: Phase 2 (Core Infrastructure) - Remove Prisma from tRPC context and database provider

**Dependencies**: None - Can begin immediately
**Blockers**: None identified
**Estimated Completion**: 2-3 days with agent assistance
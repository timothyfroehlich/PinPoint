# Test Inventory: Library & Validation Test Files

## 8-Archetype Categorization Analysis

**Total Files Analyzed**: 30 library, validation, utility, and service test files  
**Primary Archetype Distribution**: 21 Unit Tests (Archetype 1), 9 Security/Service Tests (Archetype 6)  
**Conversion Priority**: High - Foundation for all other archetypes

---

## 📊 Executive Summary

### 8-Archetype Classification

- **Archetype 1** (Pure Function Unit Test): 21 files (70%)
- **Archetype 6** (Permission/Auth Test): 9 files (30%)
- **Unknown/Mixed**: 0 files
- **High Confidence**: 28 files (93.3%)
- **Medium Confidence**: 2 files (6.7%)

### Overall Conversion Requirements

- **Memory Safety Issues**: 2 files require fixes
- **Import Path Changes**: 8 files need updates
- **Mocking Pattern Updates**: 15 files need modernization
- **RLS Session Context**: 6 files need auth context

---

## 🗂️ Detailed File Analysis

### **ARCHETYPE 1: Pure Function Unit Test** (21 files)

#### **High Priority - Validation Core (5 files)**

**1. `/src/lib/common/__tests__/inputValidation.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: Critical
- **Pattern**: Comprehensive Zod schema validation testing (1,683 lines)
- **Changes Required**:
  - Memory safety: No
  - Mocking updates: Not Required
  - Import paths: Required (relative imports)
  - RLS context: No
- **Complexity**: Low | **Effort**: Minimal
- **Notes**: Excellent example of pure function testing - comprehensive boundary testing, error message validation, edge cases

**2. `/src/lib/issues/__tests__/statusValidation.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: High
- **Pattern**: Business logic validation with mock factories (520 lines)
- **Changes Required**:
  - Memory safety: No
  - Mocking updates: Not Required
  - Import paths: Required (type imports)
  - RLS context: No
- **Complexity**: Low | **Effort**: Minimal
- **Notes**: Good factory pattern usage, comprehensive transition testing

**3. `/src/lib/issues/__tests__/assignmentValidation.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: High
- **Pattern**: Assignment business rule validation
- **Changes Required**: Minimal (estimated based on status validation pattern)

**4. `/src/lib/issues/__tests__/creationValidation.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: High
- **Pattern**: Issue creation validation rules
- **Changes Required**: Minimal (estimated based on status validation pattern)

**5. `/src/lib/common/__tests__/organizationValidation.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: High
- **Pattern**: Organization boundary validation
- **Changes Required**: Minimal (estimated based on input validation pattern)

#### **Medium Priority - External Integrations (4 files)**

**6. `/src/lib/external/__tests__/pinballmapTransformer.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: Medium
- **Pattern**: Data transformation testing
- **Changes Required**: Minimal

**7. `/src/lib/pinballmap/__tests__/client.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: Medium
- **Pattern**: API client testing with mocks
- **Changes Required**: Mocking pattern updates likely required

**8. `/src/lib/opdb/__tests__/utils.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: Medium
- **Pattern**: Utility function testing
- **Changes Required**: Minimal

**9. `/src/lib/supabase/__tests__/types.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: Medium
- **Pattern**: Type definition validation
- **Changes Required**: Import path updates

#### **Infrastructure & Environment (5 files)**

**10. `/src/lib/env-loaders/__tests__/environment-loaders.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: Low
- **Pattern**: Environment loading logic
- **Changes Required**: Minimal

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: Low
- **Pattern**: Test helper validation
- **Changes Required**: Minimal

**12. `/src/lib/supabase/__tests__/errors.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: Medium
- **Pattern**: Error handling testing
- **Changes Required**: Import path updates

**13. `/src/lib/supabase/__tests__/client.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: Medium
- **Pattern**: Supabase client testing with mocks
- **Changes Required**: Mocking pattern updates required

**14. `/src/lib/supabase/__tests__/server.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: Medium
- **Pattern**: Server-side Supabase client testing (167 lines)
- **Changes Required**:
  - Memory safety: No
  - Mocking updates: Required (vi.mock patterns)
  - Import paths: Required
  - RLS context: No
- **Complexity**: Medium | **Effort**: Moderate
- **Notes**: Good mock setup patterns, comprehensive environment integration testing

#### **Database & Infrastructure (2 files)**

**15. `/src/server/db/__tests__/provider.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: Low
- **Pattern**: Database provider testing (40 lines)
- **Changes Required**:
  - Memory safety: No
  - Mocking updates: Required
  - Import paths: Required
  - RLS context: No
- **Complexity**: Low | **Effort**: Minimal
- **Notes**: Simple provider validation test

**16. `/src/server/db/__tests__/drizzle-singleton.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: Low
- **Pattern**: Singleton behavior testing
- **Changes Required**: Mocking pattern updates

#### **Test Infrastructure (5 files)**

**17. `/src/server/db/__tests__/drizzle-test-helpers.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: Low
- **Pattern**: Test helper validation (507 lines)
- **Changes Required**:
  - Memory safety: No
  - Mocking updates: Required (vi.mock patterns)
  - Import paths: Required
  - RLS context: No
- **Complexity**: Medium | **Effort**: Moderate
- **Notes**: Comprehensive test helper validation, good mock configuration testing

**18. `/src/lib/users/__tests__/roleManagementValidation.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: High
- **Pattern**: Role management validation
- **Changes Required**: Minimal

**19. `/src/server/services/__tests__/factory.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: Low
- **Pattern**: Service factory testing
- **Changes Required**: Mocking pattern updates

**20. `/src/server/services/__tests__/pinballmapService.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: Medium
- **Pattern**: External service integration
- **Changes Required**: Mocking pattern updates

**21. `/src/server/services/__tests__/notificationPreferences.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: High | **Priority**: Medium
- **Pattern**: Preference management testing
- **Changes Required**: Minimal

---

### **ARCHETYPE 6: Permission/Auth Test** (9 files)

#### **Core Security Tests (4 files)**

**22. `/src/lib/permissions/__tests__/descriptions.test.ts`**

- **Current**: Archetype 6 | **Target**: Archetype 6 | **Agent**: security-test-architect
- **Confidence**: High | **Priority**: Critical
- **Pattern**: Permission description validation (178 lines)
- **Changes Required**:
  - Memory safety: No
  - Mocking updates: Not Required
  - Import paths: Required
  - RLS context: Yes (permission context validation)
- **Complexity**: Low | **Effort**: Minimal
- **Notes**: Good permission constant validation, consistent formatting checks

**23. `/src/server/auth/__tests__/permissions.test.ts`**

- **Current**: Archetype 6 | **Target**: Archetype 6 | **Agent**: security-test-architect
- **Confidence**: High | **Priority**: Critical
- **Pattern**: Core permission system testing (431 lines)
- **Changes Required**:
  - Memory safety: Yes (Prisma→Drizzle mock context)
  - Mocking updates: Required (VitestMockContext pattern)
  - Import paths: Required
  - RLS context: Yes (role-based auth testing)
- **Complexity**: High | **Effort**: Significant
- **Notes**: Critical auth infrastructure - needs careful Drizzle conversion, comprehensive permission checking

**24. `/src/server/auth/__tests__/permissions.constants.test.ts`**

- **Current**: Archetype 6 | **Target**: Archetype 6 | **Agent**: security-test-architect
- **Confidence**: High | **Priority**: High
- **Pattern**: Permission constants validation
- **Changes Required**: Minimal

**25. `/src/server/auth/__tests__/uploadAuth.test.ts`**

- **Current**: Archetype 6 | **Target**: Archetype 6 | **Agent**: security-test-architect
- **Confidence**: High | **Priority**: High
- **Pattern**: Upload authorization testing
- **Changes Required**: RLS session context

#### **Service-Level Security (3 files)**

**26. `/src/server/services/__tests__/roleService.test.ts`**

- **Current**: Archetype 6 | **Target**: Archetype 6 | **Agent**: security-test-architect
- **Confidence**: High | **Priority**: Critical
- **Pattern**: Role service security testing (383 lines)
- **Changes Required**:
  - Memory safety: Yes (Drizzle mock setup)
  - Mocking updates: Required (modern vi.mock patterns)
  - Import paths: Required
  - RLS context: Yes (role management with org scoping)
- **Complexity**: High | **Effort**: Significant
- **Notes**: Complex role management logic, admin protection, template creation - needs careful RLS integration

**27. `/src/server/services/__tests__/collectionService.test.ts`**

- **Current**: Archetype 6 | **Target**: Archetype 6 | **Agent**: security-test-architect
- **Confidence**: High | **Priority**: High
- **Pattern**: Collection security testing
- **Changes Required**: RLS session context, mocking updates

**28. `/src/server/services/__tests__/permissionService.expandDependencies.test.ts`**

- **Current**: Archetype 6 | **Target**: Archetype 6 | **Agent**: security-test-architect
- **Confidence**: High | **Priority**: High
- **Pattern**: Permission dependency validation
- **Changes Required**: Minimal

#### **Service Architecture (2 files)**

**29. `/src/server/services/__tests__/notificationService.unit.test.ts`**

- **Current**: Mixed (Archetype 1/6) | **Target**: Archetype 6 | **Agent**: security-test-architect
- **Confidence**: Medium | **Priority**: Medium
- **Pattern**: Unit testing of notification service with security boundaries (939 lines)
- **Changes Required**:
  - Memory safety: Yes (hoisted mock pattern)
  - Mocking updates: Required (drizzle mock patterns)
  - Import paths: Required
  - RLS context: Yes (user scoping validation)
- **Complexity**: High | **Effort**: Significant
- **Notes**: Complex service with security boundaries, good multi-tenancy testing, needs Drizzle conversion

**30. `/src/server/auth/__tests__/auth-simple.test.ts`**

- **Current**: Archetype 1 | **Target**: Archetype 1 | **Agent**: unit-test-architect
- **Confidence**: Medium | **Priority**: Low
- **Pattern**: Simple auth logic validation (139 lines)
- **Changes Required**:
  - Memory safety: No
  - Mocking updates: Not Required
  - Import paths: Required
  - RLS context: No
- **Complexity**: Low | **Effort**: Minimal
- **Notes**: Documents auth requirements, good interface validation

---

## 🚧 Conversion Analysis

### **Memory Safety Issues (2 files)**

- **Critical**: `/src/server/auth/__tests__/permissions.test.ts` - VitestMockContext conversion
- **High**: `/src/server/services/__tests__/roleService.test.ts` - Drizzle mock patterns

### **Mocking Pattern Updates (15 files)**

**High Priority**:

- All Supabase client/server tests
- All Drizzle test helpers
- Service layer tests with database mocks

### **Import Path Changes (8 files)**

**Pattern**: Relative → TypeScript alias imports

- `/src/lib/common/__tests__/inputValidation.test.ts`
- `/src/lib/issues/__tests__/statusValidation.test.ts`
- All Supabase tests
- Database infrastructure tests

### **RLS Session Context (6 files)**

**Security Tests Requiring Auth Context**:

- Permission system tests
- Role service tests
- Notification service user scoping
- Upload authorization tests

---

## 📋 Migration Strategy

### **Phase 1: Foundation (Archetype 1 - Week 1)**

1. **Validation Core** (5 files) - inputValidation, statusValidation, etc.
2. **Simple Utilities** (8 files) - OPDB, environment loaders, types

### **Phase 2: Infrastructure (Week 2)**

1. **Database Layer** (3 files) - provider, singleton, test helpers
2. **Supabase Integration** (4 files) - client, server, errors, types

### **Phase 3: Security (Archetype 6 - Week 3)**

1. **Permission Core** (4 files) - descriptions, constants, permissions, uploadAuth
2. **Service Security** (5 files) - roleService, collectionService, notification security

### **Phase 4: Integration & Validation (Week 4)**

1. Full test suite execution
2. Performance validation
3. Memory usage verification
4. Coverage analysis

---

## 🎯 Success Metrics

### **Immediate Goals**

- All 30 files pass with new archetype patterns
- Zero memory safety issues
- Modern vi.mock patterns throughout
- Proper import path usage

### **Quality Targets**

- Test execution time < 10s for full utility suite
- Memory usage < 100MB for complete run
- 100% test pass rate
- Consistent archetype patterns

### **Long-term Benefits**

- Clean foundation for all other archetype conversions
- Reusable patterns for Phase 3 router conversions
- Robust security test infrastructure
- Maintainable test architecture

---

**Inventory Complete**: 30 files analyzed, categorized, and prioritized for 8-archetype conversion

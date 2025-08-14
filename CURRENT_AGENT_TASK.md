# Current Agent Task - Complete Test Overlap Cleanup & Drizzle Conversion

**Created:** 2025-08-14  
**Updated:** 2025-08-14 (Added issue.attachment.ts conversion)
**Status:** In Progress - Implementing Phase 1  
**Context:** Direct Drizzle migration - optimizing test suite for velocity and clarity

## Executive Summary

During the issue router review, significant test overlap was discovered between unit tests and integration tests, leading to:

- **Duplicate coverage** reducing test suite efficiency
- **Misclassified tests** (complex workflows in unit tests)
- **Missing coverage** for critical procedures
- **Technical debt** from legacy test patterns

**NEW**: Adding `issue.attachment.ts` router conversion to complete the issue router ecosystem in this branch.

This document tracks all overlap findings and provides a systematic implementation plan.

---

## Current Branch Status

### ✅ COMPLETED THIS SESSION:

- [x] **Comment Overlap Fix:** Removed ~160 lines duplicate comment testing from `issue.test.ts`
- [x] **Analysis:** Comprehensive system-wide test overlap patterns documented
- [x] **Git State:** Clean merge from origin/main, all PRs integrated

### 🔄 IN PROGRESS:

- **Document Migration:** Moving to root as `CURRENT_AGENT_TASK.md` (this file)
- **issue.attachment.ts:** Adding to conversion plan and analysis

### 📋 NEXT PRIORITIES:

1. **Convert issue.attachment.ts** - Complete issue router ecosystem
2. **Fix Collection Test Misplacement** - Critical: test doesn't test router
3. **Move Complex Business Logic** - Unit → Integration tests

---

## Issue Router Ecosystem Analysis

### **Current State - Issue Router Family:**

#### **✅ issue.core.ts** (CONVERTED)

- **Status:** Clean Drizzle implementation, well-tested
- **Size:** 1260 lines, 8/9 procedures covered
- **Pattern:** Good separation of concerns

#### **✅ issue.comment.ts** (CONVERTED - Recent PR)

- **Status:** 906-line comprehensive comment router
- **Coverage:** Full test suite with modern patterns
- **Integration:** Clean Drizzle implementation with validation utilities

#### **🔄 issue.attachment.ts** (NEEDS CONVERSION - ADDING TO BRANCH)

- **Current State:** 100 lines, Prisma-based, 2 procedures
- **Procedures:** `createAttachment`, `deleteAttachment`
- **Business Logic:** Attachment count limits (max 3 per issue)
- **External Dependencies:** File storage operations (`imageStorage.deleteImage`)
- **Security:** Organizational scoping implemented
- **Test Status:** No existing tests identified

**Analysis of issue.attachment.ts:**

```typescript
// CURRENT: Prisma patterns
const existingIssue = await ctx.db.issue.findFirst({
  where: { id: input.issueId, organizationId: ctx.organization.id },
});

const existingAttachments = await ctx.db.attachment.count({
  where: { issueId: input.issueId },
});

// NEEDS: Drizzle conversion
const existingIssue = await ctx.drizzle.query.issues.findFirst({
  where: and(
    eq(issues.id, input.issueId),
    eq(issues.organizationId, ctx.organization.id),
  ),
});

const existingAttachments = await ctx.drizzle
  .select({ count: sql<number>`count(*)` })
  .from(attachments)
  .where(eq(attachments.issueId, input.issueId));
```

**Conversion Priority:** HIGH

- Part of issue router ecosystem (logical to complete in same branch)
- Relatively simple (100 lines, 2 procedures)
- Clear patterns to follow from other conversions
- No existing test overlap issues to resolve

---

## System-wide Overlap Patterns Discovered

### **1. Router vs Service Testing Overlap (HIGH PRIORITY)**

#### **❌ NOTIFICATION OVERLAP:**

- **Router Test:** `notification.test.ts` - Properly tests tRPC router but mocks NotificationService completely
- **Service Test:** `notificationService.test.ts` - Tests NotificationService business logic with mocked database
- **Issue:** Router test duplicates service functionality testing through mocks
- **Recommendation:** Router should focus on auth/input validation, service tests cover business logic

#### **❌ COLLECTION OVERLAP (CRITICAL - MISNAMED TEST):**

- **Router "Test":** `collection.test.ts` - **Claims** to be "Collection Router Integration" but actually tests CollectionService directly
- **Service Test:** `collectionService.test.ts` - Tests CollectionService directly (proper approach)
- **Issue:** Router test is completely misnamed/misplaced - it doesn't test the router at all, just duplicates service testing
- **Recommendation:** Either move to service tests or rewrite to actually test the router

**Analysis Details:**

```typescript
// collection.test.ts - MISNAMED, doesn't test router
describe("Collection Router Integration", () => {
  let service: CollectionService; // ❌ Tests service directly
  // ... tests service methods without any router context
});

// vs collectionService.test.ts - PROPER
describe("CollectionService", () => {
  let service: CollectionService; // ✅ Correctly tests service
  // ... proper service testing
});
```

### **2. Issue Router Testing Overlap (PARTIALLY RESOLVED)**

#### **✅ FIXED: Comment Operations**

- **Previously:** `issue.test.ts` lines 547-701 vs `comment.integration.test.ts`
- **Resolution:** Removed ~160 lines duplicate comment testing from unit tests
- **Result:** Clean separation, no more duplicate coverage

#### **❌ STILL NEEDS FIX: Complex Business Logic in Unit Tests**

- **Examples:**
  - "should create issue with proper organizational scoping" (complex workflows)
  - "should allow users with edit permissions to update issues" (multi-step operations)
  - Assignment operations with database validation
  - Complex update workflows with activity tracking
- **Issue:** These mock complex database operations but test full business workflows
- **Recommendation:** Move to integration tests for real database validation

#### **❌ MISSING: Critical Procedures**

- **Not Covered:** `publicGetAll`, `publicCreate` (anonymous user flows)
- **Impact:** QR code functionality and anonymous issue creation not tested
- **Recommendation:** Add integration tests

### **3. Permission Testing Overlap (MEDIUM PRIORITY)**

#### **❌ PERMISSION VALIDATION OVERLAP:**

- **Core Functions:** `permissions.test.ts` - Tests `hasPermission`, `requirePermission` functions
- **tRPC Integration:** `trpc.permission.test.ts` - Tests permission middleware integration
- **Router Tests:** Multiple router tests duplicate permission validation scenarios
- **Issue:** Same permission logic tested at multiple levels
- **Recommendation:** Consolidate to core function tests + integration validation only

---

## Implementation Plan

### **Phase 1: Critical Fixes & Router Conversion (Week 1)**

#### **Task 1: Convert issue.attachment.ts Router (NEW - HIGH PRIORITY)**

```diff
Target: src/server/api/routers/issue.attachment.ts
Current: 100 lines, Prisma-based, 2 procedures

Conversion Steps:
1. Replace ctx.db.issue.findFirst with Drizzle query patterns
2. Replace ctx.db.attachment.count with Drizzle aggregation
3. Replace ctx.db.attachment.create with Drizzle insert.returning()
4. Replace ctx.db.attachment.delete with Drizzle delete.where()
5. Maintain file storage cleanup operations
6. Preserve organizational scoping security
7. Keep attachment count business logic (max 3 per issue)

Test Strategy:
- Create unit tests for business logic validation
- Create integration tests for file operations + database validation
- Test organizational scoping boundaries
- Test attachment limits enforcement
- Mock file storage operations appropriately

Expected: Clean Drizzle router completing issue ecosystem
Impact: Issue router family 100% Drizzle-native
```

#### **Task 2: Fix Collection Router Test Misplacement (CRITICAL)**

```diff
File: src/server/api/routers/__tests__/collection.test.ts
Issue: Claims to be "Collection Router Integration" but tests CollectionService directly
Action: Either rename/move to service tests OR rewrite to actually test router
Priority: CRITICAL - test file is completely misleading
Impact: Eliminates misleading test categorization
```

#### **Task 3: Move Complex Business Logic to Integration**

```diff
Source: src/server/api/routers/__tests__/issue.test.ts
Target: src/server/api/routers/__tests__/issue.integration.test.ts
Move tests:
- "should create issue with proper organizational scoping"
- "should allow users with edit permissions to update issues"
- Assignment operations with validation
- Complex update workflows with activity tracking
Reason: These test full business workflows, not isolated logic
Impact: ~200 lines moved, better test reliability with real database validation
```

#### **Task 4: Add Missing Integration Coverage**

```diff
File: src/server/api/routers/__tests__/issue.integration.test.ts
Add tests:
+ publicGetAll procedure testing
+ publicCreate procedure testing (anonymous workflows)
+ QR code issue creation flows
Reason: Critical functionality not covered
Impact: Complete API surface coverage
```

### **Phase 2: Service/Router Overlap Cleanup (Week 2)**

#### **Task 5: Fix Notification Router vs Service Overlap**

- **Issue:** `notification.test.ts` router test mocks NotificationService completely
- **Action:** Refocus router test on auth/input validation, let service test handle business logic
- **Files:** `notification.test.ts`, `notificationService.test.ts`

#### **Task 6: Consolidate Permission Testing**

- **Issue:** Permission validation tested at multiple levels redundantly
- **Action:** Keep core function tests + minimal integration validation only
- **Files:** `permissions.test.ts`, `trpc.permission.test.ts`, router tests

### **Phase 3: Test Organization & Standards (Week 3)**

#### **Task 7: Create Test Factory Patterns**

```diff
Create: src/test/factories/issue-test-factory.ts
Patterns:
+ createIssueTestData() for unit tests
+ createSeededIssueData() for integration tests
+ createAnonymousIssueData() for public flows
+ createAttachmentTestData() for attachment testing (NEW)
Reason: Reduce test setup duplication
Impact: More maintainable test code across issue router ecosystem
```

#### **Task 8: Refocus Unit Tests on Pure Logic**

```diff
Target: All router unit tests
Keep Only:
✅ Permission validation failures
✅ Input validation edge cases
✅ Pure business logic validation
✅ Error handling scenarios
✅ Security boundary enforcement
Remove: Complex mocked database operations
Impact: Faster, more focused unit tests
```

### **Expected Results After Phase 1:**

- **issue.attachment.ts:** Converted to clean Drizzle implementation
- **Issue Router Ecosystem:** 100% Drizzle-native (core, comment, attachment)
- **Unit Tests:** ~300 lines each (down from 576+ for issue.test.ts)
- **Integration Tests:** ~800 lines each (comprehensive workflows)
- **New Attachment Tests:** ~400 lines (unit + integration)
- **Code Reduction:** ~300+ lines of duplicate test code eliminated
- **Coverage Improvement:** All procedures tested appropriately

---

## Router Conversion Status (Updated)

### **✅ COMPLETED CONVERSIONS:**

- `qrCode.ts` - 1 query converted (simple machine lookup)
- `comment.ts` - 2 queries converted (joins with soft delete patterns)
- `admin.ts` - 18 queries converted (complex admin operations with bulk updates)
- `role.ts` - Service pattern maintained, minimal cleanup needed

### **🔄 CURRENT BRANCH CONVERSIONS:**

- `issue.comment.ts` - 906 lines, comprehensive comment router (COMPLETED in recent PR)
- `issue.attachment.ts` - 100 lines, file attachment operations (ADDING TO BRANCH)

### **📋 PENDING CONVERSIONS (Future Branches):**

- 9 remaining routers identified in original migration plan
- Will follow patterns established in this branch

---

## Success Metrics & Tracking

### **Code Quality Metrics:**

- **Lines of Code:** Reduce duplicate test code by >300 lines ✅ ON TRACK (160 lines removed already)
- **Router Conversion:** Convert issue.attachment.ts to Drizzle 🔄 IN PROGRESS
- **Test Execution Time:** Improve unit test speed by focusing scope
- **Coverage Accuracy:** Ensure all procedures have appropriate test level

### **Developer Experience Metrics:**

- **Test Reliability:** Fewer flaky tests from improved integration testing
- **Maintainability:** Clearer test boundaries and factory patterns
- **Debugging:** Easier issue identification with focused test scope
- **Router Ecosystem:** Complete issue functionality in unified patterns

### **Migration Context Benefits:**

- **Clean Drizzle implementation** enables better integration testing with PGlite
- **Modern Vitest patterns** support more efficient test organization
- **Direct conversion approach** allows comprehensive test restructuring
- **Issue router completion** provides template for remaining conversions

---

## Priority Implementation Order

### **HIGH IMPACT, LOW RISK (Do First):**

1. **Convert issue.attachment.ts** - Completes issue router ecosystem, simple conversion
2. **Fix Collection Router Test Misplacement** - Critical: test file doesn't test router at all
3. **Move Issue Router Complex Tests** - Better test reliability with PGlite
4. **Add Missing Anonymous Issue Coverage** - Critical functionality gap

### **MEDIUM IMPACT, LOW RISK (Do Second):**

1. **Router vs Service Testing Consolidation** - Notification and Collection overlap
2. **Permission Testing Cleanup** - Eliminate redundant validation tests
3. **Test Factory Pattern Creation** - Reduce maintenance overhead across issue ecosystem

### **HIGH IMPACT, HIGHER RISK (Do Carefully):**

1. **Database Testing Pattern Migration** - Apply admin router patterns to other routers
2. **Context Mocking Standardization** - System-wide refactoring

---

## Implementation Notes

### **Patterns for issue.attachment.ts Conversion:**

- **Follow admin.integration.test.ts pattern** for comprehensive database testing
- **Use comment.integration.test.ts pattern** for relational data validation
- **Apply qrCode.ts pattern** for simple CRUD conversions
- **Mock file storage operations** appropriately in tests

### **Testing Strategy for New Router:**

```typescript
// Unit Tests Focus
- Input validation (file types, URLs)
- Business logic (attachment count limits)
- Permission validation (create/delete permissions)
- Error handling (file not found, invalid issue)

// Integration Tests Focus
- Database operations with real PGlite
- Organizational scoping validation
- File storage integration (mocked appropriately)
- Cross-table relationship validation (issues ↔ attachments)
```

### **Shared Patterns Across Issue Ecosystem:**

- **Organizational Scoping:** All issue routers enforce organization boundaries
- **Permission Patterns:** Consistent use of specialized permission procedures
- **Error Handling:** Standardized TRPCError patterns with appropriate codes
- **Validation:** Input validation with Zod schemas
- **Testing:** Unit tests for logic, integration tests for database operations

---

**Last Updated:** 2025-08-14 (Added issue.attachment.ts conversion plan)  
**Current Task:** Converting issue.attachment.ts router to Drizzle  
**Status:** 🔄 IN PROGRESS - Phase 1 Implementation

**Next Steps:**

1. Convert issue.attachment.ts router from Prisma to Drizzle
2. Create comprehensive test suite for attachment operations
3. Fix collection router test misplacement
4. Complete issue router ecosystem testing cleanup

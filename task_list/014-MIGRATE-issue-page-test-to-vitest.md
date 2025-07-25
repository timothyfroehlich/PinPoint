# Task 014: Migrate Issue Page Test to Vitest

## Status

🔧 **PENDING** - Deferred due to DI permissions rework

## Priority

**Medium** - Blocking complete Jest removal

## Problem Description

The issue page test (`src/app/issues/__tests__/page.test.tsx`) is the last remaining Jest test file (1,069 lines) that needs migration to Vitest to complete the Jest purge from the codebase.

## Current State Analysis

### Test File Details

- **File**: `src/app/issues/__tests__/page.test.tsx`
- **Size**: 1,069 lines
- **Component**: `IssuePage` (issue detail page)
- **Test Framework**: Jest + React Testing Library
- **Environment**: jsdom

### Test Coverage Areas

1. **Public User View** (3 tests)
   - Issue details display for unauthenticated users
   - Hidden admin controls
   - Public-only comments

2. **Authenticated User View** (2 tests)
   - Full issue details for authenticated users
   - All comments visibility

3. **Permission-based Controls** (5 tests)
   - Edit controls for users with edit permissions
   - Assign controls for users with assign permissions
   - Close controls for users with close permissions
   - Permission tooltips on disabled buttons

4. **Loading States** (2 tests)
   - Skeleton loader during data fetch
   - Individual action loading states

5. **Error States** (3 tests)
   - 404 error for non-existent issues
   - Permission denied error
   - Network error handling

6. **Accessibility** (2 tests)
   - ARIA labels and roles
   - Keyboard navigation

7. **Responsive Design** (2 tests)
   - Mobile layout adaptation
   - Desktop layout

## Why Deferred

The permissions system is undergoing a **dependency injection (DI) rework** that will likely change:

- Permission checking patterns
- Mock setup for permissions
- Component prop interfaces
- tRPC procedure signatures

Migrating this test now would require immediate rework once the DI changes are implemented.

## Implementation Steps (For Later)

### Phase 1: Environment Setup

1. Create `src/app/issues/__tests__/page.vitest.test.tsx`
2. Replace Jest imports with Vitest equivalents:
   - `jest.mock()` → `vi.mock()`
   - `jest.fn()` → `vi.fn()`
   - `jest.clearAllMocks()` → `vi.clearAllMocks()`

### Phase 2: Mock Updates

1. **Next.js Navigation Mocks**:

   ```typescript
   // Jest
   jest.mock("next/navigation", () => ({ ... }))

   // Vitest
   vi.mock("next/navigation", () => ({ ... }))
   ```

2. **MUI Component Mocks**:

   ```typescript
   // Jest
   jest.mock("@mui/material", () => ({ ... }))

   // Vitest
   vi.mock("@mui/material", () => ({ ... }))
   ```

3. **tRPC Mock Updates**:
   - Update `createMockTRPCClient` calls for Vitest patterns
   - Ensure MSW-tRPC integration works with component tests

### Phase 3: Permission System Updates

1. **Wait for DI rework completion**
2. Update permission mock patterns to match new DI system
3. Update test scenarios for new permission checking approach

### Phase 4: Test Validation

1. Ensure all 19 test cases pass
2. Verify coverage matches original Jest version
3. Test responsive design mocks work in Vitest environment

## Dependencies

### Blocked By

- **DI Permissions Rework** - Major architecture change in progress

### Technical Dependencies

- MSW-tRPC integration for component tests
- Vitest jsdom environment configuration
- React Testing Library Vitest integration

## Success Criteria

- [ ] All 19 test cases migrated and passing in Vitest
- [ ] Test coverage maintained at same level
- [ ] Permission mocking works with new DI system
- [ ] Responsive design tests function correctly
- [ ] Original Jest file can be safely deleted

## Estimated Effort

**2-3 hours** (after DI rework completion)

- 1 hour: Basic Jest → Vitest migration
- 1 hour: Permission system updates for DI pattern
- 30min: Test validation and debugging

## Notes

- This is the **final blocking task** for complete Jest removal
- Test is comprehensive with good coverage of component behavior
- Migration should be straightforward once DI permissions are stable
- Consider splitting large test file into focused test suites during migration

## Context References

- Original file: `src/app/issues/__tests__/page.test.tsx`
- Component: `src/app/issues/[issueId]/page.tsx`
- Permission system: `src/lib/permissions/`
- Mock utilities: `src/test/mockTRPCClient.ts`

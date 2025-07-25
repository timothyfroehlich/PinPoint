# Task 009: Fix Test Member Authentication Consistency Issue

**Priority**: HIGH  
**Category**: Testing  
**Status**: 🔧 PENDING  
**Dependencies**: Task 008 (E2E test cleanup completed)

## Problem

The Test Member authentication flow has inconsistent behavior in e2e tests, causing some tests to fail or be flaky. This affects the reliability of our authentication test suite and makes it difficult to validate permission-based features.

## Current State Analysis

From previous e2e test analysis:

- Test Member authentication sometimes fails to complete properly
- Tests expect consistent auth state but receive inconsistent results
- This primarily affects tests in `auth-flow.spec.ts` that use "Test Member" role
- Other auth roles (Test Admin, Test Player) appear more reliable

## Root Cause Investigation Needed

1. **Dev Quick Login Implementation**: Examine how "Test Member" is handled vs other roles
2. **Session Management**: Check if member-specific session setup has issues
3. **Timing Issues**: Verify if member auth requires different wait times
4. **Permission Context**: Ensure member permissions are properly initialized

## Implementation Steps

### Phase 1: Investigation

1. **Analyze Dev Quick Login Code**
   - Examine `/api/auth/dev-login` or equivalent implementation
   - Compare Test Member vs Test Admin/Test Player handling
   - Check for any member-specific configuration issues

2. **Review Session Setup**
   - Check how member role is configured in seed data
   - Verify member permissions are properly assigned
   - Examine organization membership setup for test member

3. **Test Current Behavior**
   - Run isolated tests with only member authentication
   - Check browser console for member-specific errors
   - Examine network requests during member login

### Phase 2: Fix Implementation

1. **Session Configuration Fix**
   - Ensure Test Member has proper organization membership
   - Verify all required permissions are assigned
   - Check session object structure matches expectations

2. **Authentication Flow Fix**
   - Add proper wait conditions for member authentication
   - Ensure member auth redirect/reload happens correctly
   - Fix any member-specific authentication timing issues

3. **Test Helper Updates**
   - Update auth helpers to handle member auth consistently
   - Add member-specific wait conditions if needed
   - Ensure proper session verification for member role

### Phase 3: Validation

1. **Isolated Testing**
   - Run member auth tests in isolation to verify fixes
   - Test member authentication multiple times for consistency
   - Verify member permissions work correctly after auth

2. **Integration Testing**
   - Run full auth-flow.spec.ts to ensure no regressions
   - Test member-specific features work properly
   - Verify member auth doesn't affect other test roles

## Success Criteria

- [ ] Test Member authentication succeeds consistently (100% success rate)
- [ ] Member auth tests pass reliably in CI environment
- [ ] Member authentication time is comparable to other roles
- [ ] Member-specific permissions work correctly after authentication
- [ ] No regressions in Test Admin or Test Player authentication
- [ ] All tests in `auth-flow.spec.ts` pass consistently

## Expected Files to Modify

- `src/app/api/auth/dev-login/route.ts` (or equivalent)
- `prisma/seed-development.ts` (member setup)
- `e2e/helpers/auth.ts` (helper functions)
- `e2e/helpers/unified-dashboard.ts` (member-specific helpers)
- `e2e/auth-flow.spec.ts` (test adjustments if needed)

## Testing Strategy

1. **Before Changes**: Document current failure rate and specific error patterns
2. **During Implementation**: Test each change with isolated member auth tests
3. **After Changes**: Run comprehensive auth test suite 10+ times to verify consistency

## References

- **Authentication Architecture**: `docs/architecture/permission-system.md`
- **Dev Login Implementation**: `src/app/api/auth/dev-login/`
- **Seed Data**: `prisma/seed-development.ts`
- **Test Helpers**: `e2e/helpers/auth.ts`
- **Auth Flow Tests**: `e2e/auth-flow.spec.ts:80-105`

## Context from Previous Analysis

From the e2e test cleanup session, the specific issue was identified as:

- Member authentication inconsistency compared to admin authentication
- Tests expecting member auth to work like admin auth but with different permission levels
- Possible timing or session setup differences for member role

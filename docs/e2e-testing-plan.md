# PinPoint E2E Testing Implementation Plan

This document outlines the comprehensive plan for implementing End-to-End (E2E) tests that cover all Critical User Journeys (CUJs) defined in the Beta release scope.

## Overview

Our E2E testing strategy focuses on validating the complete user workflows defined in `docs/design-docs/cujs-list.md`, ensuring that all user roles can successfully complete their key tasks within the PinPoint application.

## Current State Analysis

### ✅ Working
- Basic auth flow tests (with minor selector issues)
- Playwright configuration with multiple browsers
- Dev quick login authentication helpers

### 🔧 Needs Fixing
- Auth flow test selectors (case sensitivity issues)
- Session persistence validation
- Permission-based navigation testing

### ❌ Missing
- Core CUJ flows from design docs
- Issue reporting workflows
- Location and machine management flows
- Role-specific permission validation

## Implementation Phases

### Phase 1: Fix Current Auth Flow Tests (IMMEDIATE)

**Goal**: Make all existing authentication tests pass reliably

**Tasks**:
1. **Fix Selector Issues**:
   - Update login form heading selector (`Welcome to PinPoint` casing)
   - Fix navigation link selectors (`link:has-text("PinPoint")`)
   - Correct logout menuitem selector timing
   - Add proper wait conditions for dynamic content loading

2. **Enhance Test Coverage**:
   - Session persistence across page reloads
   - Permission-based navigation restrictions
   - User information display verification
   - Cross-browser compatibility

3. **Validation**:
   - All tests in `auth-flow.spec.ts` must pass
   - No flaky tests or timing issues
   - Clear test output and failure reporting

**Acceptance Criteria**: 
- `npx playwright test auth-flow.spec.ts` passes 100%
- Tests are stable across multiple runs
- All user roles (Admin, Member, Player) auth flows work

### Phase 2: Implement Beta CUJs (CORE FOCUS)

**Goal**: Cover all Critical User Journeys from the Beta scope

#### 2.1 Anonymous/Public User Journeys (CUJ 1.x)

**File**: `e2e/qr-code-flow.spec.ts`
- **CUJ 1.1**: QR code discovery → Issue detail → Report new issue
- **CUJ 1.4**: Duplicate issue reporting handling
- Photo attachment capabilities
- Anonymous vs authenticated flow differences

**File**: `e2e/location-browsing.spec.ts`
- **CUJ 1.2**: Homepage → Location selection → Machine browsing
- **CUJ 1.3**: Machine filtering and text search
- Mobile responsive design validation

**File**: `e2e/registration-flow.spec.ts`
- **CUJ 1.5**: New user registration and login
- Email magic link workflow
- Google OAuth integration
- First-time user onboarding

#### 2.2 Authenticated Member Journeys (CUJ 2.x)

**File**: `e2e/member-issue-flow.spec.ts`
- **CUJ 2.1**: Authenticated issue reporting with identity attachment
- **CUJ 2.2**: Profile management and avatar updates
- Issue tracking and status monitoring

#### 2.3 Machine Owner Journeys (CUJ 3.x)

**File**: `e2e/machine-owner-flow.spec.ts`
- **CUJ 3.1**: Viewing owned machines list
- **CUJ 3.2**: Notification preferences management  
- **CUJ 3.3**: Machine issue history review

#### 2.4 Technician Journeys (CUJ 4.x)

**File**: `e2e/technician-triage.spec.ts`
- **CUJ 4.1**: Daily triage - filtering "New" issues
- **CUJ 4.2**: Acknowledge/close invalid or duplicate issues
- **CUJ 4.3**: Complete issue lifecycle management
- **CUJ 4.4**: Merge duplicate issues workflow

#### 2.5 Admin Journeys (CUJ 5.x)

**File**: `e2e/admin-location-management.spec.ts`
- **CUJ 5.1**: Onboard new physical locations
- **CUJ 5.2**: Add machines (OPDB search + custom titles)
- **CUJ 5.3**: Assign machine owners
- **CUJ 5.4**: Generate and download QR codes

**File**: `e2e/admin-user-management.spec.ts`
- **CUJ 5.5**: User role management (promote Member → Technician)
- **CUJ 5.6**: Photo upload permission configuration
- User removal and access control

### Phase 3: Enhance Existing Tests

**Goal**: Complete the existing issue detail test coverage

**Tasks**:
1. **Update Issue Detail Tests** (`issue-detail-*.spec.ts`):
   - Replace placeholder data-testid selectors with actual UI elements
   - Enable fixme'd tests one by one based on current UI implementation
   - Add proper tRPC mocking for loading states and error handling

2. **Cross-Role Permission Testing**:
   - Verify UI elements visible/hidden based on user permissions
   - Test role-specific action availability
   - Validate permission error handling

### Phase 4: Test Infrastructure Improvements

**Goal**: Build robust, maintainable E2E test foundation

**Tasks**:
1. **Enhanced Authentication**:
   - Real authentication flow integration (not just session mocking)
   - Multi-tenant/organization support
   - Proper test isolation and cleanup

2. **Test Data Management**:
   - Database seeding utilities for consistent test data
   - Shared test fixtures and factories
   - Automated cleanup between test runs

3. **CI/CD Integration**:
   - Parallel test execution optimization
   - Screenshot/video capture on failures
   - Performance budgets and monitoring
   - Cross-browser testing matrix

## Test Organization Structure

```
e2e/
├── auth-flow.spec.ts                    ✅ (Phase 1)
├── qr-code-flow.spec.ts                 📋 (Phase 2.1)
├── location-browsing.spec.ts            📋 (Phase 2.1)
├── registration-flow.spec.ts            📋 (Phase 2.1)
├── member-issue-flow.spec.ts            📋 (Phase 2.2)
├── machine-owner-flow.spec.ts           📋 (Phase 2.3)
├── technician-triage.spec.ts            📋 (Phase 2.4)
├── admin-location-management.spec.ts    📋 (Phase 2.5)
├── admin-user-management.spec.ts        📋 (Phase 2.5)
├── helpers/
│   ├── auth.ts                          ✅ (Updated)
│   ├── test-data.ts                     📋 (Phase 4)
│   ├── database.ts                      📋 (Phase 4)
│   └── permissions.ts                   📋 (Phase 4)
└── issues/
    ├── issue-detail-public.spec.ts      🔧 (Phase 3)
    ├── issue-detail-permissions.spec.ts 🔧 (Phase 3)
    └── issue-detail-technician.spec.ts  🔧 (Phase 3)
```

## Success Criteria

### Phase 1 Success
- [ ] All auth flow tests pass consistently
- [ ] No flaky or timing-dependent test failures
- [ ] All three user roles (Admin, Member, Player) can authenticate
- [ ] Session persistence works across page reloads
- [ ] Permission-based navigation is properly tested

### Phase 2 Success  
- [ ] All Beta CUJs have corresponding E2E test coverage
- [ ] Tests validate complete user workflows end-to-end
- [ ] Role-specific capabilities are properly tested
- [ ] Error handling and edge cases are covered
- [ ] Mobile responsiveness is validated

### Overall Success
- [ ] 95%+ test pass rate in CI
- [ ] Tests run in under 10 minutes total
- [ ] Clear test failure reporting and debugging
- [ ] Comprehensive coverage of all user-facing features
- [ ] Tests serve as living documentation of system behavior

## Implementation Timeline

- **Week 1**: Phase 1 completion (auth flow fixes)
- **Week 2**: Phase 2.1-2.2 (Anonymous + Member flows) 
- **Week 3**: Phase 2.3-2.4 (Machine Owner + Technician flows)
- **Week 4**: Phase 2.5 (Admin flows)
- **Week 5**: Phase 3 (Enhance existing tests)
- **Week 6**: Phase 4 (Infrastructure improvements)

## Notes

- All tests should use the actual running application (not mocked APIs where possible)
- Tests should be reliable and not dependent on external services
- Each test should be independent and not rely on state from other tests
- Tests should provide clear failure messages and debugging information
- Mobile responsiveness should be tested across different viewport sizes

---

*This document will be updated as implementation progresses and requirements evolve.*
# Task 006: Create E2E Tests for Permission Scenarios

**Priority**: MEDIUM  
**Category**: Testing  
**Status**: Not Started  
**Dependencies**: Tasks 004-005 (implementation)

## Problem

Need comprehensive E2E tests that verify permission enforcement across the entire application. Tests should cover:

- Different user roles accessing same resources
- Permission denial scenarios
- UI state changes based on permissions
- Cross-organization isolation

## Current State

- Some E2E tests exist but don't test permissions
- No systematic permission testing
- Missing multi-user scenarios
- No cross-organization tests

## Solution

Create comprehensive E2E test suite for permissions using Playwright.

## Implementation Steps

### 1. Create Test Helpers

`e2e/helpers/auth.ts`:

```typescript
export async function loginAsAdmin(page: Page) {}
export async function loginAsMember(page: Page) {}
export async function loginAsUnauthenticated(page: Page) {}
export async function switchOrganization(page: Page, orgId: string) {}
```

### 2. Permission Denial Tests

`e2e/permissions/permission-denial.spec.ts`:

- Member tries to access admin functions
- Unauthenticated user tries protected routes
- User from Org A tries to access Org B data

### 3. UI State Tests

`e2e/permissions/ui-states.spec.ts`:

- Buttons disabled for users without permission
- Hidden elements for unauthorized users
- Tooltip messages for permission requirements

### 4. Cross-Organization Tests

`e2e/permissions/multi-tenant.spec.ts`:

- User in multiple organizations
- Switching organization context
- Data isolation verification

### 5. Role-Based Workflows

`e2e/permissions/role-workflows.spec.ts`:

- Admin workflow: Create org → Add users → Assign roles
- Member workflow: View issues → Create/edit own → Can't delete
- Unauthenticated: View public → Report issue → Can't edit

## Test Data Setup

- Create consistent test organizations
- Seed users with different roles
- Create test data for each permission scenario

## Test Development Notes

**Note**: This is a testing task that may be developed incrementally. Focus on:

- Writing one test scenario at a time
- Ensuring each test file passes linting: `npm run lint`
- Building up the test helpers gradually
- Some tests may be skipped initially if features aren't complete

## Success Criteria

- [ ] Test files created for each permission scenario
- [ ] Test helpers implemented
- [ ] Your test code passes linting
- [ ] Tests written for both positive and negative cases
- [ ] Multi-tenant isolation tests written
- [ ] UI state tests written
- [ ] Tests can be run (even if some are skipped)

## References

### Core Documentation

- Core objectives: `task_list/README.md`
- **Roles & Permissions Design**: `docs/design-docs/roles-permissions-design.md`
- **Testing Design**: `docs/design-docs/testing-design-doc.md`

### Architecture Documentation

- **Test Map**: `docs/architecture/test-map.md` - E2E test section
- **Source Map**: `docs/architecture/source-map.md`

### Existing Test Patterns

- E2E test examples: `e2e/`
- Auth test helpers: `e2e/helpers/`
- Test data factories: `src/test/factories/`

### Test Files to Create/Update

- `e2e/permissions/permission-denial.spec.ts`
- `e2e/permissions/ui-states.spec.ts`
- `e2e/permissions/multi-tenant.spec.ts`
- `e2e/permissions/role-workflows.spec.ts`
- `e2e/helpers/auth.ts`
- `e2e/helpers/permissions.ts`

### Key Test Scenarios

1. **Authentication States**: Logged out, Member, Admin
2. **Permission Checks**: View, Create, Edit, Delete for each resource
3. **Organization Boundaries**: Can't access other org's data
4. **UI Consistency**: Disabled states, tooltips, hidden elements
5. **Error Handling**: Permission denial messages

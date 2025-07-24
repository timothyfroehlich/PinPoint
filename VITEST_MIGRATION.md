# Jest to Vitest Migration Plan

## Overview

This worktree contains the migration from Jest to Vitest for the PinPoint codebase. Vitest offers better ESM support, faster execution, and better integration with Vite-based tooling.

## Why Vitest?

1. **Native ESM Support**: Better handling of ES modules without complex configuration
2. **Faster Execution**: Runs tests in parallel by default, with better performance
3. **Better TypeScript Support**: First-class TypeScript support without ts-jest
4. **Vite Integration**: If we move to Vite in the future, tests will be ready
5. **Jest Compatibility**: Most Jest APIs work out of the box

## Current Jest Setup Analysis

### Configuration Files
- `jest.config.js` - Main Jest configuration with two projects (node, jsdom)
- `src/test/setup.ts` - Test setup file
- Multiple test utilities in `src/test/`

### Dependencies to Replace
- `jest` → `vitest`
- `ts-jest` → (built into Vitest)
- `jest-environment-jsdom` → `@vitest/environment-jsdom`
- `jest-fixed-jsdom` → `@vitest/environment-jsdom`
- `jest-mock-extended` → `vitest-mock-extended` or native Vitest mocks
- `@testing-library/jest-dom` → `@testing-library/jest-dom/vitest`

### Test Patterns
- Server tests: `src/server/**/__tests__/**/*.test.{js,ts}`
- Component tests: `src/components/**/__tests__/**/*.test.{js,ts,tsx}`
- App tests: `src/app/**/__tests__/**/*.test.{js,ts,tsx}`
- Hook tests: `src/hooks/**/__tests__/**/*.test.{js,ts,tsx}`

## Migration Steps

### Phase 1: Setup Vitest Infrastructure
1. Install Vitest and related dependencies
2. Create `vitest.config.ts` with equivalent configuration
3. Update test setup files for Vitest
4. Create helper scripts for gradual migration

### Phase 2: Migrate Test Files
1. Start with utility/helper test files (lowest risk)
2. Migrate server-side tests (Node environment)
3. Migrate component tests (jsdom environment)
4. Update mock patterns to Vitest equivalents

### Phase 3: Update Tooling
1. Update package.json scripts
2. Update CI/CD pipelines
3. Update coverage configuration
4. Remove Jest dependencies

### Phase 4: Validation
1. Ensure all tests pass
2. Verify coverage reports match
3. Check CI performance improvements
4. Document any behavioral differences

## Key Differences to Handle

### Import Statements
```typescript
// Jest
import { describe, it, expect, beforeEach } from "@jest/globals";

// Vitest
import { describe, it, expect, beforeEach } from "vitest";
```

### Mocking
```typescript
// Jest
jest.mock("~/trpc/react");

// Vitest
vi.mock("~/trpc/react");
```

### Configuration
- Jest uses `transformIgnorePatterns`
- Vitest uses `server.deps.external` and `server.deps.inline`

## Success Criteria

1. All tests pass with same or better coverage
2. Test execution time reduced by at least 30%
3. No breaking changes to test behavior
4. Simplified configuration
5. Better ESM module handling

## Risks and Mitigation

1. **Risk**: Some Jest-specific features might not have direct equivalents
   - **Mitigation**: Document workarounds or alternative patterns

2. **Risk**: Third-party testing utilities might not support Vitest
   - **Mitigation**: Check compatibility before migration, find alternatives

3. **Risk**: CI/CD pipeline failures
   - **Mitigation**: Test in separate branch, gradual rollout

## Timeline Estimate

- Phase 1: 2-3 hours (setup and configuration)
- Phase 2: 4-6 hours (test file migration)
- Phase 3: 1-2 hours (tooling updates)
- Phase 4: 2-3 hours (validation and fixes)

Total: 1-2 days of focused work

## Current Test File Analysis

### Migration Status Summary
- **Total test files**: 47
- **Already migrated to Vitest**: 11 files
- **Still using Jest (need migration)**: 36 files

### Vitest Files (✅ Already Migrated)
```
src/app/dashboard/_components/__tests__/PrimaryAppBar.vitest.test.tsx
src/lib/opdb/__tests__/utils.vitest.test.ts
src/server/api/__tests__/msw-trpc-validation.vitest.test.ts
src/server/api/__tests__/trpc-auth-modern.vitest.test.ts
src/server/auth/__tests__/auth-simple.vitest.test.ts
src/server/auth/__tests__/config.vitest.test.ts
src/server/auth/__tests__/permissions.constants.vitest.test.ts
src/server/auth/__tests__/permissions.vitest.test.ts
src/server/db/__tests__/provider.vitest.test.ts
src/server/services/__tests__/factory.vitest.test.ts
src/server/services/__tests__/pinballmapService.vitest.test.ts
```

### Jest Files Requiring Migration

#### Frontend/Component Tests (10 files)
```
src/app/api/dev/__tests__/users-simple.test.ts
src/app/api/dev/__tests__/users.test.ts
src/app/dashboard/_components/__tests__/PrimaryAppBar.test.tsx
src/app/issues/__tests__/page.test.tsx
src/_archived_frontend/_components/dev/__tests__/dev-login-compact.test.tsx
src/_archived_frontend/hooks/__tests__/auth-integration.test.ts
src/_archived_frontend/hooks/__tests__/use-current-user.test.ts
src/components/permissions/__tests__/PermissionButton.test.tsx
src/components/permissions/__tests__/PermissionGate.test.tsx
src/hooks/__tests__/usePermissions.test.tsx
```

#### Server Tests (22 files)
```
src/server/api/routers/__tests__/collection.test.ts
src/server/api/routers/__tests__/integration.test.ts
src/server/api/routers/__tests__/issue-confirmation.test.ts
src/server/api/routers/__tests__/issue.notification.test.ts
src/server/api/routers/__tests__/issue.test.ts
src/server/api/routers/__tests__/notification.test.ts
src/server/api/routers/__tests__/pinballmap-integration.test.ts
src/server/api/routers/__tests__/role.test.ts
src/server/api/__tests__/multi-tenant-security.test.ts
src/server/api/__tests__/trpc-auth.test.ts
src/server/api/__tests__/trpc.permission.test.ts
src/server/auth/__tests__/auth-simple.test.ts
src/server/auth/__tests__/config.test.ts
src/server/auth/__tests__/permissions.constants.test.ts
src/server/auth/__tests__/permissions.test.ts
src/server/db/__tests__/provider.test.ts
src/server/services/__tests__/collectionService.test.ts
src/server/services/__tests__/factory.test.ts
src/server/services/__tests__/notificationPreferences.test.ts
src/server/services/__tests__/notificationService.test.ts
src/server/services/__tests__/permissionService.expandDependencies.test.ts
src/server/services/__tests__/pinballmapService.test.ts
```

#### Library/Utility Tests (3 files)
```
src/lib/opdb/__tests__/utils.test.ts
src/lib/permissions/__tests__/descriptions.test.ts
src/lib/pinballmap/__tests__/client.test.ts
```

#### Integration Tests (1 file)
```
src/integration-tests/notification.schema.test.ts
```

### Migration Priority
1. **High Priority - Server Tests**: Critical business logic, easier to migrate (no DOM dependencies)
2. **Medium Priority - Library/Utility Tests**: Pure functions, straightforward migration
3. **Medium Priority - Integration Tests**: Database tests, need careful handling
4. **Lower Priority - Frontend/Component Tests**: May have complex DOM/React dependencies

## Notes

- Keep both Jest and Vitest configs during migration
- Run both test suites in parallel to verify compatibility
- Document any workarounds needed for specific patterns
- Several files already have Vitest equivalents (e.g., `*.vitest.test.ts` alongside `*.test.ts`)
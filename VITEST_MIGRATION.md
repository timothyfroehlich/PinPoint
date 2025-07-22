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

## Notes

- Keep both Jest and Vitest configs during migration
- Run both test suites in parallel to verify compatibility
- Document any workarounds needed for specific patterns
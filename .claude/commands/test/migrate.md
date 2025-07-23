---
description: Migrate a Jest test to Vitest with best practices
allowed-tools: all
argument-hint: "<test-file-path> - Jest test file to migrate"
---

# Jest to Vitest Migration

Migrating test file: $ARGUMENTS

## Migration Checklist

@docs/testing/migration-guide.md
@docs/testing/migration-examples.md
@docs/testing/troubleshooting.md
@vitest-migration-tasks/README.md

## Step-by-Step Process

1. **Copy test file**
   ```bash
   ! cp $ARGUMENTS ${ARGUMENTS%.test.ts}.vitest.test.ts
   ```

2. **Update imports**
   - `@jest/globals` → `vitest`
   - `jest.fn()` → `vi.fn()`
   - `jest.mock()` → `vi.mock()`

3. **Add transitive mocks** (Vitest requires explicit mocking)
   - Run test, see what fails
   - Add mocks iteratively
   - Consider DI refactoring if >5 dependencies

4. **Handle special cases**
   - `vi.hoisted()` for variable hoisting
   - AcceleratePromise mocking patterns
   - MSW-tRPC setup if needed

5. **Validate migration**
   ```bash
   ! npm run test:vitest ${ARGUMENTS%.test.ts}.vitest.test.ts
   ```

6. **Document the migration**
   Create a migration report at: @docs/testing/migration-reports/
   
   File name format: `YYYY-MM-DD-filename.md`
   
   Template:
   ```markdown
   # Migration Report: [Test File Name]
   
   **Date**: YYYY-MM-DD  
   **Original File**: `$ARGUMENTS`  
   **Migrated File**: `${ARGUMENTS%.test.ts}.vitest.test.ts`  
   
   ## Summary
   - **Test Count**: X tests
   - **Test Types**: [unit/integration/component]
   - **Migration Time**: X minutes
   - **Complexity**: [Easy/Medium/Complex]
   
   ## Performance Results
   - **Jest**: Xms
   - **Vitest**: Xms  
   - **Improvement**: Xx faster
   
   ## Changes Made
   
   ### 1. Basic Updates
   - [ ] Updated imports to Vitest
   - [ ] Replaced Jest globals (jest.fn → vi.fn)
   - [ ] Added vi.clearAllMocks() to beforeEach
   
   ### 2. Mocking Changes
   - List specific mocks added
   - Transitive dependencies mocked
   - Any vi.hoisted() usage
   
   ### 3. Special Patterns
   - AcceleratePromise handling?
   - MSW setup?
   - React component patterns?
   
   ## Challenges & Solutions
   
   ### Challenge 1: [Description]
   **Solution**: [How it was resolved]
   
   ## Patterns Discovered
   - New mocking patterns
   - Reusable solutions
   - Architecture insights
   
   ## Lessons Learned
   - Key takeaways for future migrations
   - Recommendations for similar tests
   ```

## Decision: Mock vs Refactor

**Just Mock if**:
- < 3 dependencies
- Pure functions
- Time-sensitive

**Refactor to DI if**:
- 5+ transitive deps
- Mock setup > test logic
- Core business logic

See real examples in testing/migration-examples.md!
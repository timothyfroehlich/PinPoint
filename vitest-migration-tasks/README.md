# Vitest Migration Tasks

## Overview

This directory contains the tasks for migrating PinPoint from Jest to Vitest. The migration is designed to be done incrementally to minimize risk.

## Migration Approach

We're taking a **parallel migration** approach:
1. Set up Vitest alongside Jest
2. Migrate test files incrementally
3. Run both test suites during migration
4. Remove Jest once all tests are migrated

## Task List

### Phase 1: Infrastructure Setup
- **[TASK-001](TASK-001-setup-vitest.md)**: Setup Vitest Infrastructure ⏳

### Phase 2: Test Migration (To be created)
- **TASK-002**: Migrate Utility and Helper Tests
- **TASK-003**: Migrate Server-Side Tests
- **TASK-004**: Migrate Component Tests
- **TASK-005**: Migrate App Tests

### Phase 3: Cleanup (To be created)
- **TASK-006**: Update CI/CD Configuration
- **TASK-007**: Remove Jest Dependencies
- **TASK-008**: Performance Validation

## Quick Start

1. Switch to the vitest worktree:
   ```bash
   cd /home/froeht/Code/PinPoint-worktrees/jest-to-vitest
   ```

2. Start with TASK-001 to set up Vitest

3. Use the migration script for individual files:
   ```bash
   npm run migrate:test path/to/test.spec.ts
   ```

4. Run both test suites to verify:
   ```bash
   npm test          # Jest
   npm run test:vitest  # Vitest
   ```

## Benefits of Migration

1. **Performance**: Vitest runs tests in parallel by default
2. **ESM Support**: Better native ES modules handling
3. **TypeScript**: No need for ts-jest, native TS support
4. **Developer Experience**: Faster watch mode, better error messages
5. **Future-Proof**: Better integration with modern tooling

## Current Jest Analysis

- **Test Files**: ~60 test files across the codebase
- **Environments**: Node (server) and jsdom (client)
- **Dependencies**: jest, ts-jest, jest-environment-jsdom, jest-fixed-jsdom
- **Complex Config**: ESM setup with transformIgnorePatterns
- **Test Patterns**: Standard Jest patterns with describe/it/expect

## Success Metrics

- [ ] All tests pass in Vitest
- [ ] Test execution time reduced by 30%+
- [ ] Coverage remains the same or improves
- [ ] No behavioral changes in tests
- [ ] CI/CD pipeline updated successfully

## Risk Mitigation

1. **Parallel Running**: Keep Jest working during migration
2. **Incremental Migration**: Start with low-risk utility tests
3. **Automated Conversion**: Use migration script for consistency
4. **Verification**: Run both test suites to compare results
5. **Rollback Plan**: Git worktree allows easy rollback

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Migrating from Jest](https://vitest.dev/guide/migration.html)
- [Vitest Configuration](https://vitest.dev/config/)
- [Jest Compatibility](https://vitest.dev/guide/migration.html#jest)
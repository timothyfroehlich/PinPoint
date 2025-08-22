# Phase 3: Integration Tests & Remaining Issues

## Scope

Focus on integration tests and any remaining eslint-disable comments.

## Goals

- Remove eslint-disable comments from integration tests
- Fix remaining non-null assertions in test files
- Address any remaining TypeScript issues
- Ensure all tests pass with strict typing

## Files to Address

1. `src/integration-tests/role.integration.test.ts` - Remove non-null assertions
2. `src/server/auth/__tests__/uploadAuth.test.ts` - Fix void expression issues
3. Any remaining files with eslint-disable comments
4. Review and fix any TODO comments that represent type safety issues

## Success Criteria

- All integration tests pass with strict TypeScript
- No eslint-disable comments remain in test files
- Non-null assertions replaced with proper error handling
- Test code is type-safe and maintainable

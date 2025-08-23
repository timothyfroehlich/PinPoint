# Phase 2: Test Infrastructure TypeScript Fixes

## Scope

Focus on test utilities, factories, and shared test infrastructure.

## Goals

- Create shared type definitions to replace `any` usage
- Update test factories with proper typing
- Remove eslint-disable comments from test utilities
- Maintain test flexibility while adding type safety

## Files to Address

1. Create `src/types/` directory with shared interfaces
2. `src/test/testDataFactories.ts` - Replace any types with proper interfaces
3. `src/test/factories/roleFactory.ts` - Add return type annotations
4. `src/test/VitestTestWrapper.tsx` - Replace any types in test components
5. `src/test/msw/handlers.ts` - Add return type annotations
6. `src/test/helpers/worker-scoped-db.ts` - Remove non-null assertions
7. `src/test/seed-data-helpers.ts` - Add return types and fix null checks

## New Type Files

- `src/types/factory.ts` - Factory interfaces and utility types
- `src/types/test-helpers.ts` - Test utility interfaces
- `src/types/database.ts` - Database type re-exports

## Success Criteria

- All test factories use proper TypeScript interfaces
- No `any` types in test infrastructure
- Tests continue to pass with improved type safety
- Shared types are reusable across test files

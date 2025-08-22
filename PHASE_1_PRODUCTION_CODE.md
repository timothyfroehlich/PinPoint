# Phase 1: Production Code TypeScript & ESLint Fixes

## Scope

Focus on `src/` production code only, excluding test files and utilities.

## Goals

- Remove all eslint-disable comments from production code
- Add explicit return type annotations to all functions
- Replace `any` types with proper interfaces
- Fix Playwright configuration error

## Files to Address

1. `src/lib/supabase/server.ts` - Remove no-unnecessary-condition disable
2. `src/lib/supabase/rls-helpers.ts` - Remove no-unnecessary-condition disable
3. `src/lib/supabase/multi-tenant-client.ts` - Remove no-unnecessary-condition disable
4. `src/lib/env-loaders/development.ts` - Fix environment variable handling
5. `src/lib/env-loaders/production.ts` - Fix environment variable handling
6. `src/server/api/routers/utils/commentService.ts` - Remove non-null assertions
7. `src/server/api/routers/utils/commentValidation.ts` - Remove non-null assertions
8. `src/server/api/routers/issue.status.ts` - Fix object injection warnings
9. `src/server/db/drizzle.ts` - Add return type annotation
10. `playwright.config.ts` - Fix module resolution error

## Success Criteria

- All production code files have no eslint-disable comments
- TypeScript compilation passes with no errors
- Playwright diagnostics work correctly
- No regression in existing functionality

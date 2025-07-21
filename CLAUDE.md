# PinPoint Development Instructions

## Tech Stack

- **Framework**: Next.js + React + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: NextAuth.js (Auth.js v5)
- **UI**: Material UI (MUI)
- **API**: tRPC
- **Deployment**: Vercel

## Core Architecture

### Multi-Tenancy

- Shared database with row-level security
- All tenant tables require non-nullable `organization_id`
- Strict query scoping by `organization_id`
- Global users with organization-specific memberships

### Key Entities

- **Organization**: Top-level tenant (e.g., "Austin Pinball Collective")
- **Location**: Physical venue belonging to an Organization
- **Game Title**: Generic machine model (e.g., "Godzilla Premium")
- **Game Instance**: Specific physical machine at a Location
- **Issue**: Problem/task for a Game Instance
- **User**: Global account; **Member**: User + Organization + Role

## Essential Commands

```bash
# Development (RECOMMENDED)
npm run dev:full        # Start all services with monitoring
npm run dev:clean       # Fresh start with cleanup
npm run setup:worktree  # Setup new worktree environment

# Agent Validation Protocol (MANDATORY)
npm run quick:agent        # Development checks + auto-fix (after code changes)
npm run validate:agent     # Pre-commit validation + auto-fix (MUST PASS)
npm run validate:full:agent # Pre-PR validation (MUST PASS)

# Legacy Commands (Still Available)
npm run validate        # Standard validation
npm run pre-commit      # Full validation + workflow check + build test

# Database
npm run db:reset
npm run db:push

# Quick Fixes & Debug
npm run fix             # Auto-fix lint + format issues
npm run debug:typecheck # Full TypeScript output
npm run debug:test      # Verbose test output
npm run debug:lint      # Detailed lint output

# Testing
npm run test:coverage

# File-Specific TypeScript Checking (NEW)
npm run typecheck:files -- src/specific/file.ts   # Check specific files
npm run typecheck:routes                          # Check route files only
npm run typecheck:tests                           # Check test files only
npm run typecheck:changed                         # Check git-modified files

# Advanced TypeScript Scripts (Auto-Approved)
./scripts/typecheck-files.sh [--lines N] src/**/*.ts     # Direct bash script (default: 10 lines)
./scripts/typecheck-grep.sh [--lines N] "pattern" [files] # Type check + grep filter (default: 5 lines)
# Examples:
#   ./scripts/typecheck-files.sh --lines 20 src/app/api/**/*.ts
#   ./scripts/typecheck-grep.sh -l 0 "multi-tenant" # Show all matching errors
#   ./scripts/typecheck-grep.sh --lines 3 "route\.ts" # Show only 3 errors
# Note: These scripts use `npx tsc --noEmit` and are auto-approved for faster execution
```

## Quality Standards (Zero Tolerance)

- **0 TypeScript errors** - Fix immediately, never commit with TS errors
- **0 usage of `any`**: Never use an `any` type, even in test code. If you don't know the type then go look for it.
- **0 ESLint errors** - Warnings acceptable with justification
- **Strict type-aware linting** - Project uses `@tsconfig/strictest` + type-aware ESLint rules to enforce type safety
- **Consistent formatting** - Auto-formatted with Prettier
- **Modern patterns** - ES modules, typed mocks (`jest.fn<T>()`), no `any` types
- **Test quality** - Same standards as production code
- **Coverage thresholds** - 50% global, 60% server/, 70% lib/ (configured in jest.config.js)

## TypeScript Strictest Mode Guidelines

### Key Patterns for `@tsconfig/strictest` Compliance

1. **Optional Properties (`exactOptionalPropertyTypes`)**

   ```typescript
   // ❌ Bad: undefined not assignable to optional
   const data: { prop?: string } = { prop: value || undefined };

   // ✅ Good: Use conditional assignment
   const data: { prop?: string } = {};
   if (value) data.prop = value;

   // ✅ Alternative: Object spread with filter
   const data = { ...otherProps, ...(value && { prop: value }) };
   ```

2. **Null Checks (`strictNullChecks`)**

   ```typescript
   // ❌ Bad: Object possibly null
   const id = ctx.session.user.id;

   // ✅ Good: Guard with optional chaining
   if (!ctx.session?.user?.id) throw new Error("Not authenticated");
   const id = ctx.session.user.id;
   ```

3. **Array Access (`noUncheckedIndexedAccess`)**

   ```typescript
   // ❌ Bad: Array access without bounds check
   const first = items[0].name;

   // ✅ Good: Safe array access
   const first = items[0]?.name ?? "Unknown";
   const first = items.at(0)?.name ?? "Unknown";
   ```

4. **Type Assertions**

   ```typescript
   // ❌ Bad: Avoid 'as' casting
   const mock = jest.fn() as jest.Mock<any>;

   // ✅ Good: Use proper generics
   const mock = jest.fn<ReturnType, [Parameters]>();
   ```

5. **Never Use 'any' Type**

   ```typescript
   // ❌ Bad: Using any defeats type safety
   const data: any = await someApi();

   // ✅ Good: Find or define the real type
   const data: UserResponse = await userApi.get();

   // ✅ Good: Use unknown for truly unknown data
   const data: unknown = JSON.parse(str);
   if (isUserData(data)) {
     /* now typed */
   }
   ```

6. **Prisma Mocks (with $accelerate)**
   ```typescript
   // ✅ ExtendedPrismaClient includes $accelerate
   const mockPrisma = {
     user: { findUnique: jest.fn() },
     $accelerate: {
       invalidate: jest.fn(),
       invalidateAll: jest.fn(),
     },
   };
   ```

### Critical Do's and Don'ts

**✅ ALWAYS:**

- Use `@ts-expect-error` with descriptive comments (never `@ts-ignore`)
- Handle null/undefined before property access
- Use type guards instead of assertions
- Check array bounds or use optional chaining
- Find real types instead of using `any`

**❌ NEVER:**

- Use `@ts-ignore` (banned by ESLint)
- Assign `undefined` to optional properties
- Access array elements without bounds checking
- Use `any` type (even in tests)
- Skip null checks in protected procedures

**Remember**: Betterer tracks all TypeScript errors - no new errors allowed in production code!

## Development Workflow

1. **Start**: `npm run validate` → `npm run dev:full`
2. **During**: Run `npm run quick:agent` after significant code changes
3. **Before commit**: `npm run validate:agent` must pass (MANDATORY)
4. **Before PR**: `npm run validate:full:agent` must pass (MANDATORY)
5. **Database changes**: Use `npm run db:reset` (pre-production phase)

### Agent Protocol Benefits

- **Context preservation**: ~3-5 lines output vs 100+ lines
- **Auto-fix capability**: Automatically fixes lint/format issues
- **Early detection**: Catch issues during development, not CI
- **Consistent format**: ✓ Success messages, ✗ Error summaries

## Architecture Principles

- **TypeScript First**: Strict typing, no unsafe operations
- **Optimistic UI**: Immediate updates, background API calls, revert on failure
- **Future-Ready**: Design for Kanban board (post-1.0) and inventory (v2.0)
- **Testing**: Unit tests with mocked dependencies only - database tests require exceptional justification

## MCP Tools Available

- **GitHub**: Repository management, PRs, issues
- **Playwright**: Browser automation, E2E testing
- **Context7**: Library documentation lookup

## Developer Guides

For detailed guidance beyond these essentials:

- **TypeScript Issues**: See `docs/developer-guides/typescript-strictest.md` for comprehensive error resolution
- **Testing Patterns**: See `docs/developer-guides/testing-patterns.md` for Jest mocking and coverage patterns
- **ESLint Errors**: See `docs/developer-guides/common-errors.md` for specific rule violations and fixes
- **Betterer Workflow**: See `docs/developer-guides/betterer-workflow.md` for migration workflow and team coordination
- **Migration Progress**: See `TYPESCRIPT_MIGRATION.md` for current status and tracking
- **Script Usage**: See `scripts/README.md` for TypeScript analysis tools

## Repository

- **Repo**: timothyfroehlich/PinPoint
- **Troubleshooting**: See `docs/troubleshooting.md` (environment) or `docs/developer-guides/troubleshooting.md` (development)
- **Design Docs**: Available in Notion workspace (`/PinPoint/`)
- **Protected Main**: Never commit to main, all changes require PRs.

## Critical Notes

- Database strategy in development: sessions clear on `db:reset`
- Pre-production: frequent schema changes, no migrations
- OPDB games: global (no organizationId), custom games: organization-scoped
- **ESM modules**: Project uses `"type": "module"` - some packages (superjson, @auth/prisma-adapter) are ESM-only and may need transformIgnorePatterns updates in Jest
- **Jest ESM**: Current config uses `ts-jest/presets/default-esm` - avoid changing without understanding ESM implications
- **Type Safety**: Project enforces strictest TypeScript + type-aware ESLint rules. All `@typescript-eslint/no-unsafe-*` and `no-explicit-any` violations must be fixed
- **TypeScript Migration**: ✅ Production code is 100% strict mode compliant! Test files being cleaned up incrementally
- **Migration Tracking**: See `TYPESCRIPT_MIGRATION.md` for patterns and progress. Betterer prevents regressions

## Frontend Development Notes

- **MUI Version**: Currently using MUI v7.2.0 - always check Context7 for latest MUI documentation before making changes
- **Grid Components**: In MUI v7, use `import Grid from "@mui/material/Grid"` and `size={{ xs: 12, lg: 8 }}` syntax (no `item` prop needed)

## Development Practices

- **ESLint Disabling**: NEVER add an eslint-disable unless you have exhausted all other options and confirmed with the user that it is the correct thing to do.

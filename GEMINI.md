# PinPoint Development Instructions

## Tech Stack

- **Framework**: Next.js + React + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: NextAuth.js (Auth.js v5)
- **UI**: Material UI (MUI)
- **API**: tRPC (exclusive - no custom API routes)
- **Deployment**: Vercel

## Core Architecture

### API Strategy

PinPoint uses **tRPC exclusively** for all application endpoints. Traditional API routes are only used for:

- Authentication handlers (NextAuth requirement)
- Health checks (monitoring requirement)
- QR code redirects (HTTP redirect requirement)
- Development utilities (dev environment only)

See `docs/architecture/api-routes.md` for details on legitimate exceptions.

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
npm run quick        # Development checks + auto-fix (after code changes)
npm run validate     # Pre-commit validation + auto-fix (MUST PASS)
npm run validate:full:agent # Pre-PR validation (MUST PASS)

# Legacy Commands (Removed - Use Agent Commands Instead)
# npm run validate      # REMOVED - use validate
# npm run pre-commit    # REMOVED - use validate

# Database
npm run db:reset:local:sb
npm run db:push:local

# Quick Fixes & Debug
npm run fix             # Auto-fix lint + format issues
npm run debug:test      # Verbose test output
npm run debug:lint      # Detailed lint output

# Testing
npm run test:coverage

# TypeScript Error Filtering
npm run typecheck                                 # Check entire project (recommended)
npm run typecheck | grep "pattern"               # Filter errors by pattern
npm run typecheck | head -10                     # Show first 10 errors
npm run typecheck | grep "usePermissions"        # Find specific function errors
```

## Multi-Config TypeScript Strategy

PinPoint uses a tiered TypeScript configuration system for different code contexts, balancing strict production standards with pragmatic testing needs.

### Configuration Files

1. **`tsconfig.base.json`** - Common settings (paths, module resolution, Next.js plugins)
2. **`tsconfig.json`** - Production code (extends base + @tsconfig/strictest)
3. **`tsconfig.test-utils.json`** - Test utilities (extends base + @tsconfig/recommended)
4. **`tsconfig.tests.json`** - Test files (extends base with relaxed settings)

### TypeScript Standards by Context

#### Production Code (`src/**/*.ts` excluding tests)

- **Config**: `tsconfig.json` (strictest mode)
- **Standards**: **Zero tolerance** - all TypeScript errors must be fixed
- **ESLint**: Strict type-safety rules at error level
- **Coverage**: 50% global, 60% server/, 70% lib/

#### Test Utilities (`src/test/**/*.ts`)

- **Config**: `tsconfig.test-utils.json` (recommended mode)
- **Standards**: Moderate - allows practical testing patterns
- **ESLint**: Type-safety rules at warning level

#### Test Files (`**/*.test.ts`, `**/*.vitest.test.ts`)

- **Config**: `tsconfig.tests.json` (relaxed mode)
- **Standards**: Pragmatic - allows `any` types and unsafe operations for testing
- **ESLint**: Type-safety rules disabled

## Quality Standards

- **Production Code**: Zero TypeScript errors, zero `any` usage, strict ESLint
- **Test Utilities**: Moderate standards, warnings acceptable
- **Test Files**: Relaxed standards, pragmatic patterns allowed
- **Consistent formatting** - Auto-formatted with Prettier
- **Modern patterns** - ES modules, proper TypeScript throughout

## TypeScript Patterns for Production Code

### Key Patterns for `@tsconfig/strictest` Compliance (Production Only)

Production code must follow strictest TypeScript patterns. Test files can use pragmatic patterns.

1. **Optional Properties (`exactOptionalPropertyTypes`)**

   ```typescript
   // ❌ Production: undefined not assignable to optional
   const data: { prop?: string } = { prop: value || undefined };

   // ✅ Production: Use conditional assignment
   const data: { prop?: string } = {};
   if (value) data.prop = value;

   // ✅ Tests: Relaxed patterns allowed
   const testData: any = { prop: value || undefined }; // OK in tests
   ```

2. **Null Checks (`strictNullChecks`)**

   ```typescript
   // ❌ Production: Object possibly null
   const id = ctx.session.user.id;

   // ✅ Production: Guard with optional chaining
   if (!ctx.session?.user?.id) throw new Error("Not authenticated");
   const id = ctx.session.user.id;

   // ✅ Tests: Can use non-null assertions for mocks
   const id = mockSession.user!.id; // OK in tests
   ```

3. **Array Access (`noUncheckedIndexedAccess`)**

   ```typescript
   // ❌ Production: Array access without bounds check
   const first = items[0].name;

   // ✅ Production: Safe array access
   const first = items[0]?.name ?? "Unknown";

   // ✅ Tests: Direct access OK for known test data
   const first = testItems[0].name; // OK in tests
   ```

### Multi-Config Benefits

- **Production**: Strictest TypeScript ensures runtime safety
- **Test Utils**: Moderate standards for reusable test code
- **Tests**: Pragmatic patterns for effective testing
- **ESLint**: Pattern-based rules match config strictness levels

## Multi-Config TypeScript Workflow

### ✅ Check Different Contexts

```bash
# Production code (strictest) - must pass
npm run typecheck

# Test utilities (recommended) - warnings OK
npx tsc --project tsconfig.test-utils.json --noEmit

# Test files (relaxed) - very permissive
npx tsc --project tsconfig.tests.json --noEmit

# Watch mode for development
npm run dev:typecheck
```

### ✅ Agent Commands (Recommended)

```bash
# Quick validation with auto-fix
npm run quick

# Pre-commit validation
npm run validate

# Full pre-PR validation
npm run validate:full:agent
```

### Config-Specific Commands

- **Production errors**: Always block CI/commits
- **Test utility warnings**: Reported but non-blocking
- **Test file issues**: Ignored for pragmatic testing

## Development Workflow

1. **Start**: `npm run validate` → `npm run dev:full`
2. **During**: Run `npm run quick` after significant code changes
3. **Before commit**: `npm run validate` must pass (MANDATORY)
4. **Before PR**: `npm run validate:full:agent` must pass (MANDATORY)
5. **Database changes**: Use `npm run db:reset:local:sb:local:sb` (pre-production phase)

### Environment Configuration

- **Environment Setup**: Worktree setup uses `vercel env pull` to sync shared environment variables

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
- **Memory**: Knowledge graph for storing and retrieving coding patterns

### Memory Server Usage

The Memory MCP server stores critical coding standards and patterns as a knowledge graph. Key entities include:

- **PinPoint Tech Stack**: Core technologies and configuration
- **TypeScript Strictest Standards**: Zero-tolerance rules and patterns
- **Multi-Tenancy Architecture**: Row-level security and org scoping
- **API Security Patterns**: tRPC procedures and permission checks
- **Testing Best Practices**: Mock patterns and coverage requirements
- **Common TypeScript Fixes**: Solutions for strictest mode errors

Quick commands:

- `mcp__memory__search_nodes` - Search for patterns by keyword
- `mcp__memory__open_nodes` - Get specific entity details
- `mcp__memory__read_graph` - See all stored knowledge

Use memory to quickly recall:

- Specific TypeScript error fixes
- Prisma mock patterns with $accelerate
- tRPC router patterns and security
- Multi-tenant query patterns

## Developer Guides

For detailed guidance beyond these essentials:

- **TypeScript Issues**: See `docs/developer-guides/typescript-guide.md` for comprehensive TypeScript setup, error resolution, and migration patterns
- **Testing Patterns**: See `docs/testing/vitest-best-practices.md` for Vitest patterns and performance data
- **ESLint Errors**: See `docs/developer-guides/common-errors.md` for specific rule violations and fixes
- **Migration Lessons**: All migration insights now consolidated in `docs/developer-guides/typescript-guide.md`
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
- **ESM modules**: Project uses `"type": "module"` with native ESM support - Vitest handles this seamlessly
- **Type Safety**: Project enforces strictest TypeScript + type-aware ESLint rules. All `@typescript-eslint/no-unsafe-*` and `no-explicit-any` violations must be fixed
- **TypeScript Migration**: ✅ Production code is 100% strict mode compliant! Test files being cleaned up incrementally
- **Migration Patterns**: Complete TypeScript migration patterns in `docs/developer-guides/typescript-guide.md`

## Frontend Development Notes

- **MUI Version**: Currently using MUI v7.2.0 - always check Context7 for latest MUI documentation before making changes
- **Grid Components**: In MUI v7, use `import Grid from "@mui/material/Grid"` and `size={{ xs: 12, lg: 8 }}` syntax (no `item` prop needed)

## Development Practices

- **ESLint Disabling**: NEVER add an eslint-disable unless you have exhausted all other options and confirmed with the user that it is the correct thing to do.

## Key Lessons Learned (Non-Obvious Insights)

### Counter-Intuitive Discoveries

- **Mock data accuracy was critical for test reliability**: Initial test failures weren't due to logic bugs but because mocks returned full objects while APIs used Prisma `select` clauses - mocks must simulate exact response structure
- **Explicit dependency mocking forces better architecture**: What initially seemed like Vitest being "more work" actually drove better dependency injection patterns and cleaner service boundaries
- **Public endpoints still need multi-tenant scoping**: Even unauthenticated APIs must respect organization boundaries through subdomain resolution, not just skip authentication entirely
- **"Migration complete" doesn't mean "working"**: Functionality existing in codebase doesn't guarantee it's properly tested or behaves correctly under all conditions

### Performance Insights

- **7-65x performance improvements**: Not just marketing - real measured improvements from Jest → Vitest migration with the biggest gains on pure functions (65x) and service layer tests (12-19x)
- **ESM transformation overhead is significant**: Native ESM support eliminated a major performance bottleneck that wasn't obvious until measuring before/after

### Security & Testing Revelations

- **Permission UI testing requires both states**: Testing permission-based components for authorized state isn't enough - must test unauthorized state with proper fallbacks/tooltips
- **Security boundaries blur with public endpoints**: Public APIs can leak sensitive data through careless Prisma queries - explicit `select` clauses are essential for data security
- **Test mocks often fail to catch real API issues**: If mocks don't match production API structure exactly, tests give false confidence

## Claude Memories

- Don't be a yes-man and don't pander to me
- Don't leave references to old/removed things in documentation
- Your training ended in 2024. It's July 2025 now. Don't hesitate to look up the latest documentation if you suspect you're out of date

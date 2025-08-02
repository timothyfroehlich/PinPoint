# PinPoint Development Instructions

## 🚨 ACTIVE MIGRATION: Supabase + Drizzle + RLS

**Status**: IN PROGRESS - 6-week staged migration underway

- **Stage 1** (Weeks 1-2): Supabase Auth integration
- **Stage 2** (Weeks 3-4): Drizzle ORM migration
- **Stage 3** (Weeks 5-6): Row Level Security activation

**Migration Hub**: `@docs/migration/supabase-drizzle/`

### ⚠️ Supabase Configuration Notes

**Performance Optimizations**: The following Supabase features are currently disabled in `supabase/config.toml` for development performance:

- `db.migrations` - Disabled during development phase
- `realtime` - Disabled for performance
- `studio` - Disabled for performance

**🔔 REMINDER**: Re-enable these features in `supabase/config.toml` when ready for beta:

```toml
[db.migrations]
enabled = true  # Re-enable for production migrations

[realtime]
enabled = true  # Re-enable for real-time features

[studio]
enabled = true  # Re-enable for database management UI
```

## Tech Stack (TRANSITIONING)

### Current Stack (Being Replaced)

- **Database**: PostgreSQL + Prisma ORM → **Drizzle ORM**
- **Authentication**: NextAuth.js → **Supabase Auth**
- **Authorization**: App-level checks → **Row Level Security**
- **File Storage**: Local/Vercel Blob → **Supabase Storage**

### Stable Stack (Unchanged)

- **Framework**: Next.js + React + TypeScript
- **UI**: Material UI (MUI)
- **API**: tRPC (exclusive - no custom API routes)
- **Deployment**: Vercel (with Supabase cloud services)

## Migration Resources

### Quick References

- **Auth Pattern Mapping**: `@docs/migration/supabase-drizzle/quick-reference/auth-patterns.md`
- **Prisma → Drizzle**: `@docs/migration/supabase-drizzle/quick-reference/prisma-to-drizzle.md`
- **Migration Guide**: `@docs/migration/supabase-drizzle/developer-guide.md`

### Technology Guides

- **Supabase Auth**: `@docs/developer-guides/supabase/`
- **Drizzle ORM**: `@docs/developer-guides/drizzle/`
- **Row Level Security**: `@docs/developer-guides/row-level-security/`

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
- **Model**: Generic machine model (e.g., "Godzilla Premium")
- **Machine**: Specific physical machine at a Location
- **Issue**: Problem/task for a Game Instance
- **User**: Global account; **Member**: User + Organization + Role

## Essential Commands

```bash
# Development (RECOMMENDED)
npm run dev:bg          # Start dev server in background
npm run dev:bg:stop     # Stop background server
npm run dev:bg:status   # Check server status
npm run dev:bg:logs     # View server logs
npm run dev:clean       # Fresh start with cleanup
npm run setup:worktree  # Setup new worktree environment

# Validation Protocol (MANDATORY)
npm run check        # Development checks (typecheck + lint + format + audit)
npm run check:fix    # Development checks + auto-fix (after code changes)
npm run validate     # Pre-commit validation (MUST PASS)
npm run pre-commit   # Pre-PR validation (MUST PASS)

# Database
npm run db:reset
npm run db:push

# Database Inspection (Efficient - DON'T USE PRISMA STUDIO)
# Read schema structure: prisma/schema.prisma
# Query data samples directly (no GUI needed):
npx prisma db execute --stdin <<< "SELECT * FROM \"Organization\" LIMIT 5;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"User\";"
# DON'T launch Prisma Studio unless debugging specific data issues

# Core Commands (Use brief versions unless debugging)
# PREFERRED: Use :brief variants for daily development - faster, cleaner output
npm run typecheck:brief # TypeScript type checking (minimal output)
npm run lint:brief      # ESLint linting (quiet mode)
npm run format:brief    # Prettier formatting check (minimal output)
npm run audit:brief     # npm security vulnerability check (table format)
npm run test:brief      # Vitest unit tests (basic reporter)
npm run playwright:brief # E2E tests (line reporter, headless)
npm run smoke            # Smoke test (complete workflow validation)

# Regular versions - use only when brief fails and you need more detail
npm run typecheck       # Full TypeScript output
npm run lint            # Full ESLint output
npm run format          # Full Prettier output
npm run audit           # Full vulnerability details
npm run test            # Full Vitest output
npm run playwright      # Full E2E output

# Verbose versions - use sparingly, preferably with filters
# Only use when regular versions don't provide enough diagnostic info
npm run lint:verbose    # Detailed ESLint diagnostics
npm run typecheck:verbose # TypeScript with file lists

# Meta Commands
npm run check:brief     # PREFERRED: Fast validation (all brief variants)
npm run check           # Full validation when brief shows issues
npm run check:fix       # Validation with auto-fix
npm run fix             # Auto-fix lint + format issues

# Test Command Guidelines
# CRITICAL: Never pass shell redirection operators (2>&1, |, >, etc.) through npm's -- argument separator
# Shell operations must be outside the npm command
# ✅ CORRECT: npm run test 2>&1 | head -50
# ❌ WRONG: npm run test -- --run 2>&1 | head -50
# If you need extra test arguments beyond filtering, ask the user first

# TypeScript Error Filtering
npm run typecheck                                 # Check entire project (recommended)
npm run typecheck | grep "pattern"               # Filter errors by pattern
npm run typecheck | head -10                     # Show first 10 errors
npm run typecheck | grep "usePermissions"        # Find specific function errors
```

## TypeScript Standards

**Complete Reference**: See `@docs/developer-guides/typescript-guide.md` for comprehensive patterns and error solutions.

### Quick Patterns for Agents

```typescript
// Null safety with optional chaining
if (!ctx.session?.user?.id) throw new Error("Not authenticated");
const userId = ctx.session.user.id; // Now safe

// Safe array access
const firstItem = items[0]?.name ?? "No items";

// Optional property assignment (exactOptionalPropertyTypes)
const data: { name?: string } = {};
if (value) data.name = value;
```

### Multi-Config Strategy

- **Production Code** (`tsconfig.json`): `@tsconfig/strictest` - zero tolerance for errors
- **Test Utilities** (`tsconfig.test-utils.json`): `@tsconfig/recommended` - moderate standards
- **Test Files** (`tsconfig.tests.json`): Relaxed - pragmatic patterns allowed

### Essential Commands

```bash
# Quick validation (check-only, CI-friendly)
npm run check

# Quick validation with auto-fix
npm run check:fix

# Pre-commit validation
npm run validate

# Full pre-PR validation
npm run pre-commit
```

### Config-Specific Commands

- **Production errors**: Always block CI/commits
- **Test utility warnings**: Reported but non-blocking
- **Test file issues**: Ignored for pragmatic testing

## Development Workflow

1. **Start**: `npm run validate` → `npm run dev:bg`
2. **During**: Run `npm run check` after significant code changes
3. **Before commit**: `npm run validate` must pass (MANDATORY)
4. **Before PR**: `npm run pre-commit` must pass (MANDATORY)
5. **Database changes**: Use `npm run db:reset` (pre-production phase)

### Environment Configuration

- **Shared Database**: All worktrees use a single shared development database configured via Vercel environment variables
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
- **Testing**: ~~Unit tests with mocked dependencies only~~ → **Integration-first with transactions**

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

## Test-Architect Agent Usage

The test-architect agent specializes in improving individual test files. It's self-directed and will discover necessary context.

### When to Use

- Writing new tests
- Fixing failing tests
- Improving test quality (fragility, performance, coverage)
- Modernizing old test patterns

### Workflow

1. **Single File Assignment**: Always assign one test file at a time
2. **Self-Discovery**: Agent will find and read relevant docs/examples
3. **Recommendations**: If agent returns improvement recommendations:
   ```
   Agent: { type: "test-improvement-recommendation", ... }
   You: Present recommendation to user with clear justification
   User: Approves/Declines
   You: If approved, implement then re-run agent with context
        If declined, re-run agent with "skip: [specific recommendation]"
   ```
4. **Completion**: Summarize what the agent accomplished

### Example Interaction

```
User: "Fix the tests in src/components/issues/__tests__/IssueCard.test.tsx"

You: "I'll use the test-architect agent to analyze and improve the IssueCard tests."

[Agent discovers it's a component test, reads relevant docs, identifies fragile patterns]

[If recommendation]: "The test-architect identified an opportunity to create a shared
issue test data factory that would benefit 6 test files. Should I implement this?"

[On completion]: "Test improvements complete:
- Replaced 12 fragile text assertions with semantic queries
- Removed 2 unnecessary mocks (now testing real components)
- Added auth scenario testing (unauthenticated, member, admin)
- All 8 tests passing, 40% faster execution"
```

### Recommendation Handling Example

```
User: "Fix the IssueCard tests"

You: "I'll use the test-architect agent to improve those tests."

[Test-architect returns recommendation about creating shared test factory]

You: "The test-architect discovered an improvement opportunity before completing the test fixes. It found 6 test files using similar issue mock data and recommends creating a shared test factory. This would:
- Reduce ~120 lines of duplicate code
- Provide a single source of truth for issue test data
- Make future test updates easier

Should I implement this improvement first?"

User: "Yes, go ahead"

You: [Implement the test factory]
You: "I've created the shared test factory. Now I'll have the test-architect complete the IssueCard test improvements using this new utility."

[Call test-architect again, it will now use the new factory]

--- OR ---

User: "No, just fix the tests as-is"

You: "Understood. I'll have the test-architect complete the test fixes without creating the shared factory."

[Call test-architect with: "Continue with IssueCard.test.tsx improvements. Skip creating the issue test factory - user prefers to keep current pattern."]
```

### Logging and Audit Trail

**CRITICAL: Always check the log file after each test-architect run**

The test-architect agent creates detailed logs at `.claude/sub-agent-logs/test-architect-{timestamp}.log`:

- Every file read during context gathering
- Analysis findings and decision points
- All transformations applied with before/after examples
- Validation results (test runs, lint, typecheck)
- Any errors encountered and their resolutions
- Final completion summary

**Workflow requirement**: After each agent run, read the log file to:

1. Verify all expected actions were completed
2. Review any issues or errors encountered
3. Understand what context files were examined
4. Confirm test results and validations

### Map Maintenance

The test-architect will update `test-map.md` and `source-map.md` as it works. These maps may be outdated, so the agent uses them as guides, not gospel.

## Documentation Hub

### All Documentation Indices

- `@docs/architecture/INDEX.md` - System design and patterns
- `@docs/developer-guides/INDEX.md` - Technology-specific guides
- `@docs/testing/INDEX.md` - Testing philosophy and patterns
- `@docs/migration/INDEX.md` - Active migrations
- `@docs/planning/INDEX.md` - Roadmap and features
- `@docs/security/INDEX.md` - Security patterns
- `@docs/deployment/INDEX.md` - Environment management
- `@docs/design-docs/INDEX.md` - Design documentation
- `@docs/lessons-learned/INDEX.md` - Counter-intuitive insights
- `@docs/orchestrator-system/INDEX.md` - Multi-agent workflow

### Migration-Specific Guides

- **Supabase + Drizzle Migration**: `@docs/migration/supabase-drizzle/`
- **TypeScript Standards**: `@docs/developer-guides/typescript-guide.md`
- **Testing Philosophy**: `@docs/testing/` (rewritten for integration-first)
- **Security**: `@docs/developer-guides/row-level-security/`

## Repository

- **Repo**: timothyfroehlich/PinPoint
- **Troubleshooting**: See `docs/troubleshooting.md` (environment) or `docs/developer-guides/troubleshooting.md` (development)
- **Design Docs**: Available in Notion workspace (`/PinPoint/`)
- **Protected Main**: Never commit to main, all changes require PRs.

## Migration Best Practices

### During Migration

- **Parallel Development**: Both old and new patterns coexist temporarily
- **Feature Flags**: Use environment variables to toggle between implementations
- **Incremental Updates**: Update one service/component at a time
- **Test Both Paths**: Ensure tests cover both legacy and new code paths

### PR Requirements During Migration

- **Documentation Updates MANDATORY**: All PRs created during the Supabase + Drizzle + RLS migration MUST include documentation updates
- **Update Migration Docs**: Changes must be reflected in `@docs/migration/supabase-drizzle/` documentation
- **Environment Variable Changes**: Document any new or modified environment variables
- **Pattern Updates**: Update quick reference guides for new patterns or deprecated approaches
- **Migration Progress Tracking**: Update implementation status and lessons learned

### Code Patterns

```typescript
// Temporary dual support example
const user = process.env.USE_SUPABASE_AUTH
  ? await getSupabaseUser()
  : await getNextAuthUser();
```

### Database Commands (Migration Period)

```bash
# Prisma (current)
npm run db:push         # Schema sync
npm run db:reset        # Full reset

# Drizzle (migration target)
npm run drizzle:push    # Coming in Stage 2
npm run drizzle:migrate # Coming in Stage 2
```

## Critical Notes

- **Active Migration**: Supabase + Drizzle + RLS migration in progress
- Database strategy: Shared dev database, frequent resets during migration
- **Testing Evolution**: Moving from mock-heavy to transaction-based integration tests
- **Security Evolution**: App-level → Database-level (RLS) enforcement
- Pre-production: frequent schema changes, no migrations
- OPDB games: global (no organizationId), custom games: organization-scoped
- **ESM modules**: Native ESM support throughout
- **Type Safety**: 100% strictest TypeScript in production code
- **Testing Framework**: Vitest with 7-65x performance over Jest

## Frontend Development Notes

- **MUI Version**: Currently using MUI v7.2.0 - always check Context7 for latest MUI documentation before making changes
- **Grid Components**: In MUI v7, use `import Grid from "@mui/material/Grid"` and `size={{ xs: 12, lg: 8 }}` syntax (no `item` prop needed)

## Development Practices

- **Server Status Checks**: ALWAYS use `npm run dev:bg:status` to check if the development server is running. NEVER use curl commands for server status checks.
- **ESLint Disabling**: NEVER add an eslint-disable unless you have exhausted all other options and confirmed with the user that it is the correct thing to do.
- **E2E Testing**: Use `npm run playwright` (headless). NEVER use `playwright:headed` or `playwright:ui` as they show browser windows and interrupt the user's workflow.
- **Smoke Testing**: Use `npm run smoke` for quick end-to-end workflow validation. This tests the complete issue creation → admin management flow in ~2 minutes.
- **Prisma Studio**: AVOID launching Prisma Studio (`npm run db:studio`) unless absolutely necessary for debugging complex data issues. Use direct SQL queries, schema file reading, or existing component inspection instead.
- **Import Path Consistency**: ALWAYS use the TypeScript path alias `~/` for internal imports. NEVER use relative paths like `../../../lib/supabase/client`. ESLint enforces this with `no-restricted-imports` rule to prevent deep relative imports.

## Key Lessons Learned (Non-Obvious Insights)

### Counter-Intuitive Discoveries

- **Mock data accuracy was critical for test reliability**: Initial test failures weren't due to logic bugs but because mocks returned full objects while APIs used Prisma `select` clauses - mocks must simulate exact response structure
- **Explicit dependency mocking forces better architecture**: What initially seemed like Vitest being "more work" actually drove better dependency injection patterns and cleaner service boundaries
- **Multi-config TypeScript complexity vs. benefits**: Sophisticated 4-tier TypeScript setup provides precise control but requires careful agent guidance to navigate effectively
- **Permission system implementation learnings**: Dependency injection pattern for testing permission components proved essential for both authorized and unauthorized state testing
- **Public endpoints still need multi-tenant scoping**: Even unauthenticated APIs must respect organization boundaries through subdomain resolution, not just skip authentication entirely
- **"Migration complete" doesn't mean "working"**: Functionality existing in codebase doesn't guarantee it's properly tested or behaves correctly under all conditions
- **Import path inconsistency can cause cascade failures**: During Supabase migration, 24+ TypeScript errors appeared due to files mixing relative imports (`../../../lib/supabase/client`) with TypeScript aliases (`~/lib/supabase/client`). The modules existed but path resolution failed. Solution: ESLint `no-restricted-imports` rule now prevents deep relative imports, enforcing consistent `~/` alias usage.

### Performance Insights

- **7-65x performance improvements**: Not just marketing - real measured improvements from Jest → Vitest migration with the biggest gains on pure functions (65x) and service layer tests (12-19x)
- **ESM transformation overhead is significant**: Native ESM support eliminated a major performance bottleneck that wasn't obvious until measuring before/after

### Security & Testing Revelations

- **Permission UI testing requires both states**: Testing permission-based components for authorized state isn't enough - must test unauthorized state with proper fallbacks/tooltips
- **Dependency injection transformed permission testing**: PermissionDepsProvider pattern enables precise mocking of session and membership data, leading to more reliable permission component tests
- **Security boundaries blur with public endpoints**: Public APIs can leak sensitive data through careless Prisma queries - explicit `select` clauses are essential for data security
- **Test mocks often fail to catch real API issues**: If mocks don't match production API structure exactly, tests give false confidence
- **TypeScript migration success**: Achieved 100% strictest TypeScript compliance across all production code through systematic error resolution and validation pipeline enforcement

### Unified Dashboard Benefits

- **User Experience**: No "broken" logout experience, fast initial page load, graceful authentication failures.
- **SEO & Accessibility**: Public content indexable, works without JavaScript for public features, progressive enhancement improves with better browsers/connection.
- **Development Benefits**: Easier testing, clearer separation between public and private features, simpler error handling.

### Counter-Intuitive Authentication Insights

- **Authentication Isn't Binary**: Traditional thinking: "Either authenticated or not" Reality: "Public experience enhanced by authentication".
- **Logout Should Preserve Context**: Traditional thinking: "Logout clears everything, redirect to login" Reality: "Logout removes private features, keeps public context".
- **Single Page, Multiple Audiences**: Traditional thinking: "Different pages for public/private users" Reality: "Same page, different enhancement levels".

## Claude Memories

- Don't be a yes-man and don't pander to me
- Don't leave references to old/removed things in documentation
- Your training ended in 2024. It's July 2025 now. Don't hesitate to look up the latest documentation if you suspect you're out of date

# PinPoint - GitHub Copilot Instructions

## Project Overview

PinPoint is a pre-beta multi-tenant React Server Components application for pinball machine issue tracking. The codebase follows strict architectural patterns for security, performance, and maintainability.

**Phase**: Pre-beta, solo development, zero production users  
**Schema**: LOCKED - code adapts to schema, never modify schema files  
**Quality Bar**: All tests and lints must pass before committing

## Technology Stack

- **Frontend**: Next.js 15, React 19 with Server Components, shadcn/ui, Tailwind CSS v4
- **Backend**: tRPC, Drizzle ORM, PostgreSQL via Supabase
- **Authentication**: Supabase SSR with RLS (Row-Level Security)
- **Testing**: Vitest, Playwright, pgTAP for RLS testing
- **Language**: TypeScript with @tsconfig/strictest configuration
- **Path Aliases**: Use `~/` for all imports (maps to `src/`)

## Critical Review Requirements

### 🔴 MANDATORY: Reference Architecture Documentation

When performing code review, apply ALL checks from the project's core documentation:

- `/docs/CORE/NON_NEGOTIABLES.md` - Critical patterns and forbidden practices
- `/docs/CORE/TYPESCRIPT_STRICTEST_PATTERNS.md` - Type safety requirements
- `/AGENTS.md` - Project-specific development constraints

### 🔴 CRITICAL Architecture Violations (Block Merge)

Focus heavily on these patterns that can cause production failures:

1. **Multi-Tenant Security**: ALL database queries MUST include `organizationId` filtering
2. **Authentication**: Server-side auth MUST use `~/lib/supabase/server`, never direct imports
3. **Type Safety**: No `any`, `!`, or unsafe `as` - flag as CRITICAL violations
4. **SQL Security**: Raw string interpolation in SQL is FORBIDDEN
5. **Schema Lock**: Code adapts to schema, NEVER modify schema files

### 🟠 HIGH Priority Issues

- Unnecessary Client Components (default to Server Components)
- Missing organization context in Server Components
- Performance: Server data access MUST use React 19 `cache()`
- Import patterns: Use `~/` aliases, no deep relative imports

### Review Focus Areas

1. **Security First**: Multi-tenant isolation, RLS compliance, authentication patterns
2. **Server-First Architecture**: Prefer Server Components, minimal client-side code
3. **Type Safety**: Strict TypeScript compliance, proper type boundaries
4. **Performance**: Caching, query optimization, connection management
5. **Testing**: Proper test types per `/docs/CORE/TESTING_GUIDE.md`

## Code Quality Standards

- Follow `/docs/CORE/NON_NEGOTIABLES.md` Quick Start Checklist
- Use Material Design 3 colors only (no custom purple tints)
- shadcn/ui for new UI components (no new MUI components)
- Database: snake_case schema, camelCase application code

## Error Handling

- Use structured error types (ValidationError, AuthorizationError, DatabaseError)
- No stack traces or internal details exposed to clients
- Security-first error messaging for authentication failures

## Memory Safety & Testing

- **CRITICAL**: Use worker-scoped PGlite instances (per-test instances cause system lockups)
- **FORBIDDEN**: New SQL migration files in `supabase/migrations/` (pre-beta constraint)
- **REQUIRED**: Use SEED_TEST_IDS constants for predictable test data
- **FORBIDDEN**: Vitest redirection (`npm test 2>&1` breaks test execution)

## Forbidden Patterns

> **All forbidden patterns are documented in [`/docs/CORE/NON_NEGOTIABLES.md`](../docs/CORE/NON_NEGOTIABLES.md). This is the single source of truth. Do not maintain duplicate lists—always refer to the canonical documentation.**

### Key Forbidden Patterns (see NON_NEGOTIABLES.md for complete list)

- **Memory Safety**: Per-test PGlite instances (causes system lockups)
- **Schema Changes**: No modifications to locked schema files
- **SQL Injection**: Raw string interpolation (`sql.raw(\`SET var = '${value}'\`)`)
- **TypeScript Defeats**: No `any`, `!`, or unsafe `as` - use proper type guards
- **Deep Imports**: Use `~/` aliases instead of `../../../`
- **Migration Files**: No new files in `supabase/migrations/` (pre-beta constraint)
- **Vitest Redirection**: Commands like `npm test 2>&1` break execution
- **New MUI Components**: Use shadcn/ui for all new UI development
- **Unscoped Queries**: ALL database queries MUST filter by organizationId

## Development Commands

### Testing

- `npm test` - Run all tests (Vitest)
- `npm run test:brief` - Concise output
- `npm run test:watch` - Watch mode for TDD
- `npm run test:rls` - Run RLS policy tests (pgTAP)
- `npm run test-file <path>` - Test single file

### Development

- `npm run dev` - Start dev server
- `npm run build` - Production build
- `npm run typecheck` - TypeScript validation
- `npm run lint` - ESLint check
- `npm run format:write` - Format code with Prettier
- `npm run validate-file <path>` - Fast validation of single file

### Database

- `npm run db:push:local` - Push schema changes (Drizzle)
- `npm run db:seed:local:sb` - Seed local database
- `npm run db:reset` - Reset local database
- `npm run db:studio` - Open database explorer

## Review Priority Guidelines

- **🔴 CRITICAL**: Multi-tenant security, authentication patterns, forbidden SQL patterns
- **🟠 HIGH**: Server Component usage, performance patterns, type safety
- **🟡 MEDIUM**: Code organization, import patterns, testing compliance
- **🟢 LOW**: Style consistency, documentation improvements

**Review Authority**: All review decisions must align with the comprehensive patterns documented in `/docs/CORE/NON_NEGOTIABLES.md`.

## Pattern-Specific Instructions

Additional scoped instructions are available in `.github/instructions/`:

- `testing.instructions.md` - Test architecture and patterns
- `database.instructions.md` - Database layer and RLS patterns
- `auth.instructions.md` - Authentication and Supabase SSR
- `components.instructions.md` - Server/Client Component patterns
- `api-routes.instructions.md` - API routes and tRPC routers
- `server-actions.instructions.md` - Server Actions patterns

## Key Documentation References

**MUST READ** before making changes:

- `/docs/CORE/NON_NEGOTIABLES.md` - Critical patterns and constraints
- `/docs/CORE/TYPESCRIPT_STRICTEST_PATTERNS.md` - Type safety patterns
- `/docs/CORE/TESTING_GUIDE.md` - Test type selection and standards
- `/AGENTS.md` - Project context and development rules

## Architecture Principles

### Server-First Development

- **Default**: Server Components for all new pages and layouts
- **Client Components**: Only for interactivity (event handlers, hooks, browser APIs)
- **Hybrid Pattern**: Server Component shell with Client Component islands

### Multi-Tenant Security

- **CRITICAL**: Every database query MUST filter by `organizationId`
- **RLS Enforcement**: Use Row-Level Security policies for defense in depth
- **Organization Context**: Server Components must receive org context via props
- **Global Pages**: Root domain pages must NOT perform org-scoped queries

### Type Safety

- **Strictest Mode**: `@tsconfig/strictest` configuration enforced
- **No Escapes**: Never use `any`, `!`, or unsafe `as`
- **Type Boundaries**: Keep `Db.*` types in DB layer, convert to camelCase at boundary
- **Shared Types**: Import from `~/lib/types`, never duplicate type definitions

### Authentication

- **SSR Pattern**: Use `~/lib/supabase/server` createClient()
- **Immediate Check**: Call `auth.getUser()` right after creating client
- **Middleware**: Required for token refresh in SSR
- **OAuth**: Maintain `/auth/callback/route.ts` for OAuth flows

### Testing Strategy

- **Unit Tests**: Pure functions, utilities, validation logic
- **Integration Tests**: Database operations, tRPC procedures, Server Actions
- **E2E Tests**: Full user workflows with Playwright
- **RLS Tests**: pgTAP tests in `supabase/tests/rls/`
- **Memory Safety**: Worker-scoped PGlite (NOT per-test instances)
- **Test Data**: Use SEED_TEST_IDS constants for predictable testing

## Code Style

- **Imports**: Always use `~/` path aliases, never deep relative imports
- **Components**: PascalCase files, `-client.tsx` suffix for client-only
- **Formatting**: Prettier (run `npm run format:write`)
- **Linting**: ESLint with max 220 warnings during migration
- **Comments**: Match existing style, explain complex logic only

## Commit Guidelines

Before committing:

1. Run `npm run typecheck` - Must pass
2. Run `npm test` - All tests must pass
3. Run `npm run lint` - Check for errors
4. Run `npm run format:write` - Format code

**Commit Style**: Conventional commits preferred (`feat:`, `fix:`, `chore:`)

## Getting Help

When uncertain about patterns:

1. Check relevant documentation in `/docs/CORE/`
2. Search codebase for similar patterns
3. Review pattern-specific instruction files in `.github/instructions/`
4. Consult `AGENTS.md` for project constraints

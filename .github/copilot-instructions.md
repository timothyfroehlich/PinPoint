# PinPoint Code Review Instructions

## Project Overview
PinPoint is a pre-beta multi-tenant React Server Components application for pinball machine issue tracking. The codebase follows strict architectural patterns for security, performance, and maintainability.

## Technology Stack
- **Frontend**: Next.js 15, React 19 with Server Components, shadcn/ui, Tailwind CSS v4
- **Backend**: tRPC, Drizzle ORM, PostgreSQL via Supabase
- **Authentication**: Supabase SSR with RLS (Row-Level Security)
- **Testing**: Vitest, Playwright, pgTAP for RLS testing
- **Language**: TypeScript with strictest configuration

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

## Forbidden Patterns (One‑Page Reference)
- Memory safety violations: per‑test PGlite instances
- New SQL migration files in `supabase/migrations/` (initial snapshot only)
- Schema modifications: Code adapts to schema, not vice versa
- Deprecated imports: `@supabase/auth-helpers-nextjs`
- Supabase SSR misuse: no wrapper, wrong cookie contract, logic before `getUser()`
- TypeScript safety defeats: `any`, non‑null `!`, unsafe `as`
- Deep relative imports; use `~/` aliases
- SQL injection patterns: Raw string interpolation in SQL
- Architectural SQL misuse: Using `sql.raw()` when `sql` templates provide safe parameterization
- Over-abstraction: Functions with single call sites that add no architectural value
- Enterprise infrastructure in pre-beta: Complex error hierarchies before operational scale demands

## Review Priority Guidelines
- **🔴 CRITICAL**: Multi-tenant security, authentication patterns, forbidden SQL patterns
- **🟠 HIGH**: Server Component usage, performance patterns, type safety
- **🟡 MEDIUM**: Code organization, import patterns, testing compliance
- **🟢 LOW**: Style consistency, documentation improvements

**Review Authority**: All review decisions must align with the comprehensive patterns documented in `/docs/CORE/NON_NEGOTIABLES.md`.
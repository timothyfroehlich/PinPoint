# PinPoint Non-Negotiables

_Critical file content patterns that MUST be enforced during static analysis_

## 🚨 ABSOLUTELY FORBIDDEN PATTERNS

**Memory Safety Violations**: Per-test PGlite instances cause system lockups. Use worker-scoped pattern.

**Migration Files**: Any NEW files in `supabase/migrations/` directory. Pre-beta uses initial migration (`0000_fuzzy_talisman.sql`) for Supabase seeding only.

**Schema Modifications**: Schema is locked. Code adapts to schema, not vice versa.

**Deprecated Imports**: `@supabase/auth-helpers-nextjs` is deprecated. Use modern SSR patterns.

**Supabase SSR Client Creation Violations**: Must use `createServerClient` from `@supabase/ssr` with proper cookie handling. No direct `createClient` imports.

**Missing Supabase Middleware**: Next.js middleware REQUIRED for Supabase SSR. Auth tokens won't refresh without it.

**Supabase Response Object Modification**: Never modify `supabaseResponse` object in middleware. Must return exactly as-is or auth breaks.

**Code Between Supabase Client and getUser()**: FORBIDDEN to run any logic between `createServerClient()` and `supabase.auth.getUser()`. Causes random logouts.

**Missing Auth Callback Route**: `app/auth/callback/route.ts` required for OAuth flows. Without it, users can't complete sign-in.

**Supabase Cookie Sync Violations**: Must implement `getAll()`/`setAll()` cookie pattern exactly as documented. Partial implementation breaks sessions.

**TypeScript Safety Defeats**: No `any`, `!.`, unsafe `as`. Use proper type guards.

**Deep Relative Imports**: No `../../../lib/`. Always use TypeScript aliases like `~/lib/`.

**Seed Data Modifications**: SEED_TEST_IDS locked for predictable debugging. Don't change IDs.

**Next.js 15 Performance Risk**: Uncached fetch() calls without explicit caching. Add `cache: "force-cache"` for performance.

**Tailwind v3 Config**: No `tailwind.config.js` files with Tailwind v4. Use CSS-based configuration only.

**Client Component Overuse**: Don't use "use client" for data display components. Server Components by default.

**Material UI in New Code**: No new Material UI components. Use shadcn/ui for all new development.

## ⚡ HIGH PRIORITY VIOLATIONS

**Missing Return Types**: Complex functions need explicit return types. Prevents inference errors.

**Duplicate Database Queries**: Use React 19 cache() API for request-level memoization. Prevents query duplication.

**Missing Organization Context**: Server Components should receive organizationId for multi-tenant scoping.

**Uncached Data Access**: Data fetching functions should be wrapped with cache() for performance optimization.

## 🔐 SECURITY REQUIREMENTS

**Missing Org Scoping**: Always scope queries by organizationId. Prevents data leakage.

**API Security Holes**: Use protectedProcedure, not publicProcedure. Generic errors leak information.

**RLS Track Mixing**: pgTAP tests RLS policies. PGlite bypasses RLS. Don't mix.

## 🧪 TESTING REQUIREMENTS

**Wrong Test Archetypes**: Pure functions don't use DB. Integration uses workerDb. tRPC uses mocks.

**Server Component Testing**: No direct unit testing of async Server Components. Use E2E tests for full flows.

**Manual Test Creation**: All tests created via `/create-test` slash command. No manual test files.

**Missing Archetype Declaration**: Test files must declare archetype in filename (e.g., `*.unit.test.ts`).

## 📋 DRIZZLE NAMING

**snake_case Variables**: Use camelCase TypeScript variables, snake_case DB names. Drizzle standard.

---

**DETAILED EXAMPLES:** See docs/NON_NEGOTIABLES_EXAMPLES.md for full code examples and rationale.

**ENFORCEMENT:** These patterns are automatically scanned by the `enforcer` agent during code reviews. Violations result in immediate PR blocking for CRITICAL issues.

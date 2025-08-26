# PinPoint Non-Negotiables

_Critical file content patterns that MUST be enforced during static analysis_

## 🚨 ABSOLUTELY FORBIDDEN PATTERNS

**Memory Safety Violations**: Per-test PGlite instances cause system lockups. Use worker-scoped pattern.

**Migration Files**: Any files in `supabase/migrations/` directory. Pre-beta has zero users.

**Schema Modifications**: Schema is locked. Code adapts to schema, not vice versa.

**Deprecated Imports**: `@supabase/auth-helpers-nextjs` is deprecated. Use modern SSR patterns.

**TypeScript Safety Defeats**: No `any`, `!.`, unsafe `as`. Use proper type guards.

**Deep Relative Imports**: No `../../../lib/`. Always use TypeScript aliases like `~/lib/`.

**Seed Data Modifications**: SEED_TEST_IDS locked for predictable debugging. Don't change IDs.

## ⚡ HIGH PRIORITY VIOLATIONS

**Missing Return Types**: Complex functions need explicit return types. Prevents inference errors.

## 🔐 SECURITY REQUIREMENTS

**Missing Org Scoping**: Always scope queries by organizationId. Prevents data leakage.

**API Security Holes**: Use protectedProcedure, not publicProcedure. Generic errors leak information.

**RLS Track Mixing**: pgTAP tests RLS policies. PGlite bypasses RLS. Don't mix.

## 🧪 TESTING REQUIREMENTS

**Wrong Test Archetypes**: Pure functions don't use DB. Integration uses workerDb. tRPC uses mocks.

## 📋 DRIZZLE NAMING

**snake_case Variables**: Use camelCase TypeScript variables, snake_case DB names. Drizzle standard.

---

**DETAILED EXAMPLES:** See docs/NON_NEGOTIABLES_EXAMPLES.md for full code examples and rationale.

**ENFORCEMENT:** These patterns are automatically scanned by the `enforcer` agent during code reviews. Violations result in immediate PR blocking for CRITICAL issues.

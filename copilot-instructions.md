## PinPoint – Copilot Instructions (Developer Quick Guide)

Purpose: Fast, safe, and correct day-to-day development guidance for this repo. Mirrors CLAUDE.md, latest updates, and agent docs in a terse format you can act on.

## Context you must assume

- Project phase: Pre‑beta, solo dev, high velocity, **migration 95% complete**
- Schema & seed data: LOCKED/IMMUTABLE - code conforms to schema, not vice versa
- Quality expectations: **All tests and lints should pass** - report failures for immediate fixing
- Tech: Next.js 15, React 19, Drizzle ORM, PGlite for tests, Supabase RLS, Vitest
- Path alias: `~/*` -> `src/*` (see tsconfig.base.json). Tests use tsconfig.tests.json
- Use Context7 for docs when unsure: Drizzle, Vitest, Next.js, Supabase evolve quickly
- TypeScript: @tsconfig/strictest mode - embrace strict errors, they prevent runtime bugs

## Do / Don't (critical)

**🚨 ABSOLUTELY FORBIDDEN (Non-Negotiable Patterns):**

- **Memory safety**: Never create per-test PGlite instances (causes system lockups)
- **Migration files**: Never create files in `supabase/migrations/` (pre-beta violation)
- **Schema modifications**: Schema is locked - code adapts to schema, not vice versa
- **TypeScript safety defeats**: No `any`, `!.`, unsafe `as` - use proper type guards
- **Missing org scoping**: Always scope queries by organizationId (security requirement)
- **Deep relative imports**: No `../../../lib/` - always use `~/lib/` TypeScript aliases
- **Vitest redirection**: No `2>&1`, `>`, `>>` with npm test commands (breaks CLI)
- **Dangerous commands**: No `find -exec` or raw `psql` - use rg/safe scripts

**✅ REQUIRED PATTERNS:**

- Use worker‑scoped DB pattern: `import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db"`
- RLS testing: Use pgTAP (`supabase/tests/rls/`) for real RLS policies
- Business logic: Use PGlite with RLS bypassed for speed
- Single‑file validation: `npm run validate-file <file>` for fast loops
- Organization scoping: Always use `orgScopedProcedure` in tRPC routers
- TypeScript strictest: Explicit return types, null safety, proper error handling
- Hardcoded test IDs: Use `SEED_TEST_IDS` for predictable debugging

## Commands you’ll actually use

- Dev server: `npm run dev` (or the VS Code task: Development Server)
- Typecheck: `npm run typecheck` (task: TypeScript: Check)
- Lint: `npm run lint` (task: Lint Code)
- Format: `npm run format:write` (task: Format Code)
- Tests (all): `npm run test` or `npm run test:brief` (task: Run Tests)
- RLS (pgTAP) tests: `npm run test:rls`
- Full validate (heavy): `npm run validate` (runs checks + tests + smoke + db validate)

Fast single‑file flows:

- Validate single file (typecheck/lint/format/tests auto‑detected):
  - `npm run validate-file <path>`
- Run tests for one file only:
  - `npm run test-file <path>`
  - Example: `npm run test-file src/integration-tests/machine.owner.integration.test.ts`
  - The validator accepts flags in any order; first non‑flag is treated as the file path.

Direct Vitest (optional):

- One file: `npx vitest run src/integration-tests/file.test.ts`
- One test by name: `npx vitest run src/integration-tests/file.test.ts -t "test name"`

## Test architecture patterns (Phase 3.3 validated)

- Worker‑scoped PGlite integration tests (real DB, memory‑safe):
  - `test("..", async ({ workerDb }) => { await withIsolatedTest(workerDb, async (db) => { /* db ops */ }); });`
- Router/service integration with mocks (fast):
  - Use mock context + SEED_TEST_IDS patterns where applicable
- RLS boundary validation:
  - Use pgTAP SQL tests in `supabase/tests/rls/` for real RLS policy testing

## Hardcoded test data (SEED_TEST_IDS)

All tests use hardcoded IDs from `~/test/constants/seed-test-ids` for predictable debugging:

- Primary org: `SEED_TEST_IDS.ORGANIZATIONS.primary` ("test-org-pinpoint")
- Competitor org: `SEED_TEST_IDS.ORGANIZATIONS.competitor` ("test-org-competitor")
- Admin user: `SEED_TEST_IDS.USERS.ADMIN` ("test-user-tim")
- Machines: `SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1` ("machine-mm-001")
- Cross-org isolation testing with dual organizations

## RLS Testing

- **Critical**: PGlite CANNOT test real RLS policies (lacks `auth.jwt()` functions)
- Real RLS testing: `supabase/tests/rls/` (pgTAP) - actual policy enforcement
- Business logic: PGlite with RLS bypassed - fast, memory-safe
- Commands: `npm run test:rls` (pgTAP), `npm run test` (PGlite)
- Complete: `npm run test:all` (dual-track testing)

## Database rules (pre‑beta)

- No migrations. Prefer: reset -> push -> seed
  - `supabase db reset`
  - `npm run db:push:local` or `:preview`
  - `npm run db:seed:local:sb` or `:preview`
  - RLS setup: `npm run db:setup-rls`

## Safe tooling

- Prefer ripgrep/fd/git for search/listing; avoid `find -exec`.
- For DB access use project scripts (see scripts/), not raw `psql`.

## Useful repo facts

- Tests live in `src/integration-tests/**` and elsewhere; tsconfig.tests.json includes them.
- Path alias `~` resolves during Vitest/Vite via vite-tsconfig-paths.
- Lint budget is permissive during migration: `eslint . --max-warnings 220`.
- **Quality expectations**: All tests and lints should pass - report any failures for immediate fixing

## API Security Patterns (Multi-tenant)

**tRPC Procedures**:

```typescript
// ✅ Always scope by organization
export const issueRouter = createTRPCRouter({
  list: orgScopedProcedure.query(async ({ ctx }) => {
    return await db.query.issues.findMany({
      where: eq(issues.organizationId, ctx.organizationId),
    });
  }),
});
```

**Server Actions**:

```typescript
export const withAuth =
  <T extends any[], R>(action: (userId: string, ...args: T) => Promise<R>) =>
  async (...args: T): Promise<R> => {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) redirect("/login");
    return action(user.id, ...args);
  };
```

**Error Handling**:

```typescript
// ✅ Generic messages (don't leak info)
throw new TRPCError({ code: "NOT_FOUND", message: "Access denied" });
// ❌ Never: throw new Error("User not found in org xyz")
```

## TypeScript Strictest Patterns

**Null Safety**:

```typescript
// ✅ Safe authentication check
if (!ctx.session?.user?.id) {
  throw new TRPCError({ code: "UNAUTHORIZED" });
}
const userId = ctx.session.user.id; // Now safe

// ✅ Optional property assignment
const data = {
  id: uuid(),
  ...(name && { name }),
  ...(description && { description }),
};
```

**Type Guards**:

```typescript
function isValidUser(user: unknown): user is { id: string; email: string } {
  return (
    typeof user === "object" && user !== null && "id" in user && "email" in user
  );
}
```

## When in doubt – Context7

Always resolve library docs first if an API feels unfamiliar or new since 2024:

- Drizzle ORM, Vitest 3.x, Next.js 15, Supabase Auth/RLS, PGlite/ElectricSQL
- Use: resolve-library-id → get-library-docs (topic focus: hooks, routing, transactions, vitest cli)

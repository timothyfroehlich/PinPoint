## PinPoint – Copilot Instructions (Developer Quick Guide)

Purpose: Fast, safe, and correct day-to-day development guidance for this repo. Mirrors CLAUDE.md, latest updates, and agent docs in a terse format you can act on.

## Context you must assume

- Project phase: Pre‑beta, solo dev, high velocity, Phase 3A TypeScript error elimination (systematic recovery)
- Schema & seed data: LOCKED/IMMUTABLE - code conforms to schema, not vice versa
- Active migration: Phase 3 test conversion; many tests failing by design until finished
- Tech: Next.js 15, React 19, Drizzle ORM, PGlite for tests, Supabase RLS, Vitest
- Path alias: `~/*` -> `src/*` (see tsconfig.base.json). Tests use tsconfig.tests.json
- Use Context7 for docs when unsure: Drizzle, Vitest, Next.js, Supabase evolve quickly

## Do / Don’t (critical)

- Do use the worker‑scoped DB pattern in integration tests:
  - `import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db"`
  - No per‑test PGlite instances; no `new PGlite()` in tests.
- For RLS testing use pgTAP (`supabase/tests/rls/`) - PGlite cannot test real RLS policies
- For business logic use PGlite with RLS bypassed for speed
- Do use single‑file validation for fast loops:
  - `npm run validate-file <file>` (all checks) or `npm run test-file <test-file>` (tests only).

- Don’t generate or commit DB migrations pre‑beta.
- Don’t create per‑test databases or global PGlite instances (memory blowouts).
- Don’t use shell redirection with Vitest (e.g., `2>&1`, `>`); it breaks CLI parsing.
- Don’t use `find` with `-exec` or raw `psql`; use rg/safe scripts.

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

- All tests use hardcoded IDs for predictable debugging
- Primary org: `SEED_TEST_IDS.ORGANIZATIONS.primary` ("test-org-pinpoint")
- Competitor org: `SEED_TEST_IDS.ORGANIZATIONS.competitor` ("test-org-competitor") 
- Admin user: `SEED_TEST_IDS.USERS.ADMIN` ("test-user-tim")
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
- Validate script prints a compact summary; failures are expected during Phase 3.

## When in doubt – Context7

- Always resolve library docs first if an API feels unfamiliar or new since 2024:
  - Drizzle ORM, Vitest 3.x, Next.js 15, Supabase Auth/RLS, PGlite/ElectricSQL.
  - Use: resolve-library-id → get-library-docs (topic focus: hooks, routing, transactions, vitest cli).

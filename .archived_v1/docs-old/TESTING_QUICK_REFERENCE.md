# Testing Quick Reference

Use this as a compact checklist. See full details in `docs/CORE/TESTING_GUIDE.md`.

## Test Types

- Unit: Pure logic, no IO. Name `*.unit.test.ts`. Keep fast.
- Integration: Boundaries (services, DAL, tRPC, server actions). Name `*.integration.test.ts`.
- E2E: Playwright user journeys. Name `*.e2e.test.ts`.
- RLS: pgTAP policies/invariants. Name `*.rls.test.sql`.
- Schema: pgTAP constraints/indexes. Name `*.schema.test.sql`.

## Pick the Right Type

- Pure functions → Unit
- Framework/service wiring → Integration
- Full browser flows → E2E
- Database security → RLS
- Structural constraints → Schema

## Naming & Placement

- Co-locate tests with code where practical.
- E2E under `e2e/`; RLS/Schema under `supabase/tests/`.

## Do’s

- Use `SEED_TEST_IDS` and stable fixtures.
- Keep RLS separate from application tests.
- Use worker-scoped DB if needed (no per-test DB instances).
- Use stable `data-testid` in E2E.
- Update feature specs when behavior changes.

## Don’ts

- No random IDs/time-based flakiness.
- No unit tests for async Server Components (use Integration/E2E).
- No mixing RLS SQL with app test code.
- No coverage theater (assert meaningful behavior).

## Creation Workflow

1. Choose test type (above).
2. Start from a template in `src/test/templates` if available.
3. Place file with correct name and path.
4. Use seed constants and deterministic mocks.
5. Keep assertions crisp; validate contracts and errors.

## Updating Tests

- Adjust tests alongside contract/behavior changes.
- Keep assertions robust (avoid brittle snapshots).
- Update feature spec’s “Test Spec” and “Associated Test Files”.

## Mocking

- See `docs/CORE/latest-updates/vitest.md` for modern Vitest patterns.
- Prefer minimal, type-safe mocks.

## RLS Guidance

- Cite `docs/CORE/DATABASE_SECURITY_SPEC.md` sections in pgTAP test descriptions.
- Keep SQL tests declarative; add `-- BUG NOTE:` if behavior diverges.

## Commands

- Unit/Integration: `npm test`, `npm run test:watch`
- RLS: `npm run test:rls`
- E2E smoke: `npm run smoke`

## Where to Look

- Full guide: `docs/CORE/TESTING_GUIDE.md`
- Security authority: `docs/CORE/DATABASE_SECURITY_SPEC.md`
- Templates/helpers/constants: `src/test/`

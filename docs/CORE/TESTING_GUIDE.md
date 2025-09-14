# Testing Guide (Source of Truth)

Last Reviewed: 2025-09-13
Last Updated: 2025-09-13

Scope: All contributors. This is the single source of truth for creating and updating tests. It replaces prior archetype-era documentation and any deprecated automation around test scaffolding.

## Objectives
- Make tests consistent, fast, and trustworthy.
- Focus on five test types: Unit, Integration, E2E, RLS, Schema.
- Define do’s/don’ts, naming, placement, and review policy.

## Test Types and When to Use Them

1) Unit Tests
- What: Pure logic (formatters, validators, utilities) with no IO.
- When: Function has no external effects and can be isolated.
- Where: Co-locate with source or under `src/**/__tests__` or `src/**/*.test.ts(x)`.
- Naming: `*.unit.test.ts` (optional suffix) or `*.test.ts` when clearly unit.
- Notes: No mocking of DB/network. Keep assertions meaningful.

2) Integration Tests
- What: Application boundaries with I/O mocked or isolated (services, DAL, tRPC callers, server actions). Validates contracts and wiring.
- When: Code integrates multiple modules or uses framework context.
- Where: `src/**/*.test.ts(x)` (by feature), or `src/integration-tests/**/*` for broader flows.
- Naming: `*.integration.test.ts` (recommended).
- Notes: Use seed-based mocks and stable fixtures. Do not instantiate a database per test; use worker-scoped strategy if DB is required.

3) E2E Tests (Playwright)
- What: Full user journeys in the browser.
- When: Validate CUJs, routing, auth gates, and server/client integration.
- Where: `e2e/**/*` (smoke and feature journeys).
- Naming: `*.e2e.test.ts`.
- Notes: Use stable `data-testid` selectors. Keep journeys focused and reliable. Prefer smoke coverage + a few critical flows.

4) RLS Tests (pgTAP / SQL)
- What: Database Row-Level Security, invariants, containment, and permission enforcement.
- When: Validating database-enforced behavior independent of application code.
- Where: `supabase/tests/**/*.test.sql`.
- Naming: `*.rls.test.sql`.
- Notes: Cite sections in `docs/CORE/DATABASE_SECURITY_SPEC.md`. Keep tests declarative; don’t adjust expectations to match bugs—add a BUG NOTE comment instead.

5) Schema Tests (pgTAP / SQL)
- What: Constraints, FKs, CHECKs, indexes; structural invariants.
- When: Ensuring schema rules remain correct and stable.
- Where: `supabase/tests/**/*.test.sql`.
- Naming: `*.schema.test.sql`.
- Notes: Keep separate from RLS policy tests.

## Naming and Placement
- Unit: `*.unit.test.ts` (optional) in same directory or `__tests__`.
- Integration: `*.integration.test.ts` near the boundary code.
- E2E: `e2e/**/something.e2e.test.ts`.
- RLS: `supabase/tests/**/something.rls.test.sql`.
- Schema: `supabase/tests/**/something.schema.test.sql`.

## Do’s and Don’ts (Non-Negotiable Behaviors)
Do
- Use `SEED_TEST_IDS` and stable fixtures from `src/test/constants/seed-test-ids.ts`.
- Prefer worker-scoped database if DB is needed; reuse across tests.
- Keep RLS tests separate from application tests.
- Assert on behavior, not implementation details.
- Use stable `data-testid` selectors in E2E.
- Update feature specs’ “Test Spec” and “Associated Test Files” when flows change.

Don’t
- Don’t create per-test PGlite instances (memory/time blow-ups).
- Don’t mix RLS SQL tests with application mocking in the same file.
- Don’t hand-roll random IDs or flaky time-based assertions.
- Don’t unit test async Server Components directly; validate via integration/E2E.
- Don’t rely on coverage % as a goal; focus on meaningful assertions.

## Creation Workflow
1) Pick the right test type (see list above). If unsure, default to Integration for boundary logic and Unit for pure logic.
2) Start from templates and helpers under `src/test/templates` and `src/test/helpers` when available.
3) Place the file by type (see Naming and Placement). Keep paths near the code under test where practical.
4) Use seed constants and deterministic mocks. Avoid ad-hoc generators.
5) For Integration with DB needs, use the worker-scoped DB pattern; do not spawn per-test instances.
6) For E2E, use stable `data-testid` and minimal journeys that map to CUJs.
7) For RLS/Schema, cite `docs/CORE/DATABASE_SECURITY_SPEC.md` section numbers in descriptions.

## Updating Tests
- Update adjacent tests when changing contracts, DTOs, validation messages, or behavior.
- Keep assertions stable via constants and helpers; avoid brittle snapshots.
- When fixing a bug uncovered by a test, keep the failing assertion and adjust implementation.
- When feature behavior changes, update the feature spec and bump dates; align tests with new acceptance criteria.

## Mocking Standards
- Prefer type-safe mocking via Vitest. See `docs/CORE/latest-updates/vitest.md` for modern patterns (vi.mock with async factory, vi.importActual, vi.hoisted).
- Keep mocks minimal and focused on behavior.
- Avoid mocking too deep; integration tests should exercise meaningful boundaries.

## RLS vs Application Separation
- RLS SQL tests: verify database policies, invariants, and visibility semantics.
- Application tests (Unit/Integration/E2E): verify request flows, validations, and permissions wiring.
- Do not bypass RLS in app tests unless the purpose is to validate service logic unrelated to RLS.

## Review Checklist (for PRs)
- Correct test type, naming, and placement.
- Uses seed constants and deterministic fixtures.
- No per-test DB instances; worker-scoped if DB is used.
- For E2E: stable data-testids; minimal but complete journeys.
- For RLS/Schema: cites `DATABASE_SECURITY_SPEC` sections.
- Feature spec updated (Test Spec + Associated Test Files) if behavior changed.

## Commands
- Unit/Integration: `npm test`, `npm run test:watch`
- RLS: `npm run test:rls`
- E2E smoke: `npm run smoke`

## References
- Security authority: `docs/CORE/DATABASE_SECURITY_SPEC.md`
- Vitest modern mocking: `docs/CORE/latest-updates/vitest.md`
- Test infra (helpers/templates/constants): `src/test/`

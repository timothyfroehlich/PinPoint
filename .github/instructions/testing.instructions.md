---
applyTo: "**/*.test.ts,**/*.test.tsx,**/*.spec.ts,**/*.spec.tsx,e2e/**/*.ts,src/test/**/*.ts"
---

# Testing Instructions (Memory Safety & Pyramid)

## Pyramid Targets (Long-Term)

- ~70% Unit (pure logic: validation, status derivation)
- ~25% Integration (Drizzle + Server Actions with worker-scoped PGlite)
- ~5% E2E (Playwright critical flows)

Early phase: start lean; add breadth only after core flows exist.

## Memory Safety (CRITICAL)

- One PGlite instance per worker (NOT per test).
- Forbidden: creating DB instance inside `beforeEach` or every test.

### Worker-Scoped Example

```ts
// src/test/setup/worker-db.ts
import { createWorkerDb } from "~/test/helpers/worker";
export const workerDb = await createWorkerDb(); // single instance for suite / worker
```

### Integration Test Pattern

```ts
import { workerDb } from "~/test/setup/worker-db";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import { describe, it, expect } from "vitest";

describe("machines", () => {
  it("inserts machine", async () => {
    await db.insert(machines).values({ name: "Medieval Madness" });
    const rows = await db.select().from(machines);
    expect(rows.some((r) => r.name === "Medieval Madness")).toBe(true);
  });
});
```

## Unit Test Guidance

- Test pure utilities (e.g., `deriveMachineStatus`).
- Avoid mocking Drizzle; prefer direct logic tests.

## E2E Guidance

- Use Playwright for landing page load, auth flow, machine creation.
- Keep traces for failures; minimal retries.

## Cheapest-Layer Coverage (CORE-TEST-005)

Every clickable element must be exercised by a test that actually invokes its handler — **but pick the layer by bug class, not reflexively E2E**. See `pinpoint-testing` skill § "Bug Classes & Cheapest Catching Layer" for the table.

- **Multi-step user journeys** (login → mutate → verify across pages): E2E.
- **Server Action wiring / permission checks / DB query correctness**: integration (PGlite + direct action call).
- **Pure form-state / UI logic**: RTL unit test.
- **Smoke E2E** is for "page renders without 500" and layout regression only.

Don't write E2E for class-B / E / I bugs — it's slower, flakier, and won't catch them better.

## Test What We Own — Class-J (AGENTS.md §2.1 #14)

E2E specs must not drive **live external services**. Owned local stack only: Mailpit, PGlite, local Supabase (including local Storage). Everything else (Discord webhooks, real OAuth providers, vendor email templates, captcha verification, etc.) MUST be mocked at the SDK boundary in unit/integration tests.

**Class-J self-check before merging an E2E spec — both layers must pass:**

1. `rg 'https?://' e2e/path/to/spec.ts` — only `localhost` / `127.0.0.1` / owned-domain hits allowed in the spec source.
2. `rg 'https?://' src/lib/ src/server/actions/` — any production third-party URL (`discord.com`, `googleapis.com`, OAuth providers) must live inside an SDK client module that has a `*.test.ts` mocking `fetch` at the boundary.

Diagnostic: "If this ran against production with real credentials, would the same code pass?" If no, the test is wrong — delete the spec and add the SDK-boundary mock instead.

## Forbidden Patterns

- Per-test PGlite instantiation.
- Redirecting test runner output (`pnpm test 2>&1`) causing filter issues.
- Attempting to directly unit test async Server Components (use E2E instead).
- `page.waitForTimeout()` and arbitrary waits in Playwright — assert on real UI state (add `data-testid` hooks if needed).
- Driving live external services from E2E (class-J): real Discord, OAuth providers, vendor email APIs.
- Reflexive E2E for every clickable — pick the cheapest layer that catches the bug class.

## Data & Determinism

- Prefer deterministic inputs (avoid random IDs unless logic demands uniqueness).
- If seeding helpers introduced later, document them in `docs/PATTERNS.md` first.

## Copilot Should Suggest

- Clear separation of unit vs integration test intent.
- Worker-scoped DB usage.
- Simple assertion patterns (`expect(value).toBe(...)`).

## Copilot Should NOT Suggest

- RLS/organization isolation tests.
- pgTAP usage.
- Complex fixture factories before repetition occurs.

## Coverage

- Eventually enforce coverage (e.g., ≥80%) in CI; early phase tolerant while scaffolding.

---

Last Updated: 2026-05-17 (added CORE-TEST-005 cheapest-layer doctrine, class-J "Test What We Own", arbitrary-waits ban)

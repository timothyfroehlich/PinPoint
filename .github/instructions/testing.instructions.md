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

## Forbidden Patterns

- Per-test PGlite instantiation.
- Redirecting test runner output (`npm test 2>&1`) causing filter issues.
- Attempting to directly unit test async Server Components (use E2E instead).

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

Last Updated: 2025-11-09

# PinPoint v2 – GitHub Copilot Repository Instructions

> Source of truth lives in: `docs/NON_NEGOTIABLES.md`, `docs/PATTERNS.md`, `docs/TYPESCRIPT_STRICTEST_PATTERNS.md`, `docs/PRODUCT_SPEC.md`, `docs/TECH_SPEC.md`, `docs/TESTING_PLAN.md`, plus root `AGENTS.md` and active tasks in `TASKS.md`. Do NOT duplicate full lists of forbidden patterns here—reference them.

## Phase & Context
- Phase: Greenfield rewrite (v2) – single-tenant (Austin Pinball Collective) – pre-beta
- Users: 0 production users (high refactor tolerance, emphasize velocity + clarity)
- Core Value: Enable logging issues for pinball machines, tracking work, resolving them.
- Single-Tenant Impact: No organization scoping, no RLS, no multi-tenant isolation layers. Keep architecture lean.

## Architectural Pillars
1. Server-First: Prefer React Server Components. Client islands only for real interactivity (events, browser APIs, dynamic state).
2. Direct Data Access: Use Drizzle directly from Server Components & Server Actions. Avoid DAL/service abstractions until Rule of Three is met.
3. Progressive Enhancement: Forms must submit without JavaScript; enhance with client code optionally.
4. Strict TypeScript: Follow strictest patterns (no `any`, non-null `!`, unsafe `as`). Use narrow types + guards.
5. Schema Lock: Modify schema files directly (no migration files this phase). Never alter schema solely to appease TS errors.
6. Memory Safety: Worker-scoped PGlite for integration tests; NEVER per-test DB instantiation.
7. Consistent Domain Rules: Every issue belongs to exactly one machine (CHECK constraint). Severity uses `minor | playable | unplayable`.
8. UI Constraints: shadcn/ui + Tailwind CSS v4 + Material Design 3 color tokens in `globals.css`.

## What Changed From Archived (v1)
- Dropped multi-tenant & RLS concerns (remove orgId scoping logic from generation / reviews).
- Removed tRPC layer; now direct Drizzle + Server Actions.
- Simplified auth: Supabase SSR only; no RLS policies or pgTAP tests.
- Domain focus narrowed to machines + issues + comments (later navigation, auth pages, etc per `TASKS.md`).

## Forward-Looking (PR Sequence Guidance)
Referencing `TASKS.md` PR order:
- PR1 Foundation: Bootstrapping configs (TS, lint, format, CI). Copilot suggestions should not introduce app logic prematurely.
- PR2 Schema: Favor clear Drizzle definitions + relations; no premature indexes unless justified.
- PR3 Auth: Generate SSR Supabase helpers (`createClient` with immediate `auth.getUser()`). Avoid client-side auth hacks.
- PR4 UI + Landing: Server Component landing page; minimal client code.
- PR5 Testing: Ensure test helpers follow memory safety guideline.
Subsequent PRs extend domain logic—keep suggestions incremental, referencing existing patterns.

## Critical Patterns (Summaries – Full Detail in Docs)
- Forbidden Patterns: See `docs/NON_NEGOTIABLES.md` (includes memory safety, schema mutation via migrations, unsafe TS escapes, non-progressive forms, introducing MUI, etc.).
- Type Boundaries: Keep snake_case in database layer; convert at boundary if/when needed—do not over-engineer conversions early.
- Server Actions: Use explicit return types; integrate validation (Zod) with smallest viable schemas.
- Testing Distribution: Aim eventually for pyramid described in `TESTING_PLAN.md`; early phase can start with minimal unit + one integration seed.

## Copilot Review Priorities
1. Security & Data Integrity: Input validation, single-tenant assumptions honored, issue-machine relationship enforced.
2. Server-First Compliance: Avoid unnecessary `"use client"`.
3. Type Safety: No forbidden escapes; proper narrowing.
4. Progressive Enhancement: `<form action={serverAction}>` patterns validated.
5. Memory Safety & Test Patterns: Worker-scoped DB setup; no per-test instances.
6. Domain Consistency: Issue severity vocabulary and one-machine rule.

## Preferred Implementation Examples
(See pattern-specific instruction files for scoped detail.)

### Minimal Server Component
```tsx
// src/app/page.tsx
export default async function Landing() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <section className="space-y-4 text-center">
        <h1 className="text-3xl font-semibold">PinPoint</h1>
        <p className="text-sm text-muted-foreground">Track pinball machine issues fast.</p>
      </section>
    </main>
  );
}
```

### Server Action With Validation
```ts
// src/app/machines/actions.ts
"use server";
import { z } from "zod";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";

const createMachineSchema = z.object({ name: z.string().min(1) });
export type CreateMachineInput = z.infer<typeof createMachineSchema>;

export async function createMachine(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const raw = { name: formData.get("name") };
  const parsed = createMachineSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid name" };
  await db.insert(machines).values({ name: parsed.data.name });
  return { ok: true };
}
```

### Integration Test Memory Safety Snippet
```ts
// src/test/setup/worker-db.ts
import { createWorkerDb } from "~/test/helpers/worker"; // pattern wrapper
export const workerDb = await createWorkerDb(); // one per worker, not per test
```

## Auth Essentials
- SSR only: `src/lib/supabase/server.ts` wrapper creates client and immediately calls `auth.getUser()`.
- Middleware handles token refresh; do not mutate the response object.
- Auth pages use Server Components + forms posting to Server Actions.

## UI & Styling
- Tailwind CSS v4 using `@import "tailwindcss"` & `@config` in `globals.css`.
- Material Design 3 colors stored as CSS variables; prefer semantic tokens (`--color-primary-container`).
- Use shadcn/ui primitives; never introduce MUI.

## Testing Guidance (Condensed)
- Unit: Pure logic (status derivation, validation).
- Integration: Drizzle queries + Server Actions using worker-scoped PGlite.
- E2E: Playwright for full flows (landing load, auth, machine creation) after foundational PRs.
- Avoid testing Server Components directly—validate via E2E.

## Commit & Quality Gates
Run (or ensure CI runs) before pushing:
```bash
npm run typecheck
npm run lint
npm run test
npm run format
```
(Use eventual `preflight` script when added.) Conventional commit messages.

## Copilot Should Avoid Generating
- Organization scoping logic (obsolete in v2 single-tenant).
- tRPC routers / multi-tenant context wrappers.
- RLS policy tests / pgTAP usage.
- DAL/service abstraction layers prematurely.
- Client components where static server rendering suffices.

## Escalation / Uncertainty Handling
If Copilot cannot infer a pattern: reference the canonical docs first; prefer asking for clarification only when a direct pattern is absent and Rule of Three not met.

## Evolution Notes
As features stabilize (Machines CRUD, Issues workflow, Comments), patterns that repeat (≥2 implementations) MUST be documented in `docs/PATTERNS.md` before introducing abstractions.

---
Last Updated: 2025-11-09 (v2 greenfield start)
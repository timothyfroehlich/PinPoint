# PinPoint Agent Context (Gemini)

## 1. User & Philosophy

- **User**: Tim (GitHub: timothyfroehlich)
- **Context**: Solo vibecoding to learn web development. New to TypeScript/JavaScript.
- **Requirement**: Explain _pros/cons_ of decisions. Don't just fix; teach.
- **Core Value**: Tracking pinball machine issues for Austin Pinball Collective.
- **Phase**: Greenfield (v2), Pre-beta. High risk tolerance for breaking changes.
- **Guideline**: PR review comments are AI-generated. Apply critical thinking, not blind acceptance.

## 2. Tech Stack & Environment

- **Frontend**: Next.js 16, React 19 (Server Components), shadcn/ui, Tailwind CSS v4
- **Backend**: Drizzle ORM, PostgreSQL (Supabase)
- **Auth**: Supabase SSR (No RLS - Single Tenant)
- **Testing**: Vitest (unit/integration), Playwright (E2E), worker-scoped PGlite
- **Language**: TypeScript (strictest configuration)
- **Knowledge Cutoff**: Jan 2025, current Dec 2025. Use Context7 MCP (`resolve-library-id` → `get-library-docs`) for latest docs.

### Worktree Port Allocation (Critical for Config)

| Worktree    | Next.js | Supabase API | Postgres | Mailpit |
| ----------- | ------- | ------------ | -------- | ------- |
| Main        | 3000    | 54321        | 54322    | 54324   |
| Secondary   | 3100    | 55321        | 55322    | 55324   |
| Review      | 3200    | 56321        | 56322    | 56324   |
| AntiGravity | 3300    | 57321        | 57322    | 57324   |

**Note**: Escape parentheses in paths: `src/app/\(app\)` not `src/app/(app)`.

## 3. Critical Non-Negotiables & Rationales

### Database (Drizzle/Supabase)

- **Rule**: NEVER use `drizzle-kit push`. ALWAYS use migrations.
  - _Why_: `push` can cause schema drift and data loss in production. Migrations are version-controlled and safe.
- **Rule**: Schema (snake_case) <-> App (camelCase).
  - _Why_: SQL standard is snake_case; JS standard is camelCase. Mixing them causes confusion.
- **Workflow**:
  1. Edit `src/server/db/schema.ts`.
  2. `npm run db:generate -- --name <desc>`
  3. `npm run db:migrate`
  4. `npm run test:_generate-schema`
  5. Commit `schema.ts`, `drizzle/`, and `src/test/setup/schema.sql`
- **Rule**: `handle_new_user()` trigger for profiles.
  - _Why_: Client-side profile creation fails with OAuth. DB triggers are atomic and reliable.

### Architecture (Server-First)

- **Rule**: Default to Server Components.
  - _Why_: Better performance, security, and smaller bundles.
- **Rule**: `<form action={serverAction}>`.
  - _Why_: Progressive enhancement. Forms work without JS.
- **Rule**: Use `useActionState` (React 19) for form feedback.
  - _Why_: Replaces legacy "Flash Messages" (cookies). Native to React 19 Server Actions.
- **Rule**: Direct Server Action references in forms.
  - _Why_: Inline wrappers `action={async () => { await serverAction(); }}` break Next.js form serialization.
- **Rule**: Server Actions in dropdown menus use `onSelect`, not forms.
  - _Why_: Dropdowns unmount before form submission completes, causing "Form submission canceled" errors.

### Testing Strategy

- **Unit (70%)**: Pure logic. `npm test`.
- **Integration (25%)**: DB queries. **MUST use worker-scoped PGlite**. `npm run test:integration`.
  - _Why_: Per-test PGlite instances cause system lockups and memory leaks.
- **E2E (5%)**: Critical flows. `npm run smoke`.
- **Preflight**: `npm run preflight` before ALL commits.
  - _Why_: Comprehensive validation (typecheck, lint, format, test, build, integration tests).

### Security

- **Rule**: CSP with nonces.
  - _Why_: Prevents XSS by blocking unauthorized scripts.
  - _How_: `middleware.ts` generates nonces, `next.config.ts` sets static headers.
- **Rule**: Validate ALL inputs with Zod.
  - _Why_: Prevent injection attacks.
- **Rule**: `localhost` for all auth callbacks, dev server, Playwright `baseURL`, Supabase `site_url`.
  - _Why_: Prevents cookie host mismatches.

### Supabase SSR

- **Rule**: Use `~/lib/supabase/server`, call `auth.getUser()` immediately.
  - _Why_: Workaround for timing issues, avoids token invalidation.
- **Rule**: No logic between `createClient()` and `getUser()`.
  - _Why_: Breaks SSR session continuity.

## 4. Strict Code Patterns (Copy-Paste Ready)

### Type Safety (strictest config)

**Correct Optional Assignment:**

```typescript
// ✅ Good: Spread conditional
const data = {
  id: uuid(),
  ...(name && { name }), // Only adds key if name exists
  ...(description && { description }),
};

// ❌ Bad: undefined assignment
const data = { name: value }; // Error: exactOptionalPropertyTypes
```

**Safe Drizzle Query:**

```typescript
// ✅ Good: Explicit checks & query builder
if (!machineId) throw new Error("ID Required");
return await db.query.issues.findMany({
  where: eq(issues.machineId, machineId),
});
```

**Type Guard:**

```typescript
// ✅ Good: Proper type narrowing
function hasItems<T>(arr: T[] | undefined): arr is T[] {
  return arr !== undefined && arr.length > 0;
}
```

### Server Action Auth

```typescript
"use server";
export async function update(formData: FormData) {
  const supabase = await createClient(); // ~/lib/supabase/server
  const {
    data: { user },
  } = await supabase.auth.getUser(); // Call immediately
  if (!user) redirect("/login");
  // ... validation & logic
}
```

### Component Architecture

```tsx
// ✅ Good: Async Server Component
export default async function Page({ params }: { params: { id: string } }) {
  const data = await db.query.table.findFirst(...);
  return <ClientComponent data={data} />;
}
```

### Forms with Progressive Enhancement

```tsx
// ✅ Good: Direct Server Action reference
<form action={updateProfile}>
  <input name="name" required />
  <button type="submit">Save</button>
</form>

// ❌ Bad: Inline wrapper (breaks Next.js)
<form action={async () => { await updateProfile(); }}>
```

### Dropdowns with Server Actions

```tsx
// ✅ Good: Use onSelect
<DropdownMenuItem
  onSelect={async () => {
    await deleteIssue(issueId);
  }}
>
  Delete
</DropdownMenuItem>

// ❌ Bad: Form inside dropdown (unmounts before submission)
<DropdownMenuItem>
  <form action={deleteIssue}>
    <button>Delete</button>
  </form>
</DropdownMenuItem>
```

### Integration Test with PGlite

```typescript
// ✅ Good: Worker-scoped instance
import { getPGlite } from "~/test/setup/pglite";

describe("getIssuesForMachine", () => {
  beforeAll(async () => {
    const db = getPGlite(); // Shared worker instance
    await db.exec("INSERT INTO machines ...");
  });

  it("returns issues for machine", async () => {
    const issues = await getIssuesForMachine("machine-id");
    expect(issues).toHaveLength(3);
  });
});

// ❌ Bad: Per-test instance (causes lockups)
beforeEach(async () => {
  const db = new PGlite(); // DON'T DO THIS
});
```

## 5. Security Checklist

1. **Inputs**: Validate ALL inputs with Zod.
2. **CSP**: Nonce-based CSP required in Middleware.
3. **Hosts**: Use `localhost` explicitly to avoid cookie domain mismatches.
4. **Logic**: No logic between `createClient()` and `getUser()`.

## 6. Commands Quick Reference

**Critical (Before Commit):**

```bash
npm run preflight  # Typecheck, lint, format, test, build, integration tests
```

**Development:**

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run typecheck        # TypeScript validation
npm run lint             # ESLint
npm test                 # Unit tests only
npm run test:integration # DB tests (requires supabase start)
npm run smoke            # E2E tests (Playwright)
```

**Database Migrations:**

```bash
npm run db:generate -- --name <change-name>
npm run db:migrate
npm run test:_generate-schema
```

**Components:**

```bash
npx shadcn@latest add [component]
```

## 7. Testing Requirements

**Location**:

- Unit tests: Anywhere in `src/test/` except `src/test/integration/`
- Integration tests (DB): `src/test/integration/supabase/` (must end with `.test.ts`)
- E2E tests: `e2e/` directory

**Distribution (100-150 tests total)**:

- 70% Unit (~70-100): Pure functions, utilities, validation
- 25% Integration (~25-35): DB queries with worker-scoped PGlite
- 5% E2E (~5-10): Critical flows (Playwright)

**Dev Loop**:

- After any change: `npm run check` (~5s)
- Before commit: `npm run preflight` (~60s)
- Targeted: `npm test -- path/to/file.test.ts`

## 8. Documentation Index

**Security**: docs/SECURITY.md, docs/NON*NEGOTIABLES.md (security section)
**Testing**: docs/TESTING_PLAN.md, docs/E2E_BEST_PRACTICES.md
**TypeScript**: docs/TYPESCRIPT_STRICTEST_PATTERNS.md
**UI**: docs/UI_GUIDE.md, docs/patterns/ui-patterns/*
**Patterns**: docs/PATTERNS.md, docs/patterns/\_
**Product**: docs/PRODUCT_SPEC.md, docs/TECH_SPEC.md, docs/V2_ROADMAP.md

## 9. Scope Control

**The Scope Firewall** (defer if answers are No/No/Yes):

1. Does this solve a problem we have RIGHT NOW?
2. Does this block achieving the core value proposition?
3. Can we ship MVP without this?

**"Done Enough" Standard** (ship if all Yes):

1. Works for happy path?
2. Handles most common error case?
3. Has at least one test?
4. Secure (input validation, auth checks)?
5. Readable by someone else?

## 10. Coding Standards

**TypeScript**: Strictest config - no `any`, no `!`, no unsafe `as`. Explicit return types for public functions.

**Naming**:

- Components: PascalCase files (`IssueCard.tsx`)
- Client Components: `"use client"` directive at top
- Hooks: `useThing.ts`
- DB: snake_case schema, convert to camelCase at boundaries

**Path Aliases**: Always use `~/` instead of relative imports `../../../`.

**Database**: Use migrations, not `push`. Schema is source of truth.

## 11. Commit Guidelines

- **Style**: Conventional commits (`feat:`, `fix:`, `chore:`)
- **Process**: Run `npm run preflight` → commit → push
- **Hooks**: Husky + lint-staged enforce quality gates

See AGENTS.md for comprehensive context that applies to all agents.

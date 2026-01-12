---
trigger: always_on
# For Antigravity
---

# PinPoint - Pinball Issue Tracking

## About the User

**Name**: Tim (GitHub: timothyfroehlich)
**Context**: Learning web development via solo vibecoding. New to TypeScript/JavaScript. Explain decisions with pros/cons.
**Guideline**: PR review comments are AI-generated suggestions - apply critical thinking, not blind acceptance.

## Critical Commands

**Run BEFORE every commit:**

```bash
pnpm run preflight  # Typecheck, lint, format, test, build, integration tests
```

**Development:**

```bash
pnpm run dev              # Start dev server (uses PORT from .env.local)
pnpm run build            # Production build
pnpm run typecheck        # TypeScript validation
pnpm run lint             # ESLint check
pnpm test                 # Unit tests only
pnpm run test:integration # DB integration tests (requires `supabase start`)
pnpm run smoke            # E2E smoke tests (Playwright)
```

**Database Migrations (ALWAYS use migrations, never `push`):**

```bash
# 1. Edit src/server/db/schema.ts
# 2. Generate migration:
pnpm run db:generate -- --name <descriptive-name>
# 3. Apply migration:
pnpm run db:migrate
# 4. Update test schema:
pnpm run test:_generate-schema
# 5. Commit schema.ts, drizzle/, and src/test/setup/schema.sql
```

**Components:**

```bash
pnpm dlx shadcn@latest add [component]  # Add shadcn/ui components
```

## Tech Stack

- **Frontend**: Next.js 16, React 19 (Server Components), shadcn/ui, Tailwind CSS v4
- **Backend**: Drizzle ORM, PostgreSQL (Supabase)
- **Auth**: Supabase SSR (single-tenant, no RLS)
- **Testing**: Vitest (unit/integration), Playwright (E2E), worker-scoped PGlite
- **Language**: TypeScript (@tsconfig/strictest)
- **Phase**: Greenfield v2, Beta, early production users

**Knowledge Gap**: Training cutoff Jan 2025, current date Dec 2025. Use Context7 MCP (`resolve-library-id` → `get-library-docs`) for latest library patterns.

## Top 10 Non-Negotiables

1. **Use migrations, never `push`**: `push` causes schema drift and data loss in production. Migrations are version-controlled.
2. **Worker-scoped PGlite only**: Per-test PGlite instances cause system lockups. Use shared worker instance.
3. **Server Components first**: Better performance, security, SEO. Use "use client" only for interactivity leaves.
4. **Progressive enhancement**: Forms must work without JavaScript. Use `<form action={serverAction}>`.
5. **useActionState for forms**: Modern React 19 pattern. Replaces cookie-based flash messages.
6. **Supabase SSR contract**: Use `~/lib/supabase/server`, call `auth.getUser()` immediately after `createClient()`.
7. **CSP with nonces**: Security headers required. Use `middleware.ts` for dynamic nonces, `next.config.ts` for static headers.
8. **Type safety (strictest)**: No `any`, no `!`, no unsafe `as`. Write type guards for validation.
9. **Path aliases (`~/`)**: Always use `~/lib/...` instead of relative imports `../../../lib/...`.
10. **Preflight before commit**: `pnpm run preflight` must pass. Pre-commit hooks enforce this.

## Quick Code Examples

### Server Action with Auth

```typescript
"use server";
import { createClient } from "~/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(); // Call immediately!
  if (!user) redirect("/login");

  const name = formData.get("name");
  if (typeof name !== "string") throw new Error("Invalid name");

  await db.update(users).set({ name }).where(eq(users.id, user.id));
  revalidatePath("/profile");
}
```

### Safe Drizzle Query

```typescript
import { eq } from "drizzle-orm";
import { issues } from "~/server/db/schema";

export async function getIssuesForMachine(machineId: string) {
  if (!machineId) throw new Error("Machine ID required");

  return await db.query.issues.findMany({
    where: eq(issues.machineId, machineId),
    orderBy: desc(issues.createdAt),
  });
}
```

### Type Guard for Optional Properties

```typescript
// ✅ Correct: Conditional spread for optional properties
const data = {
  id: uuid(),
  ...(name && { name }), // Only adds if name exists
  ...(description && { description }),
};

// ❌ Wrong: Direct assignment of potentially undefined
const data = { name: value }; // Error with exactOptionalPropertyTypes
```

### Server Component Pattern

```typescript
export default async function MachineIssuesPage({
  params
}: {
  params: { machineId: string }
}) {
  const issues = await getIssuesForMachine(params.machineId);

  return (
    <div>
      {issues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
    </div>
  );
}
```

### Form with Progressive Enhancement

```typescript
// ✅ Good: Direct Server Action reference
<form action={updateProfile}>
  <input name="name" required />
  <button type="submit">Save</button>
</form>

// ❌ Bad: Inline wrapper (breaks Next.js form handling)
<form action={async () => { await updateProfile(); }}>
```

### Dropdown with Server Action

```typescript
// ✅ Good: Use onSelect for Server Actions in dropdowns
<DropdownMenuItem
  onSelect={async () => {
    await deleteIssue(issueId);
  }}
>
  Delete
</DropdownMenuItem>

// ❌ Bad: Form inside dropdown (unmounts before submission completes)
<DropdownMenuItem>
  <form action={deleteIssue}>
    <button>Delete</button>
  </form>
</DropdownMenuItem>
```

## Worktree Port Allocation

| Worktree    | Next.js | Supabase API | PostgreSQL | project_id           |
| ----------- | ------- | ------------ | ---------- | -------------------- |
| Main        | 3000    | 54321        | 54322      | pinpoint             |
| Secondary   | 3100    | 55321        | 55322      | pinpoint-secondary   |
| Review      | 3200    | 56321        | 56322      | pinpoint-review      |
| AntiGravity | 3300    | 57321        | 57322      | pinpoint-antigravity |

**Note**: Each worktree uses `skip-worktree` for `supabase/config.toml`. Use `scripts/sync_worktrees.py` to manage.

**Warning**: Escape parentheses in paths: `src/app/\(app\)` not `src/app/(app)`.

## Agent Skills (Progressive Disclosure)

**What are Agent Skills?**
Agent Skills provide on-demand detailed guidance without loading everything upfront. They use progressive disclosure: metadata loads first (~100 tokens per skill), full content loads only when relevant.

**Supported agents**: Claude Code, GitHub Copilot (as of Dec 18, 2025)
**Coming soon**: gemini-cli

**Available skills** (in `.claude/skills/` and `.github/skills/`):

- `pinpoint-security` - CSP nonces, auth checks, input validation, Supabase SSR
- `pinpoint-testing` - Test pyramid, PGlite patterns, Playwright best practices
- `pinpoint-typescript` - Strictest patterns, type guards, optional properties
- `pinpoint-ui` - shadcn/ui, progressive enhancement, Server Components
- `pinpoint-patterns` - Server Actions, data fetching, error handling

**If your agent doesn't support skills yet:**
Read the skill files directly for full context. Each skill is a single Markdown file:

```bash
cat .claude/skills/pinpoint-security/SKILL.md    # Security patterns
cat .claude/skills/pinpoint-testing/SKILL.md     # Testing strategy
cat .claude/skills/pinpoint-typescript/SKILL.md  # TypeScript patterns
cat .claude/skills/pinpoint-ui/SKILL.md          # UI/component patterns
cat .claude/skills/pinpoint-patterns/SKILL.md    # Project patterns
```

## Documentation & Skills Reference

For detailed guidance, use Agent Skills (if supported) or reference docs directly:

**Security**

- Skill: `pinpoint-security` (CSP, auth patterns, input validation)
- Docs: @docs/SECURITY.md, @docs/NON_NEGOTIABLES.md#security

**Testing**

- Skill: `pinpoint-testing` (test pyramid, PGlite patterns, Playwright)
- Docs: @docs/TESTING_PLAN.md, @docs/E2E_BEST_PRACTICES.md

**TypeScript**

- Skill: `pinpoint-typescript` (type guards, optional properties, Drizzle safety)
- Docs: @docs/TYPESCRIPT_STRICTEST_PATTERNS.md

**UI/Components**

- Skill: `pinpoint-ui` (shadcn/ui, Server Components, progressive enhancement)
- Docs: @docs/UI_GUIDE.md, @docs/patterns/ui-patterns/\*

**Patterns**

- Skill: `pinpoint-patterns` (Server Actions, data fetching, error handling)
- Docs: @docs/PATTERNS.md, @docs/patterns/\*

**Product/Architecture** (no skills, use docs directly):

- @docs/PRODUCT_SPEC.md - Feature specifications (MVP/MVP+/1.0/2.0)
- @docs/TECH_SPEC.md - Single-tenant architecture
- @docs/V2_ROADMAP.md - Deferred features

## Testing Strategy

**Distribution (100-150 tests total)**:

- 70% Unit (~70-100): Pure functions, utilities, validation
- 25% Integration (~25-35): DB queries with worker-scoped PGlite
- 5% E2E (~5-10): Critical flows only (Playwright)

**Dev Loop**:

| Command                             | When to use                      |
| ----------------------------------- | -------------------------------- |
| `pnpm run check`                    | After ANY code change (~5s)      |
| `pnpm test -- path/to/file.test.ts` | Debug specific test              |
| `pnpm run preflight`                | Before commit (full suite, ~60s) |
| **Mobile Safari**                   | **DO NOT RUN LOCALLY** (CI only) |

**Key Constraints**:

- Worker-scoped PGlite only (no per-test instances)
- No testing Server Components directly (use E2E)
- Test behavior, not implementation

## Coding Standards

**TypeScript**: Strictest config - no `any`, no `!`, no unsafe `as`. Explicit return types for public functions.

**Naming**:

- Components: PascalCase files (`IssueCard.tsx`)
- Client Components: `"use client"` directive at top
- Hooks: `useThing.ts`
- DB: snake_case schema, convert to camelCase at boundaries

**Database**: Use migrations, not `push`. Schema is source of truth - code adapts to schema, never modify schema to fix TypeScript errors.

## Scope Control

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

## Commit Guidelines

- **Style**: Conventional commits (`feat:`, `fix:`, `chore:`)
- **Process**: Run `pnpm run preflight` → commit → push
- **Hooks**: Husky + lint-staged enforce quality gates

## GitHub Copilot Reviews

When an agent or user requests a review from `@github/copilot`, the resulting inline comments may not be fully visible via basic `gh pr view` commands.

**To fetch all review comments from Copilot:**

```bash
gh api graphql -f query='
{
  repository(owner: "timothyfroehlich", name: "PinPoint") {
    pullRequest(number: <PR_NUMBER>) {
      reviews(last: 5) {
        nodes {
          author { login }
          state
          comments(first: 20) {
            nodes {
              path
              line
              body
            }
          }
        }
      }
    }
  }
}'
```

# PinPoint Development Instructions

## 🚨 CRITICAL CONSTRAINTS

### Non-Negotiable Patterns

- **Memory safety**: Use worker-scoped PGlite instances (per-test instances cause system lockups)
- **No migration files**: Pre-beta has zero users, schema changes via direct modification only
- **No Vitest redirection**: Commands like `npm test 2>&1` break test execution
- **Schema lock**: Code adapts to schema, never modify schema to fix TypeScript errors
- **Organization scoping**: All queries must include organizationId for security
- **Server-first**: Default to Server Components, minimal Client Components
- **shadcn/ui only**: No new MUI components, use shadcn/ui for all new development
- **Material Design 3 colors only**: All colors must come from the Material 3 color system in globals.css. No manual color overrides or custom purple tints. Work within Material 3's generated primary, secondary, tertiary, surface, and error color families.

### Mandatory Context7 Usage

- **When**: Working with any library/framework (Drizzle, Supabase, Next.js, shadcn/ui, Server Components, Server Actions, Vitest)
- **Why**: Training cutoff January 2025, now August 2025 - 7+ months behind
- **Process**: `resolve-library-id` → `get-library-docs` → Apply current patterns

### Command Guidance

- Avoid `npm test 2>&1` / `npm test > file.txt` (breaks Vitest)
- Prefer `rg`/`fd` over `find` for searching
- For human contributors, it’s fine to use `psql` and `curl` directly. Wrapper scripts like `./scripts/safe-psql.sh` and `./scripts/safe-curl.sh` exist primarily for automated agents to reduce risk.
- **`require()` statements** are disallowed: use ES module `import` syntax only (project is type: "module")

---

## 📍 PROJECT CONTEXT

### Project Status

- Pre-beta phase, zero production users
- Solo development, high risk tolerance for breaking changes
- Core features and navigation still being decided

---

## 🏗️ ARCHITECTURE DIRECTIVES

### Server-First Principles

- **Default**: Server Components for all new development
- **Client Islands**: Minimal "use client" for specific interactivity only
- **Hybrid**: Server shell + Client islands for complex interactions
- **Data Flow**: Server Components → DAL → Drizzle → PostgreSQL
- **Mutations**: Server Actions with progressive enhancement

### UI Framework Strategy

- **New Development**: shadcn/ui + Tailwind CSS only
- **Existing Code**: MUI components continue working during transition
- **Migration**: Component-by-component replacement when convenient
- **CSS**: Layer isolation enables MUI/Tailwind coexistence

### Schema & Data Lock-In

- **Schema is immutable**: Code adapts to schema, never modify schema for TypeScript errors
- **Seed data locked**: SEED_TEST_IDS finalized for predictable testing
- **Development approach**: Fix imports, add required fields, use correct property names
- **No migrations**: Pre-beta has zero users, no migration files allowed

### Test System Status

- **Archive complete**: ~130 files removed, clean foundation established
- **Current tests**: pgTAP RLS + smoke tests + 1 baseline unit test
- **Ready for**: Systematic archetype implementation
- **Quality expectation**: All tests and lints must pass before commits

### Test Archetype System

**9 Archetypes**: Unit, Component, Service, Repository, Router, API Integration, E2E, RLS, Schema
**Mock System**: Auto-generated from seed data for consistency
**Templates**: Pre-built for each archetype
**Worker-scoped DB**: PGlite pattern for integration tests

### Test Creation Policy

**MANDATORY**: All new tests created via `/create-test` command
**No exceptions**: Manual test creation bypasses archetype compliance
**Agent response**: "I need to create a [type] test. Please run `/create-test` to ensure archetype compliance."

### Development Notes

- Training cutoff: January 2025 (7+ months behind current libraries)
- Use husky for pre-commits, shellcheck for scripts
- Server Components by default, minimal Client Components
- shadcn/ui for new UI, MUI coexistence during transition

---

## 🛠️ DEVELOPMENT RULES

### Command Recommendations

| Consider Avoiding | Prefer                             | Reason                                                    |
| ----------------- | ---------------------------------- | --------------------------------------------------------- |
| `npm test 2>&1`   | `npm test`                         | Vitest treats redirection as test filters                 |
| `find`            | `rg --files`, `fd`                 | Safer/faster search                                       |
| —                 | `psql` or `./scripts/safe-psql.sh` | `safe-psql` is agent-focused; human use of `psql` is fine |
| —                 | `curl` or `./scripts/safe-curl.sh` | `safe-curl` is agent-focused; human use of `curl` is fine |
| Parameterized SET | `sql.raw()` with escaping          | PostgreSQL DDL limitation                                 |
| `require()`       | ES module `import`                 | Project is type: "module" (ESM)                           |

### Safe Command Alternatives

- **Search**: `rg --files \| rg "pattern"`, `rg -l "content" --type js`
- **Discovery**: `fd "*.js"`, `fd --type f --changed-within 1day`
- **Repository**: `git ls-files \| grep "\.js$"`
- **UI Components**: `npx shadcn@latest add [component]`

### Available Commands

**Testing**: `npm test`, `npm run test:watch`, `npm run test:rls`, `npm run smoke`
**Development**: `npm run dev`, `npm run build`, `npm run lint`, `npm run type-check`
**Components**: `npx shadcn@latest add [component]`
**Test Creation**: `/create-test` (slash command)

### Seed Data Pattern

**Critical**: Use hardcoded SEED_TEST_IDS for predictable debugging

- `SEED_TEST_IDS.ORGANIZATIONS.primary` → "test-org-pinpoint"
- `SEED_TEST_IDS.USERS.ADMIN` → "test-user-tim"
- `SEED_TEST_IDS.MOCK_PATTERNS.MACHINE` → "mock-machine-1"

### Development Patterns

**DAL Functions**: Direct Drizzle queries with organization scoping
**Server Actions**: "use server" with auth validation and revalidation
**Hybrid Components**: Server shell with targeted Client islands
**Forms**: Server Actions with progressive enhancement
**Authentication**: Supabase SSR with proper cookie handling

### Quality Gates

- All tests pass before commits
- Pre-commit hooks (husky + shellcheck)
- Server-first principles for new development
- Organization scoping in all multi-tenant queries
- SEED_TEST_IDS for predictable testing

### Supabase Infrastructure Setup

**CRITICAL**: The `db:reset` workflow has been updated to handle auth trigger creation properly:

1. `supabase db reset --no-seed` (skip premature seed.sql execution)
2. `npm run db:push:local` (apply Drizzle schema first)
3. `npm run db:apply-infrastructure` (then run seed.sql with auth triggers)
4. RLS setup and data seeding complete the process

**Root Cause**: Supabase's seed.sql tries to create policies on tables that don't exist yet when migrations are disabled. The new workflow ensures tables exist before infrastructure setup.

### Pattern Synchronization

**Mandatory**: Update `@docs/developer-guides/general-code-review-procedure.md` when discovering new forbidden/enforced patterns

---

## 📚 QUICK REFERENCE

### Essential Documentation

- **@docs/CORE/NON_NEGOTIABLES.md** - Static analysis patterns
- **RSC_MIGRATION/** - Current migration plans and status
- **docs/CORE/latest-updates/quick-reference.md** - Post-training tech updates
- **@docs/CORE/TYPESCRIPT_STRICTEST_PATTERNS.md** - Type safety patterns
- **@package.json** - Available scripts, dependencies, and project configuration

### Essential but too big to autoload

- **docs/CORE/TARGET_ARCHITECTURE.md** - Architectural authority for all decisions

### Documentation Review Requirement

**CRITICAL**: Any document in `docs/CORE/` that hasn't been reviewed within 5 days must be verified for consistency with the current codebase state before use.

### Current Priorities

- **RSC Migration**: Phase 1A → Phase 1B (DAL implementation)
- **Test System**: Ready for archetype implementation
- **Development**: Server-first with shadcn/ui for new features

### Documentation Philosophy

- Actionable information only, no justifications or selling points
- Focus on "what" and "how", not "why" something is beneficial
- No marketing language, performance claims, or convincing explanations
- Designed for efficient LLM consumption, context reminders without persuasion
- Scope of changes matters, not time estimates or session planning
- Don't commit with --no-verify unless explicitly instructed

# PinPoint Agent Guidelines & Repository Overview

## ✅ Critical Context Files
The following files contain critical context and should be read immediately:
- `docs/CORE/NON_NEGOTIABLES.md` - Forbidden patterns and critical constraints
- `docs/CORE/TYPESCRIPT_STRICTEST_PATTERNS.md` - Type safety patterns
- `package.json` - Available scripts, dependencies, and project configuration
- `docs/CORE/TESTING_GUIDE.md` - Testing guidelines and patterns

## 🚨 CRITICAL CONSTRAINTS

### Non-Negotiable Patterns

- **Memory safety**: Use worker-scoped PGlite instances (per-test instances cause system lockups)
- **No migration files**: Pre-beta has zero users, schema changes via direct modification only
- **No Vitest redirection**: Commands like `npm test 2>&1` break test execution
- **Schema lock**: Code adapts to schema, never modify schema to fix TypeScript errors
- **Organization scoping**: All queries must include organizationId for security
- **Server-first**: Default to Server Components, minimal Client Components
- **shadcn/ui only**: No new MUI components, use shadcn/ui for all new development
- **Material Design 3 colors only**: All colors must come from the Material 3 color system in globals.css

### Library Knowledge Gap

- **Training Cutoff**: January 2025, current date September 2025 - 8+ months behind
- **Required Libraries**: Drizzle, Supabase, Next.js, shadcn/ui, Server Components, Server Actions, Vitest
- **Process**: Research current patterns before implementation

## 📍 PROJECT CONTEXT

### Project Status
- Pre-beta phase, zero production users
- Solo development, high risk tolerance for breaking changes
- Core features and navigation still being decided

### Technology Stack
- **Frontend**: Next.js 15, React 19 with Server Components, shadcn/ui, Tailwind CSS v4
- **Backend**: tRPC, Drizzle ORM, PostgreSQL via Supabase
- **Authentication**: Supabase SSR with RLS (Row-Level Security)
- **Testing**: Vitest, Playwright, pgTAP for RLS testing
- **Language**: TypeScript with strictest configuration

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

## 🛠️ DEVELOPMENT RULES

### Command Recommendations
| Consider Avoiding | Prefer | Reason |
| ----------------- | ------ | ------ |
| `npm test 2>&1` | `npm test` | Vitest treats redirection as test filters |
| `find` | `rg --files`, `fd` | Safer/faster search |
| `require()` | ES module `import` | Project is type: "module" (ESM) |

### Available Commands
- **Testing**: `npm test`, `npm run test:watch`, `npm run test:rls`, `npm run smoke`
- **Development**: `npm run dev`, `npm run build`, `npm run lint`, `npm run type-check`
- **Components**: `npx shadcn@latest add [component]`

### Seed Data Pattern
**Critical**: Use hardcoded SEED_TEST_IDS for predictable debugging
- `SEED_TEST_IDS.ORGANIZATIONS.primary` → "test-org-pinpoint"
- `SEED_TEST_IDS.USERS.ADMIN` → "test-user-tim"
- `SEED_TEST_IDS.MOCK_PATTERNS.MACHINE` → "mock-machine-1"

## 📚 PROJECT STRUCTURE & MODULES

- **Source**: `src/app` (Next.js App Router), `src/components` (client/server UI), `src/lib`, `src/hooks`, `src/server`, `src/utils`, `src/types`
- **Tests**: unit/integration in `src/test`, Playwright E2E in `e2e/`, SQL/RLS tests in `supabase/tests`
- **Data & Infra**: `supabase/` (config, seeds, RLS, tests), Drizzle configs in `drizzle.config.*.ts`, helper scripts in `scripts/`, static assets in `public/`

## 🔨 BUILD, TEST, AND DEVELOPMENT

- `npm run dev`: Start Next.js dev server (use `dev:full` to include typecheck)
- `npm run build` / `npm start`: Production build and server
- `npm run typecheck`: Strict TypeScript checks
- `npm test`: Vitest unit/integration suite. `npm run test:watch` for TDD
- `npm run smoke`: Quick Playwright smoke E2E. `npm run test:ci` runs unit + RLS + smoke
- **Database**: `npm run db:push:local` (apply schema via Drizzle push), `npm run db:generate-types` (Supabase types), `npm run db:studio` (schema explorer), `npm run db:reset` (reset local dev DB)

## ✍️ CODING STYLE & NAMING

- **Formatting**: Prettier; run `npm run format:write`. Lint: ESLint via `npm run lint`
- **TypeScript everywhere**: prefer explicit types on public APIs
- **Application code**: must follow TypeScript Strictest settings
- **Components**: PascalCase files (e.g., `ProfilePictureUpload.tsx`). Client-only pieces may use `-client.tsx` or live under a `client/` folder with `"use client"`
- **Hooks**: `useThing.ts`. Utilities/constants: kebab-case or snake_case files; booleans prefixed `is/has`

## 🧪 TESTING GUIDELINES

- **Frameworks**: Vitest (+ Testing Library), Playwright, and SQL/RLS tests
- **Naming**: `*.test.ts(x)` for unit/integration, `*.e2e.test.ts`/`*.spec.ts` under `e2e/`, SQL tests in `supabase/tests/rls/*.test.sql`
- **Coverage**: services, server actions, and RLS-critical paths. Use helpers under `src/test/**`
- **Authority**: `docs/CORE/TESTING_GUIDE.md` for test type selection, naming, placement, and templates

## 📝 COMMIT & PULL REQUESTS

- **Commits**: Conventional style where practical (`feat:`, `fix:`, `chore:`, `build:`), optional scope, reference issues/PRs
- **PRs**: clear description, linked issue, screenshots for UI, notes for DB schema/seed changes, and steps to verify
- **Before pushing**: `npm run typecheck && npm test && npm run smoke && npm run lint`
- **Drizzle workflow**: use `db:push:*`; do not add new SQL files under `supabase/migrations/` (initial snapshot is retained)

## 🔐 SECURITY & CONFIGURATION

- **Env**: copy `.env.example` to `.env.local` or `npm run env:pull`. Never commit secrets
- **Supabase**: `npm run sb:reset` to bootstrap local; `sb:volumes:clean` is destructive
- **Hooks**: Husky + lint-staged format on commit; optional `npm run pre-commit:gitleaks` for secret scanning

## 📖 ESSENTIAL DOCUMENTATION

- **NON_NEGOTIABLES.md** - Critical patterns and forbidden practices (MUST READ)
- **TARGET_ARCHITECTURE.md** - Architectural authority for all decisions
- **TESTING_GUIDE.md** - Test types and standards
- **TYPE_INVENTORY.md** - Type system reference and import patterns

## ⚡ QUALITY GATES

- All tests pass before commits
- Pre-commit hooks (husky + shellcheck)
- Server-first principles for new development
- Organization scoping in all multi-tenant queries
- SEED_TEST_IDS for predictable testing

**USAGE**: This serves as the central agent context for PinPoint development. Read and follow all critical constraints, especially those in NON_NEGOTIABLES.md.
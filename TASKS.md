# PinPoint v2 Greenfield Tasks

**Last Updated**: November 10, 2025
**Status**: Greenfield initialization phase

**Purpose**: Task breakdown organized by Pull Request for GitHub issue creation.

---

## PR Overview

```
PR 1 (Foundation) → PR 2 (Schema) → PR 3 (Supabase) → PR 4 (UI) → PR 5 (Testing)
                                                                      ↓
                                                                   PR 6 (Auth)
                                                                      ↓
                                                                   PR 7 (Machines)
                                                                      ↓
                                                                   PR 8 (Issues)
                                                                      ↓
                                                                   PR 9 (Comments)
                                                                      ↓
                                                                   PR 10 (Error/Loading)
                                                                      ↓
                                                                   PR 11 (A11y/Docs)
```

---

## PR 1: Project Foundation ⚙️

**Branch**: `setup/project-initialization`
**Description**: Initialize npm project, TypeScript, linting, formatting, git hooks, GitHub Actions
**Deliverables**: Can run `npm run dev`, `npm run typecheck`, `npm run lint`, CI passing

### Tasks

#### Project Initialization
- [ ] Initialize npm project (`npm init`)
- [ ] Set `"type": "module"` in package.json
- [ ] Install Next.js 16 (`npm install next@latest react@latest react-dom@latest`)
- [ ] Install TypeScript (`npm install -D typescript @types/react @types/node`)
- [ ] Install @tsconfig/strictest (`npm install -D @tsconfig/strictest`)
- [ ] Create initial Next.js app structure (manual setup or `npx create-next-app@latest`)

#### Build & Dev Tools
- [ ] Install cross-env (`npm install -D cross-env`) - only if developing cross-platform (Windows + Mac/Linux)

#### TypeScript Configuration
- [ ] Create `tsconfig.base.json` (shared configuration)
  - Path aliases (`~/` and `@/` → `./src/*`)
- [ ] Create `tsconfig.json` (main app config)
  - Extend `tsconfig.base.json` and `@tsconfig/strictest`
  - Enable `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`
  - Include src, middleware.ts, types
  - Exclude tests, config files, scripts
- [ ] Create `tsconfig.config.json` (for config files)
  - Looser strictness for tooling files
- [ ] Create `tsconfig.tests.json` (for test files)
  - Include test files and helpers
- [ ] Verify all TypeScript compilation works

#### Linting & Formatting
- [ ] Install ESLint packages
  - `npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-config-next`
  - `npm install -D @microsoft/eslint-formatter-sarif` (for GitHub Code Scanning)
- [ ] Configure ESLint for Next.js + TypeScript
  - Type-aware rules
  - Custom rules for security patterns
- [ ] Install Prettier (`npm install -D prettier`)
- [ ] Create `.prettierrc` config
- [ ] Create `.prettierignore` file
- [ ] Install eslint-config-prettier (`npm install -D eslint-config-prettier`)

#### Security Tools (Minimal)
- [ ] Create `scripts/` directory
- [ ] Add gitleaks to pre-commit hook (secret scanning)
  - Installed in CI, not locally
  - Prevents committing API keys, passwords

#### Git Hooks (Husky + lint-staged)
- [ ] Install Husky (`npm install -D husky`)
- [ ] Initialize Husky (`npx husky install`)
- [ ] Install lint-staged (`npm install -D lint-staged`)
- [ ] Create `.husky/pre-commit` hook
  - Run lint-staged (format + lint staged files only)
- [ ] Add prepare script to package.json (`"prepare": "husky"`)
- [ ] Configure lint-staged in package.json

#### GitHub Actions (Minimal)
- [ ] Create `.github/workflows/` directory
- [ ] Create `.github/workflows/ci.yml`
  - Node.js setup with dependency caching
  - Typecheck job (`npm run typecheck`)
  - Lint job (`npm run lint`)
  - Format check job (`npm run format`)
  - Build job (`npm run build`)
  - Test job (`npm test`)
  - gitleaks scan (secret detection)
  - npm audit (dependency vulnerabilities)
  - Triggers on push and pull_request to main

#### GitHub Actions - CodeQL (free security scanning)
- [ ] Enable CodeQL in GitHub Security settings
  - Automated JavaScript/TypeScript analysis
  - Zero configuration needed
  - Or create `.github/workflows/codeql.yml` for custom config

#### PostCSS Configuration
- [ ] Install PostCSS (`npm install -D postcss`)
- [ ] Create `postcss.config.mjs`
  - Configure for Tailwind CSS v4

#### Directory Structure
- [ ] Create `src/app/` (Next.js App Router)
  - [ ] `layout.tsx` (root layout)
  - [ ] `page.tsx` (home page)
  - [ ] `globals.css`
- [ ] Create `src/components/ui/` (for shadcn components)
- [ ] Create `src/lib/` (utilities)
- [ ] Create `src/lib/types/` (shared TypeScript types)

#### Environment Files
- [ ] Create `.env.example` template
- [ ] Create `.env.local` (gitignored)
- [ ] Add `.gitignore` entries for env files

#### Package.json Scripts (Simplified)
**Essential Scripts:**
- [ ] `dev` - Start Next.js dev server
- [ ] `build` - Build for production
- [ ] `start` - Start production server
- [ ] `typecheck` - Run TypeScript type checking (all tsconfig files)
- [ ] `lint` - Run ESLint
- [ ] `lint:fix` - Auto-fix ESLint issues
- [ ] `format` - Check Prettier formatting
- [ ] `format:fix` - Auto-format with Prettier
- [ ] `test` - Run Vitest tests
- [ ] `test:watch` - Vitest watch mode
- [ ] `prepare` - Husky install (runs on npm install)

### Verification
- [ ] `npm run dev` starts development server
- [ ] `npm run build` completes without errors
- [ ] `npm run typecheck` passes (all tsconfig files)
- [ ] `npm run lint` passes
- [ ] `npm run format` passes
- [ ] GitHub Actions CI workflow passes
- [ ] Pre-commit hook runs on commit (lint-staged)
- [ ] gitleaks scan passes in CI

---

## PR 2: Database Schema 🗄️

**Branch**: `setup/database-schema`
**Description**: Drizzle ORM setup and complete schema definition
**Deliverables**: Schema compiles, can generate migrations, types available

### Tasks

#### Drizzle ORM Setup
- [ ] Install Drizzle (`npm install drizzle-orm`)
- [ ] Install Drizzle Kit (`npm install -D drizzle-kit`)
- [ ] Install PostgreSQL driver (`npm install postgres`)
- [ ] Create `drizzle.config.ts`
- [ ] Create `src/server/db/index.ts` (database instance)

#### Database Schema
- [ ] Create `src/server/db/schema.ts`
- [ ] Define `users` table
  - id (uuid, primary key, default gen_random_uuid())
  - email (text, unique, not null)
  - name (text)
  - role (text: 'guest' | 'member' | 'admin', default 'guest')
  - created_at (timestamp, default now())
  - updated_at (timestamp, default now())
- [ ] Define `machines` table
  - id (uuid, primary key, default gen_random_uuid())
  - name (text, not null)
  - created_at (timestamp, default now())
  - updated_at (timestamp, default now())
- [ ] Define `issues` table
  - id (uuid, primary key, default gen_random_uuid())
  - machine_id (uuid, not null, foreign key → machines.id ON DELETE CASCADE)
  - title (text, not null)
  - description (text)
  - status (text: 'new' | 'in_progress' | 'resolved', default 'new')
  - severity (text: 'minor' | 'playable' | 'unplayable', default 'playable')
  - reported_by (uuid, foreign key → users.id)
  - assigned_to (uuid, foreign key → users.id)
  - resolved_at (timestamp)
  - created_at (timestamp, default now())
  - updated_at (timestamp, default now())
  - CHECK constraint: `machine_id IS NOT NULL`
- [ ] Define `comments` table
  - id (uuid, primary key, default gen_random_uuid())
  - issue_id (uuid, not null, foreign key → issues.id ON DELETE CASCADE)
  - author_id (uuid, foreign key → users.id)
  - content (text, not null)
  - created_at (timestamp, default now())
  - updated_at (timestamp, default now())
- [ ] Add Drizzle relations definitions
- [ ] Add package.json scripts:
  - [ ] `db:generate` - Generate Drizzle migrations
  - [ ] `db:push` - Push schema to database
  - [ ] `db:studio` - Open Drizzle Studio

### Verification
- [ ] `npx drizzle-kit generate` works without errors
- [ ] Schema types are available for import
- [ ] TypeScript compilation includes schema types
- [ ] No TypeScript errors in schema file

---

## PR 3: Supabase SSR Authentication 🔐

**Branch**: `setup/supabase-auth`
**Description**: Supabase client, middleware, auth callback, schema deployment
**Deliverables**: Auth infrastructure complete, can connect to Supabase

### Tasks

#### Supabase Setup
- [ ] Install Supabase packages (`npm install @supabase/supabase-js @supabase/ssr`)
- [ ] Create Supabase projects (preview & production via Supabase dashboard)
- [ ] Add Supabase env vars to `.env.example`
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] Add Supabase credentials to `.env.local`

#### Supabase SSR Client
- [ ] Create `src/lib/supabase/server.ts` (SSR client wrapper)
  - Implement createClient() with cookie handlers
  - Follow CORE-SSR-001 pattern (getAll/setAll cookies)
  - Call auth.getUser() immediately after client creation (CORE-SSR-002)
- [ ] Create Next.js middleware (`middleware.ts`)
  - Token refresh logic
  - Follow Supabase SSR middleware pattern
  - Don't modify response object (CORE-SSR-004)
- [ ] Create auth callback route (`src/app/auth/callback/route.ts`)
  - Handle OAuth callback
  - Redirect to home after successful auth

#### Schema Deployment
- [ ] Apply schema to Supabase preview project
  - Use `npx drizzle-kit push` or SQL import
- [ ] Verify tables exist in Supabase dashboard
- [ ] Test database connection from application

### Verification
- [ ] Middleware runs without errors
- [ ] Auth callback route responds (test with curl)
- [ ] Can connect to Supabase database
- [ ] Schema exists in Supabase project
- [ ] No Supabase SSR warnings in console

---

## PR 4: UI Foundation 🎨

**Branch**: `setup/ui-foundation`
**Description**: Tailwind CSS v4, Material Design 3 colors, shadcn/ui setup
**Deliverables**: UI framework ready, can use shadcn components

### Tasks

#### Tailwind CSS v4
- [ ] Install Tailwind CSS v4 (`npm install tailwindcss@next`)
- [ ] Create CSS-based Tailwind config in `src/app/globals.css`
  - Use `@import "tailwindcss"` directive
  - Configure with `@config` directive (no `tailwind.config.js`)
- [ ] Add Material Design 3 color system to globals.css
  - Primary, secondary, tertiary colors
  - Surface, background, error colors
  - Light and dark variants
- [ ] Update Next.js config for Tailwind CSS v4
- [ ] Verify Tailwind works in development

#### shadcn/ui Setup
- [ ] Install shadcn/ui CLI dependencies
- [ ] Initialize shadcn/ui (`npx shadcn@latest init`)
  - Configure for Next.js App Router
  - Use TypeScript
  - Use CSS variables for theming
- [ ] Install base components:
  - [ ] `button`
  - [ ] `card`
  - [ ] `form`
  - [ ] `input`
  - [ ] `label`
  - [ ] `select`
  - [ ] `textarea`
  - [ ] `badge`
  - [ ] `table`
  - [ ] `dialog`
  - [ ] `dropdown-menu`

### Verification
- [ ] Tailwind classes work in components
- [ ] Material Design 3 colors apply correctly
- [ ] shadcn components render with styles
- [ ] No `tailwind.config.js` file exists
- [ ] Can use shadcn components in pages

---

## PR 5: Testing Infrastructure 🧪

**Branch**: `setup/testing`
**Description**: Vitest, PGlite, Playwright setup with example tests
**Deliverables**: Can run `npm test` and `npm run smoke`

### Tasks

#### Vitest Setup
- [ ] Install Vitest (`npm install -D vitest @vitest/ui`)
- [ ] Install React Testing Library (`npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event`)
- [ ] Create `vitest.config.ts`
  - Configure path aliases (`~/*`)
  - Set up test environment (jsdom)
  - Configure globals (describe, it, expect)
- [ ] Add test scripts to package.json
  - [ ] `test` - Run Vitest unit/integration tests
  - [ ] `test:watch` - Vitest watch mode
  - [ ] `test:ui` - Vitest UI

#### PGlite Integration Testing
- [ ] Install PGlite (`npm install -D @electric-sql/pglite`)
- [ ] Create `src/test/setup/` directory
- [ ] Create worker-scoped PGlite instance setup
- [ ] Create database test helpers in `src/test/helpers/`
  - Setup/teardown utilities
  - Test data factories
  - Schema application helpers
- [ ] Write example integration test (database query)

#### Playwright E2E Setup (Simplified)
- [ ] Install Playwright (`npm install -D @playwright/test`)
- [ ] Initialize Playwright (`npx playwright install`)
- [ ] Create `playwright.config.ts`
  - Configure base URL
  - Single chromium project (keep it simple)
  - Basic retries and timeouts
- [ ] Create `e2e/` directory
  - [ ] `smoke/` subdirectory for smoke tests
- [ ] Write example smoke test (home page loads)
- [ ] Add `smoke` script to package.json

#### GitHub Actions - E2E Tests
- [ ] Add E2E job to `.github/workflows/ci.yml`
  - Install Playwright browsers
  - Run smoke tests (`npm run smoke`)
  - Upload Playwright trace on failure

### Verification
- [ ] `npm test` runs and passes
- [ ] Example integration test with PGlite passes
- [ ] `npm run smoke` runs Playwright test
- [ ] Example E2E test passes
- [ ] GitHub Actions runs tests successfully

---

## PR 6: Authentication Pages 🔑

**Branch**: `feat/auth-pages`
**Description**: Login, signup pages with Server Actions and auth guards
**Deliverables**: Full auth flow working (sign up, log in, log out, protected routes)

### Tasks

#### Authentication Pages
- [ ] Create `src/app/(auth)/` route group
- [ ] Create `src/app/(auth)/layout.tsx` (auth pages layout)
- [ ] Create `src/app/(auth)/login/page.tsx`
  - Email/password login form
  - Progressive enhancement (works without JS)
  - Display validation errors
- [ ] Create `src/app/(auth)/signup/page.tsx`
  - Registration form
  - Email, password, name fields
  - Progressive enhancement
- [ ] Create `src/app/(auth)/actions.ts` (Server Actions)
  - Login action with Zod validation
  - Signup action with Zod validation
  - Logout action
- [ ] Add logout button to root layout (when authenticated)

#### Protected Routes Pattern
- [ ] Create auth guard helper in `src/lib/auth.ts`
  - Check user in Server Component
  - Redirect to login if unauthenticated
  - Return user if authenticated
- [ ] Create example protected page
- [ ] Document auth patterns in `docs/PATTERNS.md`
  - Auth check in Server Components
  - Auth check in Server Actions
  - Protected route pattern

#### Tests
- [ ] Unit tests for validation schemas
- [ ] Integration tests for auth actions
- [ ] E2E test for signup flow
- [ ] E2E test for login flow
- [ ] E2E test for protected route redirect

### Verification
- [ ] Can sign up with new account
- [ ] Can log in with credentials
- [ ] Can log out
- [ ] Protected routes redirect to login when unauthenticated
- [ ] Auth state persists across page refreshes
- [ ] All tests pass

---

## PR 7: Machines CRUD 🎰

**Branch**: `feat/machines-crud`
**Description**: Complete CRUD for machines (list, create, detail, edit, delete)
**Deliverables**: Can manage machines end-to-end, patterns established

### Tasks

#### Machine List Page
- [ ] Create `src/app/machines/page.tsx`
- [ ] Add auth guard (protected route)
- [ ] Implement direct Drizzle query (Server Component)
  - Query all machines, order by name
- [ ] Display machines in table or cards
- [ ] Add "Create Machine" button
- [ ] Style with shadcn components

#### Create Machine Form
- [ ] Create `src/app/machines/actions.ts`
- [ ] Create Server Action for machine creation
  - Zod validation schema (name required)
  - Auth check
  - Database insert with Drizzle
  - Revalidate path
  - Redirect to machine detail
- [ ] Create `src/app/machines/new/page.tsx`
- [ ] Create form component
  - Name input field
  - Progressive enhancement (works without JS)
  - Server Action submission
  - Display validation errors
- [ ] Update `docs/PATTERNS.md` with Server Action pattern

#### Machine Detail Page
- [ ] Create `src/app/machines/[machineId]/page.tsx`
- [ ] Add auth guard
- [ ] Query machine by ID (direct Drizzle)
- [ ] Display machine details
- [ ] Show count of associated issues
- [ ] Add edit and delete buttons
- [ ] Create edit form (inline or separate page)
- [ ] Create delete action with confirmation

#### Tests
- [ ] Unit tests for validation schemas
- [ ] Integration tests for machine queries
- [ ] Integration tests for machine mutations
- [ ] E2E test for create machine flow
- [ ] E2E test for edit machine flow
- [ ] E2E test for delete machine flow

### Verification
- [ ] Can view list of machines
- [ ] Can create new machine
- [ ] Can view machine details
- [ ] Can edit machine
- [ ] Can delete machine
- [ ] All tests pass
- [ ] Patterns documented in PATTERNS.md

---

## PR 8: Issues Per Machine 🐛

**Branch**: `feat/issues-system`
**Description**: Issue CRUD with machine requirement, status/severity management
**Deliverables**: Core issue tracking working, CHECK constraint enforced

### Tasks

#### Issue List Page
- [ ] Create `src/app/machines/[machineId]/issues/page.tsx`
- [ ] Add auth guard
- [ ] Query issues for machine with relations
  - Include assigned user, reporter
  - Order by created_at desc
- [ ] Display issues with severity badges
- [ ] Show status for each issue
- [ ] Add "Create Issue" button
- [ ] Optional: Filter by status

#### Create Issue Form
- [ ] Create `src/app/machines/[machineId]/issues/actions.ts`
- [ ] Create Server Action for issue creation
  - Validate machineId is present (CORE-ARCH-004)
  - Zod schema with severity enum ('minor' | 'playable' | 'unplayable')
  - Auth check for reported_by
  - Database insert with Drizzle
  - Revalidate path
- [ ] Create `src/app/machines/[machineId]/issues/new/page.tsx`
- [ ] Create form component
  - Title input (required)
  - Description textarea
  - Severity selector (minor/playable/unplayable)
  - Machine is implicit from URL
  - Progressive enhancement
- [ ] Update `docs/PATTERNS.md` with issues-per-machine pattern

#### Issue Detail Page
- [ ] Create `src/app/issues/[issueId]/page.tsx`
- [ ] Add auth guard
- [ ] Query issue with relations (machine, reporter, assignee)
- [ ] Display issue details
- [ ] Show related machine (link back)
- [ ] Display current status and severity
- [ ] Add update status action (dropdown or buttons)
- [ ] Add update severity action
- [ ] Add assign to user action (dropdown)

#### Issue Update Actions
- [ ] Create `src/app/issues/[issueId]/actions.ts`
- [ ] Update status action (Zod validation, auth check)
- [ ] Update severity action
- [ ] Update assigned user action
- [ ] Resolve issue action (sets resolved_at timestamp)

#### Tests
- [ ] Unit tests for issue validation schemas
- [ ] Integration tests for issue queries
- [ ] Integration tests for issue mutations
- [ ] E2E test for create issue flow
- [ ] E2E test for update issue status flow
- [ ] Test CHECK constraint (issues require machine)
  - Try to insert issue without machine_id (should fail)

### Verification
- [ ] Can view issues for a machine
- [ ] Can create new issue for machine
- [ ] Can view issue details
- [ ] Can update issue status
- [ ] Can update issue severity
- [ ] Can assign issue to user
- [ ] CHECK constraint prevents issues without machines
- [ ] All tests pass

---

## PR 9: Comments System 💬

**Branch**: `feat/issue-comments`
**Description**: Add comments to issues
**Deliverables**: Full issue collaboration with comments

### Tasks

#### Comments Display
- [ ] Update `src/app/issues/[issueId]/page.tsx`
- [ ] Query comments for issue (with author relation)
- [ ] Display comments list
  - Author name
  - Timestamp
  - Content
- [ ] Order comments by created_at asc (chronological)

#### Add Comment Form
- [ ] Update `src/app/issues/[issueId]/actions.ts`
- [ ] Create Server Action for adding comments
  - Zod validation (content required, min length)
  - Auth check for author_id
  - Database insert with Drizzle
  - Revalidate path
- [ ] Add comment form to issue detail page
  - Textarea for comment content
  - Progressive enhancement
  - Submit button
- [ ] Display validation errors

#### Tests
- [ ] Unit tests for comment validation
- [ ] Integration tests for comment queries
- [ ] Integration tests for comment creation
- [ ] E2E test for add comment flow

### Verification
- [ ] Can view comments on issue
- [ ] Can add new comment
- [ ] Comments display with author and timestamp
- [ ] All tests pass

---

## PR 10: Error & Loading States ⚠️

**Branch**: `polish/error-handling`
**Description**: Error boundaries, 404 pages, loading states, skeletons
**Deliverables**: Robust error/loading UX across all routes

### Tasks

#### Error Handling
- [ ] Create `src/app/error.tsx` (root error boundary)
  - Display friendly error message
  - "Try again" button
  - Log error to console
- [ ] Create `src/app/machines/error.tsx` (machines section error)
- [ ] Create `src/app/issues/error.tsx` (issues section error)
- [ ] Create `src/app/not-found.tsx` (global 404 page)
- [ ] Create `src/app/machines/[machineId]/not-found.tsx` (machine not found)

#### Loading States
- [ ] Create `src/app/machines/loading.tsx`
  - Skeleton loader for machine list
- [ ] Create `src/app/machines/[machineId]/loading.tsx`
  - Skeleton loader for machine detail
- [ ] Create `src/app/issues/[issueId]/loading.tsx`
  - Skeleton loader for issue detail
- [ ] Add Suspense boundaries for slow components
  - Issue list in machine detail
  - Comments in issue detail

#### Skeleton Loaders
- [ ] Create reusable skeleton components in `src/components/ui/`
  - Card skeleton
  - Table skeleton
  - List skeleton
- [ ] Style with Tailwind animate-pulse

### Verification
- [ ] Error boundaries catch and display errors
- [ ] 404 pages display for missing resources
- [ ] Loading states display during data fetching
- [ ] Skeleton loaders provide visual feedback
- [ ] Navigation feels smooth with loading states

---

## PR 11: Accessibility & Documentation ♿

**Branch**: `polish/accessibility-docs`
**Description**: A11y testing, keyboard nav, README, env documentation
**Deliverables**: Production-ready polish, new contributors can set up project

### Tasks

#### Accessibility
- [ ] Test keyboard navigation
  - Tab through all interactive elements
  - Enter/Space activate buttons
  - Escape closes dialogs
- [ ] Verify form labels
  - All inputs have associated labels
  - Error messages linked to inputs with aria-describedby
- [ ] Add ARIA attributes where needed
  - aria-label for icon buttons
  - aria-live for dynamic content
  - role attributes for custom widgets
- [ ] Test with screen reader (basic check)
  - VoiceOver (macOS) or NVDA (Windows)
- [ ] Fix any accessibility issues found

#### Documentation
- [ ] Update `README.md`
  - Project description and purpose
  - Tech stack overview
  - Prerequisites (Node version, Supabase account)
  - Setup instructions (clone, install, env setup, database)
  - Development commands
  - Testing commands
  - Deployment instructions (Vercel)
- [ ] Document environment variables
  - Update `.env.example` with all required vars
  - Add comments explaining each variable
- [ ] Create `docs/DEVELOPMENT.md` (optional)
  - Development workflow
  - Running tests
  - Database management
  - Troubleshooting common issues

### Verification
- [ ] Can navigate entire app with keyboard
- [ ] Screen reader announces content correctly
- [ ] New developer can follow README to set up project
- [ ] All environment variables documented
- [ ] No accessibility warnings in browser console

---

## MVP Completion Criteria

**MVP is complete when:**
- [ ] All PR 1-11 tasks completed and merged
- [ ] 5 critical E2E tests passing:
  - [ ] User can sign up and log in
  - [ ] User can create a machine
  - [ ] User can create an issue for a machine
  - [ ] User can view issues for a machine
  - [ ] User can resolve an issue
- [ ] TypeScript compilation with no errors
- [ ] All quality gates pass:
  - [ ] Linting passes
  - [ ] Formatting passes
  - [ ] Unit tests pass (~70-100 tests)
  - [ ] Integration tests pass (~25-35 tests)
  - [ ] E2E tests pass (5 smoke tests)
- [ ] GitHub Actions CI passing on main branch
- [ ] Can deploy to Vercel successfully
- [ ] Core value proposition achieved: "Log issues with pinball machines, track work, and resolve them"

---

## Notes

- **PR Strategy**: Each PR is independently reviewable and leaves project in working state
- **Testing**: Add tests in the same PR as the feature (not separate test PRs)
- **Scope Discipline**: Use Scope Firewall (3 questions) for any features not listed
- **Pattern Documentation**: Update `docs/PATTERNS.md` as patterns emerge (PRs 6-9)
- **Breaking Changes**: High tolerance - we have zero users
- **GitHub Issues**: Convert each PR section to a GitHub issue with tasks as checklist

**Reference**:
- Feature details: `docs/PRODUCT_SPEC.md`
- Architecture: `docs/TECH_SPEC.md`
- Patterns: `docs/PATTERNS.md`
- Constraints: `docs/NON_NEGOTIABLES.md`

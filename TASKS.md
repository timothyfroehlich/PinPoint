# PinPoint v2 Greenfield Tasks

**Last Updated**: November 10, 2025
**Status**: Greenfield initialization phase (scope refined)

**Purpose**: Task breakdown organized by Pull Request for GitHub issue creation.

---

## PR Overview

```
PR 1 (Foundation) → PR 2 (Schema) → PR 3 (Supabase) → PR 4 (UI + Landing) → PR 5 (Testing)
                                                                                 ↓
                                                                              PR 6 (Auth)
                                                                                 ↓
                                                                              PR 6.5 (Navigation)
                                                                                 ↓
                                                                              PR 7 (Machines)
                                                                                 ↓
                                                                              PR 8 (Issues)
                                                                                 ↓
                                                                              PR 8.5 (Public Reporting)
                                                                                 ↓
                                                                              PR 9 (Comments)
                                                                                 ↓
                                                                              PR 9.5 (Dashboard)
                                                                                 ↓
                                                                              PR 10 (Password Reset)
                                                                                 ↓
                                                                              PR 11 (Documentation)
```

**Deferred to MVP+:**
- Error boundaries & loading states
- Accessibility testing (shadcn/ui provides base a11y)
- Machine edit/delete (create-only for MVP)

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

#### TypeScript Configuration
- [ ] Create `tsconfig.base.json` (shared configuration)
  - Path aliases (`~/` and `@/` → `./src/*`)
- [ ] Create `tsconfig.json` (main app config)
  - Extend `tsconfig.base.json` and `@tsconfig/strictest`
  - Enable `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`
  - Include src, middleware.ts
  - Exclude tests, config files, scripts
- [ ] Create `tsconfig.tests.json` (for test files)
  - Extend `tsconfig.base.json` only (NOT strictest)
  - Include test files and helpers
  - Looser rules for test code
- [ ] Verify all TypeScript compilation works

#### Linting & Formatting
- [ ] Install ESLint packages
  - `npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-config-next`
- [ ] Configure ESLint for Next.js + TypeScript
  - Type-aware rules
- [ ] Install Prettier (`npm install -D prettier`)
- [ ] Create `.prettierrc` config
- [ ] Create `.prettierignore` file
- [ ] Install eslint-config-prettier (`npm install -D eslint-config-prettier`)

#### ShellCheck & ActionLint
- [ ] Install shellcheck locally (`brew install shellcheck` on Mac, or via apt)
- [ ] Create `.shellcheckrc` configuration file
- [ ] Create `scripts/` directory for bash scripts
- [ ] Install actionlint for workflow validation

#### Security Tools
- [ ] Add gitleaks to CI (secret scanning)
  - Prevents committing API keys, passwords

#### Git Hooks (Husky + lint-staged)
- [ ] Install Husky (`npm install -D husky`)
- [ ] Initialize Husky (`npx husky install`)
- [ ] Install lint-staged (`npm install -D lint-staged`)
- [ ] Create `.husky/pre-commit` hook
  - Run lint-staged (format + lint staged files only)
- [ ] Add prepare script to package.json (`"prepare": "husky"`)
- [ ] Configure lint-staged in package.json

#### GitHub Actions
- [ ] Create `.github/workflows/` directory
- [ ] Create `.github/workflows/ci.yml`
  - Node.js setup with dependency caching
  - Typecheck job (`npm run typecheck`)
  - Lint job (`npm run lint`)
  - Format check job (`npm run format`)
  - Build job (`npm run build`)
  - Test job (`npm test`)
  - ShellCheck job (lint bash scripts)
  - actionlint job (validate workflows)
  - gitleaks scan (secret detection)
  - npm audit (dependency vulnerabilities)
  - Triggers on push and pull_request to main

#### GitHub Actions - CodeQL (optional)
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

#### Package.json Scripts
**Essential Scripts:**
- [ ] `dev` - Start Next.js dev server
- [ ] `build` - Build for production
- [ ] `start` - Start production server
- [ ] `typecheck` - Run TypeScript type checking (main + tests)
- [ ] `lint` - Run ESLint
- [ ] `lint:fix` - Auto-fix ESLint issues
- [ ] `format` - Check Prettier formatting
- [ ] `format:fix` - Auto-format with Prettier
- [ ] `test` - Run Vitest tests
- [ ] `test:watch` - Vitest watch mode
- [ ] `smoke` - Run Playwright smoke tests
- [ ] `prepare` - Husky install (runs on npm install)
- [ ] `preflight` - Run everything before pushing (`typecheck && test:coverage && smoke && lint && format`)
  - This is what you run before pushing to GitHub
  - Runs all quality gates locally (including coverage check)

### Verification
- [ ] `npm run dev` starts development server
- [ ] `npm run build` completes without errors
- [ ] `npm run typecheck` passes (main + tests)
- [ ] `npm run lint` passes
- [ ] `npm run format` passes
- [ ] `npm run preflight` passes (runs all quality gates)
- [ ] GitHub Actions CI workflow passes
- [ ] Pre-commit hook runs on commit (lint-staged)
- [ ] gitleaks scan passes in CI
- [ ] ShellCheck validates bash scripts in CI
- [ ] actionlint validates workflows in CI

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
- [ ] Define `user_profiles` table (NOT `users`)
  - id (uuid, primary key, references auth.users(id) ON DELETE CASCADE)
  - name (text, not null)
  - avatar_url (text)
  - role (text: 'guest' | 'member' | 'admin', default 'member')
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
  - reported_by (uuid, foreign key → user_profiles.id)
  - assigned_to (uuid, foreign key → user_profiles.id)
  - resolved_at (timestamp)
  - created_at (timestamp, default now())
  - updated_at (timestamp, default now())
  - CHECK constraint: `machine_id IS NOT NULL`
- [ ] Define `issue_comments` table (NOT `comments`)
  - id (uuid, primary key, default gen_random_uuid())
  - issue_id (uuid, not null, foreign key → issues.id ON DELETE CASCADE)
  - author_id (uuid, foreign key → user_profiles.id)
  - content (text, not null)
  - is_system (boolean, default false) -- for timeline events
  - created_at (timestamp, default now())
  - updated_at (timestamp, default now())
- [ ] Add Drizzle relations definitions

#### Database Trigger (Auto-Profile Creation)
- [ ] Create `handle_new_user()` function
  - Auto-creates user_profiles record on signup
  - Copies name from Supabase auth.users metadata
  - Sets default role to 'member'
- [ ] Create trigger on `auth.users` table
  - AFTER INSERT trigger
  - Executes handle_new_user() function
- [ ] Document trigger in schema comments

#### Package.json Scripts
- [ ] Add package.json scripts:
  - [ ] `db:generate` - Generate Drizzle migrations
  - [ ] `db:push` - Push schema to database
  - [ ] `db:studio` - Open Drizzle Studio

### Verification
- [ ] `npx drizzle-kit generate` works without errors
- [ ] Schema types are available for import
- [ ] TypeScript compilation includes schema types
- [ ] No TypeScript errors in schema file
- [ ] Trigger script ready for deployment

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
  - Don't modify response object (CORE-SSR-005)
- [ ] Create auth callback route (`src/app/auth/callback/route.ts`)
  - Handle OAuth callback
  - Redirect to home after successful auth

#### Schema Deployment
- [ ] Apply schema to Supabase preview project
  - Use `npx drizzle-kit push` or SQL import
- [ ] Execute trigger creation SQL in Supabase SQL editor
- [ ] Verify tables exist in Supabase dashboard
- [ ] Test database connection from application
- [ ] Test trigger: Sign up new user, verify profile auto-created

### Verification
- [ ] Middleware runs without errors
- [ ] Auth callback route responds (test with curl)
- [ ] Can connect to Supabase database
- [ ] Schema exists in Supabase project
- [ ] Trigger creates user_profiles automatically
- [ ] No Supabase SSR warnings in console

---

## PR 4: UI Foundation & Landing Page 🎨

**Branch**: `setup/ui-foundation`
**Description**: Tailwind CSS v4, Material Design 3 colors, shadcn/ui setup, simple landing page
**Deliverables**: UI framework ready, can use shadcn components, localhost:3000 shows landing page

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
  - [ ] `avatar` (for navigation later)

#### Simple Landing Page
- [ ] Create `src/app/page.tsx` (replace default)
  - Clean, simple design
  - "PinPoint" heading
  - Tagline: "Pinball Machine Issue Tracking"
  - Brief description (1-2 sentences)
  - Sign Up / Sign In buttons (link to /auth/signup and /auth/login)
  - Link to /report for public issue reporting
  - Use Material Design 3 colors
  - Center content vertically and horizontally
  - **Static content** - same whether user is logged in or not
- [ ] Verify localhost:3000 shows landing page

### Verification
- [ ] Tailwind classes work in components
- [ ] Material Design 3 colors apply correctly
- [ ] shadcn components render with styles
- [ ] No `tailwind.config.js` file exists
- [ ] Can use shadcn components in pages
- [ ] Landing page displays at localhost:3000
- [ ] Landing page looks clean and centered

---

## PR 5: Testing Infrastructure 🧪

**Branch**: `setup/testing`
**Description**: Vitest, PGlite, Playwright setup with example tests
**Deliverables**: Can run `npm test` and `npm run smoke`

### Tasks

#### Vitest Setup
- [ ] Install Vitest (`npm install -D vitest @vitest/ui @vitest/coverage-v8`)
- [ ] Install React Testing Library (`npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event`)
- [ ] Create `vitest.config.ts`
  - Configure path aliases (`~/*`)
  - Set up test environment (jsdom)
  - Configure globals (describe, it, expect)
  - Configure coverage:
    - Provider: v8
    - Minimum coverage thresholds: 80% (lines, functions, branches, statements)
    - Include: `src/**/*.{ts,tsx}`
    - Exclude: `src/**/*.test.{ts,tsx}`, `src/test/**`, `src/app/**`, type definition files
- [ ] Add test scripts to package.json
  - [ ] `test` - Run Vitest unit/integration tests
  - [ ] `test:watch` - Vitest watch mode
  - [ ] `test:ui` - Vitest UI
  - [ ] `test:coverage` - Run tests with coverage report

#### PGlite Integration Testing
- [ ] Install PGlite (`npm install -D @electric-sql/pglite`)
- [ ] Create `src/test/setup/` directory
- [ ] Create worker-scoped PGlite instance setup (CORE-TEST-001)
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
- [ ] Write example smoke test (landing page loads)
- [ ] Add `smoke` script to package.json

#### Code Coverage Enforcement
- [ ] Add coverage check to `.github/workflows/ci.yml`
  - Run `npm run test:coverage` in CI
  - Fail build if coverage below 80%
  - Upload coverage reports as artifacts
- [ ] Add coverage badge to README (optional, after first run)

#### GitHub Actions - E2E Tests
- [ ] Add E2E job to `.github/workflows/ci.yml`
  - Install Playwright browsers
  - Run smoke tests (`npm run smoke`)
  - Upload Playwright trace on failure

### Verification
- [ ] `npm test` runs and passes
- [ ] `npm run test:coverage` generates coverage report
- [ ] Coverage thresholds enforce 80% minimum
- [ ] Example integration test with PGlite passes
- [ ] `npm run smoke` runs Playwright test
- [ ] Example E2E test passes (landing page)
- [ ] GitHub Actions runs tests successfully
- [ ] CI fails if coverage below 80%

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
  - Link to signup page
- [ ] Create `src/app/(auth)/signup/page.tsx`
  - Registration form
  - Email, password, name fields
  - Progressive enhancement
  - Link to login page
- [ ] Create `src/app/(auth)/actions.ts` (Server Actions)
  - Login action with Zod validation (CORE-SEC-002)
  - Signup action with Zod validation
  - Logout action
- [ ] Update landing page (`src/app/page.tsx`)
  - Wire Sign Up button to /auth/signup
  - Wire Sign In button to /auth/login

#### Protected Routes Pattern
- [ ] Create auth guard helper in `src/lib/auth.ts`
  - Check user in Server Component
  - Redirect to login if unauthenticated
  - Return user if authenticated
- [ ] Create example protected page (`src/app/dashboard/page.tsx`)
  - Simple "Dashboard" heading
  - Display user name/email
  - Logout button
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
- [ ] User profile auto-created (trigger works)
- [ ] Can log in with credentials
- [ ] Can log out
- [ ] Protected routes redirect to login when unauthenticated
- [ ] Auth state persists across page refreshes
- [ ] All tests pass
- [ ] Works on mobile (responsive design verified)

---

## PR 6.5: Navigation Framework 🧭

**Branch**: `feat/navigation-framework`
**Description**: Top navigation bar with user menu, logo, auth state handling
**Deliverables**: Navigation framework matching archived functionality (simplified for single-tenant)

### Tasks

#### Navigation Component
- [ ] Create `src/components/layout/navigation.tsx` (Server Component)
  - Fetch auth user in component
  - Conditional rendering based on auth state
  - Use Material Design 3 colors from globals.css

#### Unauthenticated Navigation
- [ ] Unauthenticated state shows:
  - "PinPoint" logo/text (links to /)
  - Sign In button (links to /auth/login)
  - Sign Up button (links to /auth/signup)
  - Use `bg-surface` and `border-outline-variant`

#### Authenticated Navigation
- [ ] Authenticated state shows:
  - "PinPoint" logo/text (links to /dashboard)
  - Quick Links section (center):
    - Issues button (links to /issues) - AlertTriangleIcon
    - Report Issue button (links to /issues/new) - PlusIcon
    - Machines button (links to /machines) - WrenchIcon
  - User section (right):
    - User name display
    - User avatar (use shadcn Avatar component)
    - User dropdown menu (see below)
  - Use `bg-primary-container` with `text-on-primary-container`

#### User Menu Component
- [ ] Create `src/components/layout/user-menu-client.tsx` (Client Component)
  - Use shadcn DropdownMenu
  - Avatar trigger with ChevronDown icon
  - Menu items:
    - Profile (UserIcon) - links to /profile (future)
    - Settings (SettingsIcon) - links to /settings (future)
    - Separator
    - Sign Out (LogOutIcon, text-error) - form with logout Server Action

#### Root Layout Integration
- [ ] Update `src/app/layout.tsx`
  - Import Navigation component
  - Place above main content
  - Pass auth context (from server)
- [ ] Install lucide-react icons if not installed
  - `npm install lucide-react`

#### Pattern Documentation
- [ ] Update `docs/PATTERNS.md`
  - Navigation auth state pattern
  - Server Component + Client Component composition
  - User menu dropdown pattern

#### Tests
- [ ] Integration test: Navigation renders correctly for unauthenticated user
- [ ] Integration test: Navigation renders correctly for authenticated user
- [ ] E2E test: User menu dropdown works
- [ ] E2E test: Logout from user menu works

### Verification
- [ ] Unauthenticated users see Sign In/Sign Up buttons
- [ ] Authenticated users see quick links and user menu
- [ ] User avatar displays with initials fallback
- [ ] User menu opens and closes correctly
- [ ] All navigation links work
- [ ] Logout works from user menu
- [ ] Works on mobile (responsive, may hide some quick links)
- [ ] All tests pass

---

## PR 7: Machines CRUD 🎰

**Branch**: `feat/machines-crud`
**Description**: Complete CRUD for machines (list, create, detail, edit, delete) with status derivation
**Deliverables**: Can manage machines end-to-end, machine status reflects open issues, patterns established

### Tasks

#### Machine List Page
- [ ] Create `src/app/machines/page.tsx`
- [ ] Add auth guard (protected route)
- [ ] Implement direct Drizzle query (Server Component)
  - Query all machines with issue counts, order by name
  - Include open issue counts by severity
- [ ] Display machines in table or cards
  - Show machine name
  - Show derived status badge (see below)
  - Show issue counts
- [ ] Add "Create Machine" button
- [ ] Style with shadcn components

#### Machine Status Derivation Logic
- [ ] Create `src/lib/machines/status.ts`
  - `deriveMachineStatus(issues)` helper function
  - Logic:
    - `unplayable`: At least one unplayable issue
    - `needs_service`: At least one playable/minor issue, no unplayable
    - `operational`: No open issues
- [ ] Apply status derivation in machine list query
- [ ] Display status badge with appropriate colors
  - Unplayable: Red/error
  - Needs Service: Yellow/warning
  - Operational: Green/success

#### Create Machine Form
- [ ] Create `src/app/machines/actions.ts`
- [ ] Create Server Action for machine creation
  - Zod validation schema (name required, min 1 char) (CORE-SEC-002)
  - Auth check (CORE-SEC-001)
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
- [ ] Query machine's open issues
- [ ] Display machine details
  - Machine name
  - Derived status badge
  - Created/updated timestamps
- [ ] Show list of associated issues
  - Link to each issue detail page
  - Show severity, status, title

#### Tests
- [ ] Unit tests for validation schemas
- [ ] Unit tests for status derivation logic
- [ ] Integration tests for machine queries
- [ ] Integration tests for machine mutations
- [ ] Integration test: Machine with unplayable issue shows "unplayable" status
- [ ] Integration test: Machine with no issues shows "operational" status
- [ ] E2E test for create machine flow

### Verification
- [ ] Can view list of machines
- [ ] Machine status reflects open issues correctly
- [ ] Can create new machine
- [ ] Can view machine details
- [ ] Machine page shows its issues
- [ ] Works on mobile (responsive design verified)
- [ ] All tests pass
- [ ] Patterns documented in PATTERNS.md

**Deferred to MVP+:** Machine edit/delete functionality

---

## PR 8: Issues Per Machine 🐛

**Branch**: `feat/issues-system`
**Description**: Issue CRUD with machine requirement, status/severity management, timeline events
**Deliverables**: Core issue tracking working, CHECK constraint enforced, timeline system functional

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
- [ ] Add filters (REQUIRED per PRODUCT_SPEC):
  - Filter by status (new/in_progress/resolved)
  - Filter by severity (minor/playable/unplayable)
  - Filter by assignee (dropdown of members)

#### Create Issue Form
- [ ] Create `src/app/machines/[machineId]/issues/actions.ts`
- [ ] Create Server Action for issue creation
  - Validate machineId is present (CORE-ARCH-004)
  - Zod schema with severity enum ('minor' | 'playable' | 'unplayable') (CORE-SEC-002)
  - Auth check for reported_by (CORE-SEC-001)
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
- [ ] Query issue comments (including system comments for timeline)
- [ ] Display issue details
  - Title, description
  - Severity badge
  - Status badge
  - Reporter, assignee
  - Created/updated/resolved timestamps
- [ ] Show related machine (link back)
- [ ] Display timeline (system comments + regular comments)
- [ ] Display current status and severity
- [ ] Add update status action (dropdown or buttons)
- [ ] Add update severity action
- [ ] Add assign to user action (dropdown)

#### Issue Update Actions
- [ ] Create `src/app/issues/[issueId]/actions.ts`
- [ ] Update status action (Zod validation, auth check)
  - Create timeline event: "Status changed from {old} to {new}"
- [ ] Update severity action
  - Create timeline event: "Severity changed from {old} to {new}"
- [ ] Update assigned user action
  - Create timeline event: "Assigned to {user}"
- [ ] Resolve issue action (sets resolved_at timestamp)
  - Create timeline event: "Marked as resolved"

#### Timeline System Events
- [ ] Create `src/lib/timeline/events.ts`
  - `createTimelineEvent(issueId, content)` helper
  - Inserts issue_comment with `is_system: true`
- [ ] Integrate timeline events into all update actions
- [ ] Display timeline in issue detail page
  - System comments styled differently (icon, muted text)
  - Regular comments styled normally

#### Tests
- [ ] Unit tests for issue validation schemas
- [ ] Integration tests for issue queries
- [ ] Integration tests for issue mutations
- [ ] Integration test: Status change creates system comment
- [ ] Integration test: Assignment creates system comment
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
- [ ] Timeline events created for all updates
- [ ] Timeline displays system events and comments together
- [ ] CHECK constraint prevents issues without machines
- [ ] Works on mobile (responsive design verified)
- [ ] All tests pass

---

## PR 8.5: Public Issue Reporting 📢

**Branch**: `feat/public-reporting`
**Description**: Anonymous public issue reporting form (no authentication required)
**Deliverables**: Public users can report issues without login, issues appear in member dashboard

### Tasks

#### Public Reporting Page
- [ ] Create `src/app/report/page.tsx` (public route, no auth guard)
- [ ] Query all machines (public can see machine list)
- [ ] Display simple form:
  - Machine dropdown (required)
  - Title input (required)
  - Description textarea
  - Severity selector (minor/playable/unplayable)
  - Progressive enhancement
- [ ] Use clear, friendly language for public users
  - "Report an Issue with a Pinball Machine"
  - Severity descriptions: "Minor (cosmetic)", "Playable (but needs attention)", "Unplayable (machine is down)"

#### Public Reporting Server Action
- [ ] Create `src/app/report/actions.ts`
- [ ] Create Server Action for anonymous reporting
  - Zod validation (machine_id, title required, severity enum) (CORE-SEC-002)
  - NO auth check (anonymous reporting)
  - Set `reported_by` to NULL
  - Database insert with Drizzle
  - Revalidate paths
  - Redirect to confirmation page
- [ ] Add rate limiting consideration (document for future if abused)

#### Confirmation Page
- [ ] Create `src/app/report/success/page.tsx`
- [ ] Display confirmation message
  - "Thank you for reporting this issue!"
  - "Our team has been notified and will address it soon."
  - Link back to report another issue

#### Navigation Update
- [ ] Add "Report Issue" link to unauthenticated navigation
  - Place next to Sign In/Sign Up buttons

#### Tests
- [ ] Integration test for anonymous issue creation
- [ ] Integration test: Anonymous issues have NULL reported_by
- [ ] Integration test: Anonymous issues appear in member issue lists
- [ ] E2E test for public issue reporting flow
  - Navigate to /report
  - Select machine, fill form, submit
  - See confirmation page
- [ ] Verify anonymous issues appear in authenticated views

### Verification
- [ ] Unauthenticated users can access /report
- [ ] Can select machine from dropdown
- [ ] Can submit issue without login
- [ ] Confirmation page displays after submission
- [ ] Issue appears in member dashboard with NULL reporter
- [ ] Works on mobile (responsive design verified)
- [ ] All tests pass

---

## PR 9: Comments System 💬

**Branch**: `feat/issue-comments`
**Description**: Add comments to issues (regular user comments, not system timeline events)
**Deliverables**: Full issue collaboration with comments

### Tasks

#### Comments Display
- [ ] Update `src/app/issues/[issueId]/page.tsx`
- [ ] Query comments for issue (with author relation)
  - Filter for `is_system: false` (regular comments only)
  - Timeline system comments already displayed separately
- [ ] Display comments list
  - Author name (or "Anonymous" if NULL)
  - Avatar (if available)
  - Timestamp
  - Content
- [ ] Order comments by created_at asc (chronological)

#### Add Comment Form
- [ ] Update `src/app/issues/[issueId]/actions.ts`
- [ ] Create Server Action for adding comments
  - Zod validation (content required, min length 1) (CORE-SEC-002)
  - Auth check for author_id (CORE-SEC-001)
  - Set `is_system: false`
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
- [ ] Integration test: Comments have is_system: false
- [ ] Integration test: Comments separate from timeline events
- [ ] E2E test for add comment flow

### Verification
- [ ] Can view comments on issue
- [ ] Can add new comment
- [ ] Comments display with author and timestamp
- [ ] Comments separate from timeline events
- [ ] Anonymous issues can receive comments from authenticated users
- [ ] Works on mobile (responsive design verified)
- [ ] All tests pass

---

## PR 9.5: Member Dashboard 📊

**Branch**: `feat/member-dashboard`
**Description**: Member dashboard with assigned issues, recent issues, unplayable machines, and stats
**Deliverables**: Default landing page after login shows critical information at a glance

### Tasks

#### Dashboard Page
- [ ] Create/update `src/app/dashboard/page.tsx`
- [ ] Add auth guard (protected route)
- [ ] Query data:
  - Issues assigned to current user (with machine relation)
  - Recently reported issues (last 10, with machine and reporter)
  - Unplayable machines (machines with unplayable issues)
  - Stats:
    - Total open issues count
    - Machines needing service count (machines with open issues)
    - Issues assigned to me count

#### Dashboard Layout
- [ ] Create card-based layout with shadcn Card
- [ ] Section: "Issues Assigned to Me"
  - List of assigned issues
  - Show title, severity, machine name
  - Link to issue detail
  - Empty state: "No issues assigned to you"
- [ ] Section: "Recently Reported Issues"
  - Last 10 issues reported
  - Show title, severity, machine, reporter
  - Link to issue detail
- [ ] Section: "Unplayable Machines"
  - List of machines with unplayable issues
  - Show machine name, issue count
  - Link to machine detail
  - Highlight with error color (critical attention needed)
- [ ] Section: "Quick Stats"
  - Card showing:
    - Open issues count
    - Machines needing service count
    - Issues assigned to me count

#### Navigation Updates
- [ ] Update `src/components/layout/navigation.tsx`
  - "PinPoint" logo links to /dashboard for authenticated users
- [ ] Update login redirect to go to /dashboard
- [ ] Update signup redirect to go to /dashboard

#### Pattern Documentation
- [ ] Update `docs/PATTERNS.md`
  - Dashboard query patterns
  - Card layout patterns
  - Stats calculation patterns

#### Tests
- [ ] Integration tests for dashboard queries
- [ ] Integration test: Assigned issues query returns correct issues
- [ ] Integration test: Unplayable machines query correct
- [ ] Integration test: Stats calculation correct
- [ ] E2E test for dashboard display (critical journey #5)
  - Login as user
  - See dashboard with assigned issues
  - See recent issues
  - See stats

### Verification
- [ ] Dashboard displays after login
- [ ] Assigned issues show correctly
- [ ] Recently reported issues show correctly
- [ ] Unplayable machines highlighted
- [ ] Quick stats display accurate counts
- [ ] All sections link to detail pages correctly
- [ ] Empty states display when no data
- [ ] Works on mobile (responsive design verified)
- [ ] All tests pass

---

## PR 10: Password Reset Flow 🔑

**Branch**: `feat/password-reset`
**Description**: Password reset flow (forgot password, reset link, new password)
**Deliverables**: Users can reset forgotten passwords via email

### Tasks

#### Password Reset Request Page
- [ ] Create `src/app/(auth)/forgot-password/page.tsx`
- [ ] Create form with email input
  - Progressive enhancement
  - Zod validation (email format)
  - Display success message after submission
- [ ] Create Server Action for password reset request
  - Call `supabase.auth.resetPasswordForEmail(email)`
  - Provide redirect URL to reset password page
  - Handle errors gracefully
- [ ] Add "Forgot password?" link to login page

#### Password Reset Confirmation Page
- [ ] Create `src/app/(auth)/reset-password/page.tsx`
- [ ] Create form for new password
  - Password input (with confirmation)
  - Zod validation (min length, match confirmation)
  - Progressive enhancement
- [ ] Create Server Action for password update
  - Call `supabase.auth.updateUser({ password: newPassword })`
  - Redirect to login after success
  - Handle errors (expired link, invalid token)

#### Email Configuration
- [ ] Configure Supabase email templates (in Supabase dashboard)
  - Password reset email template
  - Set redirect URL to app's reset password page
- [ ] Test email delivery in preview environment

#### Tests
- [ ] Integration test: Password reset request creates email
- [ ] Integration test: Password update succeeds with valid token
- [ ] E2E test: Full password reset flow
  - Request reset
  - Click email link (mock or manual)
  - Set new password
  - Login with new password

### Verification
- [ ] Can request password reset from login page
- [ ] Reset email is sent (check inbox or Supabase logs)
- [ ] Reset link redirects to reset password page
- [ ] Can set new password successfully
- [ ] Can log in with new password
- [ ] Expired/invalid tokens show error message
- [ ] All tests pass

---

## PR 11: Documentation 📖

**Branch**: `docs/mvp-documentation`
**Description**: README, setup guide, environment variables documentation
**Deliverables**: Friends can clone repo and get it running

### Tasks

#### README.md
- [ ] Update `README.md` with comprehensive setup guide
  - Project description: "Issue tracking for pinball machines at Austin Pinball Collective"
  - Core value proposition
  - Tech stack overview (Next.js 16, React 19, Supabase, Drizzle, shadcn/ui)
  - Prerequisites:
    - Node.js 22+ (specify exact version)
    - npm or pnpm
    - Supabase account
  - Setup instructions:
    1. Clone repository
    2. Install dependencies (`npm install`)
    3. Copy `.env.example` to `.env.local`
    4. Create Supabase project
    5. Add Supabase credentials to `.env.local`
    6. Push database schema (`npm run db:push`)
    7. Run development server (`npm run dev`)
  - Development commands (dev, build, typecheck, lint, format, test, smoke)
  - Testing guide (unit, integration, E2E)
  - Deployment instructions (Vercel + Supabase)

#### Environment Variables Documentation
- [ ] Update `.env.example` with ALL required variables
  - Supabase URL and keys
  - Database URL
  - Add inline comments explaining each variable
  - Include example values (non-sensitive)

#### Development Guide (Optional but Recommended)
- [ ] Create `docs/DEVELOPMENT.md`
  - Development workflow overview
  - How to run tests (`npm test`, `npm run smoke`)
  - How to add new components (`npx shadcn add [component]`)
  - Database management (`npm run db:push`, `npm run db:studio`)
  - Common troubleshooting:
    - Supabase connection issues
    - Type errors with strictest config
    - Test setup with PGlite
  - PR workflow and quality gates

#### Copilot Instructions Refresh
- [ ] Review and update `.github/copilot-instructions.md` and files in `.github/instructions/`
  - Promote any repeated patterns (seen ≥2 times in code) into `docs/PATTERNS.md` first
  - If repetition is confirmed for domains (e.g., Machines, Issues, Timeline), add focused instruction files
    - `machines.instructions.md`, `issues.instructions.md` under `.github/instructions/`
    - Keep guidance concise; reference `docs/PATTERNS.md` instead of duplicating
  - Ensure guidance remains single-tenant (no org/RLS/tRPC) and aligns with `docs/NON_NEGOTIABLES.md`
  - Update "Last Updated" stamps in instruction files
  - Open a follow-up issue to periodically revisit instruction accuracy as features evolve

### Verification
- [ ] Friend can clone repo and follow README to get app running
- [ ] All environment variables documented in `.env.example`
- [ ] Development commands work as documented
- [ ] Troubleshooting section covers common issues

**Deferred to MVP+:** Accessibility testing, screen reader support, keyboard navigation audit

---

## MVP Completion Criteria

**MVP is complete when:**
- [ ] All PR 1-11 tasks completed and merged
  - PRs 1-5: Foundation (project, schema, Supabase, UI, testing)
  - PRs 6-9.5: Features (auth, navigation, machines, issues, public reporting, comments, dashboard)
  - PRs 10-11: Polish (password reset, documentation)
- [ ] 5 critical E2E tests passing (from TESTING_PLAN.md):
  - [ ] Public Issue Reporting (anonymous submission flow)
  - [ ] Member Login → View Issues → Filter
  - [ ] Issue Resolution Flow (assign → progress → resolve → timeline)
  - [ ] Create Machine
  - [ ] Dashboard Overview (assigned issues, recent issues, stats)
- [ ] TypeScript compilation with no errors
- [ ] All quality gates pass:
  - [ ] Linting passes
  - [ ] Formatting passes
  - [ ] Unit tests pass (~70-100 tests)
  - [ ] Integration tests pass (~25-35 tests)
  - [ ] E2E tests pass (5 critical + 1 landing page smoke test)
  - [ ] Code coverage ≥ 80% (enforced by CI)
- [ ] GitHub Actions CI passing on main branch
- [ ] Can deploy to Vercel successfully
- [ ] Friends can clone repo and run it (README test)
- [ ] Core value proposition achieved: "Log issues with pinball machines, track work, and resolve them"

**What's NOT in MVP (deferred to MVP+):**
- Error boundaries and loading skeletons (polish)
- Accessibility audit (shadcn/ui provides base a11y)
- Machine edit/delete (create-only is sufficient)

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
- Testing strategy: `docs/TESTING_PLAN.md`

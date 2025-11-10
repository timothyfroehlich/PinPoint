# PinPoint v2 Greenfield Tasks

**Last Updated**: November 10, 2025
**Status**: Greenfield initialization phase

---

## Phase 1: Project Foundation

### 1.1 Project Initialization
- [ ] Initialize npm project (`npm init`)
- [ ] Install Next.js 16 (`npm install next@latest react@latest react-dom@latest`)
- [ ] Install TypeScript (`npm install -D typescript @types/react @types/node`)
- [ ] Install @tsconfig/strictest (`npm install -D @tsconfig/strictest`)
- [ ] Create initial Next.js app structure (`npx create-next-app@latest` or manual setup)

### 1.2 TypeScript Configuration
- [ ] Create `tsconfig.json` with strictest configuration
  - Extend `@tsconfig/strictest`
  - Configure path aliases (`~/*` → `./src/*`)
  - Enable `exactOptionalPropertyTypes`
- [ ] Verify TypeScript compilation works (`npx tsc --noEmit`)

### 1.3 Linting & Formatting
- [ ] Install ESLint (`npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser`)
- [ ] Configure ESLint for Next.js + TypeScript
- [ ] Install Prettier (`npm install -D prettier`)
- [ ] Create `.prettierrc` config
- [ ] Install eslint-config-prettier (`npm install -D eslint-config-prettier`)
- [ ] Add lint scripts to package.json (`lint`, `format`)

### 1.4 Git Hooks
- [ ] Install Husky (`npm install -D husky`)
- [ ] Initialize Husky (`npx husky install`)
- [ ] Install lint-staged (`npm install -D lint-staged`)
- [ ] Configure pre-commit hook (lint-staged)
- [ ] Add prepare script to package.json

---

## Phase 2: Database & Backend

### 2.1 Drizzle ORM Setup
- [ ] Install Drizzle (`npm install drizzle-orm`)
- [ ] Install Drizzle Kit (`npm install -D drizzle-kit`)
- [ ] Install PostgreSQL driver (`npm install postgres`)
- [ ] Create `drizzle.config.ts`
- [ ] Create `src/server/db/index.ts` (database instance)

### 2.2 Database Schema
- [ ] Create `src/server/db/schema.ts`
- [ ] Define `users` table
  - id (uuid, primary key)
  - email (text, unique, not null)
  - name (text)
  - role (text: 'guest' | 'member' | 'admin')
  - created_at, updated_at
- [ ] Define `machines` table
  - id (uuid, primary key)
  - name (text, not null)
  - created_at, updated_at
- [ ] Define `issues` table
  - id (uuid, primary key)
  - machine_id (uuid, not null, foreign key → machines.id)
  - title (text, not null)
  - description (text)
  - status (text: 'new' | 'in_progress' | 'resolved')
  - severity (text: 'minor' | 'playable' | 'unplayable')
  - reported_by (uuid, foreign key → users.id)
  - assigned_to (uuid, foreign key → users.id)
  - resolved_at (timestamp)
  - created_at, updated_at
  - CHECK constraint: machine_id IS NOT NULL
- [ ] Define `comments` table
  - id (uuid, primary key)
  - issue_id (uuid, not null, foreign key → issues.id)
  - author_id (uuid, foreign key → users.id)
  - content (text, not null)
  - created_at, updated_at
- [ ] Test schema generation (`npx drizzle-kit generate`)

### 2.3 Supabase Setup
- [ ] Install Supabase packages (`npm install @supabase/supabase-js @supabase/ssr`)
- [ ] Create `.env.local` with Supabase credentials
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] Create Supabase projects (preview & production)
- [ ] Apply schema to Supabase (via Drizzle push or SQL)

### 2.4 Supabase SSR Client
- [ ] Create `src/lib/supabase/server.ts` (SSR client wrapper)
  - Implement createClient() with cookie handlers
  - Follow CORE-SSR-001 pattern (getAll/setAll cookies)
- [ ] Create Next.js middleware (`middleware.ts`)
  - Token refresh logic
  - Follow Supabase SSR middleware pattern
- [ ] Create auth callback route (`src/app/auth/callback/route.ts`)

---

## Phase 3: UI & Styling

### 3.1 Tailwind CSS v4
- [ ] Install Tailwind CSS v4 (`npm install tailwindcss@next`)
- [ ] Create CSS-based Tailwind config (in `src/app/globals.css`)
  - No `tailwind.config.js` file
  - Configure with `@config` directive
- [ ] Add Material Design 3 color system to globals.css
- [ ] Verify Tailwind works in development

### 3.2 shadcn/ui Setup
- [ ] Install shadcn/ui CLI dependencies
- [ ] Initialize shadcn/ui (`npx shadcn@latest init`)
- [ ] Configure for Next.js App Router
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

---

## Phase 4: Testing Infrastructure

### 4.1 Vitest Setup
- [ ] Install Vitest (`npm install -D vitest @vitest/ui`)
- [ ] Install React Testing Library (`npm install -D @testing-library/react @testing-library/jest-dom`)
- [ ] Create `vitest.config.ts`
  - Configure path aliases
  - Set up test environment
- [ ] Add test scripts to package.json (`test`, `test:watch`, `test:ui`)

### 4.2 PGlite Integration Testing
- [ ] Install PGlite (`npm install -D @electric-sql/pglite`)
- [ ] Create worker-scoped PGlite instance for tests
- [ ] Create test helpers in `src/test/`
  - Database setup/teardown utilities
  - Test data factories
- [ ] Write example integration test

### 4.3 Playwright E2E Setup
- [ ] Install Playwright (`npm install -D @playwright/test`)
- [ ] Initialize Playwright (`npx playwright install`)
- [ ] Create `playwright.config.ts`
- [ ] Create `e2e/` directory structure
- [ ] Add smoke test script to package.json

---

## Phase 5: Project Structure

### 5.1 Directory Structure
- [ ] Create `src/app/` (Next.js App Router)
  - [ ] `layout.tsx` (root layout)
  - [ ] `page.tsx` (home page)
  - [ ] `globals.css`
- [ ] Create `src/components/`
  - [ ] `ui/` (shadcn components)
- [ ] Create `src/lib/`
  - [ ] `types/` (shared TypeScript types)
  - [ ] `utils.ts` (utility functions)
- [ ] Create `src/server/`
  - [ ] `db/` (already created for schema)
- [ ] Create `src/test/`
  - [ ] `helpers/` (test utilities)
- [ ] Create `e2e/`
  - [ ] `fixtures/` (Playwright fixtures)

### 5.2 Environment Files
- [ ] Create `.env.example` template
- [ ] Create `.env.local` (gitignored)
- [ ] Add env validation (optional: zod for env vars)

---

## Phase 6: Package.json Scripts

### 6.1 Development Scripts
- [ ] `dev` - Start Next.js dev server
- [ ] `build` - Build for production
- [ ] `start` - Start production server
- [ ] `typecheck` - Run TypeScript type checking

### 6.2 Quality Scripts
- [ ] `lint` - Run ESLint
- [ ] `lint:fix` - Auto-fix ESLint issues
- [ ] `format` - Check Prettier formatting
- [ ] `format:write` - Auto-format with Prettier

### 6.3 Testing Scripts
- [ ] `test` - Run Vitest unit/integration tests
- [ ] `test:watch` - Vitest watch mode
- [ ] `test:ui` - Vitest UI
- [ ] `smoke` - Run Playwright smoke tests (5 critical flows)

### 6.4 Database Scripts
- [ ] `db:generate` - Generate Drizzle migrations
- [ ] `db:push` - Push schema to database
- [ ] `db:studio` - Open Drizzle Studio
- [ ] `db:seed` - Seed database (optional for development)

---

## Phase 7: Authentication & Basic Pages

### 7.1 Authentication Pages
- [ ] Create `src/app/(auth)/login/page.tsx`
  - Email/password login form
  - Server Action for authentication
- [ ] Create `src/app/(auth)/signup/page.tsx`
  - Registration form
  - Server Action for sign up
- [ ] Create `src/app/(auth)/layout.tsx` (auth route group layout)
- [ ] Test auth flow end-to-end

### 7.2 Protected Routes
- [ ] Create auth guard pattern in Server Components
  - Check user in Server Component
  - Redirect to login if unauthenticated
- [ ] Document pattern in `docs/PATTERNS.md`

---

## Phase 8: First Vertical Slice - Machines

### 8.1 Machine List Page
- [ ] Create `src/app/machines/page.tsx`
- [ ] Implement direct Drizzle query (Server Component)
- [ ] Display machines in table/cards
- [ ] Add "Create Machine" button

### 8.2 Create Machine Form
- [ ] Create Server Action for machine creation
  - Zod validation schema
  - Auth check
  - Database insert
- [ ] Create form component
  - Progressive enhancement (works without JS)
  - Server Action submission
- [ ] Add validation error handling

### 8.3 Machine Detail Page
- [ ] Create `src/app/machines/[machineId]/page.tsx`
- [ ] Display machine details
- [ ] Show associated issues
- [ ] Edit/delete functionality (Server Actions)

### 8.4 Tests for Machines
- [ ] Unit tests for validation schemas
- [ ] Integration tests for database queries
- [ ] E2E test for create machine flow

---

## Phase 9: Core Feature - Issues

### 9.1 Issue List (Per Machine)
- [ ] Create `src/app/machines/[machineId]/issues/page.tsx`
- [ ] Query issues for machine (with relations)
- [ ] Display issues with severity badges
- [ ] Filter by status (optional)

### 9.2 Create Issue Form
- [ ] Create Server Action for issue creation
  - Validate machineId is present (CORE-ARCH-004)
  - Zod schema with severity enum
  - Auth check for reported_by
- [ ] Create form component
  - Machine dropdown (if not from machine page)
  - Severity selector (minor/playable/unplayable)
  - Title and description fields
- [ ] Document pattern in `docs/PATTERNS.md`

### 9.3 Issue Detail Page
- [ ] Create `src/app/issues/[issueId]/page.tsx`
- [ ] Display issue details
- [ ] Show related machine
- [ ] Display comments
- [ ] Update status/severity (Server Actions)

### 9.4 Comments System
- [ ] Create Server Action for adding comments
- [ ] Display comments with author and timestamp
- [ ] Real-time updates (optional for MVP+)

### 9.5 Tests for Issues
- [ ] Unit tests for issue validation
- [ ] Integration tests for issue queries
- [ ] E2E test for create issue flow
- [ ] Test CHECK constraint (issues require machine)

---

## Phase 10: Polish & Deployment Prep

### 10.1 Error Handling
- [ ] Create error.tsx files for error boundaries
- [ ] Create not-found.tsx for 404 pages
- [ ] Add global error handler

### 10.2 Loading States
- [ ] Create loading.tsx files for route segments
- [ ] Add Suspense boundaries where needed
- [ ] Skeleton loaders for slow components

### 10.3 Accessibility
- [ ] Test keyboard navigation
- [ ] Verify form labels and ARIA attributes
- [ ] Test with screen reader (basic check)

### 10.4 Documentation
- [ ] Update README.md with setup instructions
- [ ] Document environment variables
- [ ] Add development workflow guide

---

## Completion Criteria

**MVP is complete when:**
- [ ] All Phase 1-9 tasks completed
- [ ] 5 critical E2E tests passing (login, create machine, create issue, view issues, resolve issue)
- [ ] TypeScript compilation with no errors
- [ ] All quality gates pass (lint, format, typecheck, tests)
- [ ] Can deploy to Vercel/production environment
- [ ] Core value proposition achieved: "Log issues with pinball machines, track work, and resolve them"

---

## Notes

- **Task Priority**: Complete phases sequentially (1 → 2 → 3, etc.)
- **Scope Discipline**: Use Scope Firewall for any features not listed here
- **Pattern Documentation**: Update `docs/PATTERNS.md` as patterns emerge
- **Breaking Changes**: High tolerance - we have zero users
- **Testing**: Aim for ~100-150 tests total (70% unit, 25% integration, 5% E2E)

**Reference**: See `docs/PRODUCT_SPEC.md` for feature details, `docs/TECH_SPEC.md` for architecture.

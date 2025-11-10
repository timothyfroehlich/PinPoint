# Task 11: Documentation

**Status**: ⏳ PENDING
**Branch**: `docs/mvp-documentation`
**Dependencies**: Task 10 (Password Reset Flow)

## Objective

README, setup guide, environment variables documentation for easy onboarding.

## Acceptance Criteria

- [ ] Friend can clone repo and follow README to get app running
- [ ] All environment variables documented in `.env.example`
- [ ] Development commands work as documented
- [ ] Troubleshooting section covers common issues

## Tasks

### README.md

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

### Environment Variables Documentation

- [ ] Update `.env.example` with ALL required variables
  - Supabase URL and keys
  - Database URL
  - Add inline comments explaining each variable
  - Include example values (non-sensitive)

### Development Guide (Optional but Recommended)

- [ ] Create `docs/DEVELOPMENT.md`
  - Development workflow overview
  - How to run tests (`npm test`, `npm run smoke`)
  - How to add new components (`npx shadcn add [component]`)
  - Database management (`npm run db:push`, `npm run db:studio`)
    - **NOTE**: Add migration workflow for production (`drizzle-kit generate` + `drizzle-kit migrate`)
    - Explain when to transition from `push` (pre-beta) to migrations (production)
  - Common troubleshooting:
    - Supabase connection issues
    - Type errors with strictest config
    - Test setup with PGlite
  - PR workflow and quality gates

### Copilot Instructions Refresh

- [ ] Review and update `.github/copilot-instructions.md` and files in `.github/instructions/`
  - Promote any repeated patterns (seen ≥2 times in code) into `docs/PATTERNS.md` first
  - If repetition is confirmed for domains (e.g., Machines, Issues, Timeline), add focused instruction files
    - `machines.instructions.md`, `issues.instructions.md` under `.github/instructions/`
    - Keep guidance concise; reference `docs/PATTERNS.md` instead of duplicating
  - Ensure guidance remains single-tenant (no org/RLS/tRPC) and aligns with `docs/NON_NEGOTIABLES.md`
  - Update "Last Updated" stamps in instruction files
  - Open a follow-up issue to periodically revisit instruction accuracy as features evolve

## Key Decisions

_To be filled during task execution_

## Problems Encountered

_To be filled during task execution_

## Lessons Learned

_To be filled during task execution_

## Updates for CLAUDE.md

_To be filled after completion - what future agents need to know_

## Notes

**Deferred to MVP+:** Accessibility testing, screen reader support, keyboard navigation audit

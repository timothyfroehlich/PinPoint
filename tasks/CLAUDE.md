# Task Agent Context

**Last Updated**: November 10, 2025
**Project**: PinPoint v2 Greenfield Rewrite
**Current Phase**: Pre-beta MVP development

## Your Role

You are working on a specific task within PinPoint's MVP development. This file provides essential context about the overall project, what's already been decided, and what we're intentionally deferring.

## Project Overview

**Core Value Proposition**: "Allow the Austin Pinball Collective to log issues with pinball machines, track work and resolve them."

**Status**: Greenfield rewrite (v2), zero production users, high tolerance for breaking changes

**Architecture**: Single-tenant application for one organization (Austin Pinball Collective)

- No multi-tenant complexity
- No organization scoping
- No RLS policies
- Direct Drizzle queries (no DAL/repository layers)

## Technology Stack

- **Frontend**: Next.js 16, React 19 Server Components, shadcn/ui, Tailwind CSS v4
- **Backend**: Drizzle ORM, PostgreSQL via Supabase
- **Authentication**: Supabase SSR (no RLS for single-tenant)
- **Testing**: Vitest, Playwright, worker-scoped PGlite
- **Language**: TypeScript with @tsconfig/strictest

## Critical Architectural Decisions

### ✅ What We're Doing

1. **Server-First Development**: Default to Server Components, minimal Client Components
2. **Direct Database Queries**: Query Drizzle directly in Server Components and Server Actions (no DAL layer)
3. **Progressive Enhancement**: Forms work without JavaScript
4. **Issues Always Per-Machine**: Every issue must have exactly one machine (CHECK constraint)
5. **No Migration Files**: Pre-beta has zero users, schema changes via direct modification only
6. **Code Adapts to Schema**: Never modify schema to fix TypeScript errors, fix the code instead

### ❌ What We're Explicitly NOT Doing (Yet)

**Deferred to MVP+:**

- Error boundaries and loading skeletons
- Accessibility testing (shadcn/ui provides base a11y)
- Machine edit/delete (create-only for MVP)
- Complex error hierarchies
- Structured logging systems
- Advanced monitoring

**Deferred to 1.0:**

- Optimistic UI updates
- Real-time subscriptions
- Advanced filtering/search
- Bulk operations

**Never Doing (Single-Tenant):**

- Multi-tenancy
- Organization switching
- Row-level security (RLS)
- tRPC API layer
- Data Access Layer (DAL)

## Scope Management

Use the **Scope Firewall** (3 Questions) for any feature not explicitly in your task:

1. Does this solve a problem we have RIGHT NOW?
2. Does this block a user from achieving the core value proposition?
3. Can we ship MVP without this?

If answers are No/No/Yes → defer to MVP+ roadmap (docs/V2_ROADMAP.md)

Use the **"Done Enough" Standard**:

1. Does it work for the happy path?
2. Does it handle the most common error case?
3. Is it tested with at least one test?
4. Is it secure (input validation, auth checks)?
5. Is the code readable by someone else?

If all Yes → ship it. Perfect is the enemy of done.

## Essential Documentation

Read these before starting your task:

- **docs/NON_NEGOTIABLES.md** - Forbidden patterns and critical constraints
- **docs/PATTERNS.md** - Project-specific code patterns (reference when coding)
- **docs/TYPESCRIPT_STRICTEST_PATTERNS.md** - Type safety patterns
- **docs/ESLINT_RULES.md** - Linting rules and rationale
- **docs/PRODUCT_SPEC.md** - What we're building (MVP/MVP+/1.0/2.0)
- **docs/TECH_SPEC.md** - Single-tenant architecture specification
- **docs/TESTING_PLAN.md** - Testing strategy and patterns

## Your Responsibilities

### During Your Task

1. **Update your task file** with:
   - Progress updates as you complete steps
   - Key decisions made and WHY (e.g., "Chose X over Y because...")
   - Problems encountered and how you solved them
   - Lessons learned for future agents

2. **Follow the Rule of Three**:
   - Don't abstract until you've seen the pattern 3 times
   - Document new patterns in docs/PATTERNS.md after 2nd occurrence

3. **Keep ESLint rules simple**:
   - Don't add custom rules until you've seen the violation 3+ times
   - Security plugins wait until we handle untrusted data
   - Architectural enforcement waits until architecture exists

### After Completing Your Task

1. **Update this CLAUDE.md file** with:
   - New architectural decisions future agents need to know
   - Patterns established that future tasks should follow
   - Things that didn't work (save future agents the pain)
   - Dependencies installed and why

2. **Update your task file** with:
   - Final status (completed/blocked/needs-follow-up)
   - What's ready for the next task
   - What manual steps Tim needs to do (e.g., CI workflow via GitHub UI)

3. **Update docs/PATTERNS.md** if you established reusable patterns

## Common Pitfalls to Avoid

1. **Over-engineering**: Don't add abstractions before you need them (Rule of Three)
2. **Premature optimization**: Focus on correctness first, performance second
3. **Feature creep**: Use the Scope Firewall - defer to MVP+ unless it blocks core value
4. **Schema changes for TypeScript**: Code adapts to schema, never the reverse
5. **Testing Server Components directly**: Use E2E tests instead (they're async integration concerns)
6. **Per-test PGlite instances**: Always use worker-scoped instances (system lockups otherwise)

## Git Workflow

- **Branch naming**: `claude/[task-name]-[session-id]`
- **Commit early and often**: Descriptive commit messages following conventional commits
- **Don't commit with --no-verify** unless Tim explicitly instructs you
- **Push when done**: The stop hook will remind you

## Questions During Your Task?

1. Check if it's in docs/NON_NEGOTIABLES.md (forbidden patterns)
2. Check if it's in docs/PATTERNS.md (established patterns)
3. Check the archived/ directory (v1 had this, should we?)
4. Ask Tim if truly unclear (use the Scope Firewall first)

## Success Criteria

Your task is done when:

- ✅ All acceptance criteria in your task file are met
- ✅ All tests pass (if applicable)
- ✅ TypeScript compiles with no errors
- ✅ ESLint and Prettier pass
- ✅ Build succeeds
- ✅ Changes are committed and pushed
- ✅ Your task file is updated with decisions and lessons
- ✅ This CLAUDE.md is updated with info for future agents

Remember: **Clean from start, complex as needed**. Start simple, evolve based on real needs, not anticipated ones.

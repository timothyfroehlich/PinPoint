# PinPoint v2 Tasks

**Last Updated**: November 10, 2025
**Status**: Greenfield initialization phase

> **Note**: This file has been refactored into individual task files in the `tasks/` directory for better organization and agent-specific context.

## Task Structure

Each task has its own file in `tasks/` with:

- Clear acceptance criteria
- Detailed task breakdown
- Space for decisions, problems, and lessons learned
- Updates to share with future agents

## Getting Started

**For Agents**: Start by reading `tasks/CLAUDE.md` for essential project context, then open your assigned task file.

**For Humans**: Browse individual task files for detailed status and progress.

## Task Files

### Foundation (Completed)

- [x] **Task 01**: [Project Foundation](tasks/01-project-foundation.md) - Next.js, TypeScript, ESLint, Prettier, Git hooks

### Infrastructure Setup (Pending)

- [ ] **Task 02**: [Database Schema](tasks/02-database-schema.md) - Drizzle ORM, schema definition, database trigger
- [ ] **Task 03**: [Supabase Auth](tasks/03-supabase-auth.md) - Supabase SSR client, middleware, auth callback
- [ ] **Task 04**: [UI Foundation](tasks/04-ui-foundation.md) - Tailwind CSS v4, shadcn/ui, landing page
- [ ] **Task 05**: [Testing Infrastructure](tasks/05-testing-infrastructure.md) - Vitest, PGlite, Playwright

### Feature Development (Pending)

- [ ] **Task 06**: [Authentication Pages](tasks/06-authentication-pages.md) - Login, signup, logout with Server Actions
- [ ] **Task 06.5**: [Navigation Framework](tasks/06-5-navigation-framework.md) - Top nav bar with user menu
- [ ] **Task 07**: [Machines CRUD](tasks/07-machines-crud.md) - Machine management with status derivation
- [ ] **Task 08**: [Issues Per Machine](tasks/08-issues-per-machine.md) - Issue tracking with timeline events
- [ ] **Task 08.5**: [Public Issue Reporting](tasks/08-5-public-issue-reporting.md) - Anonymous public reporting form
- [ ] **Task 09**: [Comments System](tasks/09-comments-system.md) - User comments on issues
- [ ] **Task 09.5**: [Member Dashboard](tasks/09-5-member-dashboard.md) - Dashboard with assigned issues and stats
- [ ] **Task 10**: [Password Reset Flow](tasks/10-password-reset-flow.md) - Password reset via Supabase auth
- [ ] **Task 11**: [Documentation](tasks/11-documentation.md) - README, setup guide, environment docs

## Task Dependencies

```
Task 01 (Foundation) → Task 02 (Schema) → Task 03 (Supabase) → Task 04 (UI + Landing) → Task 05 (Testing)
                                                                                            ↓
                                                                                         Task 06 (Auth)
                                                                                            ↓
                                                                                         Task 06.5 (Navigation)
                                                                                            ↓
                                                                                         Task 07 (Machines)
                                                                                            ↓
                                                                                         Task 08 (Issues)
                                                                                            ↓
                                                                                         Task 08.5 (Public Reporting)
                                                                                            ↓
                                                                                         Task 09 (Comments)
                                                                                            ↓
                                                                                         Task 09.5 (Dashboard)
                                                                                            ↓
                                                                                         Task 10 (Password Reset)
                                                                                            ↓
                                                                                         Task 11 (Documentation)
```

## Progress Tracking

- **Completed**: 1/13 tasks (8%)
- **In Progress**: 0/13 tasks
- **Blocked**: 0/13 tasks
- **Remaining**: 12/13 tasks

## Essential Context

Before starting any task, read:

1. **tasks/CLAUDE.md** - Project overview, architectural decisions, scope management
2. **docs/NON_NEGOTIABLES.md** - Forbidden patterns and critical constraints
3. **docs/PATTERNS.md** - Established code patterns
4. **Your task file** - Specific deliverables and acceptance criteria

## Agent Guidelines

**During your task**:

- Update your task file with progress, decisions, problems, lessons learned
- Follow the Rule of Three (don't abstract until pattern seen 3x)
- Use the Scope Firewall to prevent feature creep
- Keep ESLint rules simple (add when needed, not preemptively)

**After completing your task**:

- Update tasks/CLAUDE.md with info future agents need to know
- Update docs/PATTERNS.md if you established reusable patterns
- Mark your task status as ✅ COMPLETED
- Commit and push all changes

## Deferred to MVP+

See individual task files for specific deferred items, or check `docs/V2_ROADMAP.md` for the complete parking lot of features intentionally excluded from MVP.

Common deferrals across tasks:

- Error boundaries and loading states
- Accessibility testing (shadcn/ui provides base a11y)
- Machine edit/delete (create-only for MVP)
- Complex error hierarchies
- Advanced monitoring/logging

## Success Criteria

MVP is complete when:

- All 13 tasks are marked as ✅ COMPLETED
- 5 critical E2E tests passing (see docs/TESTING_PLAN.md)
- TypeScript compilation with no errors
- All quality gates pass (lint, format, test, build)
- GitHub Actions CI passing on main branch
- Can deploy to Vercel successfully
- Friends can clone repo and run it (README test)
- Core value proposition achieved: "Log issues with pinball machines, track work, and resolve them"

---

For detailed task breakdowns, see individual files in the `tasks/` directory.

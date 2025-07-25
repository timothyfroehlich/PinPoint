# PinPoint Documentation

---

status: current
last-updated: 2025-01-20

---

Welcome to the PinPoint documentation. This index provides navigation to all project documentation, clearly indicating the status and purpose of each document.

## 🎯 Authoritative Documents (Always Current)

These documents represent the current state of the project and should be referenced for all development work:

### Planning & Roadmap

- **[Roadmap](planning/roadmap.md)** - Phased release plan (Beta → 1.0 → 1.x → 2.0 → 3.0)
- **[Backend Implementation Plan](planning/backend_impl_plan.md)** - V1.0 backend architecture and implementation strategy

### Architecture & Design

- **[Current Architecture State](architecture/current-state.md)** - As-built system documentation
- **[UI Architecture Plan](design-docs/ui-architecture-plan.md)** - Frontend pages and component structure
- **[Critical User Journeys](design-docs/cujs-list.md)** - Key user workflows by role and release phase
- **[Technical Design Document](design-docs/technical-design-document.md)** - System architecture and technology stack
- **[Subdomain Development Setup](design-docs/subdomain-development-setup.md)** - Multi-tenant subdomain routing

### Reference

- **[Terminology Guide](reference/terminology.md)** - Glossary and model rename reference

### Implementation Guides

- **[Backend Implementation Tasks](backend_impl_tasks/CLAUDE.md)** - Detailed task breakdown for backend refactor
- **[Multi-Agent Workflow](backend_impl_tasks/MULTI_AGENT_WORKFLOW.md)** - Parallel development using git worktrees

### Development Resources

- **[Troubleshooting Guide](troubleshooting.md)** - Common development issues and solutions
- **[Code Coverage Setup](coverage-setup.md)** - Testing and coverage configuration

## 📋 Implementation Status

### Completed Backend Tasks

- ✅ [Setup Feature Branch](backend_impl_tasks/completed/00-setup-feature-branch.md)
- ✅ [Move Frontend Out of Compilation](backend_impl_tasks/completed/01-move-frontend-out-of-compilation.md)
- ✅ [Delete Playwright Tests](backend_impl_tasks/completed/02-delete-playwright-tests.md)
- ✅ [Implement New Schema](backend_impl_tasks/completed/03-implement-new-schema.md)
- ✅ [Update Seed Data](backend_impl_tasks/completed/04-update-seed-data.md)
- ✅ [Rebuild tRPC Authorization](backend_impl_tasks/completed/05-rebuild-trpc-authorization.md)
- ✅ [Update Backend Tests](backend_impl_tasks/completed/06-update-backend-tests.md)
- ✅ [Fix Issue History Model](backend_impl_tasks/completed/07-fix-issue-history-model.md)
- ✅ [Implement Comment Soft Delete](backend_impl_tasks/completed/08-implement-comment-soft-delete.md)
- ✅ [Fix Upload Authorization](backend_impl_tasks/completed/09-fix-upload-authorization.md)
- ✅ [Enhance Notification System](backend_impl_tasks/completed/11-enhance-notification-system.md)

### Pending Backend Tasks

- 🔄 [Redesign PinballMap Integration](backend_impl_tasks/10-redesign-pinballmap-integration.md)
- 📋 [Implement QR Code System](backend_impl_tasks/12-implement-qr-code-system.md)
- 📋 [Implement Collections System](backend_impl_tasks/14-implement-collections-system.md)

## 📚 Planning & Future Features

### Active Planning

- **[Production Readiness Tasks](planning/production-readiness-tasks.md)** - Security, CI/CD, and deployment checklist
- **[Testing Design Document](design-docs/testing-design-doc.md)** - Testing strategy and milestones

### Future Features

- **[Video Upload Strategy](planning/future-features/video-upload-strategy.md)** - Technical approach for video attachments

## 🗂️ Historical Context (Archived)

These documents provide historical context but have been superseded by current documentation:

### Out of Date

- **[Product Specification](out-of-date/product-specification.md)** - Original product vision (see roadmap.md for current)
- **[User Profile Implementation Plan](out-of-date/user-profile-implementation-plan.md)** - Unimplemented feature (deprioritized)

### Archived Planning Documents

- **[Initial Overview](planning/archive/overview.md)** - Original pitch to Austin Pinball Collective
- **[Feature Specifications](planning/archive/feature-spec.md)** - Early feature planning with old terminology

## 📝 Documentation Standards

### Status Headers

All documents should include a status header:

```yaml
---
status: current|archived|planned
last-updated: YYYY-MM-DD
superseded-by: [optional link]
---
```

### Terminology

- **Model** (formerly GameTitle) - Generic machine model (e.g., "Godzilla Premium")
- **Machine** (formerly GameInstance) - Specific physical machine at a Location
- **Organization** - Top-level tenant (e.g., "Austin Pinball Collective")
- **Member** - User with organization-specific role

## 🛠️ Quick Reference

### Development Commands

```bash
npm run dev:full        # Start all services with monitoring
npm run validate        # Run all checks before starting work
npm run validate  # Pre-commit validation + auto-fix (MUST PASS)
npm run db:reset        # Reset database with seed data
npm run test:coverage   # Generate coverage reports
```

### Quality Standards

- **0 TypeScript errors** - Fix immediately
- **0 ESLint errors** - No exceptions
- **Test Coverage** - 50% global, 60% server/, 70% lib/
- **Agent validation** - Must always pass before commits

### Key Technologies

- **Framework**: Next.js + React + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: NextAuth.js (Auth.js v5)
- **API**: tRPC
- **UI**: Material UI (MUI)
- **Deployment**: Vercel

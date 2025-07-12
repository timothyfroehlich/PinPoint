# Phase 1A Backend Refactor Task Documentation

## Overview

This directory contains detailed implementation tasks for Phase 1A of the PinPoint backend refactor. These tasks implement the complete V1.0 schema with RBAC system as documented in `docs/planning/backend_impl_plan.md`.

## Prerequisites

**REQUIRED**: Read and understand `docs/planning/backend_impl_plan.md` before working on any task.

## Task Execution Workflow

### 1. Setup (Task 00)

Start with `00-setup-feature-branch.md` to establish the feature branch and workflow.

### 2. Implementation Order

Tasks have dependencies - follow this sequence:

**Phase 1 (Parallel):**

- `01-move-frontend-out-compilation.md`
- `02-delete-playwright-tests.md`

**Phase 2 (Sequential):**

- `03-implement-new-schema.md` (breaking changes)
- `04-update-seed-data.md` (depends on 03)
- `05-rebuild-trpc-authorization.md` (depends on 03, ideally 04)
- `06-update-backend-tests.md` (depends on 03, 04, 05)

### 3. Branch Strategy

```
feature/phase-1a-backend-refactor (base)
├── task/01-move-frontend-out-compilation
├── task/02-delete-playwright-tests
├── task/03-implement-new-schema
├── task/04-update-seed-data
├── task/05-rebuild-trpc-authorization
└── task/06-update-backend-tests
```

## Task File Structure

Each task file includes:

- **Objective** - Clear goal and scope
- **Dependencies** - Prerequisites and task order
- **Implementation Steps** - Detailed commands and code changes
- **Batch Operations** - Automated commands where possible
- **Manual Cleanup** - Items requiring human review
- **Validation Steps** - How to verify success
- **Progress Notes** - FOR IMPLEMENTERS TO FILL IN
- **Rollback Procedure** - How to undo if needed

## Implementation Guidelines

### For Task Implementers:

1. **Read the implementation plan first**: `docs/planning/backend_impl_plan.md`
2. **Create task branch**: `git checkout -b task/##-descriptive-name`
3. **Follow task documentation exactly**
4. **Update Progress Notes section** with:
   - Implementation decisions made
   - Unexpected complexity encountered
   - Information for subsequent tasks
5. **Commit task file updates** with implementation
6. **Create PR to feature branch** (not main)
7. **Include testing validation** in PR description

### Progress Tracking Requirements:

- [ ] Update task status checkboxes as you work
- [ ] Fill in all "Progress Notes" sections
- [ ] Document any deviations from task plan
- [ ] Note performance or complexity issues
- [ ] Record decisions that affect later tasks

## Key Implementation Notes

### Breaking Changes Approach:

- Frontend will be moved out of compilation (Task 01)
- Complete schema replacement (Task 03)
- No backward compatibility maintained
- Database recreated from scratch (no migrations)

### RBAC Implementation:

- Default roles created automatically with organizations
- Permission-based authorization throughout
- Role model replaces Role enum completely
- Beta: fixed roles, V1.0: configurable roles

### Model Renames:

- `GameTitle` → `Model`
- `GameInstance` → `Machine`
- `Room` → `Location` (concept simplified)
- `IssueActivity` → `IssueHistory`

## Validation Criteria

Each task must pass:

- TypeScript compilation (`npm run typecheck`)
- Backend tests (`npm run test`)
- Basic functionality verification
- No security regressions

## Support Resources

- Implementation plan: `docs/planning/backend_impl_plan.md`
- Current schema: `prisma/schema.prisma`
- Seed data: `prisma/seed.ts`
- tRPC setup: `src/server/api/trpc.ts`

## Rollback Strategy

- Current state preserved in `main` branch
- Simple rollback: create new branch from `main`
- No complex migration rollback needed
- Each task includes specific rollback procedures

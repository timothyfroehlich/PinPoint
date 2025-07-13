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

### 3. Branch Strategy - Core Tasks (Tasks 00-06)

```
feature/phase-1a-backend-refactor (base)
├── task/01-move-frontend-out-compilation
├── task/02-delete-playwright-tests
├── task/03-implement-new-schema
├── task/04-update-seed-data
├── task/05-rebuild-trpc-authorization
└── task/06-update-backend-tests
```

### 4. Extended Tasks Execution Strategy (Tasks 07-12+)

After completing the core backend refactor (Tasks 00-06), additional tasks address TODOs and missing functionality. These can be executed in parallel groups to maximize development efficiency:

#### **Phase 3A: Core Service Fixes** (Parallel Execution)

Execute these branches simultaneously:

```bash
# Start these branches in parallel
git checkout epic/backend-refactor
git checkout -b task/07-fix-issue-history-model
git checkout epic/backend-refactor
git checkout -b task/08-implement-comment-soft-delete
git checkout epic/backend-refactor
git checkout -b task/09-fix-upload-authorization
```

**Tasks:**

- `07-fix-issue-history-model.md` - Add missing organizationId and actorId fields
- `08-implement-comment-soft-delete.md` - Enable comment cleanup service
- `09-fix-upload-authorization.md` - Replace placeholder auth with RBAC

**Rationale**: Minimal schema overlap, all address critical TODOs, independent implementations.

#### **Phase 3B: Integration & Enhancement** (Parallel Execution)

Execute after Phase 3A is underway:

```bash
# Start these after Phase 3A is in progress
git checkout epic/backend-refactor
git checkout -b task/10-redesign-pinballmap-integration
git checkout epic/backend-refactor
git checkout -b task/11-enhance-notification-system
```

**Tasks:**

- `10-redesign-pinballmap-integration.md` - Rebuild PinballMap sync for new schema
- `11-enhance-notification-system.md` - Complete notification model and machine owner notifications

**Rationale**: Independent feature implementations with no schema conflicts.

#### **Phase 3C: Sequential Dependencies**

Execute after Task 11 is merged:

```bash
# Start after Task 11 is merged (Machine model conflict)
git checkout epic/backend-refactor
git checkout -b task/12-implement-qr-code-system

# Can run in parallel with Task 12 (different models)
git checkout epic/backend-refactor
git checkout -b task/13-implement-private-locations
```

**Tasks:**

- `12-implement-qr-code-system.md` - QR code generation and scanning for machines
- `13-implement-private-locations.md` - Private/public location visibility and machine movement tracking

**Rationale**: Task 12 modifies Machine model (conflicts with Task 11). Task 13 modifies Location model (safe to run parallel with Task 12).

#### **Phase 3D: Advanced Features** (After Phase 3C)

Execute after Phase 3C completion:

```bash
# Advanced features with dependencies
git checkout epic/backend-refactor
git checkout -b task/14-implement-collections-system  # After Task 12 (Machine model)

# Can run in parallel with Task 14
git checkout epic/backend-refactor
git checkout -b task/15-implement-internal-issues    # Independent

# After Task 07 (IssueHistory model)
git checkout epic/backend-refactor
git checkout -b task/16-implement-issue-merging      # After Task 07
```

**Tasks:**

- `14-implement-collections-system.md` - Machine grouping and filtering system (CUJs 7.1-7.3)
- `15-implement-internal-issues.md` - Private work orders vs public issues (CUJs 6.3-6.4)
- `16-implement-issue-merging.md` - Duplicate issue merging functionality (CUJ 4.4)

#### **Complete Task Dependency Graph**

```
Phase 3A (Parallel):
├── Task 07: Fix IssueHistory Model
├── Task 08: Implement Comment Soft Delete
└── Task 09: Fix Upload Authorization

Phase 3B (Parallel, after 3A underway):
├── Task 10: Redesign PinballMap Integration
└── Task 11: Enhance Notification System

Phase 3C (After Task 11):
├── Task 12: Implement QR Code System (after Task 11)
└── Task 13: Implement Private Locations (parallel with Task 12)

Phase 3D (After Phase 3C):
├── Task 14: Implement Collections System (after Task 12)
├── Task 15: Implement Internal Issues (independent)
└── Task 16: Implement Issue Merging (after Task 07)
```

#### **Schema Modification Conflicts**

| Task    | Models Modified                                | Conflicts With | Can Run Parallel With |
| ------- | ---------------------------------------------- | -------------- | --------------------- |
| Task 07 | IssueHistory, Organization, User               | None           | Tasks 08, 09          |
| Task 08 | Comment, User                                  | None           | Tasks 07, 09          |
| Task 09 | Attachment, Organization                       | None           | Tasks 07, 08          |
| Task 10 | Location, PinballMapConfig (new), Organization | None           | Task 11               |
| Task 11 | Notification, Machine, User                    | Task 12        | Task 10               |
| Task 12 | Machine                                        | Task 11, 14    | Task 13               |
| Task 13 | Location, MachineMovement (new), User          | None           | Task 12               |
| Task 14 | Collection, CollectionType, Machine            | Task 12        | Task 15               |
| Task 15 | Issue (visibility)                             | None           | Task 14               |
| Task 16 | Issue (merging), IssueHistory                  | Task 07        | None (sequential)     |

#### **Merge Priority Recommendations**

1. **Priority 1** (Security & Data Integrity): Tasks 07, 08, 09
2. **Priority 2** (Feature Enablement): Tasks 10, 11
3. **Priority 3** (User Experience): Task 12

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

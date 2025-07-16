# Task 00: Setup Feature Branch and Workflow

## Objective

Create the main feature branch for the Phase 1A backend refactor and establish the PR-based workflow for individual task implementation.

## Status

- [ ] In Progress
- [ ] Completed

## Branch Strategy

```
main (protected)
├── feature/phase-1a-backend-refactor (main feature branch)
    ├── task/01-move-frontend-out-compilation (individual task branches)
    ├── task/02-delete-playwright-tests
    ├── task/03-implement-new-schema
    ├── task/04-update-seed-data
    ├── task/05-rebuild-trpc-authorization
    └── task/06-update-backend-tests
```

## Implementation Steps

### 1. Create and Switch to Feature Branch

```bash
# Create feature branch from current main
git checkout main
git pull origin main
git checkout -b feature/phase-1a-backend-refactor
```

### 2. Commit Current Task Structure

```bash
# Add all task documentation
git add docs/backend_impl_tasks/
git add docs/planning/backend_impl_plan.md

# Commit with descriptive message
git commit -m "feat: Add Phase 1A backend refactor task structure

- Updated backend implementation plan to reflect major refactor approach
- Created detailed task documentation for Phase 1A implementation
- Established RBAC system design with default roles for Beta
- Documented breaking changes approach and implementation timeline

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 3. Push Feature Branch to GitHub

```bash
# Push feature branch to origin
git push -u origin feature/phase-1a-backend-refactor
```

### 4. Create GitHub Issue for Phase 1A

Create an issue in GitHub repo with:

- Title: "Phase 1A: Backend Refactor for V1.0 Schema and RBAC"
- Description linking to implementation plan
- Task checklist linking to individual task files
- Labels: "enhancement", "backend", "phase-1a"

## Workflow for Individual Tasks

### For Each Task Implementation:

#### 1. Create Task Branch

```bash
# From feature branch, create task branch
git checkout feature/phase-1a-backend-refactor
git pull origin feature/phase-1a-backend-refactor
git checkout -b task/01-move-frontend-out-compilation
```

#### 2. Implement Task

- Follow task documentation in `docs/backend_impl_tasks/`
- Update task file with progress notes and decisions made
- Test implementation thoroughly

#### 3. Create Pull Request

```bash
# Push task branch
git push -u origin task/01-move-frontend-out-compilation

# Create PR in GitHub:
# - Base: feature/phase-1a-backend-refactor
# - Head: task/01-move-frontend-out-compilation
# - Title: "Task 01: Move Frontend Code Out of Compilation"
# - Description: Link to task file, summarize changes
# - Auto-merge when checks pass (no branch protection on feature branch)
```

#### 4. Clean Up After Merge

```bash
# After PR merge, delete task branch
git checkout feature/phase-1a-backend-refactor
git pull origin feature/phase-1a-backend-refactor
git branch -d task/01-move-frontend-out-compilation
git push origin --delete task/01-move-frontend-out-compilation
```

## Task Execution Order

**Sequential Dependencies:**

1. `01-move-frontend-out-compilation` (independent)
2. `02-delete-playwright-tests` (independent)
3. `03-implement-new-schema` (independent)
4. `04-update-seed-data` (depends on 03)
5. `05-rebuild-trpc-authorization` (depends on 03, ideally 04)
6. `06-update-backend-tests` (depends on 03, 04, 05)

**Parallel Execution:**

- Tasks 01 and 02 can be done in parallel
- Task 03 can be started independently
- Tasks 04, 05, 06 should follow in sequence after 03

## Progress Tracking

### GitHub Project Board

Create project board with columns:

- **Backlog** - Planned tasks
- **In Progress** - Currently being implemented
- **Review** - PR submitted, awaiting review/merge
- **Done** - Merged to feature branch

### Task File Updates

Each task implementer must:

- Update task status checkboxes
- Fill in "Progress Notes" section with:
  - Implementation decisions made
  - Unexpected complexity encountered
  - Information needed for subsequent tasks
- Commit task file updates with implementation

## Validation Steps

```bash
# Verify feature branch exists and is pushed
git branch -a | grep feature/phase-1a-backend-refactor

# Verify task documentation is committed
ls docs/backend_impl_tasks/

# Verify implementation plan is updated
git log --oneline docs/planning/backend_impl_plan.md
```

## Progress Notes

### Implementation Decisions Made:

- Feature branch name: `feature/phase-1a-backend-refactor`
- Task branch naming: `task/##-descriptive-name`
- Base all task branches off feature branch, not main

### GitHub Setup:

- [ ] Feature branch created and pushed
- [ ] GitHub issue created for Phase 1A
- [ ] Project board created (optional)

### Notes for Task Implementation:

- Each task branch should be focused and atomic
- PRs should include task file updates with implementation notes
- No branch protection on feature branch for agility
- Final feature branch will be merged to main via comprehensive PR

## Next Steps

1. Proceed to Task 01: Move Frontend Code Out of Compilation
2. Each task should be implemented in its own branch
3. Read `docs/planning/backend_impl_plan.md` before starting any task
4. Update task files with implementation progress and decisions

## Rollback Procedure

```bash
# If feature branch needs to be recreated
git branch -D feature/phase-1a-backend-refactor
git push origin --delete feature/phase-1a-backend-refactor

# Start over from main
git checkout main
git checkout -b feature/phase-1a-backend-refactor
```

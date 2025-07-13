# Multi-Agent Development Workflow

## Overview

This document defines the coordinated workflow for multiple Claude agents working in parallel on PinPoint backend tasks using git worktrees. Each agent operates in an isolated worktree while maintaining synchronization with the main epic branch.

## Agent Context

**You are a backend development agent** working on a specific task in the PinPoint project. You are part of a coordinated multi-agent environment where multiple agents work in parallel on different backend tasks using git worktrees to maximize development velocity while maintaining code quality.

**Your Role:**

- Implement your assigned task completely and independently
- Work in your dedicated worktree environment
- Follow coordination guidelines to avoid conflicts with other agents
- Maintain strict quality standards throughout development

## Architecture

### Directory Structure

```
~/Code/
├── PinPoint/                          # Main repository (epic/backend-refactor)
└── PinPoint-worktrees/                # Isolated worktree environments
    ├── task-07-fix-issue-history-model/
    ├── task-08-implement-comment-soft-delete/
    ├── task-09-fix-upload-authorization/
    ├── task-10-redesign-pinballmap-integration/
    └── ...
```

### Git Branch Strategy

```
epic/backend-refactor (main coordination branch)
├── task/07-fix-issue-history-model
├── task/08-implement-comment-soft-delete
├── task/09-fix-upload-authorization
├── task/10-redesign-pinballmap-integration
└── ...
```

## Agent Working Environment

### Initial Setup

**FIRST TIME SETUP REQUIRED** - Your worktree environment has been pre-configured, but you need to set up the development environment:

```bash
# Navigate to your isolated working directory
cd ~/Code/PinPoint-worktrees/task-##-your-task

# Run the setup script to configure your environment
# This will:
# - Copy .env from main repo
# - Configure unique ports for your worktree (no conflicts with other agents)
# - Install dependencies
# - Sync database schema
./scripts/setup-worktree.sh

# Your environment is now ready for development
```

**Important Notes:**

- Each agent gets unique ports automatically to avoid conflicts
- Your database will be shared with other agents (use organizationId properly!)
- Only run setup once when you first start working

### Daily Sync Workflow

**CRITICAL**: Before starting work each day:

```bash
# From your worktree directory
cd ~/Code/PinPoint-worktrees/task-##-your-task

# Fetch latest changes from epic branch
git fetch origin epic/backend-refactor

# Check if epic branch has updates
git log --oneline HEAD..origin/epic/backend-refactor

# If updates exist, merge them
git merge origin/epic/backend-refactor

# Resolve any conflicts if they occur
# Then continue with your work
```

## Parallel Development Coordination

### Task Dependency Matrix

Based on the README.md task documentation:

**Phase 3A (Can Start Immediately):**

- Task 07: Fix IssueHistory Model
- Task 08: Implement Comment Soft Delete
- Task 09: Fix Upload Authorization

**Phase 3B (After 3A is underway):**

- Task 10: Redesign PinballMap Integration
- Task 11: Enhance Notification System

**Phase 3C (Sequential dependencies):**

- Task 12: Implement QR Code System (after Task 11)
- Task 13: Implement Private Locations (parallel with Task 12)

**Phase 3D (Advanced features):**

- Task 14: Implement Collections System (after Task 12)
- Task 15: Implement Internal Issues (independent)
- Task 16: Implement Issue Merging (after Task 07)

### Schema Conflict Management

**Models that create conflicts:**

| Your Task | Models You Modify                | Conflicts With | Safe to Run With |
| --------- | -------------------------------- | -------------- | ---------------- |
| Task 07   | IssueHistory, Organization, User | None           | Tasks 08, 09     |
| Task 08   | Comment, User                    | None           | Tasks 07, 09     |
| Task 09   | Attachment, Organization         | None           | Tasks 07, 08     |
| Task 11   | Machine, Notification, User      | Task 12        | Task 10          |
| Task 12   | Machine                          | Tasks 11, 14   | Task 13          |

**Rule**: If your task modifies the same model as another task in progress, coordinate merge timing.

## Agent Self-Sufficiency Guidelines

### Before Starting Your Task

1. **Read Prerequisites**: Always start with `docs/planning/backend_impl_plan.md`
2. **Setup Environment**: Run `./scripts/setup-worktree.sh` (first time only)
3. **Check Dependencies**: Verify prerequisite tasks are completed
4. **Sync Environment**: Follow daily sync workflow above
5. **Validate Setup**: Run `npm run validate` to ensure clean starting state

### During Implementation

1. **Stay Isolated**: All work happens in your dedicated worktree
2. **Regular Commits**: Commit frequently with descriptive messages
3. **Monitor Conflicts**: Watch for epic branch updates that affect your models
4. **Update Progress**: Fill in Progress Notes section of your task file

### Quality Standards

**Every agent must ensure:**

- ✅ `npm run typecheck` passes
- ✅ `npm run test` passes
- ✅ `npm run pre-commit` passes
- ✅ Task-specific validation steps completed
- ✅ Progress Notes section updated

### Communication Protocol

**When to Pause/Coordinate:**

- Schema conflicts detected during sync
- Epic branch has breaking changes affecting your work
- Your task dependency is ready for handoff
- Unexpected complexity requiring architectural decisions

**When to Proceed Independently:**

- No schema conflicts with active tasks
- All prerequisites completed
- Clear implementation path defined
- Tests passing locally

## Pull Request Workflow

### Creating PRs from Worktrees

```bash
# From your worktree directory
cd ~/Code/PinPoint-worktrees/task-##-your-task

# Ensure you're on the right branch
git checkout task/##-your-descriptive-name

# Push your branch
git push -u origin task/##-your-descriptive-name

# Create PR via GitHub CLI or web interface
# Base: epic/backend-refactor
# Head: task/##-your-descriptive-name
```

### PR Requirements

**Every PR must include:**

- ✅ Task file moved to `docs/backend_impl_tasks/completed/` folder
- ✅ Updated task file with completed Progress Notes
- ✅ All validation steps passed
- ✅ Clear description of changes made
- ✅ Any architectural decisions documented
- ✅ Notes for subsequent task dependencies

### Task Completion Process

When your task is complete:

1. **Move Task File**: Move your task file from `docs/backend_impl_tasks/` to `docs/backend_impl_tasks/completed/` as part of your PR
2. **Run Quality Checks**: Execute `npm run pre-commit` to ensure all standards pass
3. **Create Pull Request**: Target `epic/backend-refactor` branch (NOT main)
4. **Update Task Documentation**: Mark your task as completed in the moved task file
5. **Notify Coordination**: Your PR will be reviewed and merged by the orchestrating manager

#### Example Task Completion

```bash
# Move completed task file
git mv docs/backend_impl_tasks/10-my-task.md docs/backend_impl_tasks/completed/

# Update status in moved file, then commit
git add docs/backend_impl_tasks/completed/10-my-task.md
git commit -m "feat: Complete Task 10 - My Feature Implementation"
```

## Conflict Resolution

### When Epic Branch Updates Affect Your Work

```bash
# If merge conflicts occur during sync
git fetch origin epic/backend-refactor
git merge origin/epic/backend-refactor

# Resolve conflicts in affected files
# Prioritize epic branch changes unless you have specific requirements
# Run validation after resolving
npm run validate

# If validation fails, address issues before continuing
```

### When Your Task Blocks Others

**If your task completion is needed for others to proceed:**

1. Complete implementation as quickly as possible
2. Create PR immediately when tests pass
3. Notify in PR description which tasks are unblocked
4. Use GitHub's auto-merge if available

## Cleanup After Task Completion

### Post-Merge Cleanup

After your PR is merged, the software manager will handle:

- Updating the epic branch with your changes
- Removing your worktree environment
- Cleaning up task branches
- Coordinating with other agents about dependency completions

## Emergency Procedures

### If Worktree Becomes Corrupted

```bash
# If your worktree becomes corrupted, notify the software manager
# They will recreate your worktree environment from the latest epic state
# You may need to re-implement any uncommitted changes
```

### If Epic Branch Has Breaking Changes

```bash
# If epic branch changes break your work
git fetch origin epic/backend-refactor
git log --oneline HEAD..origin/epic/backend-refactor

# Option 1: Rebase your work on top of epic changes
git rebase origin/epic/backend-refactor

# Option 2: Start fresh if changes are extensive
# Back up your work first
git branch backup-task-##-$(date +%Y%m%d)
git reset --hard origin/epic/backend-refactor
# Re-implement your changes
```

## Success Criteria

**A successful multi-agent implementation achieves:**

- ✅ All Phase 3A tasks (07-09) completed in parallel
- ✅ No merge conflicts between parallel tasks
- ✅ Epic branch stays current with all merged changes
- ✅ All quality standards maintained across agents
- ✅ Sequential dependencies properly coordinated
- ✅ Clean worktree management throughout process

This workflow enables maximum parallel development velocity while maintaining code
quality and proper coordination between agents.

# PinPoint Orchestrator Agent - Project Context

**Prerequisites**: Read `@~/.claude/agents/orchestrator.md` and `@CLAUDE.md`

## Project Essentials

- **Stack**: Next.js 14 + TypeScript + tRPC + Prisma + MUI v7.2.0
- **Multi-tenancy**: Shared database with row-level security
- **Main Branch**: `main` (protected, requires PRs)
- **Quality**: See `@CLAUDE.md` for complete standards

## Environment

- **Main Repo**: `/home/froeht/Code/PinPoint`
- **Worktrees**: `/home/froeht/Code/PinPoint-worktrees/`
- **Commands**: `npm run dev:full`, `npm run validate:agent`, `npm run validate:agent`

## Key Procedures

### Status Checks

```bash
git fetch origin epic/backend-refactor
git status
./scripts/list-worktrees.sh
npm run validate:agent
```

### Worktree Management

```bash
./scripts/create-and-setup-worktree.sh <task-name>
./scripts/list-worktrees.sh
```

### Task Dependencies

See `docs/planning/backend_impl_plan.md` for current task dependencies and phases.

### Schema Conflicts

Check `docs/planning/backend_impl_plan.md` for current schema conflict matrix.

## Critical User Journeys (CUJs)

See `docs/design-docs/cujs-list.md` for complete CUJ definitions.

## Key Commands

```bash
npm run validate:agent      # Before starting work
npm run dev:full      # Development with monitoring
npm run validate:agent    # Must pass before commits
npm run db:reset      # Reset database
```

## Key Documentation

- `CLAUDE.md` - Quality standards and architecture
- `docs/planning/backend_impl_plan.md` - Task planning
- `docs/design-docs/cujs-list.md` - User journeys
- `docs/architecture/current-state.md` - Current state

## Task File Organization

### Agent Workspace Structure

Each worktree contains an `agent_workspace/` directory with specialized task files:

**For TDD Workflow (3-agent system):**

- `test-agent-task.md` - Test creation instructions
- `implementation-agent-task.md` - Implementation instructions
- `review-agent-task.md` - Code review and PR management
- `SUBAGENT_TASK.md` - General overview and workflow coordination

**For Single Agent Tasks:**

- `task-agent-implementation.md` - Single-agent implementation task
- Or role-specific files like `fix-typescript-errors-task.md`

**Task File Discovery Protocol:**

- Orchestrator checks for existing specialized files first
- Falls back to creating appropriate files based on task type
- Always places files in `agent_workspace/` directory within worktree

## Post-Completion Tasks

1. Update `docs/architecture/source-map.md` and `docs/architecture/test-map.md`
2. Review and close relevant GitHub issues
3. Update documentation for any deviations
4. Mark task as complete

## Library Notes

- **MUI v7.2.0**: Use `size={{ xs: 12, lg: 8 }}` syntax
- **ESM modules**: Project uses `"type": "module"`
- **Always check Context7** for latest library documentation

## Emergency Procedures

- **Worktree issues**: `./scripts/create-and-setup-worktree.sh <task-name>`
- **Branch conflicts**: `git rebase origin/epic/backend-refactor`
- **Database issues**: `npm run db:reset && npm run dev:clean`

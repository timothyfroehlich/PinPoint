# PinPoint Orchestrator Agent - Project Context

**Prerequisites**: Read `@~/.claude/agents/orchestrator.md` and `@CLAUDE.md`

## Project Essentials

- **Stack**: Next.js 14 + TypeScript + tRPC + Prisma + MUI v7.2.0
- **Multi-tenancy**: Shared database with row-level security
- **Main Branch**: `main` (protected, requires PRs)
- **Quality**: See `@CLAUDE.md` for complete standards

## Environment

- **Main Repo**: `/home/froeht/Code/PinPoint`
- **Worktrees**: `/home/froeht/Code/PinPoint/worktrees/`
- **Commands**: `npm run dev:full`, `npm run validate`, `npm run validate`

## Orchestrator Command Variations

### Available Commands

- **`/orchestrator-feature <task description>`** - Collaborative feature development (research → design → handoff)
- **`/orchestrator-bugfix <bug description>`** - Autonomous bug fixing (complete fix within session)
- **`/orchestrator-checkout <PR# or branch>`** - Environment setup for existing branches

### Key Procedures

#### Status Checks

```bash
git fetch origin epic/backend-refactor
git status
./scripts/list-worktrees.sh
npm run validate
```

#### Worktree Management

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
npm run validate      # Before starting work
npm run dev:full      # Development with monitoring
npm run validate    # Must pass before commits
npm run db:reset:local:sb # Reset database
```

## Key Documentation

- `CLAUDE.md` - Quality standards and architecture
- `docs/planning/backend_impl_plan.md` - Task planning
- `docs/design-docs/cujs-list.md` - User journeys
- `docs/architecture/current-state.md` - Current state

## Task Management

### GitHub Issues for Task Coordination

All orchestrator variants create GitHub issues for task management:

- **Issue Creation** - All orchestrator commands use `gh issue create`
- **Comprehensive Context** - Issues contain complete task specifications
- **Label Organization** - Consistent labeling (e.g., "orchestrator-task", "feature", "bug")
- **Agent Dispatch** - Agents receive issue numbers: "Your task is issue #X"
- **Progress Tracking** - Built-in GitHub issue tracking and status updates

### Issue Content Structure

- **Mission Statement** - Clear task description and title
- **Context** - Background information and constraints
- **Implementation Steps** - Detailed step-by-step guide
- **Quality Requirements** - Standards and validation criteria
- **Success Criteria** - Definition of completion
- **Completion Instructions** - Link PR, update status, close when merged

## Post-Completion Tasks

1. Update `docs/architecture/source-map.md` and `docs/architecture/test-map.md`
2. Close the GitHub issue when PR is merged
3. Update documentation for any deviations
4. Review related issues that may need updates

## Library Notes

- **MUI v7.2.0**: Use `size={{ xs: 12, lg: 8 }}` syntax
- **ESM modules**: Project uses `"type": "module"`
- **Always check Context7** for latest library documentation

## Emergency Procedures

- **Worktree issues**: `./scripts/create-and-setup-worktree.sh <task-name>`
- **Branch conflicts**: `git rebase origin/epic/backend-refactor`
- **Database issues**: `npm run db:reset:local:sb && npm run dev:clean`

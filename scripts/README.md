# Development Scripts

This directory contains utility scripts for PinPoint development workflows.

## Core Development Scripts

### Development Server Management

- **`dev-background.sh`** - Manage development server in background
  ```bash
  npm run dev:bg        # Start server in background
  npm run dev:bg:stop   # Stop background server
  npm run dev:bg:status # Check server status
  npm run dev:bg:logs   # View server logs
  ```

### Worktree Management

- **`create-and-setup-worktree.sh`** - Create new Git worktrees with full environment setup
- **`setup-worktree.sh`** - Set up environment for existing worktree
- **`list-worktrees.sh`** - List all worktrees with status information
- **`worktree-status.sh`** - Detailed status of worktree environments
- **`worktree-cleanup.sh`** - Clean up abandoned worktrees and containers

### Database Validation

- **`validate-drizzle-crud.ts`** - Comprehensive database operation validation
- **`validate-drizzle-foundation.ts`** - Core database foundation tests
- **`test-drizzle-*.ts`** - Specific database connectivity and CRUD tests

## Utility Scripts

### CI and Development

- **`ci-typecheck-filter.sh`** - Filter TypeScript errors for CI reporting
- **`cleanup-dev.cjs`** - Clean up development processes and files
- **`health-check.cjs`** - System health monitoring
- **`kill-dev-processes.cjs`** - Stop all development processes
- **`summarize-validation.mjs`** - Summarize validation results

### Agent Workflow

- **`agent-*.cjs`** - Scripts for automated agent workflows (dependencies, smoke tests, fixes)

### Database Management

- **`check-database.ts`** - Database connectivity verification
- **`check-current-schema.ts`** - Schema validation utilities

## Usage Patterns

### Starting Development

```bash
npm run dev:bg        # Start development server
npm run dev:bg:status # Verify it's running
```

### Database Validation

```bash
npm run db:validate   # Run comprehensive database tests
npm run db:push:local # Push schema changes
```

### Worktree Workflow

```bash
./scripts/create-and-setup-worktree.sh feature-branch
cd ../worktrees/feature-branch
npm run dev:bg
```

## Related Commands

Most scripts are wrapped in package.json commands. Use `npm run` commands when available:

- `npm run dev:bg*` - Background development server
- `npm run db:*` - Database operations
- `npm run setup:worktree` - Worktree initialization

See package.json scripts section for the complete list of available commands.

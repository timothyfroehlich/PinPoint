# Development Scripts

This directory contains utility scripts for PinPoint development workflows.

## Core Development Scripts

### Development Server Management

- Use `npm run dev` directly - background scripts have been removed for simplicity

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
supabase start       # Start database
npm run dev          # Start development server
```

### Database Validation

```bash
npm run db:validate   # Run comprehensive database tests
npm run db:push:local # Push schema changes
```

### Worktree Workflow

**Standard Workflow (Shared Supabase):**

```bash
# From root directory - start shared Supabase instance
supabase start

# Create and use worktree
./scripts/create-and-setup-worktree.sh feature-branch
cd ../worktrees/feature-branch
npm run dev  # Uses shared Supabase from root
```

**Worktree-Specific Supabase (Only when explicitly needed):**

```bash
# Stop shared instance first
supabase stop

# In worktree directory
cd ../worktrees/feature-branch
supabase start  # Start instance specific to this worktree
npm run dev
```

**When to use worktree-specific Supabase:**

- Major schema migrations that conflict with root
- Significant database structure changes
- **Decision**: Only after explicit confirmation - ask first!

## Related Commands

Most scripts are wrapped in package.json commands. Use `npm run` commands when available:

- `npm run dev` - Development server
- `npm run db:*` - Database operations
- `npm run setup:worktree` - Worktree initialization

See package.json scripts section for the complete list of available commands.

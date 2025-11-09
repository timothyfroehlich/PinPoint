# PinPoint Development Scripts Guide for Agents

## ✅ Critical Context Files
The following files contain critical context for script usage:
- `package.json` - Available npm scripts and their purposes
- `docs/CORE/NON_NEGOTIABLES.md` - Command restrictions and forbidden patterns
- `scripts/README.md` - Detailed script documentation

## 🔨 CORE DEVELOPMENT SCRIPTS

### Development Server Management
- **Direct Usage**: Use `npm run dev` directly - background scripts have been removed for simplicity
- **Full Development**: `npm run dev:full` includes typecheck alongside dev server
- **Database Studio**: `npm run dev:db:studio` for schema exploration

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

## 🔧 UTILITY SCRIPTS

### CI and Development
- **`ci-typecheck-filter.sh`** - Filter TypeScript errors for CI reporting
- **`cleanup-dev.cjs`** - Clean up development processes and files
- **`health-check.cjs`** - System health monitoring
- **`kill-dev-processes.cjs`** - Stop all development processes
- **`summarize-validation.mjs`** - Summarize validation results

### Agent Workflow Scripts
- **`agent-*.cjs`** - Scripts for automated agent workflows
  - `agent-deps.cjs` - Dependency checking and management
  - `agent-smoke.cjs` - Smoke test execution
  - `agent-workflow.cjs` - General workflow automation

### Database Management
- **`check-database.ts`** - Database connectivity verification
- **`check-current-schema.ts`** - Schema validation utilities
- **`db-reset.sh`** - Complete database reset workflow

## 🚀 USAGE PATTERNS

### Starting Development
```bash
supabase start       # Start database
npm run dev          # Start development server
npm run dev:full     # Start with typecheck
```

### Database Operations
```bash
npm run db:reset               # Reset local database
npm run db:push:local          # Apply schema changes
npm run db:studio              # Open schema explorer
npm run db:generate-types      # Generate TypeScript types
```

### Validation Workflows
```bash
npm run typecheck             # TypeScript validation
npm run lint                  # ESLint validation
npm test                      # Unit/integration tests
npm run e2e                   # Playwright E2E tests (guest + auth)
npm run test:rls              # RLS policy tests
```

### Worktree Workflows
```bash
./scripts/create-and-setup-worktree.sh feature-branch
./scripts/list-worktrees.sh
./scripts/worktree-cleanup.sh
```

## ⚠️ COMMAND RESTRICTIONS

### Forbidden Patterns
- **Vitest Redirection**: Never use `npm test 2>&1` or `npm test > file.txt` (breaks Vitest)
- **Migration Generation**: Never use `drizzle-kit generate` or `npm run db:generate` (pre-beta constraint)
- **Direct Database Access**: Use wrapper scripts `safe-psql.sh` and `safe-curl.sh` for automated processes

### Safe Alternatives
- **Search**: Use `rg --files`, `fd` instead of `find`
- **Testing**: Use `npm run test:brief`, `npm run test:verbose` for controlled output
- **Database**: Use `npm run db:push:local` instead of migration files

## 🔍 SCRIPT CATEGORIES

### Validation Scripts
- **Purpose**: Verify code quality, database integrity, and system health
- **Usage**: Automated in CI/CD, manual debugging, pre-commit checks
- **Pattern**: Return exit codes for automation, provide detailed output for debugging

### Automation Scripts
- **Purpose**: Streamline repetitive development tasks
- **Usage**: Background processes, workflow automation, environment setup
- **Pattern**: Idempotent operations, clear error reporting, graceful degradation

### Infrastructure Scripts
- **Purpose**: Manage development environment and dependencies
- **Usage**: Environment setup, container management, service orchestration
- **Pattern**: Environment detection, cleanup on failure, status reporting

## 🔐 SECURITY CONSIDERATIONS

### Safe Execution
- Scripts use wrapper patterns for external commands (`safe-psql.sh`, `safe-curl.sh`)
- Environment variable validation before external API calls
- Proper error handling and cleanup on script failure

### Development Safety
- Database operations use local/preview environments only
- Sensitive operations require explicit confirmation
- All scripts respect the pre-beta development constraints

**USAGE**: This serves as the development scripts context for PinPoint. Always respect command restrictions and use safe alternatives for automated processes.

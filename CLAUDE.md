# PinPoint Development Instructions

## Tech Stack

- **Framework**: Next.js + React + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: NextAuth.js (Auth.js v5)
- **UI**: Material UI (MUI)
- **API**: tRPC
- **Deployment**: Vercel

## Core Architecture

### Multi-Tenancy

- Shared database with row-level security
- All tenant tables require non-nullable `organization_id`
- Strict query scoping by `organization_id`
- Global users with organization-specific memberships

### Key Entities

- **Organization**: Top-level tenant (e.g., "Austin Pinball Collective")
- **Location**: Physical venue belonging to an Organization
- **Game Title**: Generic machine model (e.g., "Godzilla Premium")
- **Game Instance**: Specific physical machine at a Location
- **Issue**: Problem/task for a Game Instance
- **User**: Global account; **Member**: User + Organization + Role

## Essential Commands

```bash
# Development (RECOMMENDED)
npm run dev:full        # Start all services with monitoring
npm run dev:clean       # Fresh start with cleanup
npm run setup:worktree  # Setup new worktree environment

# Agent Validation Protocol (MANDATORY)
npm run quick:agent        # Development checks + auto-fix (after code changes)
npm run validate:agent     # Pre-commit validation + auto-fix (MUST PASS)
npm run validate:full:agent # Pre-PR validation (MUST PASS)

# Legacy Commands (Still Available)
npm run validate        # Standard validation
npm run pre-commit      # Full validation + workflow check + build test

# Database
npm run db:reset
npm run db:push

# Quick Fixes & Debug
npm run fix             # Auto-fix lint + format issues
npm run debug:typecheck # Full TypeScript output
npm run debug:test      # Verbose test output
npm run debug:lint      # Detailed lint output

# Testing
npm run test:coverage
```

## Quality Standards (Zero Tolerance)

- **0 TypeScript errors** - Fix immediately, never commit with TS errors
- **0 usage of `any`**: Never use an `any` type, even in test code. If you don't know the type then go look for it.
- **0 ESLint errors** - Warnings acceptable with justification
- **Strict type-aware linting** - Project uses `@tsconfig/strictest` + type-aware ESLint rules to enforce type safety
- **Consistent formatting** - Auto-formatted with Prettier
- **Modern patterns** - ES modules, typed mocks (`jest.fn<T>()`), no `any` types
- **Test quality** - Same standards as production code
- **Coverage thresholds** - 50% global, 60% server/, 70% lib/ (configured in jest.config.js)

## Development Workflow

1. **Start**: `npm run validate` → `npm run dev:full`
2. **During**: Run `npm run quick:agent` after significant code changes
3. **Before commit**: `npm run validate:agent` must pass (MANDATORY)
4. **Before PR**: `npm run validate:full:agent` must pass (MANDATORY)
5. **Database changes**: Use `npm run db:reset` (pre-production phase)

### Agent Protocol Benefits

- **Context preservation**: ~3-5 lines output vs 100+ lines
- **Auto-fix capability**: Automatically fixes lint/format issues
- **Early detection**: Catch issues during development, not CI
- **Consistent format**: ✓ Success messages, ✗ Error summaries

## Architecture Principles

- **TypeScript First**: Strict typing, no unsafe operations
- **Optimistic UI**: Immediate updates, background API calls, revert on failure
- **Future-Ready**: Design for Kanban board (post-1.0) and inventory (v2.0)
- **Testing**: Unit tests with mocked dependencies only - database tests require exceptional justification

## MCP Tools Available

- **GitHub**: Repository management, PRs, issues
- **Playwright**: Browser automation, E2E testing
- **Context7**: Library documentation lookup

## Repository

- **Repo**: timothyfroehlich/PinPoint
- **Troubleshooting**: See `docs/troubleshooting.md`
- **Design Docs**: Available in Notion workspace (`/PinPoint/`)
- **Protected Main**: Never commit to main, all changes require PRs.

## Critical Notes

- Database strategy in development: sessions clear on `db:reset`
- Pre-production: frequent schema changes, no migrations
- OPDB games: global (no organizationId), custom games: organization-scoped
- **ESM modules**: Project uses `"type": "module"` - some packages (superjson, @auth/prisma-adapter) are ESM-only and may need transformIgnorePatterns updates in Jest
- **Jest ESM**: Current config uses `ts-jest/presets/default-esm` - avoid changing without understanding ESM implications
- **Type Safety**: Project enforces strictest TypeScript + type-aware ESLint rules. All `@typescript-eslint/no-unsafe-*` and `no-explicit-any` violations must be fixed

## Frontend Development Notes

- **MUI Version**: Currently using MUI v7.2.0 - always check Context7 for latest MUI documentation before making changes
- **Grid Components**: In MUI v7, use `import Grid from "@mui/material/Grid"` and `size={{ xs: 12, lg: 8 }}` syntax (no `item` prop needed)

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

# Quality Assurance (MANDATORY)
npm run validate        # Before starting work
npm run pre-commit      # Before every commit (MUST PASS)

# Database
npm run db:reset        # Complete reset + reseed
npm run db:push         # Sync schema changes

# Quick Checks
npm run quick           # Fast typecheck + lint
npm run fix             # Auto-fix lint + format issues
npm run typecheck       # TypeScript validation only

# Testing
npm run test:coverage   # Generate coverage reports (50% global minimum)
```

## Quality Standards (Zero Tolerance)

- **0 TypeScript errors** - Fix immediately, never commit with TS errors
- **0 ESLint errors** - Warnings acceptable with justification
- **Consistent formatting** - Auto-formatted with Prettier
- **Modern patterns** - ES modules, typed mocks (`jest.fn<T>()`), no `any` types
- **Test quality** - Same standards as production code
- **Coverage thresholds** - 50% global, 60% server/, 70% lib/ (configured in jest.config.js)

## Development Workflow

0. **Branching**: Always begin new tasks on a new branch
1. **Start**: `npm run validate` → `npm run dev:full`
2. **During**: Fix lint/type errors immediately as they appear
3. **Before commit**: `npm run pre-commit` must pass
4. **Database changes**: Use `npm run db:reset` (pre-production phase)

## Architecture Principles

- **TypeScript First**: Strict typing, no unsafe operations
- **Optimistic UI**: Immediate updates, background API calls, revert on failure
- **Future-Ready**: Design for Kanban board (post-1.0) and inventory (v2.0)
- **Testing**: Unit tests for business logic, integration tests coming later

## MCP Tools Available

- **GitHub**: Repository management, PRs, issues
- **Notion**: Design documentation, planning documents
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

## Frontend Development Notes

- **MUI Version**: Currently using MUI v7.2.0 - always check Context7 for latest MUI documentation before making changes
- **Grid Components**: In MUI v7, use `import Grid from "@mui/material/Grid"` and `size={{ xs: 12, lg: 8 }}` syntax (no `item` prop needed)

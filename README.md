# PinPoint: Modern Issue Tracking for Arcades & Collectives

[![CI](https://github.com/froeht/PinPoint/actions/workflows/ci.yml/badge.svg)](https://github.com/froeht/PinPoint/actions/workflows/ci.yml)

PinPoint is a full-stack, multi-tenant issue tracking system designed from the ground up to streamline pinball machine and arcade game maintenance. It provides a transparent, high-quality experience for both players and the internal teams responsible for keeping the games running perfectly.

## About The Project

For many pinball collectives and arcade operators, tracking machine issues is a chaotic process involving text messages, Discord threads, and forgotten sticky notes. This disorganization leads to lost reports, delayed repairs, and frustrated players.

PinPoint solves this by providing a centralized, modern platform for the entire issue lifecycle. It empowers players to easily report problems while giving operators and technicians the tools they need to manage repairs efficiently, track machine history, and ultimately improve uptime. [1]

The system is architected as a multi-tenant SaaS platform, allowing multiple organizations to manage their game fleets in a secure and isolated environment. [1]

### Key Features

**For Players & Guests:**

- **Public Issue Dashboard:** See a list of all known issues at a location to avoid duplicate reports. [1]
- **Game Status Pages:** Scan a QR code on any machine to view its current status and complete maintenance history. [1]
- **Simple Issue Reporting:** Use a mobile-friendly form to quickly report problems, complete with photo uploads. [1]
- **Optional Notifications:** Provide an email to receive a one-time notification when the issue you reported is resolved. [1]

**For Operators & Technicians:**

- **Secure, Role-Based Access:** Manage your organization with distinct permissions for `Admins` and `Members`. [1]
- **Fleet Management:** Define game titles and manage every physical `Game Instance` across one or more `Locations`. [1]
- **Internal Management Dashboard:** A private dashboard to view, filter, and manage all issues. Update status, severity, and assignees, and hold internal discussions with comments. [1]
- **Complete Audit Trail:** Every issue features a time-stamped, immutable log of every action taken, providing full accountability. [1]
- **Advanced Tools:** Merge duplicate issues into a single canonical report and allow registered users to "upvote" issues to help with prioritization. [1]

### Built With

This project leverages a modern, type-safe, and performant technology stack to ensure a great developer and user experience. [1]

- **Framework:** [Next.js](https://nextjs.org/)
- **Language:**([https://www.typescriptlang.org/](https://www.typescriptlang.org/))
- **UI Library:**([https://react.dev/](https://react.dev/))
- **Styling:**([https://tailwindcss.com/](https://tailwindcss.com/)) & [Material UI (MUI)](https://mui.com/)
- **Database ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **Database:** [PostgreSQL](https://www.postgresql.org/) via [Supabase](https://supabase.com/)
- **Authentication:** [Supabase Auth](https://supabase.com/auth)

### ✅ Migration Near Complete

PinPoint has successfully completed its strategic migration to modernize its architecture:

- **Timeline:** 6-week staged migration (**95% COMPLETE**)
- **Stage 1** ✅ **COMPLETE**: Supabase Auth integration
- **Stage 2** ✅ **COMPLETE**: Drizzle ORM migration (100% Prisma removal achieved)
- **Stage 3** ✅ **COMPLETE**: Row Level Security activation
- **Benefits:** Database-enforced security, 100x faster serverless performance, better developer experience

**Quality Status**: All tests and lints should now pass - any failures indicate issues that need fixing.

For details, see the [Migration Guide](./docs/migration/supabase-drizzle/).

### 🚨 Development User Reset Warning

**CRITICAL DURING DEVELOPMENT**: PinPoint development seeding **DELETES AND RECREATES ALL SUPABASE AUTH USERS** on every `npm run reset:local`.

**⚠️ THIS MEANS:**

- **ALL AUTH USERS ARE WIPED** every time you reset the database
- **DEV LOGIN USERS**: Dev Admin, Dev Member, Dev Player - all recreated fresh
- **PINBALL PERSONALITIES**: Roger Sharpe, Gary Stern, etc. - all recreated fresh
- **ANY MANUAL TEST USERS**: Will be deleted and need recreation

**🔔 BETA-ONLY BEHAVIOR**: This aggressive user reset is **TEMPORARY** for rapid development iteration. In production, user accounts will be preserved.

**🚨 BEFORE PRODUCTION**: We MUST update the seeding system to preserve existing users and only create missing ones.

## Getting Started

### Quick Start

All development tools are included in `devDependencies` - no global installs required!

```bash
# 1. Clone and install dependencies
git clone https://github.com/timothyfroehlich/PinPoint.git
cd PinPoint
npm install

# 2. Set up environment variables
vercel link --project pin-point
npm run env:pull  # Downloads shared development environment from Vercel

# 3. Start Supabase and initialize database (from root worktree)
supabase start  # Start shared instance from root directory
npm run reset:local

# 4. Start development server
npm run dev

# 5. Validate setup
npm run check
```

Your development server will be running at **http://localhost:49200**

### Development Workflow

**Essential Commands:**

- `supabase start` - Start local Supabase instance
- `npm run dev` - Start development server
- `npm run check` - Run all quality checks (typecheck, lint, format, audit)
- `npm run validate` - Full validation including tests (run before commits)

**Database Commands:**

- `npm run db:reset:local:sb` - Reset database with fresh schema and seed data
- `npm run db:push:local` - Sync schema changes without reset
- `npm run db:seed:local:sb` - Seed data only (local Supabase)

**Supabase Instance Strategy:**

- **Default**: Start Supabase from root worktree - all worktrees share one instance
- **Exception**: For major schema changes, stop root instance and start from current worktree
- **Decision**: Only switch to worktree-specific after explicit confirmation
- **Ports**: Supabase uses fixed ports (54321, 54322) - only one instance can run at a time

### Prerequisites

**Required Global Installs:**

- **[Vercel CLI](https://vercel.com/cli)** - Essential for environment management (`vercel env pull`)
- **[Supabase CLI](https://supabase.com/docs/guides/cli)** - Required for local database (`supabase start`)

```bash
# Vercel CLI via npm
npm install -g vercel

# Supabase CLI via Homebrew (npm global install not supported)
brew install supabase/tap/supabase

# Alternative for Supabase: See https://github.com/supabase/cli#install-the-cli
```

**Optional Global Tools** (for convenience - all available via npm scripts):

- **[TypeScript](https://www.typescriptlang.org/)** - Direct `tsc` access (or use `npm run typecheck`)
- **[ESLint](https://eslint.org/)** - Direct `eslint` access (or use `npm run lint`)
- **[Prettier](https://prettier.io/)** - Direct `prettier` access (or use `npm run format`)
- **[Vitest](https://vitest.dev/)** - Direct `vitest` access (or use `npm run test`)

### Troubleshooting

If you encounter issues, see [docs/troubleshooting.md](./docs/troubleshooting.md) for detailed solutions.

**Quick fixes:**

- **Server not responding**: Stop with `Ctrl+C` then restart `npm run dev`
- **Database issues**: `npm run reset:local`
- **Dependency problems**: `npm run clean` then `npm install`

## Roadmap

PinPoint is designed to evolve. Key features planned for future releases include:

- **Interactive Kanban Board:** A visual, drag-and-drop interface for members to manage the issue workflow, allowing for rapid updates to status and assignees.
- **Parts & Inventory Tracking (v2.0):** A comprehensive module to manage spare parts and supplies. This will allow organizations to track stock levels, associate part consumption with specific repairs, and analyze the true maintenance cost of each game.

This roadmap ensures that PinPoint will grow from a powerful issue tracker into a complete operational management tool for any arcade or collective.

## Multi-Agent Development Workflow

PinPoint uses a coordinated multi-agent development approach for backend implementation tasks. Multiple Claude agents work in parallel using git worktrees to maximize development velocity while maintaining code quality.

**For developers working on backend tasks**: See `docs/backend_impl_tasks/MULTI_AGENT_WORKFLOW.md` for complete coordination guidelines, worktree setup, and synchronization procedures.

Key features:

- **Parallel Development**: Multiple agents work simultaneously on independent tasks
- **Git Worktrees**: Isolated environments prevent conflicts between agents
- **Dependency Management**: Clear coordination for sequential task dependencies
- **Quality Standards**: All agents maintain strict TypeScript and testing requirements

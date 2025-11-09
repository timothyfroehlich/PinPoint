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
- **Fleet Management:** Define models and manage every physical `Machine` across one or more `Locations`. [1]
- **Internal Management Dashboard:** A private dashboard to view, filter, and manage all issues. Update status, severity, and assignees, and hold internal discussions with comments. [1]
- **Complete Audit Trail:** Every issue features a time-stamped, immutable log of every action taken, providing full accountability. [1]
- **Advanced Tools:** Merge duplicate issues into a single canonical report and allow registered users to "upvote" issues to help with prioritization. [1]

### Built With

Technology stack:

- **Framework:** [Next.js 15](https://nextjs.org/) with React Server Components
- **Language:** [TypeScript](https://www.typescriptlang.org/) (strictest configuration)  
- **Runtime:** [React 19](https://react.dev/)
- **Components:** [shadcn/ui](https://ui.shadcn.com/) (primary), [Material UI](https://mui.com/) (transition)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Database:** [PostgreSQL](https://www.postgresql.org/) via [Supabase](https://supabase.com/)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication:** [Supabase SSR](https://supabase.com/docs/guides/auth/server-side)
- **Testing:** [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/), [PGlite](https://pglite.dev/)

### Current Development Phase

**React Server Components Migration:**
- Status: Phase 1A Foundation nearly complete
- Next: Data Access Layer (DAL) implementation
- Approach: Complete rewrite from client-heavy MUI to server-first RSC

**Test System:**
- Status: Archive complete, standards consolidated
- Next: Expand coverage across Unit, Integration, E2E, RLS, Schema
- Approach: Follow CORE testing guide; use templates/helpers where useful

**Project Context:** Pre-beta phase, solo development, high risk tolerance for breaking changes

For detailed evolution plans, see [`RSC_MIGRATION/`](./RSC_MIGRATION/) and the CORE testing guide [`docs/CORE/TESTING_GUIDE.md`](./docs/CORE/TESTING_GUIDE.md).

### 🚨 Development User Reset Warning

**CRITICAL DURING DEVELOPMENT**: PinPoint development seeding **DELETES AND RECREATES ALL SUPABASE AUTH USERS** on every `npm run reset:local`.

**⚠️ THIS MEANS:**

- **ALL AUTH USERS ARE WIPED** every time you reset the database
- **DEV LOGIN USERS**: Dev Admin, Dev Member, Dev Player - all recreated fresh
- **PINBALL PERSONALITIES**: Roger Sharpe, Gary Stern, etc. - all recreated fresh
- **ANY MANUAL TEST USERS**: Will be deleted and need recreation

**🔔 BETA-ONLY BEHAVIOR**: This aggressive user reset is **TEMPORARY** for rapid development iteration. In production, user accounts will be preserved.

**🚨 BEFORE PRODUCTION**: We MUST update the seeding system to preserve existing users and only create missing ones.

## Architecture Changes

**Current:** Client-heavy MUI components with tRPC + Prisma
**Target:** Server Components with shadcn/ui + Drizzle

**Migration Strategy:**
- Server Components by default, Client Components for interactivity only
- MUI and shadcn/ui coexist during transition
- Complete rewrite approach rather than incremental migration

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

### Supabase Keys (Local)

Supabase CLI now exposes new-style local keys:

- Publishable (public): `sb_publishable_…`
- Secret (service role): `sb_secret_…`

Use `supabase status` to view them. Our scripts expect:

- `NEXT_PUBLIC_SUPABASE_URL` (e.g., `http://127.0.0.1:54321`)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key)
- `SUPABASE_SECRET_KEY` (secret key)

Notes:

- `scripts/db-reset.sh` auto-detects these for local runs if missing.
- Dev users are created via `scripts/create-dev-users.ts` and accept both new `sb_secret_*` keys and legacy JWT-style tokens.
- E2E runs on a dedicated port to avoid conflicts.

See docs/developer-guides/local-supabase-keys.md for details.
```

Your development server will be running at **http://localhost:49200**

### Development Workflow

**🚀 Modern Development Commands:**

- `npm run dev` - Next.js development server with React Server Components
- `npm run build` - Production build with Server Components validation
- `npm run check` - Complete quality validation (typecheck, lint, format, audit)
- `npm run validate` - Full validation including all tests (pre-commit ready)

**🎨 UI Development (shadcn/ui + Tailwind):**

- `npx shadcn@latest add [component]` - Install shadcn/ui components
- `npx shadcn@latest add block [block-name]` - Install pre-built component blocks
- CSS lives in `src/app/globals.css` with layer separation (MUI coexistence)

**🛢️ Database Commands:**

- `supabase start` - Start local Supabase instance (shared across worktrees)
- `npm run db:reset:local:sb` - Reset database with fresh schema and seed data
- `npm run db:push:local` - Sync schema changes without reset
- `npm run db:seed:local:sb` - Seed data only (local Supabase)

**🧪 Testing Commands (Post-Reboot):**

- `npm test` - Unit tests (single baseline test currently active)
- `npm run test:rls` - pgTAP Row-Level Security policy tests
- `npm run e2e` - Playwright E2E suite (guest + auth projects)

**Supabase Instance Strategy:**

- **Default**: Start Supabase from root worktree - all worktrees share one instance
- **Exception**: For major schema changes, stop root instance and start from current worktree
- **Decision**: Only switch to worktree-specific after explicit confirmation
- **Ports**: Supabase uses fixed ports (54321, 54322) - only one instance can run at a time

### GitHub Copilot Instructions

This repository includes comprehensive GitHub Copilot instructions to help you follow PinPoint's architectural patterns:

- **Repository-wide guidance**: `.github/copilot-instructions.md`
- **Pattern-specific instructions**: `.github/instructions/*.instructions.md`
  - Component development (Server/Client Components)
  - API routes and tRPC routers
  - Server Actions
  - Database layer and RLS
  - Authentication patterns
  - Testing strategies

When you use GitHub Copilot in this repository, it will automatically provide context-aware suggestions based on the file you're working on. The instructions emphasize:
- Multi-tenant security (organization scoping)
- Server-first architecture
- TypeScript strictest patterns
- Memory-safe testing patterns

For details, see [`.github/COPILOT_INSTRUCTIONS.md`](./.github/COPILOT_INSTRUCTIONS.md).

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

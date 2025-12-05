# PinPoint: Modern Issue Tracking for Arcades & Collectives

[![CI](https://github.com/froeht/PinPoint/actions/workflows/ci.yml/badge.svg)](https://github.com/froeht/PinPoint/actions/workflows/ci.yml)

PinPoint is a specialized issue tracking system built for the Austin Pinball Collective. It streamlines the maintenance of pinball machines by providing a centralized platform for reporting issues, tracking repairs, and managing the game fleet.

## Core Value Proposition

- **For Players**: Easily report issues by scanning a QR code on the machine. View current game status before playing.
- **For Operators**: Manage the entire fleet, track repair history, and prioritize maintenance tasks.
- **For the Community**: Improved game uptime and a better player experience.

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

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, React Server Components)
- **Language:** [TypeScript](https://www.typescriptlang.org/) (Strict configuration)
- **Runtime:** [React 19](https://react.dev/)
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/)
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

### Prerequisites

- **Node.js 22+** (Required)
- **npm** or **pnpm**
- **Supabase Account** (for local development and production)

### Setup Instructions

1.  **Clone the repository**

    ```bash
    git clone https://github.com/timothyfroehlich/PinPoint.git
    cd PinPoint
    ```

2.  **Install dependencies**

    ```bash
    npm install
    ```

3.  **Configure Environment Variables**
    Copy the example environment file:

    ```bash
    cp .env.example .env.local
    ```

4.  **Setup Supabase**
    - Create a new project at [database.new](https://database.new).
    - Get your project URL and Anon Key from Project Settings > API.
    - Get your Database URL (Transaction Pooler) from Project Settings > Database.
    - Update `.env.local` with these values.

5.  **Initialize Database**
    Push the schema to your Supabase project:

    ```bash
    npm run db:push
    ```

    _Note: This uses `drizzle-kit push` which is suitable for prototyping. For production, use migrations._

6.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) to view the app.

### Development Commands

| Command             | Description                          |
| :------------------ | :----------------------------------- |
| `npm run dev`       | Start the development server         |
| `npm run build`     | Build the application for production |
| `npm run start`     | Start the production build           |
| `npm run lint`      | Run ESLint                           |
| `npm run typecheck` | Run TypeScript compiler check        |
| `npm run format`    | Format code with Prettier            |
| `npm test`          | Run unit and integration tests       |
| `npm run smoke`     | Run Playwright smoke tests           |

### Deployment

The easiest way to deploy is using **Vercel** and **Supabase**.

1.  Push your code to a GitHub repository.
2.  Import the project into Vercel.
3.  Add the environment variables from your `.env.local` to Vercel Project Settings.
4.  Deploy!

For detailed development guidelines, see [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md).

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

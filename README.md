# PinPoint: Issue Tracking for Pinball Collectives

[![CI](https://github.com/froeht/PinPoint/actions/workflows/ci.yml/badge.svg)](https://github.com/froeht/PinPoint/actions/workflows/ci.yml)

PinPoint is an issue tracker built for the **Austin Pinball Collective**.
It helps keep games playable by making it easy to report problems, see what’s broken, and coordinate repairs.

---

## What PinPoint Is For

### For Players & Guests

- See whether a machine is **operational**, **needs service**, or **unplayable** before you drop a quarter.
- Report issues in seconds from your phone:
  - Pick a machine
  - Describe the problem
  - Choose a severity: `minor`, `playable`, or `unplayable`

### For Operators & Techs

- Get a clear view of:
  - Which machines are down
  - Which issues are most urgent
  - What’s assigned to whom
- Track the full history of each machine:
  - Issues
  - Comments
  - Status changes

### Core Concepts

- **Machine** – a specific physical game in the collection.
- **Issue** – a problem on a machine, always tied to exactly one machine.
- **Severity** – how bad it is from a player’s perspective:
  - `minor` – cosmetic / nice-to-fix
  - `playable` – affects gameplay but you can still play
  - `unplayable` – game is effectively down

---

## How People Use It

- Players scan a code or visit the report page to log an issue while they’re standing at the machine.
- Members log in to:
  - See their assigned issues
  - Filter and triage by severity, status, or machine
  - Work through issues and record what was done
- Operators use the dashboard to:
  - Spot unplayable machines quickly
  - Plan repair sessions
  - Keep a record of recurring problems

---

## Tech Stack (High Level)

- **Framework:** Next.js 16 (App Router, React Server Components)
- **Language:** TypeScript (strictest settings)
- **Runtime:** React 19
- **UI:** shadcn/ui + Tailwind CSS v4
- **Database:** PostgreSQL via Supabase
- **ORM:** Drizzle ORM (schema + migrations)
- **Auth:** Supabase SSR
- **Testing:** Vitest, Playwright, PGlite

---

## For Developers

If you’re changing code, **start here**:

- `AGENTS.md` – project rules, constraints, and expectations
- `docs/NON_NEGOTIABLES.md` – things you must not break
- `docs/PATTERNS.md` – how we structure code (and why)
- `docs/DEVELOPMENT.md` – day‑to‑day commands and workflow

### Prerequisites

- Node.js **22+**
- npm
- Supabase account (for local dev / preview / prod)

### Local Setup (Short Version)

```bash
git clone https://github.com/timothyfroehlich/PinPoint.git
cd PinPoint

npm install
cp .env.example .env.local   # then fill in Supabase + DB vars

supabase start               # in one terminal
npm run dev                  # in another
```

Open `http://localhost:<PORT>` (see `.env.local`) to use the app.

### Database Workflow (Migrations)

Schema lives in `src/server/db/schema.ts` and is managed through **Drizzle migrations**:

```bash
# After editing schema.ts
npm run db:generate -- --name <change-name>   # create migration
npm run db:migrate                            # apply migrations locally
npm run test:_generate-schema                 # refresh PGlite schema
```

For a full local reset (destructive – wipes app data):

```bash
npm run db:reset
```

This restarts Supabase, drops app tables, reapplies all migrations, regenerates the test schema, and seeds users/data.

### Everyday Commands

```bash
npm run dev          # start dev server
npm run check        # typecheck + lint + unit/integration tests
npm run test         # unit + PGlite integration tests
npm run test:integration   # Supabase-backed integration tests
npm run smoke        # Playwright smoke E2E tests
npm run preflight    # full local CI gate before pushing
# See docs/E2E_DOCKER.md for running Safari tests locally via Docker
```

For more detail, see `docs/DEVELOPMENT.md` and `docs/TESTING_PLAN.md`.

---

## Deployment

PinPoint is designed to run on **Vercel + Supabase**:

1. Push your code to GitHub.
2. Import the repo into Vercel.
3. Configure environment variables in Vercel to match your `.env.local`.
4. Point the app at your Supabase project (preview and production projects recommended).

CI is configured via `.github/workflows/ci.yml` and mirrors the `npm run preflight` pipeline.

---

## Roadmap (High Level)

Short‑term focus:

- Alpha hardening for the Austin Pinball Collective
- Better dashboards for operators
- Smoother public reporting flow

Future ideas:

- More advanced dashboards and views (e.g., Kanban-style)
- Parts and inventory tracking
- Additional locations and multi‑venue support

See `docs/PRODUCT_SPEC.md` and `docs/V2_ROADMAP.md` for a more detailed roadmap.

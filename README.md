# PinPoint: Issue Tracking for Pinball Collectives

[![CI](https://github.com/timothyfroehlich/PinPoint/actions/workflows/ci.yml/badge.svg)](https://github.com/timothyfroehlich/PinPoint/actions/workflows/ci.yml)

PinPoint is an issue tracker built for the **Austin Pinball Collective**.
It helps keep games playable by making it easy to report problems, see what’s broken, and coordinate repairs.
It is in active production use by the collective’s members.

---

## What PinPoint Is For

### For Players & Guests

- See whether a machine is **operational**, **needs service**, or **unplayable** before you drop a quarter.
- Report issues in seconds from your phone:
  - Pick a machine
  - Describe the problem
  - Choose a severity: `cosmetic`, `minor`, `major`, or `unplayable`
  - Indicate consistency: `intermittent`, `frequent`, or `constant`
  - (Optional) Provide contact info for updates

### For Operators & Techs

- See every open issue across the collection at a glance, with the worst-off machines surfaced first.
- Filter and triage by severity, status, or machine.
- Pick up issues, work through them, and record what was done so there’s a history per machine.
- Spot recurring problems and plan repair sessions around them.

### Core Concepts

- **Machine** – a specific physical game in the collection.
- **Issue** – a problem on a machine, always tied to exactly one machine.
- **Severity** – how bad it is from a player’s perspective:
  - `cosmetic` – very minor / nice-to-fix (e.g. dirty playfield, minor bulb out)
  - `minor` – small issues that do not change how the game plays
  - `major` – the game plays, but something significant is wrong (shots not registering, features disabled)
  - `unplayable` – game is effectively down (ball stuck, flippers dead)

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
- `.agents/skills/` – how we structure code (and why); `pinpoint-ui`, `pinpoint-typescript`, `pinpoint-security`, `pinpoint-testing` are the ones you'll reach for most
- `docs/feature-specs/` – approved requirements for individual features

### Prerequisites

- [mise](https://mise.jdx.dev/) **2026.8.11+** (manages development Node and pnpm)
- Node.js **24** (pinned in `mise.toml`; `22.22+` or `26+` also satisfy `engines`)
- pnpm (exact version and sha512 integrity pinned in `packageManager` in `package.json`)
- Supabase account (for local dev / preview / prod)

### Local Setup (Short Version)

```bash
git clone https://github.com/timothyfroehlich/PinPoint.git
cd PinPoint

mise install --locked           # installs pinned Node and pnpm via package.json
pnpm install
cp .env.example .env.local      # then fill in Supabase + DB vars

pnpm run dev                    # automatically ensures Supabase is running
```

Open `http://localhost:<PORT>` (see `.env.local`) to use the app.

### Database Workflow (Migrations)

Schema lives in `src/server/db/schema.ts` and is managed through **Drizzle migrations**:

```bash
# After editing schema.ts
pnpm run db:generate -- --name <change-name>   # create migration
pnpm run db:migrate                            # apply migrations locally
pnpm run test:_generate-schema                 # refresh PGlite schema
```

For a full local reset (destructive – wipes app data):

```bash
pnpm run db:reset
```

This restarts Supabase, drops app tables, reapplies all migrations, regenerates the test schema, and seeds users/data.

To browse or edit the data directly, `pnpm run db:studio` opens Drizzle Studio.

### Everyday Commands

```bash
pnpm run dev          # start dev server
pnpm run check        # static gate: typecheck + lint + format (no tests, no Python)
pnpm run test         # unit tests (PGlite)
pnpm run test:integration           # PGlite integration tests
pnpm run test:integration:supabase  # Supabase-backed integration tests (needs supabase start)
pnpm run check:python # ruff + pytest over scripts/ and the hooks
pnpm run smoke        # Playwright smoke E2E tests
pnpm run preflight    # full local CI gate before pushing
```

For the command reference and the rules behind it, see `AGENTS.md` §5; for which
tests to write where, the `pinpoint-testing` skill at
`.agents/skills/pinpoint-testing/SKILL.md`.

---

## Deployment

PinPoint is designed to run on **Vercel + Supabase**:

1. Push your code to GitHub.
2. Import the repo into Vercel.
3. Configure environment variables in Vercel to match your `.env.local`.
4. Point the app at your Supabase project (preview and production projects recommended).

CI is configured via `.github/workflows/ci.yml` and mirrors the `pnpm run preflight` pipeline.

---

## Roadmap (High Level)

Short‑term focus:

- Hardening and onboarding polish for the Austin Pinball Collective’s active users
- More refined dashboards for operators
- Expanding the machine registry with OPDB integration

Future ideas:

- More advanced dashboards and views (e.g., Kanban-style)
- Parts and inventory tracking
- Additional locations and multi‑venue support

Individual feature requirements live in `docs/feature-specs/`.

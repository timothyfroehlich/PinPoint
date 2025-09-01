# Repository Guidelines

Read and follow @CLAUDE.md

## Project Structure & Modules
- Source: `src/app` (Next.js App Router), `src/components` (client/server UI), `src/lib`, `src/hooks`, `src/server`, `src/utils`, `src/types`.
- Tests: unit/integration in `src/test`, Playwright E2E in `e2e/`, SQL/RLS tests in `supabase/tests`.
- Data & Infra: `supabase/` (config, seeds, RLS, tests), Drizzle configs in `drizzle.config.*.ts`, helper scripts in `scripts/`, static assets in `public/`.

## Build, Test, and Development
- `npm run dev`: Start Next.js dev server (use `dev:full` to include typecheck).
- `npm run build` / `npm start`: Production build and server.
- `npm run typecheck`: Strict TypeScript checks.
- `npm test`: Vitest unit/integration suite. `npm run test:watch` for TDD.
- `npm run smoke`: Quick Playwright smoke E2E. `npm run test:ci` runs unit + RLS + smoke.
- Database: `npm run db:push:local` (apply schema via Drizzle push), `npm run db:generate-types` (Supabase types), `npm run db:studio` (schema explorer), `npm run db:reset` (reset local dev DB).

## Coding Style & Naming
- Formatting: Prettier; run `npm run format:write`. Lint: ESLint via `npm run lint`.
- TypeScript everywhere; prefer explicit types on public APIs.
- Application code must follow TypeScript Strictest settings
- Components: PascalCase files (e.g., `ProfilePictureUpload.tsx`). Client-only pieces may use `-client.tsx` or live under a `client/` folder with `"use client"`.
- Hooks: `useThing.ts`. Utilities/constants: kebab-case or snake_case files; booleans prefixed `is/has`.

## Testing Guidelines
- Frameworks: Vitest (+ Testing Library), Playwright, and SQL/RLS tests.
- Naming: `*.test.ts(x)` for unit/integration, `*.e2e.test.ts`/`*.spec.ts` under `e2e/`, SQL tests in `supabase/tests/rls/*.test.sql`.
- Aim to cover services, server actions, and RLS-critical paths. Use helpers under `src/test/**`.

## Commit & Pull Requests
- Commits: Conventional style where practical (`feat:`, `fix:`, `chore:`, `build:`), optional scope, reference issues/PRs.
- PRs: clear description, linked issue, screenshots for UI, notes for DB schema/seed changes, and steps to verify.
- Before pushing: `npm run typecheck && npm test && npm run smoke && npm run lint`.
- Drizzle workflow: use `db:push:*`; do not add new SQL files under `supabase/migrations/` (initial snapshot is retained).

## Security & Configuration
- Env: copy `.env.example` to `.env.local` or `npm run env:pull`. Never commit secrets.
- Supabase: `npm run sb:reset` to bootstrap local; `sb:volumes:clean` is destructive.
- Hooks: Husky + lint-staged format on commit; optional `npm run pre-commit:gitleaks` for secret scanning.

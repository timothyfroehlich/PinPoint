Local Supabase Keys (Publishable/Secret)

- Supabase CLI now uses new-style keys for local projects:
  - Publishable (public): `sb_publishable_…`
  - Secret (service role): `sb_secret_…`

- To view your local keys:
  - Run `supabase status`
  - Copy the lines:
    - API URL
    - Publishable key
    - Secret key

- For local scripts and E2E:
  - Set `NEXT_PUBLIC_SUPABASE_URL` to the API URL (e.g., `http://127.0.0.1:54321`)
  - Set `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the publishable key
  - Set `SUPABASE_SECRET_KEY` to the secret key

- Dev users seeding:
  - `scripts/create-dev-users.ts` accepts both JWT-like legacy keys and new `sb_secret_…`
  - `scripts/db-reset.sh` auto-detects local keys via `supabase status` when envs are missing

- E2E snapshot
  - `npm run e2e:snapshot:create` auto-creates the fixtures directory and writes `e2e/fixtures/test-database.dump`
  - Playwright picks a dedicated port via `PLAYWRIGHT_PORT` to avoid conflicts (set in scripts)

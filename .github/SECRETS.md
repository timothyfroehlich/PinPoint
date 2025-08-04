# Required GitHub Secrets for CI/CD

## Smoke Test Workflow

The smoke test workflow requires the following secrets to be configured in your GitHub repository:

### Supabase Configuration

- `SUPABASE_URL` - Your Supabase project URL (e.g., `https://your-project-ref.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Public publishable key for client-side operations
- `SUPABASE_SECRET_KEY` - Secret key for admin operations

> **⚠️ Migration Note**: Updated from legacy `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`
> to match new Supabase API key naming convention. Existing deployments need to update
> their environment variables to use the new names.

### Database Connection

- `DATABASE_URL` - PostgreSQL connection string for your Supabase database

## Setting Up Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with the exact name and value from your Supabase dashboard

## Security Notes

- **⚠️ CI uses ephemeral database**: Smoke tests run against a temporary PostgreSQL container, not production
- Environment variables are pulled from Vercel but DATABASE_URL is overridden to use localhost:5432
- Test data isolation: `SMOKE-TEST-` prefixes and timestamps for any data that might reach production
- Cleanup step removes test data after each run (1-hour safety window)
- All test operations are designed to be non-destructive

## Alternative: Staging Instance

When you upgrade your Supabase plan, you can create a separate staging instance and update these secrets to point to staging instead of production.

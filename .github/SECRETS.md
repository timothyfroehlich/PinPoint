# Required GitHub Secrets for CI/CD

## Smoke Test Workflow

The smoke test workflow requires the following secrets to be configured in your GitHub repository:

### Supabase Configuration

- `SUPABASE_URL` - Your Supabase project URL (e.g., `https://your-project-ref.supabase.co`)
- `SUPABASE_ANON_KEY` - Public anonymous key for client-side operations
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations

### Database Connection

- `DATABASE_URL` - PostgreSQL connection string for your Supabase database

## Setting Up Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with the exact name and value from your Supabase dashboard

## Security Notes

- These secrets allow CI to test against your production Supabase instance
- Test data is isolated using `SMOKE-TEST-` prefixes and timestamps
- Cleanup step removes test data after each run (1-hour safety window)
- All test operations are non-destructive to production data

## Alternative: Staging Instance

When you upgrade your Supabase plan, you can create a separate staging instance and update these secrets to point to staging instead of production.

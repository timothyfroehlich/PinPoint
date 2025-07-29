# Supabase Local Development

## Overview

Supabase provides a complete local development environment using Docker. This allows you to develop against a local Supabase instance that mirrors production capabilities.

## Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose)
- Supabase CLI
- Node.js 18+

## Installation

### Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# npm/yarn
npm install -g supabase

# Or use npx without installing
npx supabase <command>
```

## Project Setup

### Initialize Supabase

```bash
# In your project root
supabase init

# This creates:
# - supabase/config.toml (configuration)
# - supabase/migrations/ (database migrations)
# - supabase/functions/ (edge functions)
```

### Start Local Supabase

```bash
# Start all services
supabase start

# Output will show:
# - API URL: http://localhost:54321
# - DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# - Studio URL: http://localhost:54323
# - Inbucket URL: http://localhost:54324 (email testing)
# - anon key: eyJ... (for client-side code)
# - service_role key: eyJ... (for server-side code)
```

### Stop Local Supabase

```bash
supabase stop          # Stop containers but preserve data
supabase stop --no-backup  # Stop and clear all data
```

## Environment Configuration

### Development .env.local

```env
# Supabase Local
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... # From supabase start output
SUPABASE_SERVICE_ROLE_KEY=eyJ... # From supabase start output

# Database (for Drizzle)
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

### Multiple Environments

```bash
# .env.local (git ignored)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321

# .env.development
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# .env.production
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
```

## Database Migrations

### Create Migration

```bash
# Create a new migration
supabase migration new create_issues_table

# This creates: supabase/migrations/[timestamp]_create_issues_table.sql
```

### Write Migration

```sql
-- supabase/migrations/[timestamp]_create_issues_table.sql
CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can view their organization's issues"
  ON issues
  FOR SELECT
  USING (organization_id = auth.jwt()->>'organizationId');
```

### Apply Migrations

```bash
# Apply to local database
supabase db reset  # Resets DB and applies all migrations

# Or just apply new migrations
supabase migration up
```

## Testing Authentication

### Email Testing with Inbucket

```bash
# Access Inbucket at http://localhost:54324
# All emails sent by Supabase go here
```

### Create Test Users

```typescript
// In your test setup or seed script
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "http://localhost:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role for admin actions
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

async function createTestUser(email: string, password: string) {
  // Create user
  const { data: user, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm for testing
    app_metadata: {
      organizationId: "test-org-id",
      permissions: ["issue:create", "issue:view"],
    },
  });

  return user;
}
```

## Storage Setup

### Configure Storage Buckets

```sql
-- supabase/migrations/[timestamp]_create_storage_buckets.sql
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('pinpoint-storage', 'pinpoint-storage', true);
```

### Local Storage Policies

```sql
-- Allow public read for avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'pinpoint-storage' AND name LIKE 'avatars/%');

-- Allow authenticated uploads
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'pinpoint-storage' AND auth.uid() IS NOT NULL);
```

## Seeding Data

### Create Seed File

```typescript
// supabase/seed.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "http://localhost:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function seed() {
  // Create organizations
  const { data: org } = await supabase
    .from("organizations")
    .insert({
      name: "Test Organization",
      slug: "test-org",
    })
    .select()
    .single();

  // Create users with proper metadata
  await supabase.auth.admin.createUser({
    email: "admin@test.com",
    password: "password123",
    email_confirm: true,
    app_metadata: {
      organizationId: org.id,
      permissions: ["admin"],
    },
  });

  console.log("Seed complete!");
}

seed().catch(console.error);
```

### Run Seed

```bash
# Add to package.json
"scripts": {
  "db:seed": "tsx supabase/seed.ts"
}

# Run seed
npm run db:seed
```

## Development Workflow

### 1. Database Changes

```bash
# Make schema changes in migrations
supabase migration new add_status_to_issues

# Test locally
supabase db reset

# Generate TypeScript types (if using Supabase client)
supabase gen types typescript --local > src/types/supabase.ts
```

### 2. Test RLS Policies

```typescript
// Test different user contexts
async function testRLS() {
  // Admin user context
  const adminClient = createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    },
  });

  // Should see all issues
  const { data: adminIssues } = await adminClient.from("issues").select();

  // Regular user context
  const userClient = createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    },
  });

  // Should only see their org's issues
  const { data: userIssues } = await userClient.from("issues").select();
}
```

## ⚠️ MIGRATION: Docker Compose to Supabase CLI

### Old Docker Compose Setup

```yaml
# OLD: docker-compose.yml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: postgres
    ports:
      - 5432:5432
```

### New Supabase CLI Setup

```bash
# NEW: Everything managed by Supabase CLI
supabase start  # Starts Postgres, Auth, Storage, Realtime, etc.

# Access services:
# - Postgres: localhost:54322 (not 5432!)
# - Auth API: localhost:54321/auth/v1
# - Storage API: localhost:54321/storage/v1
# - Studio: localhost:54323
```

### Environment Variable Changes

```env
# OLD
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pinpoint
NEXTAUTH_URL=http://localhost:3000

# NEW
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## Troubleshooting

### Port Conflicts

```bash
# Check if ports are in use
lsof -i :54321  # API
lsof -i :54322  # Database
lsof -i :54323  # Studio

# Use custom ports
supabase start --api-port 8000 --db-port 5433
```

### Reset Everything

```bash
# Nuclear option - removes all data and containers
supabase stop --no-backup
docker volume prune  # Remove orphaned volumes
supabase start
```

### Connection Issues

```typescript
// Ensure correct URL format
const supabase = createClient(
  "http://localhost:54321", // NOT https in local
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// For server-side admin operations
const supabaseAdmin = createClient(
  "http://localhost:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key
  {
    auth: {
      persistSession: false,
    },
  },
);
```

## VS Code Integration

### Extensions

- [Supabase VS Code](https://marketplace.visualstudio.com/items?itemName=supabase.supabase-vscode)
- [PostgreSQL](https://marketplace.visualstudio.com/items?itemName=ms-ossdata.vscode-postgresql)

### Database Connection

```json
// .vscode/settings.json
{
  "supabase.projects": {
    "pinpoint": {
      "api": "http://localhost:54321",
      "db": "postgresql://postgres:postgres@localhost:54322/postgres"
    }
  }
}
```

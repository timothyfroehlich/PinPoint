# Test Database Setup

## Overview

PinPoint uses Supabase local for testing, providing a complete PostgreSQL environment with RLS policies, stored procedures, and all production features. This ensures tests accurately reflect production behavior.

## Installation

### Prerequisites

- Docker Desktop or Docker Engine
- Supabase CLI
- Node.js 18+

### Setup Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# npm
npm install -g supabase

# Verify installation
supabase --version
```

## Project Configuration

### Initialize Supabase

```bash
# In project root
supabase init

# Start local services
supabase start
```

This starts:

- PostgreSQL (port 54322)
- Auth service (port 54321)
- Storage service
- Realtime service
- Studio UI (port 54323)

### Environment Setup

The `.env.test` file (committed to repo) provides test environment configuration:

```env
# Test environment configuration
# This file contains environment variables specific to running tests

# Test environment marker
NODE_ENV="test"

# Use local Supabase instance for integration tests
DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres"
DIRECT_URL="postgresql://postgres:postgres@localhost:54322/postgres"
POSTGRES_PRISMA_URL="postgresql://postgres:postgres@localhost:54322/postgres"
POSTGRES_URL_NON_POOLING="postgresql://postgres:postgres@localhost:54322/postgres"

# Supabase test configuration
NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
SUPABASE_URL="http://localhost:54321"
SUPABASE_API_URL="http://localhost:54321"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="your-supabase-anon-key-here"
SUPABASE_SECRET_KEY="your-supabase-service-role-key-here"
SUPABASE_JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"

# Authentication test configuration
AUTH_SECRET="test-auth-secret-with-at-least-32-characters-for-testing-purposes"
```

### Environment Loading

Environment variables are loaded by `src/lib/env-loaders/test.ts` with override behavior:

```typescript
// src/lib/env-loaders/test.ts
import { config } from "dotenv";

export function loadTestEnvironment(): void {
  // Load in order of precedence (later files override earlier ones)
  config({ path: resolve(projectRoot, ".env"), override: true });
  config({ path: resolve(projectRoot, ".env.development"), override: true });
  config({ path: resolve(projectRoot, ".env.test"), override: true }); // Highest precedence
  config({ path: resolve(projectRoot, ".env.local"), override: true });
}
```

### Database Schema

```bash
# Apply migrations to test database
supabase db push

# Or reset completely
supabase db reset
```

## Vitest Configuration

### Multi-Project Setup

PinPoint uses a 3-project Vitest configuration for different test types:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    projects: [
      {
        // Unit tests with database mocking
        test: {
          name: "node",
          environment: "node",
          setupFiles: ["src/test/vitest.setup.ts"], // With mocking
          include: [
            "src/lib/**/*.test.{ts,tsx}",
            "src/server/**/*.test.{ts,tsx}",
          ],
          exclude: ["src/integration-tests"],
        },
      },
      {
        // Integration tests with real database
        test: {
          name: "integration",
          environment: "node",
          setupFiles: ["src/test/vitest.integration.setup.ts"], // No mocking
          poolOptions: {
            threads: { singleThread: true }, // Prevent connection conflicts
          },
          include: ["src/integration-tests/**/*.test.{ts,tsx}"],
        },
      },
      {
        // React component tests
        test: {
          name: "jsdom",
          environment: "jsdom",
          setupFiles: ["vitest.setup.react.ts"],
          include: [
            "src/app/**/*.test.{ts,tsx}",
            "src/components/**/*.test.{ts,tsx}",
          ],
        },
      },
    ],
  },
});
```

### Integration Test Setup

```typescript
// src/test/vitest.integration.setup.ts
import { beforeAll, afterAll, afterEach } from "vitest";

// NO database mocking - uses real Supabase database

beforeAll(async () => {
  // Hard failure if database unavailable - NO SKIPPING
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required for integration tests. Ensure Supabase is running.",
    );
  }

  // Reject test/mock URLs - integration tests need real database
  if (
    process.env.DATABASE_URL.includes("test://") ||
    process.env.DATABASE_URL.includes("postgresql://test:test@")
  ) {
    throw new Error(
      "Integration tests require a real database URL, not a test/mock URL. Check .env.test configuration.",
    );
  }
});

afterEach(() => {
  // Cleanup handled by individual tests using transactions
});

afterAll(() => {
  // Global cleanup
});
```

### Unit Test Setup (With Mocking)

```typescript
// src/test/vitest.setup.ts
import { beforeAll, afterAll, afterEach, vi } from "vitest";

// Mock Prisma client for unit tests
vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(() => ({
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    user: { findUnique: vi.fn(), create: vi.fn() },
    // ... comprehensive mocking
  })),
}));

beforeAll(() => {
  // Environment variables loaded by src/lib/env-loaders/test.ts
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  // Cleanup mocks
});
```

## Database Migrations

### Creating Test Migrations

```bash
# Create migration
supabase migration new add_test_helpers

# Edit the migration file
```

Example test helper migration:

```sql
-- supabase/migrations/[timestamp]_add_test_helpers.sql

-- Function to set JWT claims for testing
CREATE OR REPLACE FUNCTION auth.set_test_claims(
  p_user_id UUID,
  p_organization_id UUID,
  p_permissions TEXT[]
) RETURNS VOID AS $$
BEGIN
  -- Set JWT claims for current session
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', p_user_id::TEXT,
    'organizationId', p_organization_id::TEXT,
    'permissions', p_permissions
  )::TEXT, true);
END;
$$ LANGUAGE plpgsql;

-- Function to clear test data
CREATE OR REPLACE FUNCTION test.clear_data() RETURNS VOID AS $$
BEGIN
  TRUNCATE TABLE
    notifications,
    activities,
    comments,
    attachments,
    issues,
    machines,
    memberships,
    users,
    organizations
  CASCADE;
END;
$$ LANGUAGE plpgsql;
```

## Seed Data

### Test Seeds

```typescript
// supabase/seed.test.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "http://localhost:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function seed() {
  // Create test organizations
  const orgs = [
    { id: "test-org-1", name: "Test Arcade 1", slug: "test-1" },
    { id: "test-org-2", name: "Test Arcade 2", slug: "test-2" },
  ];

  for (const org of orgs) {
    await supabase.from("organizations").insert(org);

    // Create default data
    await createDefaultStatuses(org.id);
    await createDefaultPriorities(org.id);
    await createDefaultRoles(org.id);
  }

  console.log("✅ Test seed complete");
}

seed().catch(console.error);
```

Run seeds:

```bash
# Run main seeding (recommended for most tests)
npm run db:seed:local:sb

# Test-specific seeding would require direct script execution if needed
# (Currently no dedicated test seeding command)
```

## RLS Testing Setup

### Enable RLS for Tests

```sql
-- Ensure RLS is enabled on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
-- ... etc

-- Force RLS even for table owner
ALTER TABLE issues FORCE ROW LEVEL SECURITY;
```

### Test User Creation

```typescript
// src/test/auth-helpers.ts
export async function createTestUser(config: {
  email?: string;
  organizationId: string;
  permissions: string[];
}) {
  const email = config.email ?? faker.internet.email();

  // Create user with proper metadata
  const { data: user, error } = await testSupabaseAdmin.auth.admin.createUser({
    email,
    password: "test-password",
    email_confirm: true,
    app_metadata: {
      organizationId: config.organizationId,
      permissions: config.permissions,
    },
  });

  if (error) throw error;

  // Get access token for testing
  const { data: session } = await testSupabaseAdmin.auth.signInWithPassword({
    email,
    password: "test-password",
  });

  return {
    user: user.user,
    session: session.session,
    client: createAuthenticatedClient(session.session.access_token),
  };
}
```

## Parallel Test Execution

### Configure Test Pools

```typescript
// vitest.workspace.ts
export default defineWorkspace([
  {
    test: {
      name: "unit",
      include: ["src/**/*.test.ts"],
      exclude: ["src/**/*.integration.test.ts"],
      pool: "threads", // Run in parallel
    },
  },
  {
    test: {
      name: "integration",
      include: ["src/**/*.integration.test.ts"],
      pool: "threads",
      poolOptions: {
        threads: {
          singleThread: true, // Run serially
        },
      },
    },
  },
]);
```

## Performance Optimization

### Connection Pooling

```typescript
// src/test/test-db.ts
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

// Single connection for serial tests
const sql = postgres(process.env.TEST_DATABASE_URL!, {
  max: 1, // Single connection for transactions
  idle_timeout: 20,
  connect_timeout: 10,
});

export const testDb = drizzle(sql);

// Connection pool for parallel tests (if needed)
const pooledSql = postgres(process.env.TEST_DATABASE_URL!, {
  max: 10, // Allow parallel connections
});

export const pooledTestDb = drizzle(pooledSql);
```

### Test Data Caching

```typescript
// Cache frequently used test data
const testDataCache = new Map<string, any>();

export async function getOrCreateTestOrg(name: string) {
  if (testDataCache.has(name)) {
    return testDataCache.get(name);
  }

  const org = await createTestOrganization({ name });
  testDataCache.set(name, org);
  return org;
}

// Clear cache between test runs
beforeEach(() => {
  testDataCache.clear();
});
```

## Debugging

### SQL Query Logging

```typescript
// Enable query logging for debugging
const debugSql = postgres(process.env.TEST_DATABASE_URL!, {
  debug: (connection, query, params) => {
    console.log("SQL:", query);
    console.log("Params:", params);
  },
});
```

### Database Inspector

```bash
# Open Supabase Studio
supabase studio

# Direct psql connection
psql postgresql://postgres:postgres@localhost:54322/postgres

# Check RLS policies
\d+ issues
```

### Common Issues

**Port Conflicts:**

```bash
# Check if ports in use
lsof -i :54321
lsof -i :54322

# Use custom ports
supabase start --api-port 8000 --db-port 5433
```

**Docker Issues:**

```bash
# Reset Supabase
supabase stop --no-backup
docker system prune
supabase start
```

**Migration Failures:**

```bash
# Check migration status
supabase migration list

# Repair migrations
supabase db reset --no-seed
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start Supabase
        run: |
          supabase start
          echo "TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres" >> $GITHUB_ENV

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: npm

      - name: Install Dependencies
        run: npm ci

      - name: Run Tests
        run: npm run test:integration

      - name: Stop Supabase
        if: always()
        run: supabase stop
```

## Best Practices

1. **Use correct test projects**: Unit tests in `src/server/`, integration tests in `src/integration-tests/`
2. **Never mock in integration tests**: Use real database connections and operations
3. **Hard failures for missing database**: Integration tests should fail immediately, never skip
4. **Always use transactions** for test isolation in integration tests
5. **Use service role key** for admin operations only in integration tests
6. **Test with RLS enabled** to catch security issues
7. **Clean up resources** with transactions (automatic rollback)
8. **Use realistic data** with factories
9. **Run integration tests with Supabase started**: `supabase start` before running tests

## Running Different Test Types

```bash
# Unit tests (mocked database)
npm run test -- --project=node

# Integration tests (real database - requires Supabase)
npm run test -- --project=integration

# React component tests
npm run test -- --project=jsdom

# All tests
npm run test
```

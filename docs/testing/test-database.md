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

Create `.env.test.local`:

```env
# Test Database
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
TEST_DIRECT_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Test Supabase
TEST_SUPABASE_URL=http://localhost:54321
TEST_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-key

# Get keys from supabase start output
```

### Database Schema

```bash
# Apply migrations to test database
supabase db push

# Or reset completely
supabase db reset
```

## Vitest Configuration

### vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig({
  test: {
    // Load test environment
    env: loadEnv("test", process.cwd(), ""),

    // Separate pools for different test types
    poolOptions: {
      threads: {
        singleThread: true, // Run DB tests serially
      },
    },

    // Global setup
    globalSetup: "./src/test/global-setup.ts",
    setupFiles: ["./src/test/setup.ts"],

    // Test isolation
    isolate: true,

    // Timeouts for DB operations
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
```

### Global Setup

```typescript
// src/test/global-setup.ts
import { execSync } from "child_process";

export async function setup() {
  console.log("🚀 Starting Supabase local...");

  try {
    // Check if already running
    execSync("supabase status", { stdio: "ignore" });
  } catch {
    // Start if not running
    execSync("supabase start", { stdio: "inherit" });
  }

  // Reset database to clean state
  console.log("🔄 Resetting test database...");
  execSync("supabase db reset", { stdio: "inherit" });

  console.log("✅ Test environment ready");
}

export async function teardown() {
  // Optional: Stop Supabase after tests
  // execSync("supabase stop", { stdio: "inherit" });
}
```

### Test Setup

```typescript
// src/test/setup.ts
import { beforeAll, afterAll, beforeEach } from "vitest";
import { testSql } from "./test-db";

beforeAll(async () => {
  // Verify database connection
  await testSql`SELECT 1`;
});

beforeEach(async () => {
  // Clear test data between tests (if not using transactions)
  if (process.env.CLEAR_DB_BETWEEN_TESTS === "true") {
    await clearTestData();
  }
});

afterAll(async () => {
  // Close connections
  await testSql.end();
});

async function clearTestData() {
  // Delete in correct order (respecting foreign keys)
  await testSql`TRUNCATE TABLE 
    notifications,
    activities,
    comments,
    attachments,
    issues,
    machines,
    memberships,
    users,
    organizations
  CASCADE`;
}
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
npm run seed

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

1. **Always use transactions** for test isolation
2. **Reset database** before test runs in CI
3. **Use service role key** for admin operations only
4. **Test with RLS enabled** to catch security issues
5. **Cache test data** for performance
6. **Clean up resources** in afterEach/afterAll
7. **Use realistic data** with factories

# Test Database Setup

## Overview

PinPoint uses two database testing approaches:

1. **PGlite Integration Testing** (Recommended) - Fast, in-memory PostgreSQL for router and database logic testing
2. **Supabase Local Testing** (E2E) - Complete PostgreSQL environment for full-stack integration and E2E testing

## 🚨 CRITICAL: Memory-Safe PGlite Integration Testing

### Memory Safety Overview

**PGlite** provides a complete PostgreSQL database running in-memory via WebAssembly. However, **improper usage causes 1-2GB+ memory consumption and system lockups**.

**🔥 CRITICAL MEMORY SAFETY RULES:**

- ❌ **NEVER**: Create `new PGlite()` instances per test (50-100MB each)
- ❌ **NEVER**: Use `createSeededTestDatabase()` in `beforeEach` (memory blowout)
- ✅ **ALWAYS**: Use worker-scoped instances with transaction isolation
- ✅ **ALWAYS**: Use `withIsolatedTest` pattern for automatic cleanup

### Memory-Safe Setup (MANDATORY)

```typescript
// test/helpers/worker-scoped-db.ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "~/server/db/schema";

// Single PGlite instance per worker (NOT per test)
let workerDb: ReturnType<typeof drizzle> | null = null;

export async function getWorkerDb() {
  if (!workerDb) {
    const client = new PGlite(); // ONE instance per worker
    workerDb = drizzle(client, { schema });

    // Run migrations once
    await migrate(workerDb, { migrationsFolder: "drizzle" });
  }
  return workerDb;
}

// Transaction isolation for test cleanup
export async function withIsolatedTest<T>(
  db: ReturnType<typeof drizzle>,
  testFn: (db: ReturnType<typeof drizzle>) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    try {
      return await testFn(tx);
    } finally {
      // Transaction rollback provides automatic cleanup
      throw new Error("Test transaction rollback");
    }
  }).catch((error) => {
    if (error.message === "Test transaction rollback") {
      return; // Expected rollback
    }
    throw error; // Re-throw actual errors
  });
}

// Vitest test helper with proper types
export const test = vitest.test.extend<{
  workerDb: ReturnType<typeof drizzle>;
}>({
  workerDb: async ({}, use) => {
    const db = await getWorkerDb();
    await use(db);
  },
});
```

### Memory-Safe Usage Example (REQUIRED PATTERN)

**Reference**: Integration Testing Archetype

```typescript
// ✅ CORRECT: Memory-safe integration testing
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { sql } from "drizzle-orm";

test("database constraints with RLS", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Set RLS context
    await db.execute(sql`SET app.current_organization_id = 'test-org'`);

    // Create test data - RLS handles organizational scoping
    const [machine] = await db
      .insert(schema.machines)
      .values({ name: "Test Machine" })
      .returning();

    // Test foreign key constraints with RLS
    const [issue] = await db
      .insert(schema.issues)
      .values({
        title: "Test Issue",
        machineId: machine.id,
        // No organizationId needed - RLS handles it
      })
      .returning();

    expect(issue.organizationId).toBe("test-org"); // RLS automatic
    // Automatic cleanup via transaction rollback
  });
});
```

### ❌ DANGEROUS Anti-Patterns (NEVER USE)

```typescript
// ❌ MEMORY BLOWOUT: Per-test database creation
describe("BAD: Memory unsafe", () => {
  let db: TestDatabase;

  beforeEach(async () => {
    // DANGEROUS: 50-100MB per test, causes system lockups
    const setup = await createSeededTestDatabase();
    db = setup.db;
  });

  // This pattern causes 1-2GB+ memory usage with 12+ tests
});

// ❌ MEMORY BLOWOUT: Multiple PGlite instances
test("BAD: Multiple instances", async () => {
  const db1 = new PGlite(); // 50-100MB
  const db2 = new PGlite(); // Another 50-100MB
  // Multiplies memory usage, causes lockups
});

// ❌ COORDINATION COMPLEXITY: Manual organizational management
test("BAD: Manual coordination", async () => {
  const org = await db.insert(organizations).values({...});
  const user = await db.insert(users).values({
    organizationId: org.id, // Manual coordination
  });
  // Complex, error-prone, misses RLS benefits
});
```

### Installation

```bash
# Install PGlite
npm install @electric-sql/pglite --save-dev

# PGlite is automatically included in tests
# No additional setup required - runs in memory
```

## Test Seed Data Architecture

### Overview: Minimal → Full Progression

PinPoint uses a **hardcoded ID approach** for test data to provide consistency and predictability across all test environments (CI, local, pgTAP).

**Key Benefits:**
- 🎯 **Consistent debugging**: "machine-mm-001 is failing" instead of random UUIDs
- 🔗 **Stable relationships**: Foreign keys never break due to ID changes  
- ⚡ **Fast tests**: No random generation overhead
- 🔄 **Cross-language compatibility**: Same IDs in TypeScript and SQL tests

### Two-Tier Seed Structure

```
Minimal Seed (Foundation)
├── 2 organizations (primary + competitor)
├── ~8 test users (admin, members, guests)  
├── ~10 machines across different games
├── ~20 sample issues
└── All infrastructure (roles, statuses, priorities)

Full Seed (Additive)
├── Minimal seed (always included) 
├── +50 additional machines
├── +180 additional issues
└── Rich sample data for demos
```

**Usage:**
- **Development/CI**: Uses minimal seed (fast, essential data)
- **Preview environments**: Uses full seed (rich demonstration data)
- **Tests**: Always use minimal as foundation, add specific data as needed

### Hardcoded ID Constants

**Primary source**: [`src/test/constants/seed-test-ids.ts`](../../../src/test/constants/seed-test-ids.ts)

```typescript
// Example usage in tests
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Unit tests - use mock patterns
const mockOrg = SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION;

// Integration tests - use real seeded data  
const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
expect(result.machineId).toBe(seededData.machine);
```

### Two Organizations for Security Testing

**Primary Organization**: `test-org-pinpoint` (Austin Pinball Collective)
- Used for standard testing scenarios
- Contains majority of seeded data
- Default organization for single-org tests

**Competitor Organization**: `test-org-competitor` (Competitor Arcade) 
- Used for RLS boundary testing
- Enables cross-org isolation validation
- Critical for multi-tenant security tests

```typescript
// Example: Testing organizational boundaries
test("cross-org isolation", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create data in primary org
    await setOrgContext(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
    const issue1 = await createIssue(db, { title: "Primary Org Issue" });
    
    // Switch to competitor org - should not see primary org data
    await setOrgContext(db, SEED_TEST_IDS.ORGANIZATIONS.competitor);
    const visibleIssues = await db.query.issues.findMany();
    
    expect(visibleIssues).not.toContainEqual(issue1);
  });
});
```

### SQL Generation for pgTAP

**Build-time script**: [`scripts/generate-sql-constants.ts`](../../../scripts/generate-sql-constants.ts)

```bash
# Generate SQL constants from TypeScript
npm run generate:sql-constants

# Generated file: supabase/tests/constants.sql (DO NOT EDIT MANUALLY)
```

**pgTAP usage example:**
```sql
-- Use generated functions instead of hardcoded strings
SELECT results_eq(
  'SELECT organization_id FROM issues WHERE id = test_issue_primary()',  
  'SELECT test_org_primary()',
  'Issue belongs to primary organization'
);
```

### Seed Data Commands

```bash
# Development - minimal dataset (fast)
npm run db:seed:local:sb

# Preview - full dataset (comprehensive)  
npm run db:seed:preview

# CI - PostgreSQL only (no auth)
npm run db:seed:local:pg
```

### Best Practices

**✅ DO:**
- Use `SEED_TEST_IDS` constants for predictable IDs
- Use `getSeededTestData()` for dynamic relationship IDs
- Add minimal additional data only when tests require it
- Use both organizations for security boundary testing

**❌ DON'T:**
- Create custom organizations unless testing multi-tenant scenarios
- Use `nanoid()` or random IDs in seed data
- Modify hardcoded IDs without updating all references
- Skip organizational context when testing RLS scenarios

## Supabase Local Testing (E2E)

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

### Initialize Supabase

```bash
# In project root
supabase init

# Start local services (required for E2E tests)
supabase start
```

**Services started:**

- PostgreSQL (port 54322) - Database with RLS policies
- Auth service (port 54321) - User authentication
- Storage service - File uploads
- Realtime service - Live updates
- Studio UI (port 54323) - Database admin interface

**When to use:**

- ✅ E2E tests requiring full Supabase stack
- ✅ Authentication flow testing
- ✅ RLS policy validation
- ✅ Realtime feature testing
- ❌ Router integration testing (use PGlite instead)

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

## Testing Approach Guidelines

### Use PGlite for:

- ✅ **Router integration tests** - Fast database constraint validation
- ✅ **Database logic testing** - Foreign keys, constraints, cascades
- ✅ **Multi-table operations** - Complex queries with real relationships
- ✅ **Business rule validation** - Database-enforced business logic
- ✅ **CI/CD pipelines** - No external dependencies required

### Use Supabase Local for:

- ✅ **E2E testing** - Complete user workflows with authentication
- ✅ **Authentication flows** - Login, logout, session management
- ✅ **RLS policy testing** - Row-level security validation
- ✅ **Realtime features** - WebSocket connections and live updates
- ✅ **Full-stack integration** - Frontend + backend + database

### Performance Comparison

| Aspect               | PGlite              | Supabase Local        |
| -------------------- | ------------------- | --------------------- |
| **Startup time**     | <100ms              | 10-30 seconds         |
| **Test execution**   | <2 seconds per file | 5-15 seconds per file |
| **CI friendliness**  | Excellent           | Good                  |
| **Feature coverage** | Database only       | Full Supabase stack   |
| **Use case**         | Integration tests   | E2E tests             |

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

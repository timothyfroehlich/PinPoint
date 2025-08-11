# Integration Test Utilities - Test Architect Notes

## New Shared Utilities Available (August 2025)

Two new utility files have been created to eliminate code duplication in integration tests:

### 1. `integration-test-schema.ts`

- **Purpose**: Single source of truth for PGlite test database schema
- **Function**: `createTestSchema(db)` - Creates complete database schema
- **Includes**: All tables (organizations, users, locations, machines, models, priorities, issueStatuses, issues)
- **Replaces**: Manual schema creation and migration-based approaches that fail

### 2. `integration-test-factories.ts`

- **Purpose**: Standardized test data creation with deterministic IDs
- **Functions**:
  - `createTestOrganization()`, `createTestUser()`, `createTestLocation()`, etc.
  - `createCompleteTestDataSet()` - Creates full working test environment
- **Benefits**: Consistent test data, deterministic IDs, proper relationships

## Usage Pattern for New Integration Tests

```typescript
import { createTestSchema } from "~/test/helpers/integration-test-schema";
import {
  createCompleteTestDataSet,
  TEST_IDS,
} from "~/test/helpers/integration-test-factories";

beforeEach(async () => {
  pgClient = new PGlite();
  db = drizzle(pgClient, { schema });

  // Use shared schema creation instead of migrations
  await createTestSchema(db);

  // Use shared test data factories
  const testData = await createCompleteTestDataSet(db);

  // Now you have consistent test environment
});
```

## Migration Note

- **OLD**: `migrate(db, { migrationsFolder: "./supabase/migrations" })` - FAILS
- **NEW**: `createTestSchema(db)` - WORKS

These utilities ensure consistency across all integration tests and eliminate the 100+ lines of duplicated schema creation code.

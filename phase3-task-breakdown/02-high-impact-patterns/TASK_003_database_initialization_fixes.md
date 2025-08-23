# TASK 003: Database Initialization and Schema Fixes

## ⚡ PRIORITY: HIGH - BLOCKS INTEGRATION TESTING

**Status**: CRITICAL INFRASTRUCTURE - Integration tests failing due to database setup issues  
**Impact**: ~150+ integration tests cannot run due to schema and seeding failures  
**Agent Type**: integration-test-architect  
**Estimated Effort**: 1-2 days  
**Dependencies**: None (foundational infrastructure issue)

## Objective

Fix the systematic database initialization failures that prevent PGlite integration tests from running. Tests are failing due to missing tables, column name mismatches, and seed data insertion errors - **not** RLS context issues as previously assumed.

## Scope

**Root Cause**: PGlite database setup and schema migration process is broken

### Primary Issues Identified:

1. **Missing Tables**: `relation "organizations" does not exist`
2. **Column Name Mismatches**: `column excluded.statusid does not exist` (should be `statusId`)  
3. **Seed Data Failures**: Batch INSERT operations failing with column reference errors
4. **Schema Migration Issues**: Tables not created before seeding attempts

### Affected Test Files:

- `src/integration-tests/` - **All integration tests affected by database setup failures**
- `src/server/api/routers/__tests__/` - **Router integration tests failing during seeding**
- Seeding process: `scripts/seed/shared/sample-data.ts`
- Database setup: `src/test/helpers/pglite-test-setup.ts`

## Error Patterns Analysis

### Pattern 1: Missing Tables (Database Creation Failure)

```
❌ ERROR: relation "organizations" does not exist
❌ ERROR: RLS disable skipped for organizations: relation "organizations" does not exist

Found in: Multiple integration test files
Translation: Database tables are not being created before operations attempt to use them
```

### Pattern 2: Column Name Case Sensitivity Issues

```
❌ ERROR: column excluded.statusid does not exist
❌ HINT: Perhaps you meant to reference the column "excluded.statusId"

Found in: Seed data batch upsert operations  
Translation: SQL is using lowercase column names but schema has camelCase
```

### Pattern 3: Seeding Operation Failures

```
❌ ERROR: Failed to batch upsert issues: DrizzleQueryError
❌ INSERT INTO "issues" operation failing with column mismatches

Found in: scripts/seed/shared/sample-data.ts
Translation: Seed data operations failing due to schema mismatches
```

### Pattern 4: Migration Ordering Issues

```
❌ ERROR: [SAMPLE] Sample data seeding failed: Failed to create sample issues
❌ RLS disable attempts on non-existent tables

Translation: Operations happening in wrong order - seeding before table creation
```

## Root Cause Analysis

### 1. **Broken Database Initialization**

The PGlite database setup process is not properly creating tables before attempting to seed or configure them.

```typescript
// CURRENT BROKEN PATTERN in pglite-test-setup.ts:
await configureForBusinessLogicTesting(db); // Tries to disable RLS on non-existent tables
await seedSampleDataWithDb(db, false); // Tries to seed into non-existent tables
```

### 2. **Schema Migration Not Applied**

Database migrations are either not running or not completing successfully in PGlite environment.

### 3. **Column Name Inconsistencies**

Drizzle schema uses camelCase (`statusId`) but generated SQL uses lowercase (`statusid`), causing column reference errors.

### 4. **Seed Data SQL Generation Issues**

Batch upsert operations are generating malformed SQL with incorrect column references in the `excluded.` clauses.

## Technical Specifications

### Fix 1: Database Initialization Order

**File**: `src/test/helpers/pglite-test-setup.ts`

```typescript
export async function createSeededTestDatabase(): Promise<TestDatabaseResult> {
  console.log("[DB_INIT] Creating PGlite instance...");
  const client = new PGlite();
  const db = drizzle(client, { schema: fullSchema });

  try {
    // STEP 1: Apply migrations FIRST (create tables)
    console.log("[DB_INIT] Applying database migrations...");
    await migrate(db, { migrationsFolder: "drizzle" });
    
    // STEP 2: Verify tables exist before proceeding
    const tableCheck = await db.execute(sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log(`[DB_INIT] Created tables: ${tableCheck.rows.map(r => r.table_name).join(', ')}`);
    
    if (tableCheck.rows.length === 0) {
      throw new Error("Migration failed: No tables created");
    }

    // STEP 3: Configure for business logic testing (disable RLS on existing tables)
    console.log("[DB_INIT] Configuring for business logic testing...");
    await configureForBusinessLogicTesting(db);

    // STEP 4: Seed data into verified tables
    console.log("[DB_INIT] Seeding test data...");
    await seedSampleDataWithDb(db, false);
    
    console.log("[DB_INIT] ✅ Database setup complete");
    return { db, cleanup: async () => await client.close() };
    
  } catch (error) {
    console.error("[DB_INIT] ❌ Database setup failed:", error);
    await client.close();
    throw error;
  }
}
```

### Fix 2: Enhanced Migration Verification

**File**: `src/test/helpers/pglite-test-setup.ts`

```typescript
async function verifyMigrationComplete(db: TestDatabase): Promise<void> {
  const requiredTables = [
    'organizations', 'users', 'memberships', 'roles', 'permissions',
    'locations', 'machines', 'models', 'issues', 'priorities', 'issue_statuses',
    'comments', 'attachments', 'upvotes', 'collections', 'notifications'
  ];

  for (const tableName of requiredTables) {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_name = ${tableName} AND table_schema = 'public'
      `);
      
      if (Number(result.rows[0]?.count) === 0) {
        throw new Error(`Required table missing: ${tableName}`);
      }
      
      console.log(`[VERIFY] ✅ Table exists: ${tableName}`);
    } catch (error) {
      console.error(`[VERIFY] ❌ Table verification failed: ${tableName}`, error);
      throw new Error(`Database setup incomplete: ${tableName} table missing`);
    }
  }
}
```

### Fix 3: Column Name Consistency Fix

**File**: `scripts/seed/shared/sample-data.ts`

```typescript
// CURRENT BROKEN PATTERN:
const result = await db.insert(issues).values(issuesData)
  .onConflictDoUpdate({
    target: issues.id,
    set: {
      title: sql`excluded.title`,           // ✅ Works
      description: sql`excluded.description`, // ✅ Works  
      updatedAt: new Date(),
      statusId: sql`excluded.statusid`,     // ❌ BROKEN - wrong case
      priorityId: sql`excluded.priorityid`, // ❌ BROKEN - wrong case
    },
  });

// FIXED PATTERN:
const result = await db.insert(issues).values(issuesData)
  .onConflictDoUpdate({
    target: issues.id,
    set: {
      title: sql`excluded.title`,
      description: sql`excluded.description`,
      updatedAt: new Date(),
      statusId: sql`excluded."statusId"`,     // ✅ FIXED - quoted camelCase
      priorityId: sql`excluded."priorityId"`, // ✅ FIXED - quoted camelCase
    },
  });
```

### Fix 4: Safe RLS Configuration

**File**: `src/test/helpers/pglite-test-setup.ts`

```typescript
async function configureForBusinessLogicTesting(db: TestDatabase): Promise<void> {
  console.log("[RLS_CONFIG] Configuring PGlite for business logic testing...");
  
  // Get list of existing tables with RLS enabled
  const tablesWithRLS = await db.execute(sql`
    SELECT schemaname, tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' AND rowsecurity = true
    ORDER BY tablename
  `);

  console.log(`[RLS_CONFIG] Tables with RLS: ${tablesWithRLS.rows.length}`);

  // Safely disable RLS on existing tables only
  for (const row of tablesWithRLS.rows) {
    try {
      await db.execute(sql.raw(`ALTER TABLE ${row.tablename} DISABLE ROW LEVEL SECURITY`));
      console.log(`[RLS_CONFIG] ✅ Disabled RLS on ${row.tablename}`);
    } catch (error) {
      console.warn(`[RLS_CONFIG] ⚠️ RLS disable skipped for ${row.tablename}:`, error.message);
      // Continue with other tables - this is not fatal for business logic testing
    }
  }
}
```

### Fix 5: Robust Error Handling and Logging

**Pattern**: Apply comprehensive error handling to identify root causes

```typescript
export async function createSeededTestDatabase(): Promise<TestDatabaseResult> {
  const startTime = Date.now();
  console.log("[DB_SETUP] Starting database setup...");
  
  let client: PGlite | null = null;
  
  try {
    // Step-by-step setup with detailed logging
    client = new PGlite();
    console.log(`[DB_SETUP] PGlite instance created (${Date.now() - startTime}ms)`);
    
    const db = drizzle(client, { schema: fullSchema });
    console.log(`[DB_SETUP] Drizzle initialized (${Date.now() - startTime}ms)`);
    
    // Apply migrations with verification
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log(`[DB_SETUP] Migrations applied (${Date.now() - startTime}ms)`);
    
    await verifyMigrationComplete(db);
    console.log(`[DB_SETUP] Migration verification passed (${Date.now() - startTime}ms)`);
    
    // Configure and seed
    await configureForBusinessLogicTesting(db);
    console.log(`[DB_SETUP] RLS configuration complete (${Date.now() - startTime}ms)`);
    
    await seedSampleDataWithDb(db, false);
    console.log(`[DB_SETUP] ✅ Setup complete (${Date.now() - startTime}ms)`);
    
    return { 
      db, 
      cleanup: async () => {
        console.log("[DB_CLEANUP] Closing PGlite instance");
        await client?.close();
      }
    };
    
  } catch (error) {
    console.error(`[DB_SETUP] ❌ Fatal error at ${Date.now() - startTime}ms:`, error);
    if (client) {
      await client.close();
    }
    throw new Error(`Database setup failed: ${error.message}`);
  }
}
```

## Success Criteria

### Quantitative Success:

- [ ] **Database tables created**: All required tables exist before seeding
- [ ] **Migration verification**: `verifyMigrationComplete()` passes without errors  
- [ ] **Seed data insertion**: No column reference errors in batch operations
- [ ] **Integration tests start**: Tests can access database without setup failures
- [ ] **Clean error messages**: Clear logging when setup fails

### Qualitative Success:

- [ ] **Reliable setup process**: Database initialization works consistently
- [ ] **Clear failure diagnosis**: When setup fails, error messages identify the step
- [ ] **Fast feedback**: Setup completes in <5 seconds per test worker
- [ ] **Memory efficiency**: No memory leaks from failed database instances

### Test File Success Metrics:

- [ ] Integration tests can **start running** (not necessarily pass, but get past setup)
- [ ] No more `relation "organizations" does not exist` errors
- [ ] No more `column excluded.statusid does not exist` errors  
- [ ] Seed data operations complete successfully

## Implementation Strategy

### Day 1: Core Infrastructure

1. **Fix migration application** - ensure tables are created before any operations
2. **Add table verification** - confirm required tables exist after migration
3. **Test the pattern** on 2-3 integration test files to verify it works

### Day 2: Data Operations

1. **Fix column name consistency** - resolve `statusId` vs `statusid` issues  
2. **Fix seed data batch operations** - correct excluded column references
3. **Add robust error handling** - clear logging and error messages
4. **Validate all integration tests** can start (may still fail on business logic, but database setup works)

## Validation Commands

```bash
# Test database setup in isolation
npm run test src/test/helpers/pglite-test-setup.test.ts

# Test specific integration files (should get past setup phase)
npm run test src/integration-tests/comment.integration.test.ts  
npm run test src/server/api/routers/__tests__/collection.test.ts

# Check seed data operations work
npm run test -- --grep "seeding"

# Validate setup logging works
npm run test:verbose src/integration-tests/ | grep "\[DB_"
```

## Dependencies

**Depends on**: None (this is foundational infrastructure)

**Blocks**: All integration testing tasks - this must be fixed first

## Related Issues

- **Migration system**: May need investigation if migrations aren't applying correctly
- **Drizzle schema**: Column name casing consistency  
- **Seeding process**: Batch operation SQL generation
- **PGlite compatibility**: Ensuring feature compatibility with PostgreSQL

## Notes for Agent

This is a **foundational infrastructure fix**. Until database initialization works reliably, no integration tests can run successfully.

**Key principles**:

1. **Create tables BEFORE any operations** - migrations must complete first
2. **Verify setup at each step** - clear logging and verification  
3. **Handle errors gracefully** - setup failures should be easy to diagnose
4. **Column name consistency** - ensure Drizzle schema and SQL match

**Testing strategy**: Fix database setup first, then verify integration tests can start running (they may still fail on business logic, but setup should work).

**Success metric**: When this task is complete, integration tests should get past the database setup phase and into actual test logic execution.

## CRITICAL: This Replaces Previous TASK_003

**Previous TASK_003** was based on false assumptions about PGlite RLS capabilities and "RLS context establishment" issues. 

**This task addresses the actual problems**: Database setup failures, schema issues, and seeding problems that prevent tests from running at all.

The **real** integration test failures are infrastructure-related, not security context-related.
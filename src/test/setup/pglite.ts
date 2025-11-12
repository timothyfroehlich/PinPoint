/**
 * Worker-Scoped PGlite Setup
 *
 * CRITICAL: Per CORE-TEST-001, we use ONE worker-scoped PGlite instance
 * for all tests in a worker. Per-test instances cause system lockups.
 *
 * Tests clean up after themselves using beforeEach/afterEach, not by
 * creating new database instances.
 */

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, afterEach } from "vitest";
import * as schema from "~/server/db/schema";

// Worker-scoped instance - created once per worker
let pgliteInstance: PGlite | undefined;
let testDb: ReturnType<typeof drizzle> | undefined;

/**
 * Get the worker-scoped test database instance.
 * Creates and initializes on first call, returns cached instance thereafter.
 */
export async function getTestDb() {
  if (testDb) {
    return testDb;
  }

  // Create PGlite instance
  pgliteInstance = new PGlite();

  // Create Drizzle instance
  testDb = drizzle(pgliteInstance, { schema });

  // Apply schema (create tables)
  await pgliteInstance.exec(`
    -- User Profiles Table
    CREATE TABLE IF NOT EXISTS user_profiles (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('guest', 'member', 'admin')),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    -- Machines Table
    CREATE TABLE IF NOT EXISTS machines (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    -- Issues Table
    CREATE TABLE IF NOT EXISTS issues (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved')),
      severity TEXT NOT NULL DEFAULT 'playable' CHECK (severity IN ('minor', 'playable', 'unplayable')),
      reported_by UUID REFERENCES user_profiles(id),
      assigned_to UUID REFERENCES user_profiles(id),
      resolved_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    -- Issue Comments Table
    CREATE TABLE IF NOT EXISTS issue_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      author_id UUID REFERENCES user_profiles(id),
      content TEXT NOT NULL,
      is_system BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  return testDb;
}

/**
 * Clean up helper - deletes all rows from all tables.
 * Use in afterEach to ensure test isolation.
 */
export async function cleanupTestDb() {
  if (!testDb) return;

  // Delete in order to respect foreign key constraints
  await testDb.delete(schema.issueComments);
  await testDb.delete(schema.issues);
  await testDb.delete(schema.machines);
  await testDb.delete(schema.userProfiles);
}

/**
 * Setup function for integration tests.
 * Call this in describe blocks that need database access.
 */
export function setupTestDb() {
  beforeAll(async () => {
    await getTestDb();
  });

  afterEach(async () => {
    await cleanupTestDb();
  });
}

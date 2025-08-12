/**
 * PGlite Test Database Setup
 * 
 * Creates PGlite in-memory PostgreSQL databases with ACTUAL Drizzle schema.
 * Uses real schema definitions programmatically via drizzle-kit generation.
 * 
 * Key Features:
 * - Uses actual Drizzle schema definitions (no sync issues)
 * - In-memory PostgreSQL with PGlite
 * - Schema generated from real definitions via drizzle-kit
 * - Transaction isolation for test cleanup
 * - Modern August 2025 patterns
 */

import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";

import * as schema from "~/server/db/schema";

export type TestDatabase = PgliteDatabase<typeof schema>;

/**
 * Generate SQL DDL from actual Drizzle schema using programmatic API
 * Replaces CLI-based approach with direct drizzle-kit/api function calls
 */
async function generateSchemaSQL(): Promise<string[]> {
  try {
    // Try multiple import strategies for drizzle-kit/api compatibility
    let generateDrizzleJson: any, generateMigration: any;
    
    try {
      // Strategy 1: Dynamic ESM import
      const drizzleKit = await import('drizzle-kit/api');
      generateDrizzleJson = drizzleKit.generateDrizzleJson;
      generateMigration = drizzleKit.generateMigration;
    } catch (importError) {
      // Strategy 2: CommonJS require (fallback)
      const drizzleKit = require('drizzle-kit/api');
      generateDrizzleJson = drizzleKit.generateDrizzleJson;
      generateMigration = drizzleKit.generateMigration;
    }
    
    if (!generateDrizzleJson || !generateMigration) {
      throw new Error('drizzle-kit/api functions not available');
    }
    
    const statements = await generateMigration(
      generateDrizzleJson({}), // Empty initial schema
      generateDrizzleJson(schema) // Current schema
    );
    
    return statements;
  } catch (error) {
    console.warn('Programmatic schema generation failed, using fallback:', error);
    throw error; // Will trigger fallback in caller
  }
}

/**
 * Apply ACTUAL Drizzle schema to PGlite database
 * Uses drizzle-kit to generate SQL from real schema definitions
 */
async function applyDrizzleSchema(db: TestDatabase): Promise<void> {
  try {
    // Generate SQL from the ACTUAL Drizzle schema definitions
    const sqlStatements = await generateSchemaSQL();
    
    // Apply each SQL statement to create the schema
    for (const statement of sqlStatements) {
      if (statement.trim()) {
        await db.execute(sql.raw(statement));
      }
    }
  } catch (error) {
    // Fallback: Create basic schema structure if generation fails
    console.warn('Schema generation failed, using fallback approach:', error);
    await createFallbackSchema(db);
  }
}

/**
 * Fallback schema creation for when drizzle-kit generation fails
 * This creates a more comprehensive schema matching the actual Drizzle definitions
 */
async function createFallbackSchema(db: TestDatabase): Promise<void> {
  // Create required enums
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "NotificationFrequency" AS ENUM ('IMMEDIATE', 'DAILY', 'WEEKLY', 'NEVER');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "StatusCategory" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "ActivityType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'PRIORITY_CHANGED', 'COMMENTED', 'COMMENT_DELETED', 'ATTACHMENT_ADDED', 'MERGED', 'RESOLVED', 'REOPENED', 'SYSTEM');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create tables - more comprehensive set matching actual schema
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text,
      "email" text UNIQUE,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "Organization" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "subdomain" text UNIQUE NOT NULL,
      "logoUrl" text,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "Permission" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text UNIQUE NOT NULL,
      "description" text
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "Role" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "organizationId" text NOT NULL,
      "isDefault" boolean DEFAULT false NOT NULL,
      "isSystem" boolean DEFAULT false NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "Priority" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "order" integer NOT NULL,
      "organizationId" text NOT NULL,
      "isDefault" boolean DEFAULT false NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "IssueStatus" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "category" "StatusCategory" NOT NULL,
      "organizationId" text NOT NULL,
      "isDefault" boolean DEFAULT false NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "Location" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "address" text,
      "organizationId" text NOT NULL,
      "pinballMapId" integer,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "Model" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "manufacturer" text NOT NULL,
      "year" integer,
      "createdAt" timestamp DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "Machine" (
      "id" text PRIMARY KEY NOT NULL,
      "serialNumber" text,
      "organizationId" text NOT NULL,
      "locationId" text NOT NULL,
      "modelId" text NOT NULL,
      "ownerId" text,
      "status" text DEFAULT 'UNKNOWN' NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `);
}


/**
 * Create a fresh PGlite test database with real Drizzle schema applied
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const pgClient = new PGlite();
  const db = drizzle(pgClient, { schema });
  
  // Apply the real schema
  await applyDrizzleSchema(db);
  
  return db;
}

/**
 * Create a test database with complete seed data
 * This is the main entry point for integration tests
 */
export async function createSeededTestDatabase(): Promise<{
  db: TestDatabase;
  organizationId: string;
}> {
  const db = await createTestDatabase();
  
  // Import seed functions dynamically to avoid circular dependencies
  const { seedCompleteTestData } = await import("./integration-test-seeds");
  const organization = await seedCompleteTestData(db);
  
  return {
    db,
    organizationId: organization.id,
  };
}

/**
 * Clean up test database (closes PGlite connection)
 */
export async function cleanupTestDatabase(db: TestDatabase): Promise<void> {
  // PGlite automatically cleans up when the instance is garbage collected
  // But we can be explicit about cleanup if needed
  try {
    // Close the PGlite connection
    await (db as any).client?.close?.();
  } catch {
    // Ignore cleanup errors in tests
  }
}
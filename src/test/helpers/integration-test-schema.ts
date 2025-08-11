/**
 * Shared Integration Test Schema Creator
 *
 * Provides a unified schema creation function for PGlite integration tests.
 * This ensures consistency across all integration tests and eliminates code duplication.
 *
 * Based on the working patterns from drizzle-crud-validation.integration.test.ts
 */

import { sql } from "drizzle-orm";

import type { drizzle } from "drizzle-orm/pglite";

/**
 * Create comprehensive test schema directly in PGlite
 * This approach is more reliable than migrations for integration tests
 */
export async function createTestSchema(
  db: ReturnType<typeof drizzle>,
): Promise<void> {
  // Create enums
  await db.execute(sql`
    CREATE TYPE "NotificationFrequency" AS ENUM ('IMMEDIATE', 'DAILY', 'WEEKLY', 'NEVER')
  `);

  await db.execute(sql`
    CREATE TYPE "StatusCategory" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED')
  `);

  // Organizations table (matches Organization schema)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "Organization" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subdomain TEXT UNIQUE NOT NULL,
      "logoUrl" TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);

  // Users table (matches User schema)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "User" (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      name TEXT,
      "emailVerified" TIMESTAMPTZ,
      image TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      bio TEXT,
      "profilePicture" TEXT,
      "emailNotificationsEnabled" BOOLEAN DEFAULT TRUE NOT NULL,
      "pushNotificationsEnabled" BOOLEAN DEFAULT FALSE NOT NULL,
      "notificationFrequency" "NotificationFrequency" DEFAULT 'IMMEDIATE' NOT NULL
    )
  `);

  // Locations table (matches Location schema with all columns)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "Location" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      "organizationId" TEXT NOT NULL REFERENCES "Organization"(id),
      "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      street TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      phone TEXT,
      website TEXT,
      latitude REAL,
      longitude REAL,
      description TEXT,
      "pinballMapId" INTEGER,
      "regionId" TEXT,
      "lastSyncAt" TIMESTAMPTZ,
      "syncEnabled" BOOLEAN DEFAULT FALSE NOT NULL
    )
  `);

  // Models table (matches Model schema with all columns)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "Model" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      manufacturer TEXT,
      year INTEGER,
      "ipdbId" TEXT UNIQUE,
      "opdbId" TEXT UNIQUE,
      "machineType" TEXT,
      "machineDisplay" TEXT,
      "isActive" BOOLEAN DEFAULT TRUE NOT NULL,
      "ipdbLink" TEXT,
      "opdbImgUrl" TEXT,
      "kineticistUrl" TEXT,
      "isCustom" BOOLEAN DEFAULT FALSE NOT NULL,
      "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);

  // Priorities table (for issue management) - matches actual schema
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "Priority" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      "organizationId" TEXT NOT NULL REFERENCES "Organization"(id),
      "isDefault" BOOLEAN DEFAULT FALSE NOT NULL
    )
  `);

  // Issue Statuses table (for issue management) - matches actual schema
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "IssueStatus" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category "StatusCategory" NOT NULL,
      "organizationId" TEXT NOT NULL REFERENCES "Organization"(id),
      "isDefault" BOOLEAN DEFAULT FALSE NOT NULL
    )
  `);

  // Machines table (matches Machine schema with essential columns)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "Machine" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      "organizationId" TEXT NOT NULL REFERENCES "Organization"(id),
      "locationId" TEXT NOT NULL REFERENCES "Location"(id),
      "modelId" TEXT NOT NULL REFERENCES "Model"(id),
      "ownerId" TEXT REFERENCES "User"(id),
      "ownerNotificationsEnabled" BOOLEAN DEFAULT TRUE NOT NULL,
      "notifyOnNewIssues" BOOLEAN DEFAULT TRUE NOT NULL,
      "notifyOnStatusChanges" BOOLEAN DEFAULT TRUE NOT NULL,
      "notifyOnComments" BOOLEAN DEFAULT FALSE NOT NULL,
      "qrCodeId" TEXT UNIQUE NOT NULL,
      "qrCodeUrl" TEXT,
      "qrCodeGeneratedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);

  // Issues table (for issue tracking) - matches complete schema
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "Issue" (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      consistency TEXT,
      checklist JSON,
      "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      "resolvedAt" TIMESTAMPTZ,
      "reporterEmail" TEXT,
      "submitterName" TEXT,
      "organizationId" TEXT NOT NULL REFERENCES "Organization"(id),
      "machineId" TEXT NOT NULL REFERENCES "Machine"(id),
      "statusId" TEXT NOT NULL REFERENCES "IssueStatus"(id),
      "priorityId" TEXT NOT NULL REFERENCES "Priority"(id),
      "createdById" TEXT REFERENCES "User"(id),
      "assignedToId" TEXT REFERENCES "User"(id)
    )
  `);

  // Create indexes for organizational scoping and performance
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "Location_organizationId_idx" ON "Location"("organizationId")
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "Machine_organizationId_idx" ON "Machine"("organizationId")
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "Machine_locationId_idx" ON "Machine"("locationId")
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "Issue_organizationId_idx" ON "Issue"("organizationId")
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "Issue_machineId_idx" ON "Issue"("machineId")
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "Priority_organizationId_idx" ON "Priority"("organizationId")
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "IssueStatus_organizationId_idx" ON "IssueStatus"("organizationId")
  `);
}

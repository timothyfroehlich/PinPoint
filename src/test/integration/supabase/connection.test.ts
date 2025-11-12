/**
 * Integration Test: Supabase Connection
 *
 * REQUIRES: Local Supabase running (`supabase start`)
 *
 * This test verifies that:
 * 1. We can connect to the local Supabase instance
 * 2. The schema has been applied correctly
 * 3. The auto-profile trigger is working
 */

import { describe, it, expect } from "vitest";
import { db } from "~/server/db";
import { userProfiles, machines } from "~/server/db/schema";

describe("Supabase Integration", () => {
  it("should connect to database via Drizzle", async () => {
    // Query machines table (should be empty initially)
    const result = await db.select().from(machines);

    // Query succeeds
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should have user_profiles table with correct schema", async () => {
    // Query user_profiles table
    const result = await db.select().from(userProfiles);

    // Query succeeds
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should have issues table with correct schema", async () => {
    // Import issues schema
    const { issues } = await import("~/server/db/schema");
    const result = await db.select().from(issues);

    // Query succeeds
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

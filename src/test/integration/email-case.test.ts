import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { invitedUsers, issues, machines } from "~/server/db/schema";
import { createTestMachine } from "~/test/helpers/factories";

// Mock the database to use the PGlite instance
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return {
    db: await getTestDb(),
  };
});

describe("Case-insensitive email handling (CITEXT)", () => {
  setupTestDb();

  it("should match invited user emails case-insensitively", async () => {
    const db = await getTestDb();

    // Insert with mixed case
    const [invited] = await db
      .insert(invitedUsers)
      .values({
        firstName: "Test",
        lastName: "User",
        email: "Test@Example.COM",
        role: "member",
      })
      .returning();

    expect(invited).toBeDefined();

    // Query with lowercase — CITEXT should match
    const result = await db.query.invitedUsers.findFirst({
      where: eq(invitedUsers.email, "test@example.com"),
    });

    expect(result).toBeDefined();
    expect(result?.id).toBe(invited.id);
  });

  it("should match reporter_email case-insensitively for issue transfer", async () => {
    const db = await getTestDb();

    // Create a machine for the issue
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "CIT" }))
      .returning();

    // Insert issue with mixed-case reporter email
    const [issue] = await db
      .insert(issues)
      .values({
        machineInitials: machine.initials,
        issueNumber: 1,
        title: "CITEXT test issue",
        reporterEmail: "Guest@EXAMPLE.com",
      })
      .returning();

    expect(issue).toBeDefined();

    // Query with lowercase — CITEXT should match
    const result = await db.query.issues.findFirst({
      where: eq(issues.reporterEmail, "guest@example.com"),
    });

    expect(result).toBeDefined();
    expect(result?.id).toBe(issue.id);
  });

  it("should reject duplicate emails with different casing via unique constraint", async () => {
    const db = await getTestDb();

    // Insert first user
    await db.insert(invitedUsers).values({
      firstName: "First",
      lastName: "User",
      email: "unique@example.com",
      role: "member",
    });

    // Attempt to insert second user with same email, different case
    await expect(
      db.insert(invitedUsers).values({
        firstName: "Second",
        lastName: "User",
        email: "UNIQUE@Example.COM",
        role: "guest",
      })
    ).rejects.toThrow();
  });
});

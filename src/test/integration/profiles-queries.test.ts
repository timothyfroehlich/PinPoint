/**
 * Integration Tests: profile query module
 *
 * Tests getProfileById, getProfileActivityCounts, getCappedOwnedMachines,
 * and PROFILE_MACHINE_CAP using real PGlite (no docker required).
 *
 * CORE-SEC-007: getProfileById must not expose email.
 * CORE-TEST-001: worker-scoped PGlite, no per-test DB instances.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  userProfiles,
  machines,
  issues,
  issueComments,
} from "~/server/db/schema";
import {
  createTestUser,
  createTestMachine,
  createTestIssue,
  createTestComment,
} from "~/test/helpers/factories";

// ---------------------------------------------------------------------------
// External-boundary mocks
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

// Real PGlite — redirect ~/server/db to the shared worker-scoped instance
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

// Import AFTER the db mock so the module picks up PGlite
const {
  getProfileById,
  getProfileActivityCounts,
  getCappedOwnedMachines,
  PROFILE_MACHINE_CAP,
} = await import("~/lib/profiles/queries");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const USER = "00000000-0000-0000-0000-0000000000a1";

describe("profile queries", () => {
  setupTestDb();

  beforeEach(async () => {
    const db = await getTestDb();

    // Seed the test user
    await db.insert(userProfiles).values(
      createTestUser({
        id: USER,
        email: "p1@example.com",
        firstName: "Pat",
        lastName: "Quinn",
        role: "technician",
        bio: "EM games",
        pronouns: "they/them",
      })
    );

    // Seed 8 owned machines to exercise the cap (cap=6, fetch 7, hasMore=true, total=8)
    for (let i = 0; i < 8; i++) {
      await db.insert(machines).values(
        createTestMachine({
          initials: `OWN${i}`,
          name: `Machine ${i}`,
          ownerId: USER,
        })
      );
    }

    // Seed 2 reported issues on OWN0
    await db.insert(issues).values(
      createTestIssue("OWN0", {
        issueNumber: 1,
        title: "Issue 0",
        reportedBy: USER,
      })
    );
    await db.insert(issues).values(
      createTestIssue("OWN0", {
        issueNumber: 2,
        title: "Issue 1",
        reportedBy: USER,
      })
    );

    // Seed 1 more issue on OWN1 with a comment authored by USER
    const [iss] = await db
      .insert(issues)
      .values(
        createTestIssue("OWN1", {
          issueNumber: 1,
          title: "C",
          reportedBy: USER,
        })
      )
      .returning({ id: issues.id });

    if (!iss) throw new Error("Failed to insert issue for comment seeding");

    await db
      .insert(issueComments)
      .values(createTestComment(iss.id, { authorId: USER }));
  });

  it("getProfileById returns the public-safe row", async () => {
    const row = await getProfileById(USER);
    expect(row?.name).toBe("Pat Quinn");
    expect(row?.pronouns).toBe("they/them");
    expect(row?.role).toBe("technician");
    // CORE-SEC-007: email must not be present
    expect(row).not.toHaveProperty("email");
  });

  it("getProfileById returns null for unknown id", async () => {
    expect(
      await getProfileById("00000000-0000-0000-0000-0000000000ff")
    ).toBeNull();
  });

  it("getProfileActivityCounts counts reported issues and comments", async () => {
    const counts = await getProfileActivityCounts(USER);
    expect(counts.reported).toBe(3);
    expect(counts.comments).toBe(1);
  });

  it("getCappedOwnedMachines caps at 6 and flags overflow", async () => {
    const res = await getCappedOwnedMachines(USER);
    expect(res.machines).toHaveLength(PROFILE_MACHINE_CAP);
    expect(res.hasMore).toBe(true);
    expect(res.total).toBe(8);
  });
});

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
  getOpenIssueCountsByInitials,
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

    // Seed 9 owned machines to exercise the cap (cap=8, fetch 9, hasMore=true,
    // total=9). createdAt is staggered so the "most recently added" ordering is
    // deterministic: OWN8 is newest, OWN0 oldest.
    for (let i = 0; i < 9; i++) {
      await db.insert(machines).values(
        createTestMachine({
          initials: `OWN${i}`,
          name: `Machine ${i}`,
          ownerId: USER,
          createdAt: new Date(Date.UTC(2026, 0, 1 + i)),
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

  it("getCappedOwnedMachines caps at PROFILE_MACHINE_CAP and flags overflow", async () => {
    const res = await getCappedOwnedMachines(USER);
    expect(res.machines).toHaveLength(PROFILE_MACHINE_CAP);
    expect(res.hasMore).toBe(true);
    expect(res.total).toBe(9);
  });

  it("getCappedOwnedMachines orders by most recently added", async () => {
    const res = await getCappedOwnedMachines(USER);
    // OWN8 is newest (Jan 9), OWN1 the oldest still within the cap of 8.
    expect(res.machines.map((m) => m.initials)).toEqual([
      "OWN8",
      "OWN7",
      "OWN6",
      "OWN5",
      "OWN4",
      "OWN3",
      "OWN2",
      "OWN1",
    ]);
  });

  it("getProfileActivityCounts counts issues fixed by the user", async () => {
    const db = await getTestDb();
    // A system status_changed -> fixed comment authored by USER on the OWN1 issue.
    const [iss] = await db
      .insert(issues)
      .values(
        createTestIssue("OWN1", { issueNumber: 2, title: "F", status: "fixed" })
      )
      .returning({ id: issues.id });
    await db.insert(issueComments).values(
      createTestComment(iss.id, {
        authorId: USER,
        isSystem: true,
        content: null,
        eventData: { type: "status_changed", from: "new", to: "fixed" },
      })
    );
    const counts = await getProfileActivityCounts(USER);
    expect(counts.fixed).toBe(1);
  });

  it("getProfileActivityCounts excludes non-resolved transitions and other users from fixed", async () => {
    const db = await getTestDb();
    // (1) A non-resolved transition (new -> in_progress) by USER must NOT count:
    // exercises the ANY(CLOSED_STATUSES) status filter negatively.
    const [nonResolved] = await db
      .insert(issues)
      .values(
        createTestIssue("OWN2", { issueNumber: 1, title: "NR", status: "new" })
      )
      .returning({ id: issues.id });
    await db.insert(issueComments).values(
      createTestComment(nonResolved.id, {
        authorId: USER,
        isSystem: true,
        content: null,
        eventData: { type: "status_changed", from: "new", to: "in_progress" },
      })
    );

    // (2) A status_changed -> fixed transition authored by a DIFFERENT user must
    // NOT count toward USER's fixed total.
    const OTHER = "00000000-0000-0000-0000-0000000000b2";
    await db.insert(userProfiles).values(
      createTestUser({
        id: OTHER,
        email: "other@example.com",
        firstName: "Other",
        lastName: "Person",
      })
    );
    const [otherIssue] = await db
      .insert(issues)
      .values(
        createTestIssue("OWN3", { issueNumber: 1, title: "O", status: "fixed" })
      )
      .returning({ id: issues.id });
    await db.insert(issueComments).values(
      createTestComment(otherIssue.id, {
        authorId: OTHER,
        isSystem: true,
        content: null,
        eventData: { type: "status_changed", from: "new", to: "fixed" },
      })
    );

    // USER has no genuine fixed transition in this test's seed → 0.
    const counts = await getProfileActivityCounts(USER);
    expect(counts.fixed).toBe(0);
  });

  it("getOpenIssueCountsByInitials counts only open-status issues", async () => {
    const db = await getTestDb();
    // OWN0 already has 2 reported issues (status 'new' = open from the base seed).
    const map = await getOpenIssueCountsByInitials(["OWN0", "OWN1"]);
    expect(map.get("OWN0")).toBe(2);
  });
});

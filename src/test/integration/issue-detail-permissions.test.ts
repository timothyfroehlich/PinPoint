import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import { issues, machines, userProfiles } from "~/server/db/schema";
import { getPermissionState } from "~/lib/permissions/helpers";
import { type OwnershipContext } from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";

// ---------------------------------------------------------------------------
// Module mocks for action-level integration tests (Wave 3 RECLASS, PP-x4li.1.3)
//
// These mocks route the production `db` through the PGlite worker instance
// so real DB state drives the permission checks. Supabase auth, next/cache,
// notifications, and logger are boundary mocks — they must not reach the
// network in tests.
//
// The existing permission-state tests (below) call getTestDb() directly and
// do NOT import from ~/server/db, so adding these mocks does not affect them.
// ---------------------------------------------------------------------------
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// after() needs a request scope at runtime; in tests run the callback inline. (PP-2053.3)
vi.mock("next/server", () => ({
  after: (cb: () => unknown) => {
    void cb();
  },
}));

vi.mock("~/lib/notifications", () => ({
  planNotification: vi.fn().mockResolvedValue({ deliveries: [] }),
  dispatchNotification: vi.fn().mockResolvedValue(undefined),
  getChannels: vi.fn().mockResolvedValue([]),
}));

vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("Issue detail permission states (integration)", () => {
  setupTestDb();

  let ownerId: string;
  let reporterId: string;
  let outsiderGuestId: string;
  let guestReporterId: string;
  let issueId: string;
  let guestOwnedIssueId: string;

  beforeEach(async () => {
    const db = await getTestDb();

    const [owner] = await db
      .insert(userProfiles)
      .values(
        createTestUser({
          id: "00000000-0000-0000-0000-000000000101",
          role: "member",
          email: "owner-perm@test.com",
        })
      )
      .returning();
    ownerId = owner.id;

    const [reporter] = await db
      .insert(userProfiles)
      .values(
        createTestUser({
          id: "00000000-0000-0000-0000-000000000102",
          role: "member",
          email: "reporter-perm@test.com",
        })
      )
      .returning();
    reporterId = reporter.id;

    const [guest] = await db
      .insert(userProfiles)
      .values(
        createTestUser({
          id: "00000000-0000-0000-0000-000000000103",
          role: "guest",
          email: "guest-perm@test.com",
        })
      )
      .returning();
    outsiderGuestId = guest.id;

    // Distinct guest user who is the reporter of a separate issue — exercises
    // the "guest on own issue" path with a fixture role that actually matches
    // the AccessLevel under test.
    const [guestReporter] = await db
      .insert(userProfiles)
      .values(
        createTestUser({
          id: "00000000-0000-0000-0000-000000000104",
          role: "guest",
          email: "guest-reporter-perm@test.com",
        })
      )
      .returning();
    guestReporterId = guestReporter.id;

    const [machine] = await db
      .insert(machines)
      .values(
        createTestMachine({
          id: "10000000-0000-0000-0000-000000000101",
          initials: "PMT",
          name: "Permission Matrix Test",
          ownerId,
        })
      )
      .returning();

    const [issue] = await db
      .insert(issues)
      .values({
        machineInitials: machine.initials,
        issueNumber: 1,
        title: "Permission matrix issue",
        severity: "major",
        priority: "high",
        frequency: "frequent",
        status: "new",
        reportedBy: reporterId,
      })
      .returning();
    issueId = issue.id;

    const [guestIssue] = await db
      .insert(issues)
      .values({
        machineInitials: machine.initials,
        issueNumber: 2,
        title: "Guest-reported issue",
        severity: "minor",
        priority: "low",
        frequency: "occasional",
        status: "new",
        reportedBy: guestReporterId,
      })
      .returning();
    guestOwnedIssueId = guestIssue.id;
  });

  const buildContext = async (
    accessLevel: AccessLevel,
    userId?: string,
    targetIssueId: string = issueId
  ): Promise<OwnershipContext> => {
    const db = await getTestDb();
    const issue = await db.query.issues.findFirst({
      where: eq(issues.id, targetIssueId),
      with: {
        machine: {
          columns: { ownerId: true, invitedOwnerId: true },
        },
      },
      columns: { reportedBy: true },
    });

    if (!issue) {
      throw new Error("Expected test issue to exist");
    }

    return {
      userId: accessLevel === "unauthenticated" ? undefined : userId,
      reporterId: issue.reportedBy,
      machineOwnerId: issue.machine.ownerId ?? issue.machine.invitedOwnerId,
    };
  };

  it("returns unauthenticated reason for reporting updates when not logged in", async () => {
    const state = getPermissionState(
      "issues.update.reporting",
      "unauthenticated",
      await buildContext("unauthenticated")
    );
    expect(state).toEqual({ allowed: false, reason: "unauthenticated" });
  });

  it("returns ownership reason for guest on another user's issue reporting fields", async () => {
    const state = getPermissionState(
      "issues.update.reporting",
      "guest",
      await buildContext("guest", outsiderGuestId)
    );
    expect(state).toEqual({ allowed: false, reason: "ownership" });
  });

  it("returns role reason for guest triage updates", async () => {
    const state = getPermissionState(
      "issues.update.triage",
      "guest",
      await buildContext("guest", outsiderGuestId)
    );
    expect(state).toEqual({ allowed: false, reason: "role" });
  });

  it("allows member triage updates", async () => {
    const state = getPermissionState(
      "issues.update.triage",
      "member",
      await buildContext("member", ownerId)
    );
    expect(state).toEqual({ allowed: true });
  });

  // E-class: the "own" conditional — guest as reporter of the issue can update
  // reporting fields (status, severity, frequency) but not triage fields
  // (priority, assignee). This is the permission-enforcement boundary that the
  // smoke spec "Guest on own issue" test was exercising via browser.
  // Uses the dedicated guest-reporter fixture + guest-owned issue so the
  // accessLevel under test matches the seeded user role.

  it("allows guest to update reporting fields on their own issue", async () => {
    const state = getPermissionState(
      "issues.update.reporting",
      "guest",
      await buildContext("guest", guestReporterId, guestOwnedIssueId)
    );
    expect(state).toEqual({ allowed: true });
  });

  it("denies guest triage updates even on their own issue", async () => {
    const state = getPermissionState(
      "issues.update.triage",
      "guest",
      await buildContext("guest", guestReporterId, guestOwnedIssueId)
    );
    expect(state).toEqual({ allowed: false, reason: "role" });
  });

  it("allows member reporting updates on any issue", async () => {
    const state = getPermissionState(
      "issues.update.reporting",
      "member",
      await buildContext("member", ownerId)
    );
    expect(state).toEqual({ allowed: true });
  });
});

// =============================================================================
// Wave 3 RECLASS: issue-actions permission wiring (PP-x4li.1.3)
//
// Migrated from src/test/unit/issue-actions.test.ts:
//   - "should allow update if authorized" (updateIssueStatusAction describe)
//   - "should deny update if unauthorized" (updateIssueStatusAction describe)
//   - "should successfully update frequency" (updateIssueFrequencyAction describe)
//
// These three blocks were using a mocked checkPermission, which only verified
// the mock was called — they did NOT exercise real permission logic. Here we
// drive the real actions against PGlite and the real checkPermission so that
// DB-derived ownership context (reportedBy, machine.ownerId) genuinely controls
// the allow/deny outcome.
//
// External boundary mocks (Supabase auth, next/cache, notifications, logger)
// are declared at the top of this file and shared across both describe blocks.
// =============================================================================
describe("issue action permission wiring — action-level integration (PP-x4li.1.3)", () => {
  setupTestDb();

  // Stable UUIDs for this describe block — distinct from the sibling describe
  // above to avoid PGlite uniqueness conflicts when tests run in the same worker.
  const MEMBER_USER_ID = "a0000000-0000-0000-0000-000000000001";
  const GUEST_REPORTER_ID = "a0000000-0000-0000-0000-000000000002";
  const GUEST_OTHER_ID = "a0000000-0000-0000-0000-000000000003";
  const MACHINE_OWNER_ID = "a0000000-0000-0000-0000-000000000004";

  let memberIssueId: string;
  let guestOwnedIssueId: string;

  beforeEach(async () => {
    const db = await getTestDb();

    // Seed users — tables are cleaned by setupTestDb()'s afterEach, so no
    // conflict handling is needed.
    await db.insert(userProfiles).values([
      createTestUser({
        id: MACHINE_OWNER_ID,
        role: "member",
        email: "owner-action@test.com",
      }),
      createTestUser({
        id: MEMBER_USER_ID,
        role: "member",
        email: "member-action@test.com",
      }),
      createTestUser({
        id: GUEST_REPORTER_ID,
        role: "guest",
        email: "guest-reporter-action@test.com",
      }),
      createTestUser({
        id: GUEST_OTHER_ID,
        role: "guest",
        email: "guest-other-action@test.com",
      }),
    ]);

    // Seed machine
    await db.insert(machines).values(
      createTestMachine({
        id: "b0000000-0000-0000-0000-000000000001",
        initials: "PAT",
        name: "Permission Action Test",
        ownerId: MACHINE_OWNER_ID,
      })
    );

    // Issue reported by a member (any member can update its reporting fields)
    const [memberIssue] = await db
      .insert(issues)
      .values({
        machineInitials: "PAT",
        issueNumber: 10,
        title: "Member-reported action test issue",
        severity: "minor",
        priority: "low",
        frequency: "intermittent",
        status: "new",
        reportedBy: MEMBER_USER_ID,
      })
      .returning();
    memberIssueId = memberIssue.id;

    // Issue reported by a guest (only that guest can update its reporting fields)
    const [guestIssue] = await db
      .insert(issues)
      .values({
        machineInitials: "PAT",
        issueNumber: 11,
        title: "Guest-reported action test issue",
        severity: "minor",
        priority: "low",
        frequency: "intermittent",
        status: "new",
        reportedBy: GUEST_REPORTER_ID,
      })
      .returning();
    guestOwnedIssueId = guestIssue.id;
  });

  async function mockAuth(userId: string) {
    const { createClient } = await import("~/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  }

  // -------------------------------------------------------------------------
  // updateIssueStatusAction — permission wiring
  //
  // Migrated from the "should allow update if authorized" and
  // "should deny update if unauthorized" blocks. The old unit tests mocked
  // checkPermission; these drive the real permission matrix via PGlite state.
  // -------------------------------------------------------------------------
  it("allows updateIssueStatusAction for a member (issues.update.reporting = true for member)", async () => {
    await mockAuth(MEMBER_USER_ID);
    const { updateIssueStatusAction } =
      await import("~/app/(app)/issues/actions");

    const formData = new FormData();
    formData.append("issueId", memberIssueId);
    formData.append("status", "in_progress");

    const result = await updateIssueStatusAction(undefined, formData);

    expect(result.ok).toBe(true);
  });

  it("denies updateIssueStatusAction for a guest acting on another user's issue (issues.update.reporting = 'own')", async () => {
    // GUEST_OTHER_ID is a guest who did NOT report guestOwnedIssueId
    // (guestOwnedIssueId.reportedBy === GUEST_REPORTER_ID)
    await mockAuth(GUEST_OTHER_ID);
    const { updateIssueStatusAction } =
      await import("~/app/(app)/issues/actions");

    const formData = new FormData();
    formData.append("issueId", guestOwnedIssueId);
    formData.append("status", "in_progress");

    const result = await updateIssueStatusAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
  });

  // -------------------------------------------------------------------------
  // updateIssueFrequencyAction — permission wiring
  //
  // Migrated from "should successfully update frequency". The original block
  // mocked checkPermission to return true; here we verify the real permission
  // path allows a member (issues.update.reporting = true) and the action
  // returns ok.
  // -------------------------------------------------------------------------
  it("allows updateIssueFrequencyAction for a member (issues.update.reporting = true for member)", async () => {
    await mockAuth(MEMBER_USER_ID);
    const { updateIssueFrequencyAction } =
      await import("~/app/(app)/issues/actions");

    const formData = new FormData();
    formData.append("issueId", memberIssueId);
    formData.append("frequency", "constant");

    const result = await updateIssueFrequencyAction(undefined, formData);

    expect(result.ok).toBe(true);
  });
});

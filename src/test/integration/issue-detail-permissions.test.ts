import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import { issues, machines, userProfiles } from "~/server/db/schema";
import { getPermissionState } from "~/lib/permissions/helpers";
import { type OwnershipContext } from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";

describe("Issue detail permission states (integration)", () => {
  setupTestDb();

  let ownerId: string;
  let reporterId: string;
  let outsiderGuestId: string;
  let issueId: string;

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
  });

  const buildContext = async (
    accessLevel: AccessLevel,
    userId?: string
  ): Promise<OwnershipContext> => {
    const db = await getTestDb();
    const issue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
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

  it("returns unauthenticated reason for status updates when not logged in", async () => {
    const state = getPermissionState(
      "issues.update.status",
      "unauthenticated",
      await buildContext("unauthenticated")
    );
    expect(state).toEqual({ allowed: false, reason: "unauthenticated" });
  });

  it("returns ownership reason for guest on another user's issue status", async () => {
    const state = getPermissionState(
      "issues.update.status",
      "guest",
      await buildContext("guest", outsiderGuestId)
    );
    expect(state).toEqual({ allowed: false, reason: "ownership" });
  });

  it("returns role reason for guest assignee updates", async () => {
    const state = getPermissionState(
      "issues.update.assignee",
      "guest",
      await buildContext("guest", outsiderGuestId)
    );
    expect(state).toEqual({ allowed: false, reason: "role" });
  });

  it("allows member assignee updates", async () => {
    const state = getPermissionState(
      "issues.update.assignee",
      "member",
      await buildContext("member", ownerId)
    );
    expect(state).toEqual({ allowed: true });
  });
});

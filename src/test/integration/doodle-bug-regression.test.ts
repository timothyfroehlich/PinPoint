/**
 * Regression test for the "Doodle Bug" (PP-2053.4).
 *
 * Incident: a user reported an issue, received a confirmation email with a
 * working link, but the issue was never persisted and no Sentry alert fired.
 * Root cause: the confirmation email was sent from a Resend HTTP call executed
 * INSIDE the issue-creation transaction, before COMMIT. When the function was
 * SIGKILLed / rolled back mid-flight, the email had already gone out while the
 * issue row never committed — a silent write-loss.
 *
 * The fix (PP-2053.2 + PP-2053.3) splits the work: `planNotification` runs
 * inside the transaction and only does transactional writes (in-app rows),
 * returning the external email/Discord sends UNRUN; `dispatchNotification`
 * runs them post-commit. These tests lock that in:
 *
 *   - clean commit  => issue/timeline/in-app rows persist, and the email fires
 *                      exactly once, only AFTER an explicit post-commit dispatch
 *                      (the `expect(sendEmail).not.toHaveBeenCalled()` right
 *                      after createIssue is the guard that FAILS against the
 *                      pre-refactor inline-dispatch arrangement).
 *   - forced rollback => zero issue/timeline/in-app rows AND zero pre-commit
 *                      email sends — the incident can no longer occur.
 *
 * Worker-scoped PGlite (CORE-TEST-001). Resend is mocked at its client boundary
 * (CORE-TEST-006) — we never hit api.resend.com.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  userProfiles,
  machines,
  notificationPreferences,
  issues,
  notifications,
  timelineEvents,
} from "~/server/db/schema";
import {
  createTestUser,
  createTestMachine,
  createTestIssue,
} from "~/test/helpers/factories";
import { createIssue } from "~/services/issues";
import {
  planNotification,
  dispatchNotification,
  getChannels,
} from "~/lib/notifications";
import { emitIssueOpened } from "~/lib/timeline/issue-timeline-helpers";
import { sendEmail } from "~/lib/email/client";

// Route the production `db` import (used by the service + planNotification) to
// the PGlite worker instance.
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

// Mock Resend at its boundary — assert dispatch without real HTTP.
vi.mock("~/lib/email/client", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/lib/logger", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("~/lib/observability/report-error", () => ({
  reportError: vi.fn(),
  serverActionError: vi.fn(),
}));

describe("Doodle Bug regression — notifications deliver strictly post-commit (PP-2053.4)", () => {
  setupTestDb();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function seedOwnerAndMachine() {
    const db = await getTestDb();
    const [owner] = await db
      .insert(userProfiles)
      .values(createTestUser({ email: "owner@dbg.test" }))
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(
        createTestMachine({
          initials: "DBG",
          name: "Doodle Bug",
          ownerId: owner.id,
          nextIssueNumber: 1,
        })
      )
      .returning();
    // Owner is eligible for the new_issue email + in-app notification.
    await db.insert(notificationPreferences).values({
      userId: owner.id,
      emailEnabled: true,
      inAppEnabled: true,
      emailNotifyOnNewIssue: true,
      inAppNotifyOnNewIssue: true,
    });
    return { owner, machine };
  }

  it("clean commit: issue/timeline/in-app rows persist and the email fires exactly once, only after dispatch", async () => {
    const db = await getTestDb();
    const { owner, machine } = await seedOwnerAndMachine();

    const { issue, deliveryPlan } = await createIssue({
      title: "Saucer always awards 5000 points",
      machineInitials: machine.initials,
      severity: "minor",
      priority: "low",
      frequency: "intermittent",
      status: "new",
      reportedBy: null,
      autoWatchReporter: false,
    });

    // The transactional writes committed.
    const issueRow = await db.query.issues.findFirst({
      where: eq(issues.id, issue.id),
    });
    expect(issueRow).toBeDefined();
    const timelineRows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(timelineRows).toHaveLength(1);
    const inAppRows = await db.query.notifications.findMany({
      where: eq(notifications.userId, owner.id),
    });
    expect(inAppRows).toHaveLength(1);

    // ...but createIssue did NOT send the email — delivery is deferred. This is
    // the regression guard: pre-refactor the email fired inside the transaction
    // here, so this assertion fails against the old inline-dispatch code.
    expect(sendEmail).not.toHaveBeenCalled();

    // It fires exactly once, only when the caller dispatches post-commit.
    await dispatchNotification(deliveryPlan);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@dbg.test" })
    );
  });

  it("forced mid-flight rollback: zero issue/timeline/in-app rows persist and zero email escapes before commit", async () => {
    const db = await getTestDb();
    const { machine } = await seedOwnerAndMachine();
    const channels = await getChannels();

    // Reproduce the incident's critical section: do the same transactional
    // writes createIssue does — issue row, issue_opened timeline row, and
    // planNotification (which writes the in-app row and captures the email send
    // UNRUN) — then abort before COMMIT, as a SIGKILL/rollback would.
    await expect(
      db.transaction(async (tx) => {
        const [issue] = await tx
          .insert(issues)
          .values(
            createTestIssue(machine.initials, {
              issueNumber: 1,
              title: "Saucer always awards 5000 points",
            })
          )
          .returning();
        if (!issue) throw new Error("seed failed");

        await emitIssueOpened(asDbOrTx(tx), {
          machineId: machine.id,
          issueId: issue.id,
          issueNumber: issue.issueNumber,
          title: issue.title,
          severity: issue.severity,
          frequency: issue.frequency,
        });

        await planNotification(
          {
            type: "new_issue",
            resourceId: issue.id,
            resourceType: "issue",
            issueTitle: issue.title,
            machineName: machine.name,
            formattedIssueId: "DBG-01",
          },
          asDbOrTx(tx),
          channels
        );

        throw new Error("simulated mid-flight abort before COMMIT");
      })
    ).rejects.toThrow("mid-flight abort");

    // Everything the transaction wrote rolled back...
    expect(await db.query.issues.findMany()).toHaveLength(0);
    expect(
      await db
        .select()
        .from(timelineEvents)
        .where(eq(timelineEvents.machineId, machine.id))
    ).toHaveLength(0);
    expect(await db.query.notifications.findMany()).toHaveLength(0);

    // ...and crucially, no email escaped before commit. Pre-refactor the email
    // had already been sent by the time the rollback happened — the Doodle Bug.
    // The two-phase split makes a pre-commit send impossible.
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

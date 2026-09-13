import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  issueWatchers,
  issues,
  machines,
  machineWatchers,
  notifications,
  userProfiles,
} from "~/server/db/schema";
import {
  createTestIssue,
  createTestMachine,
  createTestUser,
} from "~/test/helpers/factories";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mocks.getUser },
    })
  ),
}));

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { toggleWatcherAction } from "~/app/(app)/issues/watcher-actions";
import {
  toggleMachineWatcherAction,
  updateMachineWatchModeAction,
} from "~/app/(app)/m/watcher-actions";
import {
  markAllAsReadAction,
  markAsReadAction,
} from "~/app/(app)/notifications/actions";

async function seedUser(): Promise<string> {
  const db = await getTestDb();
  const [user] = await db
    .insert(userProfiles)
    .values(createTestUser())
    .returning();
  if (!user) throw new Error("Expected test user insert to return a row");
  return user.id;
}

async function seedMachine(initials: string): Promise<string> {
  const db = await getTestDb();
  const [machine] = await db
    .insert(machines)
    .values(createTestMachine({ initials }))
    .returning();
  if (!machine) throw new Error("Expected test machine insert to return a row");
  return machine.id;
}

function authenticate(userId: string): void {
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId } } });
}

describe("createProtectedAction pilot actions", () => {
  setupTestDb();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enforces the issue-watch permission before mutating", async () => {
    const userId = randomUUID();
    authenticate(userId);

    const result = await toggleWatcherAction(randomUUID());

    expect(result).toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "Forbidden: Insufficient permissions.",
    });
    expect(await (await getTestDb()).select().from(issueWatchers)).toHaveLength(
      0
    );
  });

  it("authenticates and toggles an issue watcher through the pipeline", async () => {
    const db = await getTestDb();
    const userId = await seedUser();
    const machineId = await seedMachine("PAI");
    const machine = await db.query.machines.findFirst({
      where: eq(machines.id, machineId),
      columns: { initials: true },
    });
    if (!machine) throw new Error("Expected seeded machine");
    const [issue] = await db
      .insert(issues)
      .values(createTestIssue(machine.initials))
      .returning();
    if (!issue) throw new Error("Expected test issue insert to return a row");
    authenticate(userId);

    const result = await toggleWatcherAction(issue.id);

    expect(result).toEqual({ ok: true, value: { isWatching: true } });
    expect(
      await db.query.issueWatchers.findFirst({
        where: and(
          eq(issueWatchers.issueId, issue.id),
          eq(issueWatchers.userId, userId)
        ),
      })
    ).toBeDefined();
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/m/${machine.initials}/i/${issue.issueNumber}`
    );
  });

  it("preserves the two-argument machine watch-mode action interface", async () => {
    const db = await getTestDb();
    const userId = await seedUser();
    const machineId = await seedMachine("PAM");
    authenticate(userId);

    const toggleResult = await toggleMachineWatcherAction(machineId);
    const modeResult = await updateMachineWatchModeAction(
      machineId,
      "subscribe"
    );

    expect(toggleResult.ok).toBe(true);
    expect(modeResult).toEqual({
      ok: true,
      value: { watchMode: "subscribe" },
    });
    expect(
      await db.query.machineWatchers.findFirst({
        where: and(
          eq(machineWatchers.machineId, machineId),
          eq(machineWatchers.userId, userId)
        ),
      })
    ).toMatchObject({ watchMode: "subscribe" });
  });

  it("deletes only the authenticated user's notifications", async () => {
    const db = await getTestDb();
    const userId = await seedUser();
    const otherUserId = await seedUser();
    authenticate(userId);

    const [target, remaining, other] = await db
      .insert(notifications)
      .values([
        {
          userId,
          type: "new_issue",
          resourceId: randomUUID(),
          resourceType: "issue",
        },
        {
          userId,
          type: "new_comment",
          resourceId: randomUUID(),
          resourceType: "issue",
        },
        {
          userId: otherUserId,
          type: "issue_assigned",
          resourceId: randomUUID(),
          resourceType: "issue",
        },
      ])
      .returning();
    if (!target || !remaining || !other) {
      throw new Error("Expected notification inserts to return rows");
    }

    expect(await markAsReadAction(target.id)).toEqual({
      ok: true,
      value: { success: true },
    });
    expect(
      await db.query.notifications.findFirst({
        where: eq(notifications.id, target.id),
      })
    ).toBeUndefined();
    expect(
      await db.query.notifications.findFirst({
        where: eq(notifications.id, remaining.id),
      })
    ).toBeDefined();

    expect(await markAllAsReadAction()).toEqual({
      ok: true,
      value: { success: true },
    });
    expect(
      await db.query.notifications.findFirst({
        where: eq(notifications.id, remaining.id),
      })
    ).toBeUndefined();
    expect(
      await db.query.notifications.findFirst({
        where: eq(notifications.id, other.id),
      })
    ).toBeDefined();
  });
});

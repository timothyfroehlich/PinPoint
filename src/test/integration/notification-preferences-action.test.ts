import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { notificationPreferences, userProfiles } from "~/server/db/schema";
import { createTestUser } from "~/test/helpers/factories";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockGetUser = vi.fn();
vi.mock("~/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    }),
}));

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  const db = await getTestDb();
  return { db };
});

// Import after the db mock so the action picks up the PGlite instance.
const { updateNotificationPreferencesAction } =
  await import("~/app/(app)/settings/notifications/actions");

function buildFormData(entries: Record<string, "on" | "off">): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

async function seedUser(): Promise<string> {
  const id = randomUUID();
  const email = `prefs-${id}@test.com`;
  const db = await getTestDb();
  await db.execute(
    `INSERT INTO auth.users (id, email) VALUES ('${id}', '${email}')`
  );
  await db.insert(userProfiles).values(
    createTestUser({
      id,
      email,
      firstName: "Prefs",
      lastName: "Tester",
    })
  );
  return id;
}

describe("updateNotificationPreferencesAction (Integration)", () => {
  setupTestDb();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves unsubmitted fields — biomonk regression case", async () => {
    const userId = await seedUser();
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } } });

    const db = await getTestDb();
    await db.insert(notificationPreferences).values({
      userId,
      emailEnabled: true,
      inAppEnabled: true,
      discordEnabled: true,
      suppressOwnActions: false,
      discordNotifyOnNewIssue: true,
      emailNotifyOnNewIssue: true,
      inAppNotifyOnAssigned: true,
      discordNotifyOnAssigned: true,
    });

    const result = await updateNotificationPreferencesAction(
      undefined,
      buildFormData({ emailEnabled: "off", suppressOwnActions: "on" })
    );

    expect(result.ok).toBe(true);

    const [row] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));

    expect(row.emailEnabled).toBe(false);
    expect(row.suppressOwnActions).toBe(true);

    // Untouched fields — pre-fix, all of these silently flipped to false.
    expect(row.inAppEnabled).toBe(true);
    expect(row.discordEnabled).toBe(true);
    expect(row.discordNotifyOnNewIssue).toBe(true);
    expect(row.emailNotifyOnNewIssue).toBe(true);
    expect(row.inAppNotifyOnAssigned).toBe(true);
    expect(row.discordNotifyOnAssigned).toBe(true);
  });

  it("empty FormData is a no-op against an existing row", async () => {
    const userId = await seedUser();
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } } });

    const db = await getTestDb();
    await db.insert(notificationPreferences).values({
      userId,
      emailEnabled: false,
      discordNotifyOnNewIssue: true,
    });

    const result = await updateNotificationPreferencesAction(
      undefined,
      new FormData()
    );

    expect(result.ok).toBe(true);

    const [row] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));

    expect(row.emailEnabled).toBe(false);
    expect(row.discordNotifyOnNewIssue).toBe(true);
  });

  it("creates a row with schema defaults when none exists", async () => {
    const userId = await seedUser();
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } } });

    const db = await getTestDb();

    const result = await updateNotificationPreferencesAction(
      undefined,
      buildFormData({ emailEnabled: "off" })
    );

    expect(result.ok).toBe(true);

    const [row] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));

    expect(row.emailEnabled).toBe(false);
    // Schema defaults for absent fields.
    expect(row.inAppEnabled).toBe(true);
    expect(row.discordEnabled).toBe(true);
    expect(row.discordNotifyOnNewIssue).toBe(true);
    expect(row.emailNotifyOnNewIssue).toBe(true);
    expect(row.suppressOwnActions).toBe(false);
  });

  it("rejects unauthenticated calls", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await updateNotificationPreferencesAction(
      undefined,
      buildFormData({ emailEnabled: "off" })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("UNAUTHORIZED");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestUser } from "~/test/helpers/factories";
import { authUsers, userProfiles } from "~/server/db/schema";
import { updateDefaultReportModeAction } from "~/app/(app)/settings/reporting/actions";

// External boundary mocks
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Forward ~/server/db to worker-scoped PGlite
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

async function mockAuth(userId: string | null) {
  const { createClient } = await import("~/lib/supabase/server");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
      }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

function reportModes(mobile: string, desktop: string): FormData {
  const formData = new FormData();
  formData.set("mobileReportMode", mobile);
  formData.set("desktopReportMode", desktop);
  return formData;
}

describe("updateDefaultReportModeAction — PGlite integration (CORE-TEST-004)", () => {
  setupTestDb();

  const MEMBER_ID = "b0000000-0000-0000-0000-000000000001";
  const GUEST_ID = "b0000000-0000-0000-0000-000000000002";

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = await getTestDb();

    await db.insert(authUsers).values([
      { id: MEMBER_ID, email: "member-report-mode@test.com" },
      { id: GUEST_ID, email: "guest-report-mode@test.com" },
    ]);

    await db.insert(userProfiles).values([
      createTestUser({
        id: MEMBER_ID,
        role: "member",
        email: "member-report-mode@test.com",
        mobileReportMode: "quick",
        desktopReportMode: "quick",
      }),
      createTestUser({
        id: GUEST_ID,
        role: "guest",
        email: "guest-report-mode@test.com",
        mobileReportMode: "quick",
        desktopReportMode: "quick",
      }),
    ]);
  });

  it("saves both settings for an authorized reporter in the database", async () => {
    await mockAuth(MEMBER_ID);

    const result = await updateDefaultReportModeAction(
      undefined,
      reportModes("quick", "detailed")
    );

    expect(result).toEqual({
      ok: true,
      value: { mobileMode: "quick", desktopMode: "detailed" },
    });

    const db = await getTestDb();
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, MEMBER_ID));

    expect(profile.mobileReportMode).toBe("quick");
    expect(profile.desktopReportMode).toBe("detailed");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("rejects invalid values before updating and leaves database untouched", async () => {
    await mockAuth(MEMBER_ID);

    const result = await updateDefaultReportModeAction(
      undefined,
      reportModes("unknown", "detailed")
    );

    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });

    const db = await getTestDb();
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, MEMBER_ID));

    expect(profile.mobileReportMode).toBe("quick");
    expect(profile.desktopReportMode).toBe("quick");
  });

  it("rejects Multiple when batch access is absent and leaves database untouched", async () => {
    await mockAuth(GUEST_ID);

    const result = await updateDefaultReportModeAction(
      undefined,
      reportModes("multiple", "detailed")
    );

    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });

    const db = await getTestDb();
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, GUEST_ID));

    expect(profile.mobileReportMode).toBe("quick");
    expect(profile.desktopReportMode).toBe("quick");
  });

  it("requires a signed-in account", async () => {
    await mockAuth(null);

    const result = await updateDefaultReportModeAction(
      undefined,
      reportModes("quick", "detailed")
    );

    expect(result).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
  });
});

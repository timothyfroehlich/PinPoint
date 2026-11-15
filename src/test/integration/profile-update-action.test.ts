import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { userProfiles } from "~/server/db/schema";
import { signInAs } from "~/test/helpers/mock-auth";
import { seedUser } from "~/test/helpers/seed";

const ME = "00000000-0000-0000-0000-0000000000b1";

vi.mock("~/lib/supabase/server", () => import("~/test/helpers/mock-auth"));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe("updateProfileAction", () => {
  setupTestDb();

  beforeEach(async () => {
    await seedUser({
      id: ME,
      email: "me@example.com",
      firstName: "Old",
      lastName: "Name",
      role: "member",
    });
    signInAs(ME);
  });

  it("updates the caller's own profile fields and redirects to the read view", async () => {
    const db = await getTestDb();
    const { updateProfileAction } = await import("~/app/(app)/u/[id]/actions");

    // On success the action calls redirect(), which throws NEXT_REDIRECT by
    // design (Next.js control flow) instead of returning a Result.
    await expect(
      updateProfileAction(
        undefined,
        fd({
          firstName: "New",
          lastName: "Person",
          pronouns: "she/her",
          bio: "hi",
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT");

    const row = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, ME),
    });
    expect(row?.firstName).toBe("New");
    expect(row?.lastName).toBe("Person");
    expect(row?.pronouns).toBe("she/her");
    expect(row?.bio).toBe("hi");
  });

  it("rejects an over-length first name", async () => {
    const { updateProfileAction } = await import("~/app/(app)/u/[id]/actions");

    const res = await updateProfileAction(
      undefined,
      fd({ firstName: "x".repeat(51) })
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("VALIDATION");
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { authUsers, userProfiles } from "~/server/db/schema";
import { createTestUser } from "~/test/helpers/factories";

const ME = "00000000-0000-0000-0000-0000000000b1";

// Route the production `db` import to the PGlite worker instance.
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: ME } }, error: null }),
      },
    }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe("updateProfileAction", () => {
  setupTestDb();

  beforeEach(async () => {
    const db = await getTestDb();
    await db.insert(authUsers).values({ id: ME, email: "me@example.com" });
    await db.insert(userProfiles).values(
      createTestUser({
        id: ME,
        firstName: "Old",
        lastName: "Name",
        role: "member",
      })
    );
  });

  it("updates the caller's own profile fields", async () => {
    const db = await getTestDb();
    const { updateProfileAction } = await import("~/app/(app)/u/[id]/actions");

    const res = await updateProfileAction(
      undefined,
      fd({
        firstName: "New",
        lastName: "Person",
        pronouns: "she/her",
        bio: "hi",
      })
    );
    expect(res.ok).toBe(true);

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

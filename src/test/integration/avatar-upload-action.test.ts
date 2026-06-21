/**
 * Integration Test: uploadAvatarAction — Vercel Blob avatar upload (PinPoint-5r7)
 *
 * Verifies that uploadAvatarAction:
 *   - uploads a valid image, stores the blob url in userProfiles.avatarUrl,
 *     and calls deleteFromBlob with the old avatar url.
 *   - rejects non-image files with { ok: false, code: "VALIDATION" }.
 *
 * Auth and blob I/O are mocked at their boundaries. The DB write is asserted
 * against the real worker-scoped PGlite instance (CORE-TEST-001).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestUser } from "~/test/helpers/factories";
import { userProfiles } from "~/server/db/schema";

const ME = "00000000-0000-0000-0000-0000000000c1";
const OLD_AVATAR_URL =
  "https://x.public.blob.vercel-storage.com/user-avatars/old.png";

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

const deleteFromBlob = vi.fn(() => Promise.resolve(undefined));
vi.mock("~/lib/blob/client", () => ({
  uploadToBlob: (_file: File, pathname: string) =>
    Promise.resolve({
      url: `https://x.public.blob.vercel-storage.com/${pathname}`,
      pathname,
    }),
  deleteFromBlob: (...args: unknown[]) => deleteFromBlob(...args),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { uploadAvatarAction } from "~/server/actions/avatar";

function fileForm(name: string, type: string, bytes = 2048): FormData {
  const f = new FormData();
  f.append("avatar", new File([new Uint8Array(bytes)], name, { type }));
  return f;
}

describe("uploadAvatarAction", () => {
  setupTestDb();

  beforeEach(async () => {
    deleteFromBlob.mockClear();
    const db = await getTestDb();
    await db
      .insert(userProfiles)
      .values(createTestUser({ id: ME, avatarUrl: OLD_AVATAR_URL }));
  });

  it("uploads a valid image, stores the url, and cleans up the old avatar", async () => {
    const res = await uploadAvatarAction(fileForm("me.png", "image/png"));
    expect(res.ok).toBe(true);

    const db = await getTestDb();
    const row = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, ME),
    });
    expect(row?.avatarUrl).toContain("user-avatars/");
    expect(deleteFromBlob).toHaveBeenCalledWith(OLD_AVATAR_URL);
  });

  it("rejects a non-image file", async () => {
    const res = await uploadAvatarAction(fileForm("x.txt", "text/plain"));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("VALIDATION");
  });
});

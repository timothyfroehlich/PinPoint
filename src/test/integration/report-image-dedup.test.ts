/**
 * Integration test: idempotent retry must NOT link duplicate issue_images rows
 * (PP-u0v1), and no path in the report action deletes a blob named by the
 * client's imagesMetadata (PP-ysk3).
 *
 * PP-u0v1: createIssue returns the existing issue on a same-key retry, but
 * report/actions.ts was unconditionally running db.insert(issueImages)
 * afterwards → each photo appeared twice on the deduplicated issue. The action
 * now skips the insert when `deduped` is true.
 *
 * PP-ysk3: the retry branch and the link-failure branch used to delete every
 * blob the metadata named. The metadata is client input, so it could name any
 * blob in the store. Unlinked uploads are now left to the orphan-cleanup cron.
 *
 * Test layer: Integration (PGlite + direct action call) — class B/I.
 * Matches the cheapest layer that catches this bug class (CORE-TEST-005).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import {
  issues,
  issueImages,
  machines,
  userProfiles,
} from "~/server/db/schema";
import { createTestUser, createTestMachine } from "~/test/helpers/factories";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

// ---------------------------------------------------------------------------
// External-boundary mocks
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Run after() callbacks inline so post-commit effects execute synchronously.
vi.mock("next/server", () => ({
  after: (cb: () => unknown) => {
    void cb();
  },
}));

vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("~/lib/rate-limit", () => ({
  checkAuthenticatedIssueLimit: vi
    .fn()
    .mockResolvedValue({ success: true, reset: 0 }),
  checkPublicIssueLimit: vi.fn().mockResolvedValue({ success: true, reset: 0 }),
  getClientIp: vi.fn().mockResolvedValue("127.0.0.1"),
  formatResetTime: vi.fn().mockReturnValue("0s"),
}));

// Authenticated as a member user; overridden per-test where needed.
const mockGetUser = vi.fn();
vi.mock("~/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    }),
}));

vi.mock("~/lib/notifications", () => ({
  planNotification: vi.fn().mockResolvedValue({ deliveries: [] }),
  dispatchNotification: vi.fn().mockResolvedValue(undefined),
  getChannels: vi.fn().mockResolvedValue([]),
}));

const mockReportError = vi.fn();
vi.mock("~/lib/observability/report-error", () => ({
  reportError: mockReportError,
  serverActionError: vi.fn(),
}));

// Blob deletion is mocked at both boundaries: our helper and the SDK's del().
const mockDeleteFromBlob = vi.fn().mockResolvedValue(undefined);
vi.mock("~/lib/blob/client", () => ({
  deleteFromBlob: mockDeleteFromBlob,
}));
const mockBlobDel = vi.fn().mockResolvedValue(undefined);
vi.mock("@vercel/blob", () => ({
  del: mockBlobDel,
}));

function expectNoBlobDeletes(): void {
  expect(mockDeleteFromBlob).not.toHaveBeenCalled();
  expect(mockBlobDel).not.toHaveBeenCalled();
}

// Route production `db` to PGlite.
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  const db = await getTestDb();
  return { db };
});

// Lazy import AFTER mocks are wired up.
const { submitPublicIssueAction } = await import("~/app/(app)/report/actions");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid FormData for submitPublicIssueAction. */
function makeFormData(opts: {
  machineId: string;
  idempotencyKey?: string;
  imagesMetadata?: {
    blobUrl: string;
    blobPathname: string;
    fileSizeBytes: number;
    mimeType: string;
    originalFilename: string;
  }[];
}): FormData {
  const fd = new FormData();
  fd.set("machineId", opts.machineId);
  fd.set("title", "Dedup image test issue");
  fd.set("severity", "minor");
  fd.set("frequency", "intermittent");
  if (opts.idempotencyKey) {
    fd.set("idempotencyKey", opts.idempotencyKey);
  }
  if (opts.imagesMetadata) {
    fd.set("imagesMetadata", JSON.stringify(opts.imagesMetadata));
  }
  return fd;
}

// blobUrl must satisfy imageMetadataSchema's refine: a Vercel Blob host.
const TEST_IMAGE = {
  blobUrl: "https://teststore.public.blob.vercel-storage.com/img1.jpg",
  blobPathname: "images/img1.jpg",
  fileSizeBytes: 12345,
  mimeType: "image/jpeg",
  originalFilename: "photo.jpg",
};

const RETRY_IMAGE = {
  blobUrl: "https://teststore.public.blob.vercel-storage.com/img2.jpg",
  blobPathname: "images/img2.jpg",
  fileSizeBytes: 9999,
  mimeType: "image/jpeg",
  originalFilename: "photo-retry.jpg",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("report action — idempotent retry image handling (PP-u0v1)", () => {
  setupTestDb();

  let machineId: string;
  let userId: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    const db = await getTestDb();
    userId = randomUUID();
    machineId = randomUUID();

    await db
      .insert(userProfiles)
      .values(createTestUser({ id: userId, role: "member" }));

    await db.insert(machines).values(
      createTestMachine({
        id: machineId,
        initials: "RID",
        name: "Retry Image Dedup Machine",
        ownerId: userId,
      })
    );

    mockGetUser.mockResolvedValue({ data: { user: { id: userId } } });
  });

  it("first submission links images to the issue (control: deduped=false path)", async () => {
    const db = await getTestDb();
    const idempotencyKey = randomUUID();

    await submitPublicIssueAction(
      { error: "" },
      makeFormData({
        machineId,
        idempotencyKey,
        imagesMetadata: [TEST_IMAGE],
      })
    );

    const issue = await db.query.issues.findFirst({
      where: eq(issues.machineInitials, "RID"),
    });
    expect(issue).toBeDefined();

    const linked = await db
      .select()
      .from(issueImages)
      .where(eq(issueImages.issueId, issue!.id));

    expect(linked).toHaveLength(1);
    expect(linked[0]?.fullImageUrl).toBe(TEST_IMAGE.blobUrl);
    // No blob cleanup on fresh insert.
    expectNoBlobDeletes();
  });

  it("idempotent retry does NOT add duplicate issueImages rows (PP-u0v1)", async () => {
    const db = await getTestDb();
    const idempotencyKey = randomUUID();

    // First submission: creates the issue and links 1 image.
    await submitPublicIssueAction(
      { error: "" },
      makeFormData({
        machineId,
        idempotencyKey,
        imagesMetadata: [TEST_IMAGE],
      })
    );

    const issue = await db.query.issues.findFirst({
      where: eq(issues.machineInitials, "RID"),
    });
    expect(issue).toBeDefined();

    const afterFirst = await db
      .select()
      .from(issueImages)
      .where(eq(issueImages.issueId, issue!.id));
    expect(afterFirst).toHaveLength(1);

    // Retry with the SAME idempotency key, carrying a fresh image upload.
    vi.clearAllMocks();
    await submitPublicIssueAction(
      { error: "" },
      makeFormData({
        machineId,
        idempotencyKey,
        imagesMetadata: [RETRY_IMAGE],
      })
    );

    // Still exactly one row — the retry must not insert a second image.
    const afterRetry = await db
      .select()
      .from(issueImages)
      .where(eq(issueImages.issueId, issue!.id));
    expect(afterRetry).toHaveLength(1);
    expect(afterRetry[0]?.fullImageUrl).toBe(TEST_IMAGE.blobUrl);

    // The retry's metadata is client input: nothing it names is deleted
    // (PP-ysk3). The orphan-cleanup cron reclaims the unlinked upload.
    expectNoBlobDeletes();
  });

  it("a retry naming another issue's linked blob does not delete it (PP-ysk3)", async () => {
    const db = await getTestDb();

    // Another report already links TEST_IMAGE.
    await submitPublicIssueAction(
      { error: "" },
      makeFormData({
        machineId,
        idempotencyKey: randomUUID(),
        imagesMetadata: [TEST_IMAGE],
      })
    );

    // A second submission and its same-key retry, whose metadata names the
    // first report's blob.
    const idempotencyKey = randomUUID();
    await submitPublicIssueAction(
      { error: "" },
      makeFormData({ machineId, idempotencyKey })
    );
    vi.clearAllMocks();
    await submitPublicIssueAction(
      { error: "" },
      makeFormData({
        machineId,
        idempotencyKey,
        imagesMetadata: [TEST_IMAGE],
      })
    );

    expectNoBlobDeletes();
    const linked = await db
      .select()
      .from(issueImages)
      .where(eq(issueImages.fullImageUrl, TEST_IMAGE.blobUrl));
    expect(linked).toHaveLength(1);
  });

  it("a failed image link does not delete the blobs it named (PP-ysk3)", async () => {
    const db = await getTestDb();
    try {
      // Make every issue_images insert fail so the action takes its
      // link-failure branch.
      await db.execute(sql`
        CREATE OR REPLACE FUNCTION pp_ysk3_fail_image_link() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'simulated link failure'; END $$
      `);
      await db.execute(sql`
        CREATE TRIGGER pp_ysk3_fail_image_link BEFORE INSERT ON issue_images
        FOR EACH ROW EXECUTE FUNCTION pp_ysk3_fail_image_link()
      `);
      await submitPublicIssueAction(
        { error: "" },
        makeFormData({
          machineId,
          idempotencyKey: randomUUID(),
          imagesMetadata: [TEST_IMAGE],
        })
      );
    } finally {
      await db.execute(
        sql`DROP TRIGGER IF EXISTS pp_ysk3_fail_image_link ON issue_images`
      );
      await db.execute(sql`DROP FUNCTION IF EXISTS pp_ysk3_fail_image_link()`);
    }

    // The issue was created; the link failed; nothing was deleted.
    const issue = await db.query.issues.findFirst({
      where: eq(issues.machineInitials, "RID"),
    });
    expect(issue).toBeDefined();
    expect(mockReportError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "linkIssueImages" })
    );
    expectNoBlobDeletes();
  });

  it("another reporter replaying a key is not treated as a retry (PP-ysk3)", async () => {
    const db = await getTestDb();
    const idempotencyKey = randomUUID();

    // The member's report links TEST_IMAGE.
    await submitPublicIssueAction(
      { error: "" },
      makeFormData({
        machineId,
        idempotencyKey,
        imagesMetadata: [TEST_IMAGE],
      })
    );
    const original = await db.query.issues.findFirst({
      where: eq(issues.idempotencyKey, idempotencyKey),
    });
    expect(original).toBeDefined();

    // An anonymous visitor replays the member's key.
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await submitPublicIssueAction(
      { error: "" },
      makeFormData({
        machineId,
        idempotencyKey,
        imagesMetadata: [TEST_IMAGE],
      })
    );

    expect(result).toEqual({
      error: "Unable to submit the issue. Please try again.",
    });
    expectNoBlobDeletes();
    const images = await db
      .select()
      .from(issueImages)
      .where(eq(issueImages.issueId, original!.id));
    expect(images).toHaveLength(1);
  });

  it("idempotent retry without images does not call deleteFromBlob", async () => {
    const db = await getTestDb();
    const idempotencyKey = randomUUID();

    // First submission with an image.
    await submitPublicIssueAction(
      { error: "" },
      makeFormData({
        machineId,
        idempotencyKey,
        imagesMetadata: [TEST_IMAGE],
      })
    );

    vi.clearAllMocks();

    // Retry carries NO images (e.g. form was cleared on the retry attempt).
    await submitPublicIssueAction(
      { error: "" },
      makeFormData({
        machineId,
        idempotencyKey,
        // no imagesMetadata
      })
    );

    expectNoBlobDeletes();

    // Original image still linked.
    const issue = await db.query.issues.findFirst({
      where: eq(issues.machineInitials, "RID"),
    });
    const images = await db
      .select()
      .from(issueImages)
      .where(eq(issueImages.issueId, issue!.id));
    expect(images).toHaveLength(1);
  });
});

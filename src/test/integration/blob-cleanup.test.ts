/**
 * Integration Tests: getReferencedBlobUrls + cleanupOrphanedBlobs (DB-reference path)
 *
 * Wave 4 RECLASS (PP-x4li.1.4): migrated 2 blocks from
 * src/lib/blob/cleanup.test.ts whose assertions depend on real DB state:
 *
 *   RECLASSED:
 *   1. getReferencedBlobUrls — "collects avatar URLs and image URLs"
 *      Inserts real userProfiles (with avatarUrl) + issueImages rows and asserts
 *      the returned Set contains exactly those URLs. A mocked db.select chain
 *      cannot test that the query is wired to the right columns/tables.
 *
 *   2. cleanupOrphanedBlobs — "does not delete referenced blobs"
 *      With real referenced rows in the DB (avatar/image), asserts that a
 *      referenced blob URL is NOT passed to del(). The mock-db version bypassed
 *      the actual getReferencedBlobUrls() query path; here the full path runs.
 *
 *   KEPT-unit (blob-SDK / time-logic, no DB-state dependency):
 *   - "returns zero counts when storage is empty"
 *   - "skips orphaned blobs within the 24-hour grace period"
 *   - "deletes orphaned blobs older than the grace period"
 *   - "handles deletion errors gracefully"
 *   - "paginates through blob listing"
 *   These test @vercel/blob SDK boundary and grace-period time logic — correctly
 *   mocked in the unit file; they gain nothing from a real DB.
 *
 * External boundaries mocked here:
 *   - @vercel/blob (list / del) — we observe del calls, not real blob storage
 *   - ~/lib/logger — suppress noise
 *   - ~/lib/blob/config — fix SOFT_DELETE_RETENTION_HOURS to 24
 *
 * NOT mocked:
 *   - ~/server/db — redirected to PGlite via the canonical pattern
 *   - ~/server/db/schema — real schema used for inserts
 *   - drizzle-orm — real query building
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  userProfiles,
  issues,
  issueImages,
  machines,
} from "~/server/db/schema";
import {
  createTestUser,
  createTestMachine,
  createTestIssue,
} from "~/test/helpers/factories";

// ---------------------------------------------------------------------------
// External-boundary mocks
// ---------------------------------------------------------------------------

const mockList = vi.fn();
const mockDel = vi.fn();
vi.mock("@vercel/blob", () => ({
  list: (...args: unknown[]) => mockList(...args),
  del: (...args: unknown[]) => mockDel(...args),
}));

vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("~/lib/blob/config", () => ({
  BLOB_CONFIG: {
    SOFT_DELETE_RETENTION_HOURS: 24,
  },
}));

// Real PGlite — db.select / db.query flow through the actual instance
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

// Import AFTER the db mock so the functions pick up PGlite
const { getReferencedBlobUrls, cleanupOrphanedBlobs } =
  await import("~/lib/blob/cleanup");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getReferencedBlobUrls (integration)", () => {
  setupTestDb();

  const OWNER_ID = "00000000-0000-0000-0000-000000000001";

  beforeEach(async () => {
    vi.clearAllMocks();

    // Seed a user so FK constraints are satisfied
    const db = await getTestDb();
    await db
      .insert(userProfiles)
      .values(
        createTestUser({ id: OWNER_ID, email: "owner@test.example.com" })
      );
  });

  // Migrated from: getReferencedBlobUrls "collects avatar URLs and image URLs"
  it("collects avatar URLs and image URLs from real DB rows", async () => {
    const avatarUrl = "https://store.blob.vercel-storage.com/avatar.jpg";
    const fullUrl = "https://store.blob.vercel-storage.com/full.jpg";
    const croppedUrl = "https://store.blob.vercel-storage.com/cropped.jpg";

    const db = await getTestDb();

    // Insert user with avatar
    await db.insert(userProfiles).values(
      createTestUser({
        id: randomUUID(),
        avatarUrl,
      })
    );

    // Seed machine + issue so FK from issueImages is satisfied
    const machineInitials = "RFB";
    await db
      .insert(machines)
      .values(
        createTestMachine({ initials: machineInitials, name: "Rolly Blob" })
      );

    const [insertedIssue] = await db
      .insert(issues)
      .values(
        createTestIssue(machineInitials, {
          reportedBy: OWNER_ID,
        })
      )
      .returning();

    // Insert issue image with both full and cropped URLs
    await db.insert(issueImages).values({
      id: randomUUID(),
      issueId: insertedIssue.id,
      uploadedBy: OWNER_ID,
      fullImageUrl: fullUrl,
      croppedImageUrl: croppedUrl,
      fullBlobPathname: "issues/full.jpg",
      croppedBlobPathname: "issues/cropped.jpg",
      fileSizeBytes: 12345,
      mimeType: "image/jpeg",
    });

    const urls = await getReferencedBlobUrls();

    expect(urls.has(avatarUrl)).toBe(true);
    expect(urls.has(fullUrl)).toBe(true);
    expect(urls.has(croppedUrl)).toBe(true);
    expect(urls.size).toBeGreaterThanOrEqual(3);
  });

  it("omits null avatarUrl entries and only-null-cropped image rows", async () => {
    const fullUrl = "https://store.blob.vercel-storage.com/only-full.jpg";

    const db = await getTestDb();

    // User with no avatar (avatarUrl IS NULL — should not appear in Set)
    await db
      .insert(userProfiles)
      .values(createTestUser({ id: randomUUID(), avatarUrl: null }));

    const machineInitials = "NCA";
    await db.insert(machines).values(
      createTestMachine({
        initials: machineInitials,
        name: "Null Crop Arcade",
      })
    );
    const [insertedIssue] = await db
      .insert(issues)
      .values(createTestIssue(machineInitials, { reportedBy: OWNER_ID }))
      .returning();

    // Image with only a fullImageUrl (croppedImageUrl = null)
    await db.insert(issueImages).values({
      id: randomUUID(),
      issueId: insertedIssue.id,
      uploadedBy: OWNER_ID,
      fullImageUrl: fullUrl,
      croppedImageUrl: null,
      fullBlobPathname: "issues/only-full.jpg",
      fileSizeBytes: 5000,
      mimeType: "image/jpeg",
    });

    const urls = await getReferencedBlobUrls();

    expect(urls.has(fullUrl)).toBe(true);
    // Null values must not be coerced into strings and added to the set
    expect(urls.has("null")).toBe(false);
    expect(urls.has("undefined")).toBe(false);
  });
});

describe("cleanupOrphanedBlobs — DB-reference path (integration)", () => {
  setupTestDb();

  const OWNER_ID = "00000000-0000-0000-0000-000000000002";

  beforeEach(async () => {
    vi.clearAllMocks();

    const db = await getTestDb();
    await db
      .insert(userProfiles)
      .values(
        createTestUser({ id: OWNER_ID, email: "owner2@test.example.com" })
      );
  });

  // Migrated from: cleanupOrphanedBlobs "does not delete referenced blobs"
  // Real DB rows make getReferencedBlobUrls() return the avatar URL, so the
  // full path through cleanupOrphanedBlobs is exercised — not just a mock stub.
  it("does not delete a blob whose URL is referenced by a real userProfiles row", async () => {
    const referencedUrl =
      "https://store.blob.vercel-storage.com/avatar-ref.jpg";
    const oldDate = new Date("2025-06-10T00:00:00Z");

    const db = await getTestDb();

    // Insert user with avatarUrl so getReferencedBlobUrls() returns it
    await db.insert(userProfiles).values(
      createTestUser({
        id: randomUUID(),
        avatarUrl: referencedUrl,
      })
    );

    // blob list returns the referenced URL — old enough to be deleted if orphaned
    mockList.mockResolvedValue({
      blobs: [{ url: referencedUrl, uploadedAt: oldDate }],
      hasMore: false,
      cursor: "",
    });
    mockDel.mockResolvedValue(undefined);

    const result = await cleanupOrphanedBlobs();

    expect(result.totalBlobs).toBe(1);
    expect(result.referencedBlobs).toBe(1);
    expect(result.deletedBlobs).toBe(0);
    // del must never be called for a referenced blob
    expect(mockDel).not.toHaveBeenCalled();
  });

  it("does not delete a blob whose URL is referenced by a real issueImages row", async () => {
    const referencedUrl =
      "https://store.blob.vercel-storage.com/issue-full-ref.jpg";
    const oldDate = new Date("2025-06-10T00:00:00Z");

    const db = await getTestDb();

    const machineInitials = "IFR";
    await db
      .insert(machines)
      .values(
        createTestMachine({ initials: machineInitials, name: "Issue Full Ref" })
      );
    const [insertedIssue] = await db
      .insert(issues)
      .values(createTestIssue(machineInitials, { reportedBy: OWNER_ID }))
      .returning();

    await db.insert(issueImages).values({
      id: randomUUID(),
      issueId: insertedIssue.id,
      uploadedBy: OWNER_ID,
      fullImageUrl: referencedUrl,
      croppedImageUrl: null,
      fullBlobPathname: "issues/issue-full-ref.jpg",
      fileSizeBytes: 8888,
      mimeType: "image/jpeg",
    });

    // blob list returns the referenced URL — old enough to be deleted if orphaned
    mockList.mockResolvedValue({
      blobs: [{ url: referencedUrl, uploadedAt: oldDate }],
      hasMore: false,
      cursor: "",
    });
    mockDel.mockResolvedValue(undefined);

    const result = await cleanupOrphanedBlobs();

    expect(result.totalBlobs).toBe(1);
    expect(result.referencedBlobs).toBe(1);
    expect(result.deletedBlobs).toBe(0);
    expect(mockDel).not.toHaveBeenCalled();
  });
});

/**
 * Issue Core Router – create (Integration) – Test Skeleton
 *
 * Validates member issue creation: inserts with createdById, applies defaults,
 * records activity, notifies owner; rejects invalid inputs and permission issues.
 *
 * Use:
 * - SEED_TEST_IDS for organizations, users, machines, statuses, priorities
 * - setupOrganizationMocks() to shape { kind: "authorized" } auth context
 * - SeedBasedMockFactory/MockDatabaseFactory to stub DB reads/writes deterministically
 * - Consider MockFormDataFactory when exercising Server Actions adjacent to this flow
 */

import { describe, it, expect } from "vitest";

describe("issue.core.create (integration)", () => {
  it("creates member issue with defaults, activity recorded, and notification sent", async () => {
    expect("test implemented").toBe("true");
  });

  it("rejects create when target machine is soft-deleted", async () => {
    expect("test implemented").toBe("true");
  });

  it("rejects create when org default status/priority is missing", async () => {
    expect("test implemented").toBe("true");
  });

  it("validates required fields and surfaces field errors", async () => {
    expect("test implemented").toBe("true");
  });

  it("denies create without appropriate permission (issue:create)", async () => {
    expect("test implemented").toBe("true");
  });
});

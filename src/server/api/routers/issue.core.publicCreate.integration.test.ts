/**
 * Issue Core Router – publicCreate (Integration) – Test Skeleton
 *
 * Validates the anonymous issue creation endpoint: inserts with createdById=null,
 * applies default status/priority, skips activity recording, and calls notifications.
 * Includes negative cases for soft-deleted machines, missing defaults, and org scoping.
 */

import { describe, it, expect } from "vitest";

describe("issue.core.publicCreate (integration)", () => {
  it("creates anonymous issue with defaults and notifies owner (no activity)", async () => {
    expect("test implemented").toBe("true");
  });

  it("skips activity recording due to no actor", async () => {
    expect("test implemented").toBe("true");
  });

  it("rejects create when target machine is soft-deleted", async () => {
    expect("test implemented").toBe("true");
  });

  it("rejects create when org default status/priority is missing", async () => {
    expect("test implemented").toBe("true");
  });

  it("enforces org boundary (cross-organization machine rejected)", async () => {
    expect("test implemented").toBe("true");
  });
});


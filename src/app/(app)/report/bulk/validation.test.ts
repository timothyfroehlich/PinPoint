import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { parseBulkRow } from "./validation";
import { BULK_MAX_ROWS } from "./schemas";

const validRow = () => ({
  machineId: randomUUID(),
  title: "Right flipper sticky",
  description: "",
  severity: "major",
  priority: "medium",
  frequency: "frequent",
  status: "new",
  assignedTo: "",
  watch: true,
  idempotencyKey: randomUUID(),
});

describe("parseBulkRow", () => {
  it("accepts a well-formed row", () => {
    const res = parseBulkRow(validRow());
    expect(res.success).toBe(true);
  });

  it("rejects a missing machineId with a field-prefixed message", () => {
    const res = parseBulkRow({ ...validRow(), machineId: "not-a-uuid" });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toMatch(/machineId/);
  });

  it("rejects an empty title", () => {
    const res = parseBulkRow({ ...validRow(), title: "" });
    expect(res.success).toBe(false);
  });

  it("rejects a title longer than 60 chars", () => {
    const res = parseBulkRow({ ...validRow(), title: "x".repeat(61) });
    expect(res.success).toBe(false);
  });

  it("rejects an invalid severity", () => {
    const res = parseBulkRow({ ...validRow(), severity: "nope" });
    expect(res.success).toBe(false);
  });

  it("treats empty assignedTo as valid (unassigned)", () => {
    const res = parseBulkRow({ ...validRow(), assignedTo: "" });
    expect(res.success).toBe(true);
  });

  it("exposes the batch cap", () => {
    expect(BULK_MAX_ROWS).toBe(50);
  });
});

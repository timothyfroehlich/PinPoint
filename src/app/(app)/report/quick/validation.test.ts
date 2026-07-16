import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { parseQuickRow } from "./validation";
import { QUICK_MAX_ROWS } from "./schemas";

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

describe("parseQuickRow", () => {
  it("accepts a well-formed row", () => {
    const res = parseQuickRow(validRow());
    expect(res.success).toBe(true);
  });

  it("rejects a missing machineId with the schema's plain message (no field prefix)", () => {
    const res = parseQuickRow({ ...validRow(), machineId: "not-a-uuid" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe("Please select a machine");
      // The raw field path must not leak into the user-facing message.
      expect(res.error).not.toMatch(/machineId/);
    }
  });

  it("rejects an empty title", () => {
    const res = parseQuickRow({ ...validRow(), title: "" });
    expect(res.success).toBe(false);
  });

  it("rejects a whitespace-only title", () => {
    const res = parseQuickRow({ ...validRow(), title: "   " });
    expect(res.success).toBe(false);
  });

  it("rejects a title longer than 60 chars", () => {
    const res = parseQuickRow({ ...validRow(), title: "x".repeat(61) });
    expect(res.success).toBe(false);
  });

  it("rejects an invalid severity", () => {
    const res = parseQuickRow({ ...validRow(), severity: "nope" });
    expect(res.success).toBe(false);
  });

  it("treats empty assignedTo as valid (unassigned)", () => {
    const res = parseQuickRow({ ...validRow(), assignedTo: "" });
    expect(res.success).toBe(true);
  });

  it("exposes the batch cap", () => {
    expect(QUICK_MAX_ROWS).toBe(50);
  });
});

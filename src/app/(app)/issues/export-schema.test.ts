import { describe, expect, it } from "vitest";
import { exportIssuesSchema } from "./export-schema";

describe("exportIssuesSchema machineInitials", () => {
  it("normalizes lowercase initials to uppercase so the case-sensitive machine filter matches (PP-mf4e)", () => {
    const result = exportIssuesSchema.safeParse({ machineInitials: "afm" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.machineInitials).toBe("AFM");
    }
  });

  it("normalizes mixed-case alphanumeric initials", () => {
    const result = exportIssuesSchema.safeParse({ machineInitials: "Af2" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.machineInitials).toBe("AF2");
    }
  });

  it("accepts and normalizes the length boundaries (2 and 6 chars)", () => {
    const min = exportIssuesSchema.safeParse({ machineInitials: "ab" });
    expect(min.success).toBe(true);
    if (min.success) {
      expect(min.data.machineInitials).toBe("AB");
    }

    const max = exportIssuesSchema.safeParse({ machineInitials: "abcde1" });
    expect(max.success).toBe(true);
    if (max.success) {
      expect(max.data.machineInitials).toBe("ABCDE1");
    }
  });

  it("leaves already-uppercase initials unchanged", () => {
    const result = exportIssuesSchema.safeParse({ machineInitials: "AFM" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.machineInitials).toBe("AFM");
    }
  });

  it("rejects initials outside the allowed length", () => {
    expect(exportIssuesSchema.safeParse({ machineInitials: "a" }).success).toBe(
      false
    );
    expect(
      exportIssuesSchema.safeParse({ machineInitials: "toolong" }).success
    ).toBe(false);
  });

  it("rejects initials with disallowed characters", () => {
    expect(
      exportIssuesSchema.safeParse({ machineInitials: "a-b" }).success
    ).toBe(false);
  });

  it("leaves machineInitials undefined when omitted", () => {
    const result = exportIssuesSchema.safeParse({ query: "status=open" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.machineInitials).toBeUndefined();
    }
  });
});

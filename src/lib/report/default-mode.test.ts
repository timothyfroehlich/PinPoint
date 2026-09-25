import { describe, expect, it } from "vitest";
import { reportModePath, resolveDefaultReportMode } from "./default-mode";

describe("resolveDefaultReportMode", () => {
  it("keeps Quick and Detailed available regardless of batch access", () => {
    expect(resolveDefaultReportMode("quick", false, "quick")).toBe("quick");
    expect(resolveDefaultReportMode("detailed", false, "detailed")).toBe(
      "detailed"
    );
  });

  it("allows Multiple only with the batch-reporting capability", () => {
    expect(resolveDefaultReportMode("multiple", true, "quick")).toBe(
      "multiple"
    );
    expect(resolveDefaultReportMode("multiple", false, "quick")).toBe("quick");
    expect(resolveDefaultReportMode("multiple", false, "detailed")).toBe(
      "detailed"
    );
  });
});

describe("reportModePath", () => {
  it("maps Quick to the direct report route", () => {
    expect(reportModePath("quick")).toBe("/report");
    expect(reportModePath("detailed")).toBe("/report/detailed");
    expect(reportModePath("multiple")).toBe("/report/multiple");
  });
});

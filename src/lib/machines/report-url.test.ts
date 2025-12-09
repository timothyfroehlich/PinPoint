import { describe, expect, it } from "vitest";
import { buildMachineReportUrl } from "./report-url";

describe("buildMachineReportUrl", () => {
  it("builds absolute URL with machineId and source=qr", () => {
    const url = buildMachineReportUrl({
      siteUrl: "https://pinpoint.dev",
      machineId: "uuid-123",
      source: "qr",
    });

    expect(url).toBe(
      "https://pinpoint.dev/report?machineId=uuid-123&source=qr"
    );
  });

  it("omits source when not provided", () => {
    const url = buildMachineReportUrl({
      siteUrl: "http://localhost:3000",
      machineId: "uuid-123",
    });

    expect(url).toBe("http://localhost:3000/report?machineId=uuid-123");
  });
});

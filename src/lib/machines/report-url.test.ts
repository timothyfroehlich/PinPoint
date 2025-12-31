import { describe, expect, it } from "vitest";
import { buildMachineReportUrl } from "./report-url";

describe("buildMachineReportUrl", () => {
  it("builds absolute URL with machine initials and source=qr", () => {
    const url = buildMachineReportUrl({
      siteUrl: "https://pinpoint.dev",
      machineInitials: "TZ",
      source: "qr",
    });

    expect(url).toBe("https://pinpoint.dev/m/TZ?source=qr");
  });

  it("omits source when not provided", () => {
    const url = buildMachineReportUrl({
      siteUrl: "http://localhost:3000",
      machineInitials: "TZ",
    });

    expect(url).toBe("http://localhost:3000/m/TZ");
  });
});

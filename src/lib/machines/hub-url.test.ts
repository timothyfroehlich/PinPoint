import { describe, expect, it } from "vitest";
import { buildMachineHubUrl } from "./hub-url";

describe("buildMachineHubUrl", () => {
  it("targets the canonical machine hub and marks apron scans", () => {
    expect(buildMachineHubUrl("https://pinpoint.dev", "AFM")).toBe(
      "https://pinpoint.dev/m/AFM/hub?source=apron"
    );
  });
});

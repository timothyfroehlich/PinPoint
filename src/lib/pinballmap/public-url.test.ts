import { describe, it, expect } from "vitest";
import { pinballmapLocationUrl } from "./public-url";
import { APC_LOCATION_ID } from "./config";

describe("pinballmapLocationUrl", () => {
  it("builds a public location deep link for the given id", () => {
    expect(pinballmapLocationUrl(12345)).toBe(
      "https://pinballmap.com/map/?by_location_id=12345"
    );
  });

  it("defaults to the APC location id", () => {
    expect(pinballmapLocationUrl()).toBe(
      `https://pinballmap.com/map/?by_location_id=${APC_LOCATION_ID}`
    );
  });
});

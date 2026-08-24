import { describe, it, expect } from "vitest";
import { pinballmapLocationUrl } from "./public-url";

describe("pinballmapLocationUrl", () => {
  it("builds a public location deep link for the given id", () => {
    expect(pinballmapLocationUrl(12345)).toBe(
      "https://pinballmap.com/map/?by_location_id=12345"
    );
  });
});

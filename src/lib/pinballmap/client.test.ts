import { describe, it, expect } from "vitest";
import { getPinballMapClient } from "./client";
import { getPinballMapMode } from "./config";

describe("getPinballMapClient", () => {
  it("defaults to the mock client in tests — no network, no creds", async () => {
    expect(getPinballMapMode()).toBe("mock");
    const snap = await getPinballMapClient().fetchLocation(26454);
    expect(snap.locationId).toBe(26454);
    expect(snap.lmxes.length).toBeGreaterThan(0);
  });
});

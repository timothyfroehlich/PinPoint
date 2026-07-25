import { afterEach, describe, expect, it } from "vitest";
import { getPinballMapApiToken } from "./api-token";

// Bug class G (pure logic): the accessor is a deploy-time constant read off
// process.env (PP-o355.23) — no DB, no network — so the cheapest layer covers it
// fully (CORE-TEST-005). The null contract is load-bearing: `createLiveClient`
// omits the X-Api-Token header on null rather than sending an empty one.

const ORIGINAL = process.env.PINBALLMAP_API_TOKEN;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.PINBALLMAP_API_TOKEN;
  } else {
    process.env.PINBALLMAP_API_TOKEN = ORIGINAL;
  }
});

describe("getPinballMapApiToken", () => {
  it("returns null when the env var is unset", () => {
    delete process.env.PINBALLMAP_API_TOKEN;
    expect(getPinballMapApiToken()).toBeNull();
  });

  it("returns null when the env var is empty", () => {
    process.env.PINBALLMAP_API_TOKEN = "";
    expect(getPinballMapApiToken()).toBeNull();
  });

  it("returns null when the env var is whitespace-only", () => {
    process.env.PINBALLMAP_API_TOKEN = "   \t\n ";
    expect(getPinballMapApiToken()).toBeNull();
  });

  it("returns the token when set", () => {
    process.env.PINBALLMAP_API_TOKEN = "pbm-token-abc123";
    expect(getPinballMapApiToken()).toBe("pbm-token-abc123");
  });

  it("trims surrounding whitespace", () => {
    process.env.PINBALLMAP_API_TOKEN = "  pbm-token-abc123\n";
    expect(getPinballMapApiToken()).toBe("pbm-token-abc123");
  });
});

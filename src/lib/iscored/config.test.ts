import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ISCORED_BASE_URL,
  ISCORED_CACHE_TTL_MS,
  getGameroomUrl,
  getGameUrl,
  getIscoredUser,
  getScoreEntryUrl,
  isIscoredConfigured,
} from "./config";

describe("iscored config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getIscoredUser and isIscoredConfigured", () => {
    it("returns null when ISCORED_USER is unset", () => {
      delete process.env.ISCORED_USER;
      expect(getIscoredUser()).toBeNull();
      expect(isIscoredConfigured()).toBe(false);
    });

    it("returns null when ISCORED_USER is empty string or only whitespace", () => {
      process.env.ISCORED_USER = "   ";
      expect(getIscoredUser()).toBeNull();
      expect(isIscoredConfigured()).toBe(false);
    });

    it("returns trimmed username when ISCORED_USER is set", () => {
      process.env.ISCORED_USER = "  Apcscore  ";
      expect(getIscoredUser()).toBe("Apcscore");
      expect(isIscoredConfigured()).toBe(true);
    });
  });

  describe("constants", () => {
    it("exports base URL and 15s cache TTL", () => {
      expect(ISCORED_BASE_URL).toBe("https://www.iscored.info");
      expect(ISCORED_CACHE_TTL_MS).toBe(15_000);
    });
  });

  it("never builds outbound links for the local AFM demo game", () => {
    process.env.ISCORED_USER = "Apcscore";
    expect(getScoreEntryUrl("local-afm-demo")).toBeNull();
    expect(getGameUrl("local-afm-demo")).toBeNull();
  });

  describe("getScoreEntryUrl", () => {
    it("builds the correct public score entry link from env", () => {
      process.env.ISCORED_USER = "Apcscore";
      expect(getScoreEntryUrl("77956")).toBe(
        "https://www.iscored.info/?mode=public&user=Apcscore&game=77956"
      );
    });

    it("uses explicitly passed user override", () => {
      delete process.env.ISCORED_USER;
      expect(getScoreEntryUrl("104656", "OtherUser")).toBe(
        "https://www.iscored.info/?mode=public&user=OtherUser&game=104656"
      );
    });

    it("URL-encodes user and game ID components", () => {
      expect(getScoreEntryUrl("game#1 / special", "User & Co")).toBe(
        "https://www.iscored.info/?mode=public&user=User%20%26%20Co&game=game%231%20%2F%20special"
      );
    });

    it("returns null if gameId is empty or whitespace", () => {
      process.env.ISCORED_USER = "Apcscore";
      expect(getScoreEntryUrl("")).toBeNull();
      expect(getScoreEntryUrl("   ")).toBeNull();
    });

    it("returns null if explicit user is whitespace-only", () => {
      delete process.env.ISCORED_USER;
      expect(getScoreEntryUrl("77956", "   ")).toBeNull();
    });

    it("trims explicitly passed user override", () => {
      delete process.env.ISCORED_USER;
      expect(getScoreEntryUrl("77956", "  CustomUser  ")).toBe(
        "https://www.iscored.info/?mode=public&user=CustomUser&game=77956"
      );
    });

    it("returns null if no user is configured and none passed", () => {
      delete process.env.ISCORED_USER;
      expect(getScoreEntryUrl("77956")).toBeNull();
    });
  });

  describe("getGameroomUrl", () => {
    it("builds the gameroom URL from env", () => {
      process.env.ISCORED_USER = "Apcscore";
      expect(getGameroomUrl()).toBe("https://www.iscored.info/Apcscore");
    });

    it("uses explicitly passed user override", () => {
      delete process.env.ISCORED_USER;
      expect(getGameroomUrl("CustomGameroom")).toBe(
        "https://www.iscored.info/CustomGameroom"
      );
    });

    it("returns null if explicit user is whitespace-only", () => {
      delete process.env.ISCORED_USER;
      expect(getGameroomUrl("   ")).toBeNull();
    });

    it("trims explicitly passed user override", () => {
      delete process.env.ISCORED_USER;
      expect(getGameroomUrl("  CustomUser  ")).toBe(
        "https://www.iscored.info/CustomUser"
      );
    });

    it("returns null if no user is configured and none passed", () => {
      delete process.env.ISCORED_USER;
      expect(getGameroomUrl()).toBeNull();
    });
  });

  describe("getGameUrl", () => {
    it("builds the correct public gameroom scrollTo game link from env", () => {
      process.env.ISCORED_USER = "Apcscore";
      expect(getGameUrl("77956")).toBe(
        "https://www.iscored.info/Apcscore?scrollTo=77956"
      );
    });

    it("uses explicitly passed user override", () => {
      delete process.env.ISCORED_USER;
      expect(getGameUrl("104656", "OtherUser")).toBe(
        "https://www.iscored.info/OtherUser?scrollTo=104656"
      );
    });

    it("URL-encodes user and game ID components", () => {
      expect(getGameUrl("game#1 / special", "User & Co")).toBe(
        "https://www.iscored.info/User%20%26%20Co?scrollTo=game%231%20%2F%20special"
      );
    });

    it("returns null if gameId is empty or whitespace", () => {
      process.env.ISCORED_USER = "Apcscore";
      expect(getGameUrl("")).toBeNull();
      expect(getGameUrl("   ")).toBeNull();
    });

    it("returns null if explicit user is whitespace-only", () => {
      delete process.env.ISCORED_USER;
      expect(getGameUrl("77956", "   ")).toBeNull();
    });

    it("trims explicitly passed user override", () => {
      delete process.env.ISCORED_USER;
      expect(getGameUrl("77956", "  CustomUser  ")).toBe(
        "https://www.iscored.info/CustomUser?scrollTo=77956"
      );
    });

    it("returns null if no user is configured and none passed", () => {
      delete process.env.ISCORED_USER;
      expect(getGameUrl("77956")).toBeNull();
    });
  });
});

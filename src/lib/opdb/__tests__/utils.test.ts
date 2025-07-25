import { describe, it, expect } from "vitest";

import {
  parseOPDBId,
  isValidOPDBId,
  generateCacheKey,
  getGroupIdFromOPDBId,
} from "../utils";

describe("OPDB Utils", () => {
  describe("parseOPDBId", () => {
    it("should parse valid Group ID only", () => {
      const result = parseOPDBId("G43W4");
      expect(result).toEqual({
        groupId: "43W4",
        machineId: undefined,
        aliasId: undefined,
      });
    });

    it("should parse Group ID with Machine ID", () => {
      const result = parseOPDBId("G43W4-MrRpw");
      expect(result).toEqual({
        groupId: "43W4",
        machineId: "rRpw",
        aliasId: undefined,
      });
    });

    it("should parse full ID with Group, Machine, and Alias", () => {
      const result = parseOPDBId("G43W4-MrRpw-A1B7O");
      expect(result).toEqual({
        groupId: "43W4",
        machineId: "rRpw",
        aliasId: "1B7O",
      });
    });

    it("should return null for invalid format", () => {
      const invalidIds = [
        "invalid-id",
        "43W4",
        "G",
        "",
        "G43W4-MrRpw-A1B7O-extra",
      ];

      invalidIds.forEach((id) => {
        expect(parseOPDBId(id)).toBeNull();
      });
    });

    it("should handle edge cases", () => {
      expect(parseOPDBId("G1")).toEqual({
        groupId: "1",
        machineId: undefined,
        aliasId: undefined,
      });

      expect(parseOPDBId("G1-M2")).toEqual({
        groupId: "1",
        machineId: "2",
        aliasId: undefined,
      });

      expect(parseOPDBId("G1-M2-A3")).toEqual({
        groupId: "1",
        machineId: "2",
        aliasId: "3",
      });
    });
  });

  describe("isValidOPDBId", () => {
    it("should return true for valid OPDB IDs", () => {
      const validIds = [
        "G43W4",
        "G1",
        "G43W4-MrRpw",
        "G43W4-MrRpw-A1B7O",
        "G123-M456",
        "G123-M456-A789",
        "GaB3-McD4",
        "GaB3-McD4-AeF5",
      ];

      validIds.forEach((id) => {
        expect(isValidOPDBId(id)).toBe(true);
      });
    });

    it("should return false for invalid OPDB IDs", () => {
      const invalidIds = [
        "invalid-id",
        "43W4",
        "G",
        "",
        "G43W4-MrRpw-A1B7O-extra",
        "g43w4", // lowercase
      ];

      invalidIds.forEach((id) => {
        expect(isValidOPDBId(id)).toBe(false);
      });
    });
  });

  describe("generateCacheKey", () => {
    it("should generate consistent cache keys", () => {
      const key1 = generateCacheKey("search", { q: "medieval" });
      const key2 = generateCacheKey("search", { q: "medieval" });
      expect(key1).toBe(key2);
    });

    it("should generate different keys for different operations", () => {
      const searchKey = generateCacheKey("search", { q: "medieval" });
      const machineKey = generateCacheKey("machine", { id: "G43W4" });
      expect(searchKey).not.toBe(machineKey);
    });

    it("should generate different keys for different parameters", () => {
      const key1 = generateCacheKey("search", { q: "medieval" });
      const key2 = generateCacheKey("search", { q: "attack" });
      expect(key1).not.toBe(key2);
    });

    it("should handle complex parameters", () => {
      const key = generateCacheKey("export", {
        page: 1,
        perPage: 100,
        filter: "williams",
      });
      expect(key).toContain("export");
      expect(key).toContain("page");
      expect(key).toContain("perPage");
      expect(key).toContain("filter");
    });

    it("should handle empty parameters", () => {
      const key = generateCacheKey("test", {});
      expect(key).toContain("test");
    });
  });

  describe("getGroupIdFromOPDBId", () => {
    it("should extract group ID from full OPDB ID", () => {
      expect(getGroupIdFromOPDBId("G43W4")).toBe("43W4");
      expect(getGroupIdFromOPDBId("G43W4-MrRpw")).toBe("43W4");
      expect(getGroupIdFromOPDBId("G43W4-MrRpw-A1B7O")).toBe("43W4");
    });

    it("should return null for invalid OPDB ID", () => {
      expect(getGroupIdFromOPDBId("invalid-id")).toBeNull();
      expect(getGroupIdFromOPDBId("")).toBeNull();
      expect(getGroupIdFromOPDBId("43W4")).toBeNull();
    });

    it("should handle edge cases", () => {
      expect(getGroupIdFromOPDBId("G1")).toBe("1");
      expect(getGroupIdFromOPDBId("G1-M2-A3")).toBe("1");
    });
  });
});

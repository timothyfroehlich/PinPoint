import { describe, it, expect } from "vitest";

import {
  type IssueFilters,
  getDefaultFilters,
  mergeFilters,
  validateFilters,
  hasActiveFilters,
  clearAllFilters,
  getFilterSummary,
} from "../filterUtils";

describe("filterUtils", () => {
  describe("getDefaultFilters", () => {
    it("returns correct default filter values", () => {
      const defaults = getDefaultFilters();
      
      expect(defaults).toEqual({
        sortBy: "created",
        sortOrder: "desc",
      });
    });
  });

  describe("mergeFilters", () => {
    const baseFilters = getDefaultFilters();

    it("merges locationId correctly", () => {
      const result = mergeFilters(baseFilters, { locationId: "loc-1" });
      
      expect(result).toEqual({
        sortBy: "created",
        sortOrder: "desc",
        locationId: "loc-1",
      });
    });

    it("merges machineId correctly", () => {
      const result = mergeFilters(baseFilters, { machineId: "machine-1" });
      
      expect(result).toEqual({
        sortBy: "created",
        sortOrder: "desc",
        machineId: "machine-1",
      });
    });

    it("merges statusIds array correctly", () => {
      const result = mergeFilters(baseFilters, { statusIds: ["status-1", "status-2"] });
      
      expect(result).toEqual({
        sortBy: "created",
        sortOrder: "desc",
        statusIds: ["status-1", "status-2"],
      });
    });

    it("merges search term correctly", () => {
      const result = mergeFilters(baseFilters, { search: "broken button" });
      
      expect(result).toEqual({
        sortBy: "created",
        sortOrder: "desc",
        search: "broken button",
      });
    });

    it("merges multiple filters correctly", () => {
      const result = mergeFilters(baseFilters, {
        locationId: "loc-1",
        machineId: "machine-1",
        statusIds: ["status-1"],
        search: "test",
        sortBy: "updated",
        sortOrder: "asc",
      });
      
      expect(result).toEqual({
        locationId: "loc-1",
        machineId: "machine-1",
        statusIds: ["status-1"],
        search: "test",
        sortBy: "updated",
        sortOrder: "asc",
      });
    });

    it("overwrites existing filter values", () => {
      const existingFilters: IssueFilters = {
        locationId: "old-location",
        sortBy: "created",
        sortOrder: "desc",
      };
      
      const result = mergeFilters(existingFilters, { locationId: "new-location" });
      
      expect(result.locationId).toBe("new-location");
    });

    it("clears filter when undefined is provided", () => {
      const existingFilters: IssueFilters = {
        locationId: "loc-1",
        sortBy: "created",
        sortOrder: "desc",
      };
      
      const result = mergeFilters(existingFilters, { locationId: undefined });
      
      expect(result.locationId).toBeUndefined();
    });

    it("handles complex filter combinations", () => {
      const existingFilters: IssueFilters = {
        locationId: "loc-1",
        statusIds: ["status-1"],
        sortBy: "created",
        sortOrder: "desc",
      };
      
      const result = mergeFilters(existingFilters, {
        locationId: undefined, // Clear location
        machineId: "machine-1", // Add machine
        statusIds: ["status-2", "status-3"], // Replace statuses
        search: "new search", // Add search
      });
      
      expect(result).toEqual({
        locationId: undefined,
        machineId: "machine-1",
        statusIds: ["status-2", "status-3"],
        search: "new search",
        sortBy: "created",
        sortOrder: "desc",
      });
    });
  });

  describe("validateFilters", () => {
    it("validates and provides defaults for empty object", () => {
      const result = validateFilters({});
      
      expect(result).toEqual({
        locationId: undefined,
        machineId: undefined,
        statusIds: undefined,
        search: undefined,
        assigneeId: undefined,
        reporterId: undefined,
        ownerId: undefined,
        sortBy: "created",
        sortOrder: "desc",
      });
    });

    it("validates and sanitizes search string", () => {
      const result = validateFilters({ search: "  test search  " });
      
      expect(result.search).toBe("test search");
    });

    it("removes empty search string", () => {
      const result = validateFilters({ search: "   " });
      
      expect(result.search).toBeUndefined();
    });

    it("validates statusIds array", () => {
      const result = validateFilters({ statusIds: ["status-1", "status-2"] });
      
      expect(result.statusIds).toEqual(["status-1", "status-2"]);
    });

    it("rejects invalid statusIds", () => {
      const result = validateFilters({ statusIds: "not-an-array" as any });
      
      expect(result.statusIds).toBeUndefined();
    });

    it("validates sortBy field", () => {
      const result = validateFilters({ sortBy: "updated" });
      
      expect(result.sortBy).toBe("updated");
    });

    it("rejects invalid sortBy and uses default", () => {
      const result = validateFilters({ sortBy: "invalid-sort" as any });
      
      expect(result.sortBy).toBe("created");
    });

    it("validates sortOrder field", () => {
      const result = validateFilters({ sortOrder: "asc" });
      
      expect(result.sortOrder).toBe("asc");
    });

    it("rejects invalid sortOrder and uses default", () => {
      const result = validateFilters({ sortOrder: "invalid-order" as any });
      
      expect(result.sortOrder).toBe("desc");
    });
  });

  describe("hasActiveFilters", () => {
    it("returns false for default filters", () => {
      const filters = getDefaultFilters();
      
      expect(hasActiveFilters(filters)).toBe(false);
    });

    it("returns true when locationId is set", () => {
      const filters = { ...getDefaultFilters(), locationId: "loc-1" };
      
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it("returns true when machineId is set", () => {
      const filters = { ...getDefaultFilters(), machineId: "machine-1" };
      
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it("returns true when statusIds has values", () => {
      const filters = { ...getDefaultFilters(), statusIds: ["status-1"] };
      
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it("returns false when statusIds is empty array", () => {
      const filters = { ...getDefaultFilters(), statusIds: [] };
      
      expect(hasActiveFilters(filters)).toBe(false);
    });

    it("returns true when search is set", () => {
      const filters = { ...getDefaultFilters(), search: "test" };
      
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it("returns true when assigneeId is set", () => {
      const filters = { ...getDefaultFilters(), assigneeId: "user-1" };
      
      expect(hasActiveFilters(filters)).toBe(true);
    });
  });

  describe("clearAllFilters", () => {
    it("returns default filters", () => {
      const result = clearAllFilters();
      
      expect(result).toEqual(getDefaultFilters());
    });
  });

  describe("getFilterSummary", () => {
    it("returns empty array for default filters", () => {
      const filters = getDefaultFilters();
      
      expect(getFilterSummary(filters)).toEqual([]);
    });

    it("includes location in summary", () => {
      const filters = { ...getDefaultFilters(), locationId: "loc-1" };
      
      expect(getFilterSummary(filters)).toContain("Location");
    });

    it("includes machine in summary", () => {
      const filters = { ...getDefaultFilters(), machineId: "machine-1" };
      
      expect(getFilterSummary(filters)).toContain("Machine");
    });

    it("includes status count in summary", () => {
      const filters = { ...getDefaultFilters(), statusIds: ["status-1", "status-2"] };
      
      expect(getFilterSummary(filters)).toContain("Status (2)");
    });

    it("includes search in summary", () => {
      const filters = { ...getDefaultFilters(), search: "test" };
      
      expect(getFilterSummary(filters)).toContain("Search");
    });

    it("includes multiple filters in summary", () => {
      const filters = {
        ...getDefaultFilters(),
        locationId: "loc-1",
        search: "test",
        statusIds: ["status-1"],
      };
      
      const summary = getFilterSummary(filters);
      
      expect(summary).toContain("Location");
      expect(summary).toContain("Search");
      expect(summary).toContain("Status (1)");
      expect(summary).toHaveLength(3);
    });
  });
});
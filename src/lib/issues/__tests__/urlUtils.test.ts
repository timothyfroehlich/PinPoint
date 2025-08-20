import { describe, it, expect } from "vitest";

import {
  filtersToUrlParams,
  urlParamsToFilters,
  createFilteredUrl,
  hasValidFilterParams,
  sanitizeUrlParams,
  urlParamsEqual,
} from "../urlUtils";
import { getDefaultFilters } from "../filterUtils";

describe("urlUtils", () => {
  describe("filtersToUrlParams", () => {
    it("converts basic filters to URL params", () => {
      const filters = {
        ...getDefaultFilters(),
        locationId: "loc-1",
        search: "broken button",
      };
      
      const params = filtersToUrlParams(filters);
      
      expect(params.get("locationId")).toBe("loc-1");
      expect(params.get("search")).toBe("broken button");
      expect(params.get("sortBy")).toBe("created");
      expect(params.get("sortOrder")).toBe("desc");
    });

    it("handles array parameters correctly", () => {
      const filters = {
        ...getDefaultFilters(),
        statusIds: ["status-1", "status-2", "status-3"],
      };
      
      const params = filtersToUrlParams(filters);
      
      expect(params.getAll("statusIds")).toEqual(["status-1", "status-2", "status-3"]);
    });

    it("skips undefined and empty values", () => {
      const filters = {
        ...getDefaultFilters(),
        locationId: undefined,
        search: "",
        machineId: "machine-1",
      };
      
      const params = filtersToUrlParams(filters);
      
      expect(params.has("locationId")).toBe(false);
      expect(params.has("search")).toBe(false);
      expect(params.get("machineId")).toBe("machine-1");
    });

    it("skips empty arrays", () => {
      const filters = {
        ...getDefaultFilters(),
        statusIds: [],
      };
      
      const params = filtersToUrlParams(filters);
      
      expect(params.has("statusIds")).toBe(false);
    });

    it("handles all filter types", () => {
      const filters = {
        locationId: "loc-1",
        machineId: "machine-1",
        statusIds: ["status-1", "status-2"],
        search: "test search",
        assigneeId: "user-1",
        reporterId: "user-2",
        ownerId: "user-3",
        sortBy: "updated" as const,
        sortOrder: "asc" as const,
      };
      
      const params = filtersToUrlParams(filters);
      
      expect(params.get("locationId")).toBe("loc-1");
      expect(params.get("machineId")).toBe("machine-1");
      expect(params.getAll("statusIds")).toEqual(["status-1", "status-2"]);
      expect(params.get("search")).toBe("test search");
      expect(params.get("assigneeId")).toBe("user-1");
      expect(params.get("reporterId")).toBe("user-2");
      expect(params.get("ownerId")).toBe("user-3");
      expect(params.get("sortBy")).toBe("updated");
      expect(params.get("sortOrder")).toBe("asc");
    });
  });

  describe("urlParamsToFilters", () => {
    it("converts basic URL params to filters", () => {
      const params = new URLSearchParams({
        locationId: "loc-1",
        search: "broken button",
        sortBy: "updated",
        sortOrder: "asc",
      });
      
      const filters = urlParamsToFilters(params);
      
      expect(filters).toEqual({
        locationId: "loc-1",
        search: "broken button",
        sortBy: "updated",
        sortOrder: "asc",
      });
    });

    it("handles array parameters correctly", () => {
      const params = new URLSearchParams();
      params.append("statusIds", "status-1");
      params.append("statusIds", "status-2");
      params.append("statusIds", "status-3");
      
      const filters = urlParamsToFilters(params);
      
      expect(filters.statusIds).toEqual(["status-1", "status-2", "status-3"]);
    });

    it("validates sort parameters", () => {
      const params = new URLSearchParams({
        sortBy: "invalid-sort",
        sortOrder: "invalid-order",
      });
      
      const filters = urlParamsToFilters(params);
      
      expect(filters.sortBy).toBeUndefined();
      expect(filters.sortOrder).toBeUndefined();
    });

    it("handles valid sort parameters", () => {
      const params = new URLSearchParams({
        sortBy: "severity",
        sortOrder: "asc",
      });
      
      const filters = urlParamsToFilters(params);
      
      expect(filters.sortBy).toBe("severity");
      expect(filters.sortOrder).toBe("asc");
    });

    it("skips missing parameters", () => {
      const params = new URLSearchParams({
        locationId: "loc-1",
      });
      
      const filters = urlParamsToFilters(params);
      
      expect(filters).toEqual({
        locationId: "loc-1",
      });
      expect(filters.machineId).toBeUndefined();
      expect(filters.search).toBeUndefined();
    });

    it("handles all parameter types", () => {
      const params = new URLSearchParams({
        locationId: "loc-1",
        machineId: "machine-1",
        search: "test search",
        assigneeId: "user-1",
        reporterId: "user-2",
        ownerId: "user-3",
        sortBy: "game",
        sortOrder: "desc",
      });
      params.append("statusIds", "status-1");
      params.append("statusIds", "status-2");
      
      const filters = urlParamsToFilters(params);
      
      expect(filters).toEqual({
        locationId: "loc-1",
        machineId: "machine-1",
        statusIds: ["status-1", "status-2"],
        search: "test search",
        assigneeId: "user-1",
        reporterId: "user-2",
        ownerId: "user-3",
        sortBy: "game",
        sortOrder: "desc",
      });
    });
  });

  describe("createFilteredUrl", () => {
    it("creates URL with query parameters", () => {
      const filters = {
        ...getDefaultFilters(),
        locationId: "loc-1",
        search: "test",
      };
      
      const url = createFilteredUrl("/issues", filters);
      
      expect(url).toContain("/issues?");
      expect(url).toContain("locationId=loc-1");
      expect(url).toContain("search=test");
    });

    it("returns base path when no active filters", () => {
      const filters = {
        sortBy: "created" as const,
        sortOrder: "desc" as const,
      };
      
      const url = createFilteredUrl("/issues", filters);
      
      expect(url).toBe("/issues");
    });

    it("encodes special characters in URL", () => {
      const filters = {
        ...getDefaultFilters(),
        search: "broken & damaged",
      };
      
      const url = createFilteredUrl("/issues", filters);
      
      expect(url).toContain("search=broken+%26+damaged");
    });
  });

  describe("hasValidFilterParams", () => {
    it("returns true for valid filter parameters", () => {
      const params = new URLSearchParams({
        locationId: "loc-1",
        search: "test",
      });
      
      expect(hasValidFilterParams(params)).toBe(true);
    });

    it("returns false for empty parameters", () => {
      const params = new URLSearchParams();
      
      expect(hasValidFilterParams(params)).toBe(false);
    });

    it("returns false for invalid parameters only", () => {
      const params = new URLSearchParams({
        invalidParam: "value",
        anotherInvalid: "test",
      });
      
      expect(hasValidFilterParams(params)).toBe(false);
    });

    it("returns true when mixed valid and invalid parameters", () => {
      const params = new URLSearchParams({
        locationId: "loc-1",
        invalidParam: "value",
      });
      
      expect(hasValidFilterParams(params)).toBe(true);
    });
  });

  describe("sanitizeUrlParams", () => {
    it("keeps valid filter parameters", () => {
      const params = new URLSearchParams({
        locationId: "loc-1",
        search: "test",
        sortBy: "created",
      });
      
      const sanitized = sanitizeUrlParams(params);
      
      expect(sanitized.get("locationId")).toBe("loc-1");
      expect(sanitized.get("search")).toBe("test");
      expect(sanitized.get("sortBy")).toBe("created");
    });

    it("removes invalid parameters", () => {
      const params = new URLSearchParams({
        locationId: "loc-1",
        invalidParam: "value",
        anotherInvalid: "test",
      });
      
      const sanitized = sanitizeUrlParams(params);
      
      expect(sanitized.get("locationId")).toBe("loc-1");
      expect(sanitized.has("invalidParam")).toBe(false);
      expect(sanitized.has("anotherInvalid")).toBe(false);
    });

    it("trims whitespace from values", () => {
      const params = new URLSearchParams({
        search: "  test search  ",
        locationId: " loc-1 ",
      });
      
      const sanitized = sanitizeUrlParams(params);
      
      expect(sanitized.get("search")).toBe("test search");
      expect(sanitized.get("locationId")).toBe("loc-1");
    });

    it("removes empty values", () => {
      const params = new URLSearchParams({
        locationId: "loc-1",
        search: "   ",
        machineId: "",
      });
      
      const sanitized = sanitizeUrlParams(params);
      
      expect(sanitized.get("locationId")).toBe("loc-1");
      expect(sanitized.has("search")).toBe(false);
      expect(sanitized.has("machineId")).toBe(false);
    });
  });

  describe("urlParamsEqual", () => {
    it("returns true for identical parameters", () => {
      const params1 = new URLSearchParams({ locationId: "loc-1", search: "test" });
      const params2 = new URLSearchParams({ locationId: "loc-1", search: "test" });
      
      expect(urlParamsEqual(params1, params2)).toBe(true);
    });

    it("returns true for parameters in different order", () => {
      const params1 = new URLSearchParams({ locationId: "loc-1", search: "test" });
      const params2 = new URLSearchParams({ search: "test", locationId: "loc-1" });
      
      expect(urlParamsEqual(params1, params2)).toBe(true);
    });

    it("returns false for different values", () => {
      const params1 = new URLSearchParams({ locationId: "loc-1", search: "test" });
      const params2 = new URLSearchParams({ locationId: "loc-2", search: "test" });
      
      expect(urlParamsEqual(params1, params2)).toBe(false);
    });

    it("returns false for different parameters", () => {
      const params1 = new URLSearchParams({ locationId: "loc-1" });
      const params2 = new URLSearchParams({ machineId: "machine-1" });
      
      expect(urlParamsEqual(params1, params2)).toBe(false);
    });

    it("handles empty parameters", () => {
      const params1 = new URLSearchParams();
      const params2 = new URLSearchParams();
      
      expect(urlParamsEqual(params1, params2)).toBe(true);
    });
  });

  describe("round-trip conversion", () => {
    it("maintains filter data through URL conversion", () => {
      const originalFilters = {
        locationId: "loc-1",
        machineId: "machine-1",
        statusIds: ["status-1", "status-2"],
        search: "test search",
        assigneeId: "user-1",
        sortBy: "updated" as const,
        sortOrder: "asc" as const,
      };
      
      // Convert to URL params and back
      const urlParams = filtersToUrlParams(originalFilters);
      const convertedFilters = urlParamsToFilters(urlParams);
      
      expect(convertedFilters).toEqual(originalFilters);
    });
  });
});
import { describe, it, expect } from "vitest";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

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
        locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
        search: "broken button",
      };

      const params = filtersToUrlParams(filters);

      expect(params.get("locationId")).toBe(SEED_TEST_IDS.MOCK_PATTERNS.LOCATION);
      expect(params.get("search")).toBe("broken button");
      expect(params.get("sortBy")).toBe("created");
      expect(params.get("sortOrder")).toBe("desc");
    });

    it("handles array parameters correctly", () => {
      const filters = {
        ...getDefaultFilters(),
        statusIds: ["mock-status-1", "mock-status-2", "mock-status-3"],
      };

      const params = filtersToUrlParams(filters);

      expect(params.getAll("statusIds")).toEqual(["mock-status-1", "mock-status-2", "mock-status-3"]);
    });

    it("skips undefined and empty values", () => {
      const filters = {
        ...getDefaultFilters(),
        locationId: undefined,
        search: "",
        machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
      };

      const params = filtersToUrlParams(filters);

      expect(params.has("locationId")).toBe(false);
      expect(params.has("search")).toBe(false);
      expect(params.get("machineId")).toBe(SEED_TEST_IDS.MOCK_PATTERNS.MACHINE);
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
        locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
        machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
        statusIds: ["mock-status-1", "mock-status-2"],
        search: "test search",
        assigneeId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        reporterId: "mock-user-2",
        ownerId: "mock-user-3",
        sortBy: "updated" as const,
        sortOrder: "asc" as const,
      };

      const params = filtersToUrlParams(filters);

      expect(params.get("locationId")).toBe(SEED_TEST_IDS.MOCK_PATTERNS.LOCATION);
      expect(params.get("machineId")).toBe(SEED_TEST_IDS.MOCK_PATTERNS.MACHINE);
      expect(params.getAll("statusIds")).toEqual(["mock-status-1", "mock-status-2"]);
      expect(params.get("search")).toBe("test search");
      expect(params.get("assigneeId")).toBe(SEED_TEST_IDS.MOCK_PATTERNS.USER);
      expect(params.get("reporterId")).toBe("mock-user-2");
      expect(params.get("ownerId")).toBe("mock-user-3");
      expect(params.get("sortBy")).toBe("updated");
      expect(params.get("sortOrder")).toBe("asc");
    });
  });

  describe("urlParamsToFilters", () => {
    it("converts basic URL params to filters", () => {
      const params = new URLSearchParams({
        locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
        search: "broken button",
        sortBy: "updated",
        sortOrder: "asc",
      });

      const filters = urlParamsToFilters(params);

      expect(filters).toEqual({
        locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
        search: "broken button",
        sortBy: "updated",
        sortOrder: "asc",
      });
    });

    it("handles array parameters correctly", () => {
      const params = new URLSearchParams();
      params.append("statusIds", "mock-status-1");
      params.append("statusIds", "mock-status-2");
      params.append("statusIds", "mock-status-3");

      const filters = urlParamsToFilters(params);

      expect(filters.statusIds).toEqual(["mock-status-1", "mock-status-2", "mock-status-3"]);
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
        locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
      });

      const filters = urlParamsToFilters(params);

      expect(filters).toEqual({
        locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
      });
      expect(filters.machineId).toBeUndefined();
      expect(filters.search).toBeUndefined();
    });

    it("handles all parameter types", () => {
      const params = new URLSearchParams({
        locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
        machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
        search: "test search",
        assigneeId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        reporterId: "mock-user-2",
        ownerId: "mock-user-3",
        sortBy: "game",
        sortOrder: "desc",
      });
      params.append("statusIds", "mock-status-1");
      params.append("statusIds", "mock-status-2");

      const filters = urlParamsToFilters(params);

      expect(filters).toEqual({
        locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
        machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
        statusIds: ["mock-status-1", "mock-status-2"],
        search: "test search",
        assigneeId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        reporterId: "mock-user-2",
        ownerId: "mock-user-3",
        sortBy: "game",
        sortOrder: "desc",
      });
    });
  });

  describe("createFilteredUrl", () => {
    it("creates URL with query parameters", () => {
      const filters = {
        ...getDefaultFilters(),
        locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
        search: "test",
      };

      const url = createFilteredUrl("/issues", filters);

      expect(url).toContain("/issues?");
      expect(url).toContain(`locationId=${SEED_TEST_IDS.MOCK_PATTERNS.LOCATION}`);
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
        locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
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
        locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
        invalidParam: "value",
      });

      expect(hasValidFilterParams(params)).toBe(true);
    });
  });

  describe("sanitizeUrlParams", () => {
    it("keeps valid filter parameters", () => {
      const params = new URLSearchParams({
        locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
        search: "test",
        sortBy: "created",
      });

      const sanitized = sanitizeUrlParams(params);

      expect(sanitized.get("locationId")).toBe(SEED_TEST_IDS.MOCK_PATTERNS.LOCATION);
      expect(sanitized.get("search")).toBe("test");
      expect(sanitized.get("sortBy")).toBe("created");
    });

    it("removes invalid parameters", () => {
      const params = new URLSearchParams({
        locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
        invalidParam: "value",
        anotherInvalid: "test",
      });

      const sanitized = sanitizeUrlParams(params);

      expect(sanitized.get("locationId")).toBe(SEED_TEST_IDS.MOCK_PATTERNS.LOCATION);
      expect(sanitized.has("invalidParam")).toBe(false);
      expect(sanitized.has("anotherInvalid")).toBe(false);
    });

    it("trims whitespace from values", () => {
      const params = new URLSearchParams({
        search: "  test search  ",
        locationId: ` ${SEED_TEST_IDS.MOCK_PATTERNS.LOCATION} `,
      });

      const sanitized = sanitizeUrlParams(params);

      expect(sanitized.get("search")).toBe("test search");
      expect(sanitized.get("locationId")).toBe(SEED_TEST_IDS.MOCK_PATTERNS.LOCATION);
    });

    it("removes empty values", () => {
      const params = new URLSearchParams({
        locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
        search: "   ",
        machineId: "",
      });

      const sanitized = sanitizeUrlParams(params);

      expect(sanitized.get("locationId")).toBe(SEED_TEST_IDS.MOCK_PATTERNS.LOCATION);
      expect(sanitized.has("search")).toBe(false);
      expect(sanitized.has("machineId")).toBe(false);
    });
  });

  describe("urlParamsEqual", () => {
    it("returns true for identical parameters", () => {
      const params1 = new URLSearchParams({ locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION, search: "test" });
      const params2 = new URLSearchParams({ locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION, search: "test" });

      expect(urlParamsEqual(params1, params2)).toBe(true);
    });

    it("returns true for parameters in different order", () => {
      const params1 = new URLSearchParams({ locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION, search: "test" });
      const params2 = new URLSearchParams({ search: "test", locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION });

      expect(urlParamsEqual(params1, params2)).toBe(true);
    });

    it("returns false for different values", () => {
      const params1 = new URLSearchParams({ locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION, search: "test" });
      const params2 = new URLSearchParams({ locationId: "loc-2", search: "test" });

      expect(urlParamsEqual(params1, params2)).toBe(false);
    });

    it("returns false for different parameters", () => {
      const params1 = new URLSearchParams({ locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION });
      const params2 = new URLSearchParams({ machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE });

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
        locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
        machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
        statusIds: ["mock-status-1", "mock-status-2"],
        search: "test search",
        assigneeId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
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

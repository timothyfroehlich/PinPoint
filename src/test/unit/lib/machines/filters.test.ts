import { describe, it, expect } from "vitest";
import {
  parseMachineFilters,
  hasActiveMachineFilters,
} from "~/lib/machines/filters";

describe("parseMachineFilters", () => {
  it("parses search query", () => {
    const params = new URLSearchParams("q=attack");
    const filters = parseMachineFilters(params);
    expect(filters.q).toBe("attack");
  });

  it("parses comma-separated status values", () => {
    const params = new URLSearchParams("status=operational,unplayable");
    const filters = parseMachineFilters(params);
    expect(filters.status).toEqual(["operational", "unplayable"]);
  });

  it("filters out invalid status values", () => {
    const params = new URLSearchParams(
      "status=operational,invalid_status,unplayable"
    );
    const filters = parseMachineFilters(params);
    expect(filters.status).toEqual(["operational", "unplayable"]);
  });

  it("parses owner ids", () => {
    const params = new URLSearchParams("owner=user-1,user-2");
    const filters = parseMachineFilters(params);
    expect(filters.owner).toEqual(["user-1", "user-2"]);
  });

  it("handles status=all", () => {
    const params = new URLSearchParams("status=all");
    const filters = parseMachineFilters(params);
    expect(filters.status).toEqual([]);
  });

  it("parses comma-separated presence values", () => {
    const params = new URLSearchParams("presence=on_the_floor,removed");
    const filters = parseMachineFilters(params);
    expect(filters.presence).toEqual(["on_the_floor", "removed"]);
  });

  it("filters out invalid presence values", () => {
    const params = new URLSearchParams(
      "presence=on_the_floor,invalid_presence,removed"
    );
    const filters = parseMachineFilters(params);
    expect(filters.presence).toEqual(["on_the_floor", "removed"]);
  });

  it("handles presence=all", () => {
    const params = new URLSearchParams("presence=all");
    const filters = parseMachineFilters(params);
    expect(filters.presence).toEqual([]);
  });

  it("handles valid sort parameter", () => {
    const params = new URLSearchParams("sort=issues_desc");
    const filters = parseMachineFilters(params);
    expect(filters.sort).toBe("issues_desc");
  });

  it("defaults invalid sort parameter to name_asc", () => {
    const params = new URLSearchParams("sort=invalid_sort");
    const filters = parseMachineFilters(params);
    expect(filters.sort).toBe("name_asc");
  });

  it("defaults missing sort parameter to name_asc", () => {
    const params = new URLSearchParams("");
    const filters = parseMachineFilters(params);
    expect(filters.sort).toBe("name_asc");
  });
});

describe("hasActiveMachineFilters", () => {
  it("returns true when q is present", () => {
    const params = new URLSearchParams("q=test");
    expect(hasActiveMachineFilters(params)).toBe(true);
  });

  it("returns true when status is present", () => {
    const params = new URLSearchParams("status=unplayable");
    expect(hasActiveMachineFilters(params)).toBe(true);
  });

  it("returns true when owner is present", () => {
    const params = new URLSearchParams("owner=user-1");
    expect(hasActiveMachineFilters(params)).toBe(true);
  });

  it("returns true when presence is present", () => {
    const params = new URLSearchParams("presence=removed");
    expect(hasActiveMachineFilters(params)).toBe(true);
  });

  it("returns false when only sort is present", () => {
    const params = new URLSearchParams("sort=name_desc");
    expect(hasActiveMachineFilters(params)).toBe(false);
  });

  it("returns false when no params are present", () => {
    const params = new URLSearchParams("");
    expect(hasActiveMachineFilters(params)).toBe(false);
  });
});
